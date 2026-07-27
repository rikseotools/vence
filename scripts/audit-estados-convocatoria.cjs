#!/usr/bin/env node
// scripts/audit-estados-convocatoria.cjs
//
// SEGUNDA AUDITORÍA INDEPENDIENTE — coherencia estado_proceso ↔ fechas.
//
// Complementa a las otras dos auditorías:
//   - audit:oposicion  → completitud/estructura (artefactos presentes)
//   - audit:epigrafe   → coherencia epígrafe ↔ topic_scope
//   - audit:estados    → ESTE: el estado_proceso no se contradice con las fechas
//
// Motivo (18/06/2026): el estado_proceso de muchas oposiciones lo fijan signals
// `llm_semantic` y nunca se re-verifica → deriva. Casos reales detectados:
//   - administrativo-baleares: inscripcion_abierta SIN convocatoria viva (falso).
//   - enfermero-osakidetza: inscripcion_abierta pero la inscripción cerró el 22-abr
//     y el examen era el 19-jun (debía ser pendiente_examen).
//   - bombero-huelva: inscripcion_abierta sin fecha de cierre (incompleto).
// Ninguna de las otras auditorías mira esto. Esta es determinista (solo fechas),
// no necesita el boletín, y sirve de gate de CI / cron (exit 1 = hay ❌).
//
// Fuente de datos: RDS (BD viva desde el cutover 04/07/2026) vía DATABASE_URL,
// leyendo de la VISTA `oposiciones_ssot` — el drop-in de `oposiciones` con los
// campos temporales resueltos desde la convocatoria vigente, que es EXACTAMENTE
// lo que ve el front. Agnóstico (RDS/Neon), NUNCA Supabase (congelado → stale).
//
// Uso: node scripts/audit-estados-convocatoria.cjs   (o npm run audit:estados)

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
// La lógica de detección vive en el núcleo puro compartido (una sola fuente para este CLI y
// para los dos barridos de salud, que son los que la publican en el badge). Ver el módulo.
const { detectarIncoherenciasEstado, abiertaPorFechas, catalogadaVisible, POST_EXAMEN, CATALOGADA_STALE_DAYS } = require('../lib/convocatoria/estadoCoherencia.cjs')

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('❌ DATABASE_URL no configurado (agnóstico: RDS/Neon; NO Supabase). Ver db/client.ts')
  process.exit(2)
}
const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} })
// Madrid, NO UTC: el front deriva "abierta hoy" en Europa/Madrid; auditar en UTC
// compararía con el día equivocado en madrugada. Espejo de todayMadrid() de
// lib/oposiciones/inscripcion.ts (fuente de verdad; aquí inline porque es .cjs).
const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })



async function main() {
  // Fechas a ::text para preservar 'YYYY-MM-DD' y evitar el footgun de pg con
  // DATE (Date JS interpretado como medianoche UTC → -1 día en Madrid). La lógica
  // de abajo usa .slice(0, 10) sobre strings, igual que antes.
  let ops
  try {
    ops = await sql`
      SELECT slug, is_active, coverage_level, estado_proceso,
             inscription_deadline::text     AS inscription_deadline,
             inscription_start::text        AS inscription_start,
             exam_date::text                AS exam_date,
             exam_date_approximate,
             seguimiento_url,
             seguimiento_last_checked::text AS seguimiento_last_checked
      FROM oposiciones_ssot`
  } catch (err) {
    console.error('ERROR leyendo oposiciones_ssot:', err.message)
    await sql.end({ timeout: 5 })
    process.exit(2)
  }

  const errs = [] // ❌ contradicciones claras
  const warns = [] // 🟡 sospechas / datos incompletos

  // La detección vive en el núcleo puro compartido: este CLI solo la FORMATEA. Así el informe
  // legible, el gate de CI y los hallazgos del badge no pueden divergir nunca (antes la lógica
  // estaba aquí dentro y era invisible para /admin/contenido).
  for (const o of ops) {
    const tag = `${o.slug}${o.is_active ? ' [PUBLICADA]' : ''}`
    for (const inc of detectarIncoherenciasEstado(o, HOY)) {
      (inc.severidad === 'error' ? errs : warns).push(`${tag} → ${inc.mensaje}`)
    }
  }

  console.log(`━━━ Auditoría estado_proceso ↔ fechas (hoy ${HOY}) — ${ops.length} oposiciones ━━━\n`)
  if (errs.length) {
    console.log(`❌ CONTRADICCIONES (${errs.length}):`)
    errs.forEach((m) => console.log('  ❌ ' + m))
    console.log('')
  }
  if (warns.length) {
    console.log(`🟡 SOSPECHAS / INCOMPLETOS (${warns.length}):`)
    warns.forEach((m) => console.log('  🟡 ' + m))
    console.log('')
  }
  console.log(`━━━ ${errs.length} ❌  /  ${warns.length} 🟡 ━━━`)
  if (!errs.length && !warns.length) console.log('✅ Estados coherentes con las fechas.')

  await sql.end({ timeout: 5 })
  process.exit(errs.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error('FALLO:', e.message)
  try { await sql.end({ timeout: 5 }) } catch {}
  process.exit(2)
})
