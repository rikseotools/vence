#!/usr/bin/env node
// scripts/fase-b-auth-surfaces-check.cjs
// GATE de superficies de auth (Fase B). Con un token RS256 (el que emite el flip)
// ejercita UN endpoint de CADA guard distinto y comprueba los códigos esperados.
//
// POR QUÉ EXISTE: el gate del flip (authjs-e2e-validate.cjs) probó solo `/api/v2`
// normal → se le escaparon 3 huecos que cayeron en prod el 03/07 (FK, session-gap y,
// sobre todo, el GUARD ADMIN que rechazaba RS256 porque validaba remoto contra
// Supabase). Este gate cubre las 3 familias de guard para que no vuelva a pasar:
//   1. verifyAuth        (regular v2 / lifecycle / finance-vía-Bearer) — enruta por alg
//   2. guardAdminApi     (proxy, /api/admin + /api/v2/admin)          — el que rompió
//   3. authenticateFinanceRequest (finance)                          — verifyAuth + admin
//
// Ejecutar ANTES de desplegar cualquier cambio de auth (y tras el flip para verificar).
//
// Uso:   node scripts/fase-b-auth-surfaces-check.cjs [baseUrl]
//        baseUrl por defecto: https://www.vence.es
// Requiere en el entorno (source .env.local + SSM):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_JWT_SECRET
// Usuarios de prueba (reales en prod): admin=manueltrader, no-admin=faqmakemoney.

const { SignJWT } = require('/home/manuel/Documentos/github/vence/node_modules/jose')

const BASE = process.argv[2] || 'https://www.vence.es'
const ADMIN = { email: 'manueltrader@gmail.com', sub: '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f' }
const USER = { email: 'faqmakemoney@gmail.com', sub: 'd9de0f61-dae6-47b8-871f-4c7b22e5c2da' }

async function mintHs256(u, secret) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ email: u.email, role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(u.sub).setAudience('authenticated').setIssuedAt(now).setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(secret))
}

/** Cambia un HS256 por un RS256 vía el bridge de /api/auth/token (lo que hace el cliente). */
async function toRs256(hs) {
  const r = await fetch(`${BASE}/api/auth/token`, { headers: { Authorization: `Bearer ${hs}` } })
  if (!r.ok) throw new Error(`bridge /api/auth/token devolvió ${r.status}`)
  const j = await r.json()
  if (!j.accessToken) throw new Error('bridge no devolvió accessToken')
  return j.accessToken
}

async function status(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const r = await fetch(`${BASE}${path}`, { headers })
  return r.status
}

async function main() {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Faltan SUPABASE_JWT_SECRET / NEXT_PUBLIC_SUPABASE_URL (source .env.local + SSM)')
    process.exit(2)
  }
  console.log(`GATE de superficies de auth — ${BASE}\n`)

  const hsAdmin = await mintHs256(ADMIN, secret)
  const hsUser = await mintHs256(USER, secret)
  const rsAdmin = await toRs256(hsAdmin)
  const rsUser = await toRs256(hsUser)

  // Matriz: [descripción, path, token, códigos aceptables]
  const T = { rsAdmin, rsUser, hsAdmin, none: null }
  const cases = [
    // 1. REGULAR v2 (verifyAuth) — cualquier usuario autenticado; sin token = 401.
    ['regular v2 · RS256 admin',    '/api/v2/topic-progress/theme-stats', 'rsAdmin', [200]],
    ['regular v2 · RS256 no-admin',  '/api/v2/topic-progress/theme-stats', 'rsUser',  [200]],
    ['regular v2 · sin token',       '/api/v2/topic-progress/theme-stats', 'none',    [401]],

    // 2. ADMIN (guardAdminApi, proxy) — EL QUE ROMPIÓ. RS256 admin debe pasar.
    ['admin /v2 · RS256 admin',      '/api/v2/admin/dashboard',            'rsAdmin', [200]],
    ['admin /v2 · RS256 no-admin',   '/api/v2/admin/dashboard',            'rsUser',  [403]],
    ['admin /v2 · sin token',        '/api/v2/admin/dashboard',            'none',    [401]],
    ['admin /api · RS256 admin',     '/api/admin/pending-counts',          'rsAdmin', [200]],
    ['admin · HS256 admin (legacy)', '/api/v2/admin/dashboard',            'hsAdmin', [200]],

    // 3. FINANCE (authenticateFinanceRequest) — verifyAuth + isAdminEmail.
    ['finance · RS256 admin',        '/api/finance/transfers',             'rsAdmin', [200]],
    ['finance · RS256 no-admin',     '/api/finance/transfers',             'rsUser',  [403]],
    ['finance · sin token',          '/api/finance/transfers',             'none',    [401]],
  ]

  let fail = 0
  for (const [desc, path, tokKey, ok] of cases) {
    const st = await status(path, T[tokKey])
    const pass = ok.includes(st)
    if (!pass) fail++
    console.log(`  ${pass ? '✅' : '❌'} ${desc.padEnd(30)} ${path}  → ${st}  (esperado ${ok.join('/')})`)
  }

  console.log('')
  if (fail === 0) {
    console.log('✅✅ GATE VERDE — las 3 familias de guard aceptan RS256 y autorizan/rechazan bien.')
    process.exit(0)
  }
  console.log(`❌ GATE ROJO — ${fail} comprobación(es) fallaron. NO desplegar cambios de auth.`)
  process.exit(1)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
