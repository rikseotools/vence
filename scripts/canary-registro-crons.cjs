#!/usr/bin/env node
/**
 * canary-registro-crons.cjs — ¿sigue habiendo alguien escribiendo en el registro de crons? (T-442)
 *
 *   npm run canary:registro-crons [-- --json]
 *
 * Solo LEE. El criterio vive en `lib/cron/registroVivo.cjs`.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
 * La tabla `cron_runs` estuvo **dos meses muerta** (24/05 → 31/07) sin que nada avisara, porque
 * todo lo que había vigilaba «¿este cron va retrasado?» y nada vigilaba «¿sigue habiendo alguien
 * escribiendo aquí?». Con el registro vacío, `/api/admin/health` no encontraba filas y pintaba
 * cero crons y cero incidencias — que se lee igual que «todo bien».
 *
 * Un registro vacío no es calma: es no saber nada. Este canario es la única comprobación que
 * separa las dos cosas, y por eso mira PRIMERO el termómetro y después lo que el termómetro dice.
 */
const fs = require('fs')
const path = require('path')
const { clasificarCron, registroMudo, resumenRegistro } = require('../lib/cron/registroVivo.cjs')

const REPO = path.resolve(__dirname, '..')
const JSON_OUT = process.argv.includes('--json')

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
}

async function main() {
  const s = require('postgres')(url(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 15 })
  let ultimaFila, filas, tablaLegacy
  try {
    // El registro VIVO: los @Cron del backend emiten aquí. `endpoint` trae el nombre en todos;
    // `metadata.cron` falta en algunos, así que no se puede agrupar por él.
    const [u] = await s`SELECT max(created_at) AS ult FROM observable_events WHERE event_type = 'cron_run'`
    ultimaFila = u && u.ult
    filas = await s`
      SELECT DISTINCT ON (endpoint)
             endpoint AS nombre, created_at AS ultima, severity, metadata->>'status' AS status
        FROM observable_events
       WHERE event_type = 'cron_run' AND created_at > now() - interval '7 days'
       ORDER BY endpoint, created_at DESC`
    // La tabla vieja, solo para poder decirlo en voz alta si alguien la resucita.
    const [t] = await s`SELECT count(*)::int AS n, max(started_at) AS ult FROM cron_runs`
    tablaLegacy = t
  } finally { try { await s.end({ timeout: 5 }) } catch {} }

  const termometro = registroMudo(ultimaFila)
  const clasificados = filas.map((f) => clasificarCron({
    nombre: f.nombre, ultimaSenal: f.ultima, status: f.status, severity: f.severity,
  }))
  const r = resumenRegistro(clasificados)

  if (JSON_OUT) { console.log(JSON.stringify({ termometro, ...r, tablaLegacy }, null, 1)); return termometro.mudo || r.fallando.length ? 1 : 0 }

  console.log(`\n🕒 REGISTRO DE CRONS — ${termometro.mudo ? '🔴' : '🟢'} ${termometro.motivo}`)
  if (termometro.mudo) {
    console.error('\n   El termómetro está roto: mientras esto pase, NINGUNA conclusión sobre crons vale.')
    console.error('   Los @Cron del backend emiten a `observable_events` con event_type=\'cron_run\'.')
    console.error('   Si dejaron de emitir, mira /ecs/vence-backend: "Nest application successfully started".')
    return 1
  }

  console.log(`   ${r.total} cron(s) con señal en 7 días · ${r.vivos} vivos · ${r.callados.length} callados · ${r.fallando.length} fallando`)
  for (const c of r.fallando) console.log(`   🔴 ${c.nombre} — ${c.motivo}`)
  for (const c of r.callados) console.log(`   🟠 ${c.nombre} — ${c.motivo}`)

  // La tabla vieja: si alguien la revive sin quitar esto, que se vea.
  if (tablaLegacy && tablaLegacy.n > 0) {
    const dias = tablaLegacy.ult ? Math.round((Date.now() - new Date(tablaLegacy.ult).getTime()) / 86_400_000) : null
    console.log(`\n   ℹ️  la tabla LEGACY \`cron_runs\` tiene ${tablaLegacy.n} filas históricas` +
      (dias !== null ? `, la última de hace ${dias} días` : '') + '. Nadie escribe ahí desde el 24/05: no la leas.')
  }

  return r.fallando.length ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => {
  // Fail-open: un canario que no puede mirar no puede declarar una avería.
  console.log(`⚠️  canary-registro-crons no pudo comprobar (${String(e.message || e).slice(0, 120)})`)
  process.exit(0)
})
