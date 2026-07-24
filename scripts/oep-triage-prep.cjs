#!/usr/bin/env node
// scripts/oep-triage-prep.cjs
//
// CAPA 1 del triaje de señales OEP — PRE-PASE DETERMINISTA.
// Convierte el triaje manual (frase-gatillo "revisa señales oeps") en una tabla
// clasificada, para que ninguna sesión pierda un enriquecimiento por comparar la
// señal contra la fila EQUIVOCADA (caso raíz 24/07: Inspector PM Valladolid, ver
// scripts/lib/oep-triage-classify.cjs).
//
// Por cada señal pending:
//   1) RE-EMPAREJA por nombre contra TODAS las filas, ignorando el oposicion_id
//      guardado → si existe un hogar MEJOR (discriminador de cuerpo/turno) lo
//      marca MISMATCH (hay que re-enlazar antes de decidir nada).
//   2) Calcula el DELTA de campos comparables (estado/plazas/fechas) contra la
//      fila enlazada y clasifica: novel | mismatch | regression | duplicate |
//      enrichment.
// El humano solo adjudica novel/mismatch/enrichment; regression/duplicate son
// ruido auto-cerrable (este script NO cierra nada — solo informa).
//
// READ-ONLY y determinista (apto para CI/cron). Fuente: RDS vía DATABASE_URL.
// Uso:
//   node scripts/oep-triage-prep.cjs               # clasifica las pending
//   node scripts/oep-triage-prep.cjs --json        # salida JSON
//   node scripts/oep-triage-prep.cjs --recent-days 3   # re-audita lo ya revisado
//                                                       # (Capa 4: ¿algún dismiss mal?)

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const {
  findBetterHome,
  classifySignal,
  CATEGORIES,
  NEEDS_HUMAN,
} = require('./lib/oep-triage-classify.cjs')

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('❌ DATABASE_URL no configurado (RDS; NO Supabase congelado).')
  process.exit(2)
}
const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} })

const JSON_OUT = process.argv.includes('--json')
const recentIdx = process.argv.indexOf('--recent-days')
const RECENT_DAYS = recentIdx >= 0 ? parseInt(process.argv[recentIdx + 1], 10) || 7 : null

// año de la fila: de la ref de boletín o de la fecha de examen (heurístico, best-effort)
function bdYear(row) {
  const m = String(row.boe_reference || '').match(/20\d{2}/)
  if (m) return Number(m[0])
  if (row.exam_date) return Number(String(row.exam_date).slice(0, 4))
  return null
}

// identidad detectada por la señal: el nombre crudo o el cuerpoDetectado del JSON,
// enriquecido con la región si la trae (para que findBetterHome tenga entidad).
function detectedName(s) {
  const cuerpo =
    s.detected_oposicion_name ||
    (s.raw_extraction && s.raw_extraction.extraction && s.raw_extraction.extraction.cuerpoDetectado) ||
    ''
  const region = s.region_name || ''
  return `${cuerpo} ${region}`.trim()
}

