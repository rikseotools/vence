#!/usr/bin/env node
// scripts/observabilidad/llm-gasto.cjs
//
// LA vista única del consumo de LLM del sistema: lo que facturamos (API) y lo que no (la
// suscripción de Claude Code), en la misma tabla y con la misma unidad.
//
//   npm run llm:gasto                 # últimos 30 días
//   npm run llm:gasto -- --dias 7
//   npm run llm:gasto -- --json
//
// ## Por qué existe (26/07/2026)
//
// El consumo estaba repartido en tres sitios que no se hablaban: los eventos `llm_call` (solo de
// los call-sites instrumentados), la tabla legacy `ai_api_usage` (muerta desde abril de 2026) y
// la suscripción de Claude Code (invisible del todo). Preguntar "¿cuánto estamos gastando?" no
// tenía respuesta única, y la que había era un SUELO: 15 de 27 call-sites hablaban con el
// proveedor en crudo (ver `lib/observability/llmCallSites.ts`).
//
// Aquí se lee UNA fuente —`observable_events`— separando por `billing`, que es la distinción que
// de verdad importa: `api` cuesta dinero por token; `suscripcion` consume CUOTA, no euros.
// Sumarlos en un único número sería mentir en las dos direcciones.

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const postgres = require('postgres')
const { clasificarErrorLlm } = require(path.join(__dirname, '..', '..', 'lib', 'observability', 'llmErrorKind.cjs'))

const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const iDias = argv.indexOf('--dias')
const DIAS = iDias >= 0 ? Math.max(1, parseInt(argv[iDias + 1] || '30', 10)) : 30

function conectar() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurado (RDS)')
    process.exit(2)
  }
  return postgres(process.env.DATABASE_URL, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
}

const M = (n) => (Number(n) >= 1e6 ? `${(Number(n) / 1e6).toFixed(1)}M` : `${Math.round(Number(n) / 1000)}K`)

