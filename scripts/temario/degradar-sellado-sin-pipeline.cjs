#!/usr/bin/env node
/**
 * Degrada a `never_verified` los temas cuyo Paso 2 se SELLÓ A MANO y que además **no tienen el
 * Paso 1** (epígrafe verificado literal contra su fuente). T-518.
 *
 * ## Por qué existe
 *
 * El 20-22/07/2026 se marcaron temas como `verified_correct` sin que el pipeline de dos agentes
 * llegara a correr: `verified_by='claude_direct'`, `agent_run_id='--run'` (el propio flag, mal
 * pasado) y la misma nota copiada tema a tema. Un `verified_correct` así **no es un veredicto,
 * es una firma sin respaldo**, y el badge de `/admin/contenido` lo contaba como verificado: 32
 * oposiciones aparecían comprobadas sin estarlo. Lo destapó una impugnación de temario que tenía
 * razón (62 preguntas fuera de programa en un tema «verificado»).
 *
 * ## Por qué solo los que NO tienen Paso 1 (decisión de Manuel, 06/08/2026)
 *
 * De los 881 sellados sin pipeline, **319 sí tienen el epígrafe verificado literal**: su Paso 2
 * no lo firmó el pipeline, pero al menos la fuente del temario está contrastada, así que
 * degradarlos añadiría ruido sin añadir información. Los **562 restantes no tienen ni una cosa
 * ni la otra** — ni pipeline ni fuente— y son los que el badge no puede seguir dando por buenos.
 * Degradar los 881 de golpe encendía el badge de 45 oposiciones a la vez, que es como se mata un
 * badge (mismo aprendizaje que `landing_cifra_sin_respaldo`).
 *
 * ## Qué hace exactamente
 *
 * - NO borra nada: `topic_scope` no se toca, las preguntas siguen sirviéndose igual. Lo único que
 *   cambia es el ESTADO DE VERIFICACIÓN, que vuelve a decir la verdad («nadie ha comprobado esto»).
 * - Deja rastro en `topic_scope_verification_history`, que es append-only, con `verified_by` propio
 *   para poder distinguir esta degradación de cualquier otra cosa.
 * - Dry-run por defecto. `--apply` escribe, en UNA transacción.
 * - **Aborta si el conjunto se sale de lo medido** (`--max`, por defecto 700): si un día esto
 *   quisiera degradar miles de temas, el que está roto es el criterio, no el banco.
 *
 * Uso:
 *   node scripts/temario/degradar-sellado-sin-pipeline.cjs            # simula
 *   node scripts/temario/degradar-sellado-sin-pipeline.cjs --apply
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { ESCRITORES_SIN_PIPELINE } = require('../../lib/temario/revisionEpigrafe.cjs')
// Es un Set (la fuente única lo usa para `has`); pg necesita un array para `= ANY($1)`.
const ESCRITORES = [...ESCRITORES_SIN_PIPELINE]

const APPLY = process.argv.includes('--apply')
const MAX = Number((process.argv.find((a) => a.startsWith('--max=')) || '--max=700').split('=')[1])
const FIRMA = 'degradacion-sellado-sin-pipeline-t518'

// El criterio de «sellado sin pipeline» NO se reescribe aquí: es el mismo que usa el badge
// (`lib/api/scope-verification/queries.ts`) y sale de la misma constante. Dos puertas al mismo
// hecho con criterios distintos no protegen, se contradicen.
const SELECT = `
  SELECT sv.topic_id, t.position_type, t.topic_number, sv.verified_by, sv.agent_run_id
    FROM topic_scope_verification sv
    JOIN topics t ON t.id = sv.topic_id AND t.is_active
    LEFT JOIN topic_epigrafe_verification_effective ev ON ev.topic_id = sv.topic_id
   WHERE sv.state = 'verified_correct'
     AND (sv.verified_by = ANY($1) OR btrim(coalesce(sv.agent_run_id,'')) = '' OR sv.agent_run_id LIKE '--%')
     AND coalesce(ev.effective_state, 'never_sourced') <> 'verified_literal'
   ORDER BY t.position_type, t.topic_number`

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  try {
    const { rows } = await c.query(SELECT, [ESCRITORES])
    const porOposicion = rows.reduce((a, r) => ((a[r.position_type] = (a[r.position_type] || 0) + 1), a), {})
    const oposiciones = Object.keys(porOposicion).length

    console.log(`\n${rows.length} tema(s) sellados a mano y SIN Paso 1, en ${oposiciones} oposición(es):\n`)
    Object.entries(porOposicion)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pt, n]) => console.log(`   ${String(n).padStart(4)}  ${pt}`))

    if (!rows.length) {
      console.log('\n✅ nada que degradar.\n')
      return
    }
    if (rows.length > MAX) {
      console.error(
        `\n❌ ABORTO: ${rows.length} supera el techo de ${MAX}. Un salto así no es deuda nueva,` +
          ` es un criterio roto. Míralo antes de escribir (o sube --max a sabiendas).\n`,
      )
      process.exitCode = 1
      return
    }

    if (!APPLY) {
      console.log(`\n(dry-run — nada escrito. Añade --apply)\n`)
      return
    }

    await c.query('BEGIN')
    // El historial PRIMERO: si algo falla, queda dicho qué se intentaba.
    await c.query(
      `INSERT INTO topic_scope_verification_history (topic_id, state, scope_hash, verdict, findings, agent_run_id, verified_by)
       SELECT sv.topic_id, 'never_verified', sv.verified_scope_hash, NULL,
              jsonb_build_object('motivo', 'sellado sin pipeline y sin Paso 1 (T-518)',
                                 'estado_anterior', sv.state,
                                 'verified_by_anterior', sv.verified_by,
                                 'agent_run_id_anterior', sv.agent_run_id),
              NULL, $2
         FROM topic_scope_verification sv WHERE sv.topic_id = ANY($1)`,
      [rows.map((r) => r.topic_id), FIRMA],
    )
    const upd = await c.query(
      `UPDATE topic_scope_verification
          SET state='never_verified', verdict=NULL, agent_run_id=NULL,
              verified_by=$2, verified_at=NULL, updated_at=now()
        WHERE topic_id = ANY($1)`,
      [rows.map((r) => r.topic_id), FIRMA],
    )
    await c.query('COMMIT')
    console.log(`\n✅ ${upd.rowCount} tema(s) degradados a never_verified (historial escrito).`)
    console.log(`   El scope NO se ha tocado: las preguntas se sirven igual. Lo que cambia es que`)
    console.log(`   el badge deja de dar por verificado lo que nadie verificó.\n`)
  } catch (e) {
    if (APPLY) await c.query('ROLLBACK').catch(() => {})
    console.error('ERR', e.message)
    process.exitCode = 1
  } finally {
    await c.end()
  }
})()