async function main() {
  const rows = await sql`SELECT id, slug, nombre FROM oposiciones`
  const byId = new Map(rows.map((r) => [r.id, r]))

  const statusFilter = RECENT_DAYS
    ? sql`s.status IN ('dismissed','applied') AND s.reviewed_at > now() - (${RECENT_DAYS} || ' days')::interval`
    : sql`s.status = 'pending'`

  const signals = await sql`
    SELECT s.id, s.status, s.confidence_score, s.oposicion_id, s.detected_oposicion_name,
           s.region_name, s.raw_extraction, s.detected_estado, s.detected_plazas_libre,
           s.detected_fecha_examen::text AS det_exam, s.detected_fecha_inscripcion_fin::text AS det_inscfin,
           s.detected_year, s.signal_summary, s.admin_notes,
           o.slug AS bd_slug, o.estado_proceso AS bd_estado, o.plazas_libres AS bd_plazas,
           o.exam_date::text AS bd_exam, o.inscription_deadline::text AS bd_inscfin, o.boe_reference AS bd_boe
      FROM oep_detection_signals s LEFT JOIN oposiciones o ON o.id = s.oposicion_id
     WHERE ${statusFilter}
     ORDER BY s.confidence_score DESC, s.created_at DESC`

  const results = []
  for (const s of signals) {
    const bd = s.oposicion_id
      ? {
          slug: s.bd_slug,
          estado: s.bd_estado,
          plazas: s.bd_plazas,
          examDate: s.bd_exam,
          inscFin: s.bd_inscfin,
          year: bdYear({ boe_reference: s.bd_boe, exam_date: s.bd_exam }),
        }
      : null

    let betterHome = null
    if (bd) {
      const linked = byId.get(s.oposicion_id)
      const candidates = rows.filter((r) => r.id !== s.oposicion_id)
      betterHome = findBetterHome(detectedName(s), linked, candidates)
    }

    const detected = {
      estado: s.detected_estado,
      plazas: s.detected_plazas_libre,
      examDate: s.det_exam,
      inscFin: s.det_inscfin,
      year: s.detected_year,
    }
    const cls = classifySignal({ detected, bd, betterHome })
    results.push({
      id: s.id,
      status: s.status,
      score: s.confidence_score,
      fila: bd ? bd.slug : `[SIN FILA] ${detectedName(s)}`,
      category: cls.category,
      betterHome: betterHome ? betterHome.slug : null,
      reasons: cls.reasons,
      delta: cls.delta,
      summary: (s.signal_summary || '').replace(/\s+/g, ' ').slice(0, 160),
    })
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(results, null, 2))
    await sql.end()
    return
  }

  // ── Reporte agrupado ──
  const order = [CATEGORIES.MISMATCH, CATEGORIES.ENRICHMENT, CATEGORIES.NOVEL, CATEGORIES.REGRESSION, CATEGORIES.DUPLICATE]
  const ICON = {
    [CATEGORIES.MISMATCH]: '🔀 MIS-LINK (re-enlazar ANTES de decidir)',
    [CATEGORIES.ENRICHMENT]: '✳️  ENRIQUECIMIENTO (revisión humana)',
    [CATEGORIES.NOVEL]: '🆕 SIN FILA (catalogar/enlazar)',
    [CATEGORIES.REGRESSION]: '⤵️  REGRESIÓN (auto-descartable)',
    [CATEGORIES.DUPLICATE]: '♻️  DUPLICADO (auto-descartable)',
  }
  const scope = RECENT_DAYS ? `revisadas últimos ${RECENT_DAYS}d` : 'PENDING'
  console.log(`\n━━━ Triaje OEP · ${scope} · ${results.length} señal(es) ━━━`)
  for (const cat of order) {
    const grp = results.filter((r) => r.category === cat)
    if (!grp.length) continue
    console.log(`\n${ICON[cat]}  (${grp.length})`)
    for (const r of grp) {
      console.log(`  • [${r.score}] ${r.fila}`)
      if (r.betterHome) console.log(`      → mejor hogar: ${r.betterHome}`)
      if (r.reasons.length) console.log(`      ${r.reasons.join(' · ')}`)
      if (r.delta.length) console.log(`      delta: ${r.delta.map((d) => `${d.field} ${d.from}→${d.to}`).join(' | ')}`)
      // en modo --recent-days, avisar si un dismiss cae en categoría que exigía humano
      if (RECENT_DAYS && r.status === 'dismissed' && NEEDS_HUMAN.has(r.category)) {
        console.log(`      ⚠️ DISMISSED pero la Capa 1 la marca "${r.category}" — revisar si el descarte fue correcto`)
      }
    }
  }

  const human = results.filter((r) => NEEDS_HUMAN.has(r.category)).length
  const auto = results.length - human
  console.log(`\n━━━ ${human} requieren humano · ${auto} auto-descartables (ruido) ━━━`)
  if (!RECENT_DAYS && results.length === 0) console.log('✅ Sin señales pending.')
  await sql.end()
}

main().catch((e) => {
  console.error('❌ oep-triage-prep falló:', e.message)
  process.exit(2)
})
