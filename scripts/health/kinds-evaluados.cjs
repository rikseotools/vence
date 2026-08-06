#!/usr/bin/env node
// scripts/health/kinds-evaluados.cjs
//
// Responde la pregunta que [T-406] y la mitad psicotécnica de [T-384] no podían contestar: "¿este
// kind del barrido de salud se EVALUÓ anoche, o es que nadie lo mira?". `content_health_findings`
// solo guarda lo que se ENCUENTRA — un 0 ahí significa a la vez "vigilado y limpio" y "nadie lo
// miró", y hoy se leen igual (T-529).
//
// Lee el latido que `content-health-sweep.service.ts` (el `@Cron` real) emite en cada pasada:
// `cron_run` en `observable_events` con `metadata.kindsEvaluados` = kind → nº de sujetos mirados.
//
// Uso:
//   npm run health:kinds-evaluados                          # todos los kinds sin evaluar recientemente
//   npm run health:kinds-evaluados -- --kind psicotecnico_integridad   # el estado de UNO
//   npm run health:kinds-evaluados -- --umbral 3 --dias 21   # ajustar ventana/umbral
//   npm run health:kinds-evaluados -- --json
//
// Credencial: VENCE_LECTOR_URL (solo lectura, sin datos personales — `observable_events` es
// negocio, no coordinación). Si no está, cae a DATABASE_URL (que en una sesión con permisos
// normales SÍ puede leer esta tabla; el rol de coordinación de la flota, no).

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const postgres = require('postgres')
const { kindsSinEvaluar, estadoDeKind } = require(path.join(__dirname, '..', '..', 'lib', 'health', 'kindsEvaluados.cjs'))

const argv = process.argv.slice(2)
const arg = (nombre, def) => {
  const i = argv.indexOf(`--${nombre}`)
  return i >= 0 ? argv[i + 1] : def
}
const JSON_OUT = argv.includes('--json')
const KIND = arg('kind', null)
const DIAS = Math.max(1, parseInt(arg('dias', '14'), 10))
const UMBRAL_DIAS = Math.max(0, parseInt(arg('umbral', '2'), 10))

function conectar() {
  // [T-624] El orden de credenciales vive en `lib/db/negocioSoloLectura.cjs`, no aquí: eran
  // cuatro copias del mismo `VENCE_LECTOR_URL || DATABASE_URL` y el punto único mira además
  // `.env.local`, que ninguna de las copias hacía.
  const { urlLecturaNegocio } = require('../../lib/db/negocioSoloLectura.cjs')
  let url
  try { url = urlLecturaNegocio() } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(2)
  }
  return postgres(url, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
}

async function main() {
  const sql = conectar()
  let pasadas
  try {
    const filas = await sql`
      SELECT ts,
             COALESCE(metadata->>'status', 'success') AS status,
             (metadata->'kindsEvaluados')::jsonb AS kinds_evaluados
        FROM observable_events
       WHERE event_type = 'cron_run' AND endpoint = 'content-health-sweep'
         AND ts > now() - ${DIAS + ' days'}::interval
       ORDER BY ts DESC
    `
    pasadas = filas.map((f) => ({ ts: f.ts, status: f.status, kindsEvaluados: f.kinds_evaluados || {} }))
  } catch (e) {
    if (e && e.code === '42501') {
      console.error('❌ permission denied — el rol conectado no puede leer observable_events. Prueba con VENCE_LECTOR_URL.')
      process.exit(2)
    }
    throw e
  } finally {
    await sql.end()
  }

  if (!pasadas.length) {
    console.error(
      `⚠️  0 pasadas de content-health-sweep en los últimos ${DIAS} días. O el cron no ha corrido, ` +
        `o el latido de T-529 aún no está desplegado — no confundas esto con "todo limpio".`,
    )
    process.exit(JSON_OUT ? 0 : 1)
  }

  const ahoraMs = Date.now()

  if (KIND) {
    const estado = estadoDeKind(pasadas, KIND)
    if (JSON_OUT) {
      console.log(JSON.stringify({ kind: KIND, ...estado }, null, 2))
    } else if (estado.evaluado) {
      const dias = Math.round(((ahoraMs - Date.parse(estado.ultimaVez)) / (24 * 60 * 60 * 1000)) * 10) / 10
      console.log(`✅ ${KIND}: evaluado hace ${dias}d (${estado.ultimaVez}), ${estado.sujetos} sujeto(s) mirados esta última vez.`)
    } else {
      console.log(`❌ ${KIND}: NO aparece en ninguna pasada de los últimos ${DIAS} días — no se puede afirmar que se haya evaluado nunca.`)
    }
    process.exit(estado.evaluado ? 0 : 1)
  }

  const sinEvaluar = kindsSinEvaluar(pasadas, ahoraMs, { umbralDias: UMBRAL_DIAS, ventanaDias: DIAS })
  if (JSON_OUT) {
    console.log(JSON.stringify({ pasadas: pasadas.length, sinEvaluar }, null, 2))
  } else if (!sinEvaluar.length) {
    console.log(`✅ ${pasadas.length} pasada(s) en ${DIAS}d — ningún kind lleva >${UMBRAL_DIAS}d sin evaluarse.`)
  } else {
    console.log(`⚠️  ${sinEvaluar.length} kind(s) llevan >${UMBRAL_DIAS}d sin aparecer en el latido (${pasadas.length} pasada(s) en ${DIAS}d):\n`)
    for (const s of sinEvaluar) {
      console.log(`   ${s.kind} — ${s.diasSinEvaluar}d sin evaluarse (última vez: ${s.ultimaVez}, ${s.sujetos} sujeto(s))`)
    }
  }
  process.exit(sinEvaluar.length ? 1 : 0)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(2)
})
