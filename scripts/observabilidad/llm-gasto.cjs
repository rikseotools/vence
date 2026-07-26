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
const postgres = require('postgres')

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
    console.log(JSON.stringify({ dias: DIAS, api, suscripcion: sub, totales: { api: tot, suscripcion: totSub } }, null, 2))
    return
  }

  console.log(`\n${'='.repeat(72)}`)
  console.log(`CONSUMO DE LLM — últimos ${DIAS} días`)
  console.log('='.repeat(72))

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
