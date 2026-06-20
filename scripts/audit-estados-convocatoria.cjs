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
// Uso: node scripts/audit-estados-convocatoria.cjs   (o npm run audit:estados)

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
// Madrid, NO UTC: el front deriva "abierta hoy" en Europa/Madrid; auditar en UTC
// compararía con el día equivocado en madrugada. Espejo de todayMadrid() de
// lib/oposiciones/inscripcion.ts (fuente de verdad; aquí inline porque es .cjs).
const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })

// estados "post-examen": no pueden tener examen en el futuro
const POST_EXAMEN = new Set(['examen_realizado', 'resultados', 'nombramientos'])

// Espejo de isInscripcionAbierta() de lib/oposiciones/inscripcion.ts (el front usa esa).
const abiertaPorFechas = (o) => {
  const start = o.inscription_start && o.inscription_start.slice(0, 10)
  const dl = o.inscription_deadline && o.inscription_deadline.slice(0, 10)
  return !!start && !!dl && start <= HOY && dl >= HOY
}

async function main() {
  const { data: ops, error } = await s
    .from('oposiciones')
    .select('slug, is_active, coverage_level, estado_proceso, inscription_deadline, inscription_start, exam_date, exam_date_approximate')
  if (error) {
    console.error('ERROR leyendo oposiciones:', error.message)
    process.exit(2)
  }

  const errs = [] // ❌ contradicciones claras
  const warns = [] // 🟡 sospechas / datos incompletos

  for (const o of ops) {
    const e = o.estado_proceso
    const dl = o.inscription_deadline
    const ex = o.exam_date
    const pub = o.is_active ? ' [PUBLICADA]' : ''
    const tag = `${o.slug}${pub}`

    if (!e) {
      warns.push(`${tag} → estado_proceso vacío`)
      continue
    }

    // 1. inscripcion_abierta: el plazo NO puede haber vencido ni faltar
    if (e === 'inscripcion_abierta') {
      if (!dl) warns.push(`${tag} → 'inscripcion_abierta' SIN fecha de cierre (incompleto/sospechoso de stale)`)
      else if (dl < HOY) errs.push(`${tag} → 'inscripcion_abierta' con plazo VENCIDO (${dl} < ${HOY}) → debe avanzar a inscripcion_cerrada/posterior`)
    }

    // 2. convocada: si ya pasó el plazo de inscripción, debió avanzar
    if (e === 'convocada' && dl && dl < HOY) {
      warns.push(`${tag} → 'convocada' pero el plazo de inscripción (${dl}) ya venció → ¿inscripcion_cerrada?`)
    }

    // 3. inscripcion_cerrada: el plazo no debería estar aún en el futuro
    if (e === 'inscripcion_cerrada' && dl && dl > HOY) {
      warns.push(`${tag} → 'inscripcion_cerrada' pero el plazo (${dl}) aún no ha vencido (contradicción)`)
    }

    // 4. pendiente_examen: el examen no puede haber pasado; debería tener fecha
    if (e === 'pendiente_examen') {
      if (!ex) warns.push(`${tag} → 'pendiente_examen' SIN fecha de examen`)
      else if (ex < HOY && !o.exam_date_approximate) errs.push(`${tag} → 'pendiente_examen' con examen YA PASADO (${ex} < ${HOY}) → debe ser examen_realizado/resultados`)
    }

    // 5. estados post-examen con examen en el futuro = imposible
    if (POST_EXAMEN.has(e) && ex && ex > HOY) {
      errs.push(`${tag} → '${e}' pero el examen es FUTURO (${ex} > ${HOY}) → contradicción`)
    }

    // 6. coherencia start <= deadline
    if (o.inscription_start && dl && o.inscription_start > dl) {
      warns.push(`${tag} → inscription_start (${o.inscription_start}) posterior al deadline (${dl})`)
    }

    // 7. coherencia de FRONT (solo publicadas): home/SEO/banner filtran por FECHAS, no por
    // estado_proceso. Si divergen, el dato está mal en algún lado (incidente 20/06/2026).
    if (o.is_active) {
      const abierta = abiertaPorFechas(o)
      if (e === 'inscripcion_abierta' && !abierta) {
        const motivo = !o.inscription_start ? 'sin inscription_start'
          : !dl ? 'sin deadline' : `plazo vencido (${dl})`
        errs.push(`${tag} → estado 'inscripcion_abierta' pero NO abierta-por-fechas (${motivo}) → invisible en el front`)
      } else if (abierta && e !== 'inscripcion_abierta') {
        warns.push(`${tag} → abierta-por-fechas pero estado='${e}' → aparece en el front; reconciliar estado`)
      }
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

  process.exit(errs.length ? 1 : 0)
}

main().catch((e) => {
  console.error('FALLO:', e.message)
  process.exit(2)
})