async function main() {
  const sql = conectar()
  const desde = `${DIAS} days`

  // API (lo que se factura): por feature.
  const api = await sql`
    SELECT COALESCE(metadata->>'feature', 'sin_feature') feature,
           count(*)::int llamadas,
           sum((metadata->>'inputTokens')::numeric)::bigint input,
           sum((metadata->>'outputTokens')::numeric)::bigint output,
           round(sum((metadata->>'estimatedCostUsd')::numeric), 2) usd
    FROM observable_events
    WHERE event_type = 'llm_call'
      AND ts > now() - ${desde}::interval
      AND COALESCE(metadata->>'billing', 'api') = 'api'
    GROUP BY 1 ORDER BY 5 DESC NULLS LAST`

  // Suscripción (lo que consume CUOTA): por sesión.
  const sub = await sql`
    SELECT metadata->>'sessionId' sesion,
           metadata->>'proyecto' proyecto,
           sum((metadata->>'respuestas')::numeric)::bigint respuestas,
           sum((metadata->>'outputTokens')::numeric)::bigint output,
           sum((metadata->>'cacheReadTokens')::numeric)::bigint cache_r,
           sum((metadata->>'totalTokens')::numeric)::bigint total
    FROM observable_events
    WHERE event_type = 'llm_call'
      AND ts > now() - ${desde}::interval
      AND metadata->>'billing' = 'suscripcion'
    GROUP BY 1, 2 ORDER BY 6 DESC NULLS LAST LIMIT 10`

  // Salud del proveedor: si algo está fallando, el gasto es lo de menos. Se agrupa por la CLASE
  // del error (`errorKind`), que es lo que dice qué hacer: recargar saldo, regenerar la clave,
  // esperar… Sin esto había que ir a probar la clave a mano contra la API (26/07: 8 h de radar
  // muerto por falta de saldo, y el evento solo decía `ok:false`).
  // Los eventos ANTERIORES a la clasificación no traen `errorKind`; para esos se clasifica aquí
  // con el MISMO núcleo puro, leyendo `error_message`. Así la herramienta sirve desde el primer
  // día y no solo para los fallos futuros — que es la diferencia entre diagnosticar hoy o esperar.
  const fallosRaw = await sql`
    SELECT COALESCE(metadata->>'provider', '—') proveedor,
           metadata->>'errorKind' kind_guardado,
           error_message, http_status,
           count(*)::int n, to_char(max(ts), 'DD/MM HH24:MI') ultimo
    FROM observable_events
    WHERE event_type = 'llm_call' AND metadata->>'ok' = 'false' AND ts > now() - ${desde}::interval
    GROUP BY 1, 2, 3, 4 ORDER BY 5 DESC`
  const porClase = new Map()
  for (const f of fallosRaw) {
    const c = f.kind_guardado
      ? { kind: f.kind_guardado, accion: '' }
      : clasificarErrorLlm(f.error_message, f.http_status)
    const clave = `${f.proveedor}|${c.kind}`
    const e = porClase.get(clave) || { proveedor: f.proveedor, kind: c.kind, accion: c.accion, n: 0, ultimo: f.ultimo, derivado: !f.kind_guardado }
    e.n += f.n
    if (f.ultimo > e.ultimo) e.ultimo = f.ultimo
    if (!e.accion && c.accion) e.accion = c.accion
    porClase.set(clave, e)
  }
  const fallos = [...porClase.values()].sort((a, b) => b.n - a.n)
  const ultimoOk = await sql`
    SELECT COALESCE(metadata->>'provider', '—') proveedor, to_char(max(ts), 'DD/MM HH24:MI') t
    FROM observable_events
    WHERE event_type = 'llm_call' AND metadata->>'ok' = 'true'
      AND COALESCE(metadata->>'billing','api') = 'api' AND ts > now() - ${desde}::interval
    GROUP BY 1`

  const [tot] = await sql`
    SELECT round(sum((metadata->>'estimatedCostUsd')::numeric), 2) usd, count(*)::int n
    FROM observable_events
    WHERE event_type = 'llm_call' AND ts > now() - ${desde}::interval
      AND COALESCE(metadata->>'billing', 'api') = 'api'`
  const [totSub] = await sql`
    SELECT sum((metadata->>'totalTokens')::numeric)::bigint tokens, sum((metadata->>'respuestas')::numeric)::bigint resp
    FROM observable_events
    WHERE event_type = 'llm_call' AND ts > now() - ${desde}::interval AND metadata->>'billing' = 'suscripcion'`
  await sql.end()

  if (JSON_OUT) {
    console.log(JSON.stringify({ dias: DIAS, api, suscripcion: sub, fallos, ultimoOk, totales: { api: tot, suscripcion: totSub } }, null, 2))
    return
  }

  console.log(`\n${'='.repeat(72)}`)
  console.log(`CONSUMO DE LLM — últimos ${DIAS} días`)
  console.log('='.repeat(72))

  if (fallos.length) {
    console.log('\n── ⚠️  SALUD DEL PROVEEDOR: hay llamadas fallando ──')
    for (const f of fallos) {
      console.log(`   ${String(f.proveedor).padEnd(12)} ${String(f.kind).padEnd(22)} ${String(f.n).padStart(5)} fallos · último ${f.ultimo}${f.derivado ? ' (clasificado al vuelo)' : ''}`)
      if (f.accion) console.log(`                → ${f.accion}`)
    }
    for (const o of ultimoOk) console.log(`   última llamada OK de ${o.proveedor}: ${o.t}`)
  }

  console.log(`\n── API (esto SÍ se factura) — ${tot.n || 0} llamadas · ${tot.usd || 0} USD estimados ──`)
  if (!api.length) console.log('   (sin datos)')
  for (const r of api) {
    console.log(`   ${String(r.feature).padEnd(22)} ${String(r.llamadas).padStart(6)} llam · in ${M(r.input)} · out ${M(r.output)} · ${String(r.usd ?? 0).padStart(7)} USD`)
  }

  console.log(`\n── SUSCRIPCIÓN Claude Code (NO se factura: consume CUOTA) — ${totSub.resp || 0} respuestas · ${M(totSub.tokens || 0)} tokens ──`)
  if (!sub.length) {
    console.log('   (sin datos — ¿has corrido `npm run llm:ingest-claude-code`?)')
  } else {
    for (const r of sub) {
      console.log(`   ${String(r.sesion || '—').slice(0, 8)} · ${String(r.respuestas).padStart(5)} resp · out ${M(r.output)} · caché leída ${M(r.cache_r)} · total ${M(r.total)}`)
    }
  }

  console.log(`\n⚠️  El coste de la API es una ESTIMACIÓN nuestra (tarifas en lib/observability/llm.ts) y`)
  console.log(`   solo cubre los call-sites instrumentados. Los que aún hablan en crudo con el`)
  console.log(`   proveedor están listados en lib/observability/llmCallSites.ts.\n`)
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
