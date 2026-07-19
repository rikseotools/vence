#!/usr/bin/env node
// scripts/audit-law-completeness.cjs
//
// Audita la HONESTIDAD de verificación de las leyes contra su fuente oficial.
// Deriva el estado REAL de la evidencia (last_verification_summary) + si hay
// fuente, IGNORANDO el label verification_status (que puede mentir = "falso verde").
//
// Salidas:
//   node scripts/audit-law-completeness.cjs            # informe legible
//   node scripts/audit-law-completeness.cjs --json     # JSON (badge/CI)
//   node scripts/audit-law-completeness.cjs --gate      # exit 1 si hay leyes
//                                                        actionable sirviendo en
//                                                        temas VIVOS (apto CI/cron)
//
// Mirror inline de lib/laws/completeness.ts — MANTENER EN SYNC (self-contained
// para poder correr sin build TS). El test __tests__/lib/laws/completeness.test.ts
// fija las fixtures del criterio.
const fs = require('fs')
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres')

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const env = fs.readFileSync(require('path').join(__dirname, '..', '.env.local'), 'utf8')
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim()
}

// ── Mirror de classifyLawCompleteness (lib/laws/completeness.ts) ──
function classify({ isVirtual, boeUrl, verificationStatus, su }) {
  const hasSource = !!(boeUrl && String(boeUrl).trim())
  const status = (verificationStatus || '').toLowerCase()
  const claimsVerified = status === 'actualizada' || status === 'verificada'
  if (isVirtual === true) return { state: 'verified', hasSource, missingInDb: null, actionable: false }
  if (!su) {
    if (claimsVerified) return { state: 'false_green', hasSource, missingInDb: null, actionable: true }
    if (!hasSource) return { state: 'no_source', hasSource: false, missingInDb: null, actionable: true }
    return { state: 'never_verified', hasSource, missingInDb: null, actionable: true }
  }
  if (su.no_consolidated_text === true || su.historical === true || su.deliberate_subset === true)
    return { state: 'verified', hasSource, missingInDb: null, actionable: false }
  const boe = num(su.boe_count), db = num(su.db_count)
  const missing = num(su.missing_in_db) ?? (boe != null && db != null ? Math.max(0, boe - db) : null)
  const cm = num(su.content_mismatch) ?? 0, tm = num(su.title_mismatch) ?? 0
  if (missing != null && missing > 0) return { state: 'incomplete', hasSource, missingInDb: missing, actionable: true }
  if (cm > 0 || tm > 0) return { state: 'issues', hasSource, missingInDb: missing, actionable: true }
  return { state: 'verified', hasSource, missingInDb: missing ?? 0, actionable: false }
}
function num(x) { return typeof x === 'number' && Number.isFinite(x) ? x : null }

;(async () => {
  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })
  try {
    const laws = await s`
      SELECT l.id, l.short_name, l.scope, l.is_virtual, l.boe_url,
             l.verification_status, l.last_verification_summary,
             EXISTS (
               SELECT 1 FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
               WHERE ts.law_id = l.id AND t.disponible
             ) AS serving_live
      FROM laws l`

    const rows = laws.map((l) => ({
      ...l,
      ...classify({ isVirtual: l.is_virtual, boeUrl: l.boe_url, verificationStatus: l.verification_status, su: l.last_verification_summary }),
    }))

    const actionable = rows.filter((r) => r.actionable)
    const servingLive = actionable.filter((r) => r.serving_live)
    const byState = {}
    for (const r of actionable) byState[r.state] = (byState[r.state] || 0) + 1
    const byStateLive = {}
    for (const r of servingLive) byStateLive[r.state] = (byStateLive[r.state] || 0) + 1

    // CAPA 4 — Observabilidad: snapshot del barrido a observable_events (rastreable en el tiempo).
    if (!process.argv.includes('--no-emit')) {
      try {
        await s`INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
          VALUES (gen_random_uuid(), now(), 'fargate', ${servingLive.length > 0 ? 'warn' : 'info'},
                  'law_completeness_swept',
                  ${s.json({ total: rows.length, serving_live: servingLive.length, by_state: byStateLive })}, now())`
      } catch { /* observabilidad best-effort, nunca bloquea el audit */ }
    }

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({
        total: rows.length,
        actionable: actionable.length,
        servingLive: servingLive.length,
        byState,
      }))
      await s.end(); process.exit(process.argv.includes('--gate') && servingLive.length > 0 ? 1 : 0)
    }

    console.log(`\n=== Completitud de leyes vs fuente (${rows.length} leyes) ===`)
    console.log(`Actionable (estado real problemático): ${actionable.length}`)
    console.log(`  · sirviendo en temas VIVOS (impacto usuario): ${servingLive.length}`)
    console.log('  por estado:')
    for (const [st, n] of Object.entries(byState).sort((a, b) => b[1] - a[1]))
      console.log(`    ${st}: ${n}`)

    console.log('\n=== TOP 25 con impacto a usuarios (temas vivos) ===')
    for (const r of servingLive.slice(0, 25))
      console.log(`  [${r.state}${r.missingInDb ? ` faltan ${r.missingInDb}` : ''}] ${r.short_name} (${r.scope}) ${r.hasSource ? '' : '· SIN FUENTE'}`)

    if (process.argv.includes('--gate')) {
      await s.end()
      process.exit(servingLive.length > 0 ? 1 : 0)
    }
    await s.end()
  } catch (e) {
    console.error('ERROR:', e.message); await s.end(); process.exit(2)
  }
})()
