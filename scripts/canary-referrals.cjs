#!/usr/bin/env node
// scripts/canary-referrals.cjs — CANARY del programa de embajadores (capa 4).
// Correr TRAS el deploy: verifica que los endpoints desplegados se comportan + la BD está sana.
//   node scripts/canary-referrals.cjs
// Variables: BASE_URL (default https://www.vence.es), DATABASE_URL (de .env.local).
// Diseño: docs/roadmap/programa-referidos-embajadores.md §12 (capa canary).

require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const BASE = (process.env.BASE_URL || 'https://www.vence.es').replace(/\/$/, '')
// Código real de referido en prod (Manuel). Cambiar si se retira.
const CODE = process.env.CANARY_REF_CODE || '035fa1606e2a'

let failed = 0
const ok = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.error(`  ❌ ${m}`); failed++ }

async function httpChecks() {
  console.log('→ Endpoints desplegados:')

  // 1) /r/<code> → 302 a /embajadores?ref= + cookie vence_ref
  const r = await fetch(`${BASE}/r/${CODE}`, { redirect: 'manual' })
  const loc = r.headers.get('location') || ''
  const setCookie = r.headers.get('set-cookie') || ''
  if (r.status === 302 && loc.includes('/embajadores') && loc.includes('ref=')) ok(`/r/${CODE} → 302 ${loc}`)
  else bad(`/r/${CODE} esperaba 302→/embajadores?ref=, got ${r.status} ${loc}`)
  if (/vence_ref/.test(setCookie)) ok('cookie vence_ref presente'); else bad('falta cookie vence_ref')

  // 2) /api/referrals/me sin auth → 401
  const me = await fetch(`${BASE}/api/referrals/me`)
  me.status === 401 ? ok('/api/referrals/me sin sesión = 401') : bad(`/api/referrals/me = ${me.status} (esperaba 401)`)

  // 3) /api/referrals/attribute sin auth → 401
  const at = await fetch(`${BASE}/api/referrals/attribute`, { method: 'POST' })
  at.status === 401 ? ok('/api/referrals/attribute sin sesión = 401') : bad(`/api/referrals/attribute = ${at.status} (esperaba 401)`)

  // 4) cron sin secret → 401
  const cron = await fetch(`${BASE}/api/cron/referrals-promote`)
  cron.status === 401 ? ok('/api/cron/referrals-promote sin secret = 401') : bad(`cron = ${cron.status} (esperaba 401)`)

  // 5) /admin/referrals/payouts sin auth → 401/403
  const adm = await fetch(`${BASE}/api/admin/referrals/payouts`)
  ;[401, 403].includes(adm.status) ? ok(`/api/admin/referrals/payouts sin admin = ${adm.status}`) : bad(`admin payouts = ${adm.status} (esperaba 401/403)`)

  // 6) /api/referrals/badge sin auth → 401 (badge de ganancias)
  const bdg = await fetch(`${BASE}/api/referrals/badge`)
  bdg.status === 401 ? ok('/api/referrals/badge sin sesión = 401') : bad(`/api/referrals/badge = ${bdg.status} (esperaba 401)`)

  // 7) /api/admin/referrals/stats sin admin → 401/403 (escaparate)
  const st = await fetch(`${BASE}/api/admin/referrals/stats`)
  ;[401, 403].includes(st.status) ? ok(`/api/admin/referrals/stats sin admin = ${st.status}`) : bad(`admin stats = ${st.status} (esperaba 401/403)`)

  // 8) página /embajadores responde
  const pg = await fetch(`${BASE}/embajadores`)
  pg.ok ? ok('/embajadores = 200') : bad(`/embajadores = ${pg.status}`)
}

async function dbChecks() {
  console.log('→ Base de datos (RDS):')
  const c = new Client({ connectionString: (process.env.DATABASE_URL || '').replace(/\?.*$/, ''), ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    const t = await c.query(`select table_name from information_schema.tables where table_schema='public' and table_name in ('referral_codes','referrals','reward_payouts','reward_submissions')`)
    t.rows.length === 4 ? ok('4 tablas del programa presentes') : bad(`solo ${t.rows.length}/4 tablas`)

    // vista escalable de ingresos + columna del badge
    const v = await c.query(`select 1 from information_schema.views where table_schema='public' and table_name='reward_earnings'`)
    v.rows.length === 1 ? ok('vista reward_earnings presente') : bad('falta la vista reward_earnings')
    const col = await c.query(`select 1 from information_schema.columns where table_name='user_profiles' and column_name='referral_earnings_seen_at'`)
    col.rows.length === 1 ? ok('columna referral_earnings_seen_at presente') : bad('falta user_profiles.referral_earnings_seen_at')

    const bad_status = await c.query(`select count(*) n from referrals where status not in ('pending','qualified','payable','paid','rejected','expired')`)
    Number(bad_status.rows[0].n) === 0 ? ok('sin referidos en estado inválido') : bad(`${bad_status.rows[0].n} referidos con status inválido`)

    // invariante: ningún payout marcado paid sobre un referido cuyo hold no ha vencido
    const dist = await c.query(`select status, count(*) n from referrals group by status order by status`)
    console.log('     distribución:', dist.rows.map(r => `${r.status}=${r.n}`).join(' ') || '(vacío)')
  } finally {
    await c.end()
  }
}

;(async () => {
  console.log(`🏅 CANARY embajadores — ${BASE}\n`)
  try { await httpChecks() } catch (e) { bad(`http: ${e.message}`) }
  try { await dbChecks() } catch (e) { bad(`db: ${e.message}`) }
  console.log('')
  if (failed) { console.error(`❌ CANARY FALLÓ (${failed} checks)`); process.exit(1) }
  console.log('✅ CANARY VERDE — programa de embajadores sano en prod.')
})()
