#!/usr/bin/env node
/**
 * Re-ancla preguntas a otro artículo (`questions.primary_article_id`) con las guardas de
 * `lib/contenido/reanclarGuardas.js`, en transacción y con informe de impacto.
 *
 * Uso:  node scripts/reanclar-preguntas.cjs <plan.json>            # DRY-RUN (por defecto)
 *       node scripts/reanclar-preguntas.cjs <plan.json> --apply
 *
 * POR QUÉ EXISTE (26/07/2026, T-139). Re-anclar es la remediación habitual del contenido
 * invisible por artículo inactivo escopado (finding `scope_phantom_article`), y se venía
 * haciendo con un script de usar y tirar por cada caso. El riesgo que eso deja suelto es
 * silencioso: **una pregunta se sirve en un tema si SU ARTÍCULO está en el `topic_scope`
 * de ese tema**, así que mover el ancla a un artículo escopado en otros temas no la
 * rescata — la cambia de sitio, y puede dejarla huérfana. Como además el artículo viejo
 * se queda sin preguntas, el detector se apaga y el informe canta victoria.
 *
 * Formato del plan (JSON):
 * {
 *   "motivo": "T-139 — cola de contenido invisible",
 *   "movimientos": [
 *     { "preguntas": ["<uuid>", "..."],            // o "todasDelArticulo": true
 *       "origenArticuloId": "<uuid>",
 *       "destinoArticuloId": "<uuid>",
 *       "porQue": "el fragmento es texto del art. 2, que está activo y en los mismos temas",
 *       "permitirPerdidaTemas": false,
 *       "motivoPerdida": null }
 *   ],
 *   "retirar": [ { "pregunta": "<uuid>", "reasonCode": "admin_duplicate_of",
 *                  "estadoDestino": "retired_duplicate", "porQue": "…" } ],
 *   "limpiarScope": [ { "lawShortName": "RD 1708/2011", "positionType": "…", "topicNumber": 17,
 *                       "quitar": ["2.2","3.4"] } ]
 * }
 *
 * GOTCHAS que este script ya respeta:
 *  · `questions.is_active` es GENERATED: jubilar una pregunta SOLO se puede por
 *    `transition_question_state(...)`. `p_changed_by` es **uuid**, no texto.
 *  · Cambiar `primary_article_id` dispara `reset_question_verification` (correcto: la
 *    verificación anterior se hizo contra otro artículo).
 *  · Los artículos se referencian por UUID, nunca por número + short_name: hay leyes
 *    distintas con el mismo `short_name` abreviado y el mismo número de artículo.
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const { evaluarReancla } = require(path.join(__dirname, '..', 'lib', 'contenido', 'reanclarGuardas'))

const PLAN = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!PLAN) {
  console.error('uso: node scripts/reanclar-preguntas.cjs <plan.json> [--apply]')
  process.exit(2)
}
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'))

const temasDe = async (c, articuloId) =>
  (
    await c.query(
      `SELECT DISTINCT t.position_type||'/T'||t.topic_number k
         FROM articles a
         JOIN topic_scope ts ON ts.law_id = a.law_id
                            AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
         JOIN topics t ON t.id = ts.topic_id AND t.is_active
        WHERE a.id = $1 ORDER BY 1`,
      [articuloId],
    )
  ).rows.map((r) => r.k)

const articulo = async (c, id) =>
  (
    await c.query(
      `SELECT a.id, a.article_number articulo, a.content contenido, a.is_active activo, l.short_name ley
         FROM articles a JOIN laws l ON l.id = a.law_id WHERE a.id = $1`,
      [id],
    )
  ).rows[0]

;(async () => {
  const c = new Client({
    connectionString: (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  console.log(`\n━━━ ${plan.motivo || path.basename(PLAN)} — ${APPLY ? 'APLICANDO' : 'DRY-RUN'}\n`)

  // ── 1. Evaluar TODOS los movimientos antes de escribir nada ───────────────────────
  // Se evalúa el plan entero primero a propósito: un plan a medio aplicar es peor que uno
  // no aplicado, porque deja la BD en un estado que nadie ha revisado.
  const listos = []
  let bloqueados = 0
  for (const m of plan.movimientos || []) {
    const o = await articulo(c, m.origenArticuloId)
    const d = await articulo(c, m.destinoArticuloId)
    if (!o) {
      console.log(`❌ artículo de origen inexistente: ${m.origenArticuloId}`)
      bloqueados++
      continue
    }
    const v = evaluarReancla({
      origen: o,
      destino: d || {},
      temasOrigen: await temasDe(c, m.origenArticuloId),
      temasDestino: d ? await temasDe(c, m.destinoArticuloId) : [],
      permitirPerdidaTemas: !!m.permitirPerdidaTemas,
      motivoPerdida: m.motivoPerdida,
    })
    const preguntas = m.todasDelArticulo
      ? (await c.query(`SELECT id FROM questions WHERE primary_article_id=$1 AND is_active`, [m.origenArticuloId])).rows.map((r) => r.id)
      : m.preguntas || []

    console.log(`${v.ok ? '✅' : '⛔'} ${o.ley} art. ${o.articulo} → ${d ? `${d.ley} art. ${d.articulo}` : '(destino inexistente)'}  · ${preguntas.length} pregunta(s)`)
    console.log(`     ${m.porQue}`)
    console.log(`     texto: ${v.relacion}${v.temasGanados.length ? ` · gana ${v.temasGanados.length} tema(s)` : ''}`)
    for (const a of v.avisos) console.log(`     ⚠️  ${a}`)
    for (const b of v.bloqueos) console.log(`     ⛔ ${b}`)
    if (!v.ok) { bloqueados++; continue }
    if (!preguntas.length) { console.log('     (sin preguntas que mover)'); continue }
    listos.push({ ...m, preguntas })
  }

  if (bloqueados) {
    console.log(`\n⛔ ${bloqueados} movimiento(s) bloqueado(s). No se aplica NADA: un plan a medias deja la BD en un estado que nadie ha revisado.`)
    await c.end()
    process.exit(1)
  }

  const totalPreg = listos.reduce((n, m) => n + m.preguntas.length, 0)
  console.log(`\n── resumen: ${listos.length} movimiento(s), ${totalPreg} pregunta(s) · ${(plan.retirar || []).length} a jubilar · ${(plan.limpiarScope || []).length} limpieza(s) de scope`)

  if (!APPLY) {
    console.log('\n(dry-run: no se ha escrito nada. Repite con --apply)')
    await c.end()
    return
  }

  // ── 2. Aplicar ────────────────────────────────────────────────────────────────────
  await c.query('BEGIN')
  try {
    let movidas = 0
    for (const m of listos) {
      const r = await c.query(`UPDATE questions SET primary_article_id=$1 WHERE id = ANY($2::uuid[]) AND is_active`, [m.destinoArticuloId, m.preguntas])
      movidas += r.rowCount
    }
    let jubiladas = 0
    for (const j of plan.retirar || []) {
      const st = (await c.query(`SELECT lifecycle_state FROM questions WHERE id=$1`, [j.pregunta])).rows[0]
      if (!st) throw new Error(`pregunta a jubilar inexistente: ${j.pregunta}`)
      await c.query(`SELECT public.transition_question_state($1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7)`, [
        j.pregunta,
        st.lifecycle_state,
        j.estadoDestino || 'retired_duplicate',
        j.reasonCode,
        null,
        null,
        j.porQue,
      ])
      jubiladas++
    }
    let limpiadas = 0
    for (const s of plan.limpiarScope || []) {
      const r = await c.query(
        `UPDATE topic_scope ts SET article_numbers = ARRAY(SELECT x FROM unnest(ts.article_numbers) x WHERE NOT (x = ANY($1::text[])))
           FROM topics t, laws l
          WHERE ts.topic_id = t.id AND ts.law_id = l.id AND t.is_active
            AND l.short_name = $2 AND t.position_type = $3 AND t.topic_number = $4
            AND ts.article_numbers IS NOT NULL AND ts.article_numbers && $1::text[]`,
        [s.quitar, s.lawShortName, s.positionType, s.topicNumber],
      )
      limpiadas += r.rowCount
      // Un 0 silencioso aquí engaña: parece que se limpió y no había nada que limpiar.
      // La causa habitual NO es que falte la fila, sino que ese tema escopa la LEY ENTERA
      // (`article_numbers IS NULL`), y entonces no hay lista de la que quitar el número —
      // el artículo inactivo sigue "en scope" por definición. Es inocuo mientras no tenga
      // preguntas, pero hay que saberlo en vez de suponer que quedó limpio.
      if (r.rowCount === 0) {
        const nulo = (
          await c.query(
            `SELECT count(*)::int n FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id AND t.is_active JOIN laws l ON l.id=ts.law_id
              WHERE l.short_name=$1 AND t.position_type=$2 AND t.topic_number=$3 AND ts.article_numbers IS NULL`,
            [s.lawShortName, s.positionType, s.topicNumber],
          )
        ).rows[0].n
        console.log(
          `   ℹ️  ${s.lawShortName} en ${s.positionType}/T${s.topicNumber}: 0 filas tocadas — ` +
            (nulo ? 'ese tema escopa la LEY ENTERA (article_numbers NULL), no hay lista que podar' : 'no se encontró la fila de scope: revisar ley/tema'),
        )
      }
    }
    await c.query('COMMIT')
    console.log(`\n✅ ${movidas} pregunta(s) re-ancladas · ${jubiladas} jubilada(s) · ${limpiadas} fila(s) de scope limpiada(s)`)
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  }

  console.log('\n🔄 refrescando la vista materializada de conteos…')
  await c.query('SELECT public.refresh_topic_question_summary()')
  console.log('   hecho.')
  console.log('\n👉 falta purgar la caché de prod (es POR INSTANCIA, repetir 15-20 veces):')
  console.log('   POST /api/admin/revalidate con los tags: test-counts, temario, teoria, questions')

  await c.end()
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
