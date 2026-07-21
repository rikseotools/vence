#!/usr/bin/env node
// scripts/audit-oep-review.cjs
//
// GUARDARRAÍL DE "REVISIÓN OEP COMPLETA" — codifica la definición de "hecho" para
// la frase-gatillo "revisa señales oeps", para que NADIE (ni Claude) pueda declarar
// la revisión terminada mientras quede un cabo suelto medible.
//
// Por qué existe (21/07/2026): en una revisión se declaró "hecho" varias veces
// mirando solo lo recién tocado (señales pending=0) sin comprobar la definición
// COMPLETA: (a) los `discovered_processes` (otra mitad del badge), (b) que las
// catalogadas nuevas quedaran con la administración NORMALIZADA (no el sufijo
// crudo del sensor "(DOGV)/(BOCYL)…"), (c) que su `seguimiento_url` sea
// server-rendered de verdad (una SPA se hashea como shell → falso negativo
// silencioso, lección T-061), (d) que ninguna señal `applied` quedara huérfana.
// Cada gap salió solo cuando el admin empujó. Este script convierte esos gaps en
// checks deterministas.
//
// Determinista y DB-only (apto para CI/cron): exit 1 = ❌ (hay cabo BLOQUEANTE),
// exit 0 = limpio (los 🟡 son backlog documentado, no bloquean). El check de
// server-rendered de las URLs es de RED → modo aparte `--deep` (lento, no CI).
//
// Fuente: RDS vía DATABASE_URL (NUNCA Supabase congelado).
// Uso: node scripts/audit-oep-review.cjs [--deep]   (o npm run audit:oep-review)

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const https = require('https')

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('❌ DATABASE_URL no configurado (RDS/Neon; NO Supabase).')
  process.exit(2)
}
const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} })
const DEEP = process.argv.includes('--deep')

// Etiquetas crudas de sensor que NO deben quedar como `administracion` (hay que
// normalizarlas al organismo real al catalogar). Espejo de la regla del manual §7.
const SENSOR_SUFFIX_RE = /\((DOGV|BOCYL|BON|DOGC|BOJA|BOPV|BOA|BORM|DOE|DOG|BOC|BOCM|BOCyL)\)/i
const VALID_ESTADOS = new Set([
  'resultados', 'nombramientos', 'inscripcion_cerrada', 'lista_admitidos',
  'examen_realizado', 'convocada', 'sin_oep', 'oep_aprobada', 'inscripcion_abierta',
  'pendiente_examen',
])

function fetchServerRendered(url, hop = 0) {
  // ¿la URL trae contenido de empleo en el HTML PLANO (no un shell SPA)? Mismo
  // criterio que el cron (fetch plano). SIGUE redirecciones (el cron usa `fetch`,
  // que las sigue; un acortador como breu.gva.es devuelve 30x → hay que resolverlo
  // para ver el contenido real). Devuelve {ok, reason}.
  return new Promise((resolve) => {
    if (hop > 5) return resolve({ ok: false, reason: 'demasiadas redirecciones' })
    const req = https.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept-Language': 'es' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        const next = new URL(res.headers.location, url).href
        return resolve(fetchServerRendered(next, hop + 1))
      }
      if (res.statusCode >= 400) { res.resume(); return resolve({ ok: false, reason: `HTTP ${res.statusCode}` }) }
      let body = ''
      res.on('data', (c) => { body += c; if (body.length > 600000) req.destroy() })
      res.on('end', () => {
        const low = body.toLowerCase()
        const spa = /<div id="root"|<div id="app"|__next|window\.__|please enable javascript/.test(low) &&
          !/convocatoria|oposici|proceso selectivo|plazas|empleo p/.test(low)
        const listado = (low.match(/convocatoria|oposici|proceso selectivo|cuerpo |escala |plazas|inscripci/g) || []).length
        if (spa) return resolve({ ok: false, reason: 'shell SPA (JS-rendered, sin contenido)' })
        if (listado < 3) return resolve({ ok: false, reason: `casi sin contenido de empleo (${listado} menciones) — ¿shell?` })
        resolve({ ok: true, reason: `server-rendered (${listado} menciones)` })
      })
    })
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }) })
    req.on('error', (e) => resolve({ ok: false, reason: e.code || 'error de red' }))
  })
}

