#!/usr/bin/env node
/**
 * Aplica las adjudicaciones de las divergencias de dual-write (legacy `oposiciones` ↔
 * convocatoria SSOT) que destapa `npm run audit:coherencia`.
 *
 * Uso:  node scripts/dual-write-adjudicar.cjs <plan.json>            # DRY-RUN
 *       node scripts/dual-write-adjudicar.cjs <plan.json> --apply
 *
 * Formato del plan:
 * {
 *   "motivo": "T-105 — estado_proceso de las publicadas",
 *   "decisiones": [
 *     { "slug": "…", "campo": "estado_proceso", "gana": "legacy" | "convocatoria",
 *       "porQue": "hito oficial registrado: …" }
 *   ]
 * }
 *
 * POR QUÉ ASÍ (26/07/2026, T-105). La divergencia es **bidireccional**: en la primera tanda
 * de 15 salió 7-7. A veces va por delante la convocatoria (rollover hecho: el ciclo viejo
 * quedó archivado y el vigente es la OEP nueva) y a veces la fila legacy (un hito oficial se
 * anotó ahí y no se propagó). **Copiar en bloque en cualquiera de los dos sentidos regresa
 * la mitad de las filas**, así que este script no decide nada: exige que la decisión y su
 * motivo vengan escritos, fila a fila.
 *
 * Orden de escritura: primero el SSOT (`convocatorias`) y después el legacy, igual que el
 * puente radar→SSOT de `lib/api/oep-signals/queries.ts`. Si algo falla a mitad, los lectores
 * —que van por la vista `oposiciones_ssot`— ya ven el dato bueno.
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const PLAN = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!PLAN) {
  console.error('uso: node scripts/dual-write-adjudicar.cjs <plan.json> [--apply]')
  process.exit(2)
}
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'))

// Lista blanca: son los campos SSOT que el detector compara. Cerrada a propósito — este
// script no es una puerta genérica para escribir en `oposiciones`/`convocatorias`.
const CAMPOS = new Set([
  'estado_proceso',
  'plazas_libres',
  'plazas_promocion_interna',
  'plazas_discapacidad',
  'inscription_start',
  'inscription_deadline',
  'exam_date',
])

;(async () => {
  const c = new Client({
    connectionString: (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()
  console.log(`\n━━━ ${plan.motivo || path.basename(PLAN)} — ${APPLY ? 'APLICANDO' : 'DRY-RUN'}\n`)

  const listas = []
  let bloqueados = 0
  for (const d of plan.decisiones || []) {
    if (!CAMPOS.has(d.campo)) {
      console.log(`⛔ ${d.slug}: campo no admitido «${d.campo}»`)
      bloqueados++
      continue
    }
    if (!String(d.porQue || '').trim()) {
      console.log(`⛔ ${d.slug} (${d.campo}): sin motivo escrito — la adjudicación tiene que dejar su evidencia`)
      bloqueados++
      continue
    }
    const r = (
      await c.query(
        `SELECT o.id oid, cv.id cvid, o.${d.campo}::text leg, cv.${d.campo}::text conv
           FROM oposiciones o JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current
          WHERE o.slug = $1`,
        [d.slug],
      )
    ).rows
    if (r.length !== 1) {
      console.log(`⛔ ${d.slug}: ${r.length} filas (¿slug mal, o sin convocatoria vigente?)`)
      bloqueados++
      continue
    }
    const f = r[0]
    if (f.leg === f.conv) {
      console.log(`⏭️  ${d.slug} (${d.campo}): ya coinciden (${f.leg}) — nada que hacer`)
      continue
    }
    const gana = d.gana === 'legacy' ? f.leg : f.conv
    const pierde = d.gana === 'legacy' ? 'convocatorias' : 'oposiciones'
    console.log(`✅ ${d.slug} · ${d.campo}: legacy=${f.leg} | conv=${f.conv} → gana ${d.gana.toUpperCase()} («${gana}»), se corrige ${pierde}`)
    console.log(`     ${d.porQue}`)
    listas.push({ ...d, ...f, valor: gana, tabla: pierde })
  }

  if (bloqueados) {
    console.log(`\n⛔ ${bloqueados} decisión(es) bloqueada(s). No se aplica NADA.`)
    await c.end()
    process.exit(1)
  }
  const haciaLegacy = listas.filter((x) => x.tabla === 'oposiciones').length
  console.log(`\n── ${listas.length} corrección(es): ${listas.length - haciaLegacy} sobre la convocatoria (SSOT) · ${haciaLegacy} sobre la legacy`)
  if (!APPLY) {
    console.log('\n(dry-run: no se ha escrito nada. Repite con --apply)')
    await c.end()
    return
  }

  await c.query('BEGIN')
  try {
    // SSOT primero (ver cabecera): los lectores van por la vista.
    for (const x of listas.filter((y) => y.tabla === 'convocatorias')) {
      await c.query(`UPDATE convocatorias SET ${x.campo} = $1, updated_at = now() WHERE id = $2`, [x.valor, x.cvid])
    }
    for (const x of listas.filter((y) => y.tabla === 'oposiciones')) {
      await c.query(`UPDATE oposiciones SET ${x.campo} = $1 WHERE id = $2`, [x.valor, x.oid])
    }
    // Verificación dentro de la transacción: si alguna sigue divergiendo, no se confirma.
    for (const x of listas) {
      const v = (
        await c.query(
          `SELECT o.${x.campo}::text leg, cv.${x.campo}::text conv FROM oposiciones o
             JOIN convocatorias cv ON cv.oposicion_id=o.id AND cv.is_current WHERE o.id=$1`,
          [x.oid],
        )
      ).rows[0]
      if (v.leg !== v.conv) throw new Error(`${x.slug} (${x.campo}) sigue divergiendo tras escribir: ${v.leg} ≠ ${v.conv}`)
    }
    await c.query('COMMIT')
    console.log(`\n✅ ${listas.length} divergencia(s) resueltas y verificadas`)
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  }
  console.log('\n👉 purga la caché de prod (tags temario/questions y las rutas de landing) si tocaste oposiciones publicadas.')
  await c.end()
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