async function main() {
  const errs = []
  const warns = []

  // ── CHECK 1: ninguna señal sin triar (el núcleo de "revisa señales oeps") ──
  const [{ n: pend }] = await sql`SELECT count(*)::int n FROM oep_detection_signals WHERE status = 'pending'`
  if (pend > 0) errs.push(`${pend} señal(es) OEP en status='pending' — SIN triar. La revisión NO está terminada.`)

  // ── CHECK 2: la OTRA mitad del badge (discovered_processes), si la tabla existe ──
  const [{ exists: dpExists }] = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='discovered_processes') exists`
  if (dpExists) {
    const [{ n: dp }] = await sql`SELECT count(*)::int n FROM discovered_processes WHERE manuel_status IN ('new','watching')`
    if (dp > 0) errs.push(`${dp} discovered_processes con manuel_status new/watching — cuentan en el badge 🎯 y NO se han triado.`)
  }

  // ── CHECK 3: señal applied huérfana (oposicion_id que no resuelve) ──
  const orphan = await sql`
    SELECT s.id FROM oep_detection_signals s
    WHERE s.status='applied' AND s.oposicion_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM oposiciones o WHERE o.id = s.oposicion_id)`
  if (orphan.length) errs.push(`${orphan.length} señal(es) 'applied' con oposicion_id ROTO (fila borrada/inexistente).`)

  // ── CHECK 4: catalogada con administracion SIN normalizar (sufijo de sensor) ──
  const badAdm = (await sql`
    SELECT slug, administracion FROM oposiciones WHERE coverage_level='catalogada' AND administracion IS NOT NULL`)
    .filter((r) => SENSOR_SUFFIX_RE.test(r.administracion))
  if (badAdm.length) errs.push(
    `${badAdm.length} catalogada(s) con administracion = etiqueta cruda del sensor (ej. "${badAdm[0].administracion}") — normalizar al organismo real. Ej: ${badAdm.slice(0, 3).map((r) => r.slug).join(', ')}`)

  // ── CHECK 5: catalogada con estado_proceso inválido (enum) ──
  const badEst = (await sql`
    SELECT slug, estado_proceso FROM oposiciones WHERE coverage_level='catalogada' AND estado_proceso IS NOT NULL`)
    .filter((r) => !VALID_ESTADOS.has(r.estado_proceso))
  if (badEst.length) errs.push(`${badEst.length} catalogada(s) con estado_proceso inválido (ej. "${badEst[0].estado_proceso}").`)

  // ── CHECK 6 (WARN): catalogadas de señales aplicadas SIN seguimiento_url ──
  // Backlog de mantenimiento (§1021/§1030): NULL es aceptable SI está anotado en
  // la señal, pero hay que verlas. No bloquea (donante puede no existir hoy).
  const sinUrl = await sql`
    SELECT count(DISTINCT o.id)::int n
    FROM oposiciones o JOIN oep_detection_signals s ON s.oposicion_id = o.id
    WHERE o.coverage_level='catalogada' AND o.seguimiento_url IS NULL AND s.status='applied'`
  if (sinUrl[0].n > 0) warns.push(`${sinUrl[0].n} catalogada(s) de señales aplicadas SIN seguimiento_url (backlog: asignar donante verificado del organismo, o dejar con nota).`)

  // ── CHECK 7 (--deep, RED): las seguimiento_url de catalogadas recientes son server-rendered ──
  if (DEEP) {
    const recientes = await sql`
      SELECT DISTINCT o.seguimiento_url u, min(o.slug) slug
      FROM oposiciones o JOIN oep_detection_signals s ON s.oposicion_id = o.id
      WHERE o.coverage_level='catalogada' AND o.seguimiento_url IS NOT NULL
        AND s.status='applied' AND s.reviewed_at > now() - interval '7 days'
      GROUP BY o.seguimiento_url`
    for (const r of recientes) {
      const v = await fetchServerRendered(r.u)
      if (!v.ok) errs.push(`seguimiento_url NO monitorizable (${v.reason}): ${r.u} [${r.slug}] — el cron la hashearía como shell = falso negativo silencioso (T-061).`)
    }
  }

  // ── Reporte ──
  console.log('')
  if (errs.length) { console.log(`❌ CABOS BLOQUEANTES (${errs.length}):`); errs.forEach((m) => console.log('  ❌ ' + m)); console.log('') }
  if (warns.length) { console.log(`🟡 BACKLOG / A REVISAR (${warns.length}):`); warns.forEach((m) => console.log('  🟡 ' + m)); console.log('') }
  console.log(`━━━ ${errs.length} ❌  /  ${warns.length} 🟡  ${DEEP ? '(deep)' : '(db-only; usa --deep para verificar URLs)'} ━━━`)
  if (!errs.length) console.log('✅ Revisión OEP completa: sin cabos bloqueantes.')
  await sql.end()
  process.exit(errs.length ? 1 : 0)
}

main().catch((e) => { console.error('❌ audit-oep-review falló:', e.message); process.exit(2) })
