#!/usr/bin/env npx tsx
/**
 * Simulación del detector de latencia por endpoint (T-254) contra datos REALES de producción.
 *
 * Para qué sirve: antes de encender un indicador nuevo hay que saber cuántas veces se habría
 * encendido. Un detector que da rojo todos los días no informa de nada — enseña a ignorar el panel,
 * que es como se perdieron avisos anteriores en este repo (T-033/T-039/T-046). Y al revés: uno que
 * no se enciende ni con el incidente que motivó la tarea no sirve para nada.
 *
 * Importa el módulo REAL de producción (`lib/api/admin/endpoint-latency`), nunca una copia: si
 * alguien cambia los umbrales, esta simulación cambia con ellos. Un simulador con su propia copia
 * de la lógica miente en cuanto la original se mueve.
 *
 * NO ESCRIBE NADA. Solo lee `observable_events`.
 *
 * Uso:
 *   npx tsx scripts/sim-latencia-endpoints.ts [--dias 7] [--detalle]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'
import {
  worstBucketPerEndpoint,
  overallEndpointLatencyStatus,
  degradedEndpoints,
  LATENCY_BUCKET_MINUTES,
  LATENCY_MIN_SAMPLES,
  LATENCY_P95_THRESHOLDS,
  type EndpointLatencyBucket,
} from '../lib/api/admin/endpoint-latency'

const arg = (n: string, def: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : def
}
const DIAS = Number(arg('--dias', '7'))
const DETALLE = process.argv.includes('--detalle')

const url = process.env.DATABASE_URL
if (!url) { console.error('❌ falta DATABASE_URL'); process.exit(2) }

const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 2 })

async function main() {
  console.log(`\n🔬 Simulación del detector de latencia por endpoint — ${DIAS} días de producción`)
  console.log(`   cubo=${LATENCY_BUCKET_MINUTES}min · muestras mínimas=${LATENCY_MIN_SAMPLES}`)
  console.log(`   umbrales user_facing: ámbar ≥${LATENCY_P95_THRESHOLDS.user_facing.amber}ms · rojo ≥${LATENCY_P95_THRESHOLDS.user_facing.red}ms`)
  console.log(`   umbrales admin:       ámbar ≥${LATENCY_P95_THRESHOLDS.admin.amber}ms · rojo ≥${LATENCY_P95_THRESHOLDS.admin.red}ms\n`)

  // La MISMA agrupación que hará el endpoint del panel: por endpoint y por cubo de N minutos.
  const filas = await sql<Array<{ endpoint: string; bucket: Date; samples: string; p95: string }>>`
    SELECT endpoint,
           to_timestamp(floor(extract(epoch from created_at) / (${LATENCY_BUCKET_MINUTES} * 60))
                        * (${LATENCY_BUCKET_MINUTES} * 60)) AS bucket,
           count(*) AS samples,
           percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95
      FROM observable_events
     WHERE event_type = 'request_completed'
       AND duration_ms IS NOT NULL
       AND endpoint IS NOT NULL
       AND created_at > now() - (${DIAS} || ' days')::interval
     GROUP BY 1, 2`

  const buckets: EndpointLatencyBucket[] = filas.map(f => ({
    endpoint: f.endpoint,
    bucketStart: new Date(f.bucket).toISOString(),
    samples: Number(f.samples),
    p95Ms: Number(f.p95),
  }))
  console.log(`Mediciones (endpoint × cubo): ${buckets.length.toLocaleString('es-ES')}`)

  // ── 1) ¿Cuánto se encendería? Se cuenta por DÍA para ver si es una alarma o un ruido diario.
  const porDia = new Map<string, { red: Set<string>; amber: Set<string> }>()
  for (const b of buckets) {
    const [v] = worstBucketPerEndpoint([b])
    if (v.status !== 'red' && v.status !== 'amber') continue
    const dia = v.bucketStart.slice(0, 10)
    if (!porDia.has(dia)) porDia.set(dia, { red: new Set(), amber: new Set() })
    porDia.get(dia)![v.status].add(v.endpoint)
  }
  console.log('\n── Cubos degradados por día (endpoints DISTINTOS afectados) ──')
  for (const dia of [...porDia.keys()].sort()) {
    const d = porDia.get(dia)!
    console.log(`  ${dia}   🔴 ${String(d.red.size).padStart(2)} endpoint(s)   🟠 ${String(d.amber.size).padStart(2)} endpoint(s)`)
    if (DETALLE && d.red.size) console.log(`             rojo: ${[...d.red].join(', ')}`)
  }

  // ── 2) El veredicto que daría el panel HOY (ventana 24 h, que es su defecto).
  const ultimas24h = buckets.filter(
    b => new Date(b.bucketStart).getTime() > Date.now() - 24 * 3600_000)
  const veredictos24h = worstBucketPerEndpoint(ultimas24h)
  const estado = overallEndpointLatencyStatus(veredictos24h)
  const degradados = degradedEndpoints(veredictos24h)
  console.log(`\n── Veredicto del panel con la ventana de 24 h: ${estado.toUpperCase()} ──`)
  for (const v of degradados.slice(0, 15)) {
    console.log(`  ${v.status === 'red' ? '🔴' : '🟠'} ${v.endpoint.padEnd(44)} p95=${String(v.p95Ms).padStart(6)}ms  n=${String(v.samples).padStart(4)}  (${v.category})  ${v.bucketStart}`)
  }
  if (!degradados.length) console.log('  (ninguno degradado)')

  // ── 2-bis) CALIBRACIÓN DE LA ALERTA. El panel puede permitirse un ámbar suelto (lo miras
  // cuando entras); un correo, no. La señal que de verdad importa es la de T-254: varios
  // endpoints SIN relación entre sí degradándose en el MISMO cubo = recurso compartido saturado,
  // no un bug de un handler. Es el mismo razonamiento que RULE_CANARY_TIMEOUT_BURST.
  const porCubo = new Map<string, string[]>()
  for (const b of buckets) {
    const [v] = worstBucketPerEndpoint([b])
    if (v.status !== 'red') continue
    if (!porCubo.has(v.bucketStart)) porCubo.set(v.bucketStart, [])
    porCubo.get(v.bucketStart)!.push(v.endpoint)
  }
  const coincidencias = [...porCubo.entries()].filter(([, eps]) => eps.length >= 2)
  console.log(`\n── Calibración de la alerta: cubos con ≥2 endpoints en ROJO a la vez (${DIAS}d) ──`)
  console.log(`  ${coincidencias.length} en ${DIAS} días → ${(coincidencias.length / DIAS).toFixed(1)}/día`)
  for (const [cubo, eps] of coincidencias.sort().slice(0, 12)) {
    console.log(`  ${cubo}  ${eps.length} endpoints: ${eps.join(', ')}`)
  }

  // ── 2-ter) La otra firma: un endpoint SOLO, pero en rojo de forma SOSTENIDA.
  // La regla de «≥2 a la vez» se queda corta justo en el incidente que motivó la tarea: el 28/07
  // los otros dos endpoints tocados (`/api/medals` 5.003 ms, `/api/v2/test-config/articles`
  // 4.189 ms) no llegaban al suelo de muestras, así que el único rojo era answer-and-save. Un
  // detector que no caza su propio caso de origen no vale — hay que cubrir las dos firmas.
  const porEndpointCubos = new Map<string, number[]>()
  for (const b of buckets) {
    const [v] = worstBucketPerEndpoint([b])
    if (v.status !== 'red') continue
    if (!porEndpointCubos.has(v.endpoint)) porEndpointCubos.set(v.endpoint, [])
    porEndpointCubos.get(v.endpoint)!.push(new Date(v.bucketStart).getTime())
  }
  const rachas: Array<{ endpoint: string; desde: string; cubos: number }> = []
  for (const [endpoint, ts] of porEndpointCubos) {
    const orden = [...ts].sort((a, b) => a - b)
    let ini = orden[0], largo = 1
    for (let i = 1; i <= orden.length; i++) {
      const seguido = i < orden.length && orden[i] - orden[i - 1] === LATENCY_BUCKET_MINUTES * 60_000
      if (seguido) { largo++; continue }
      if (largo >= 2) rachas.push({ endpoint, desde: new Date(ini).toISOString(), cubos: largo })
      ini = orden[i]; largo = 1
    }
  }
  console.log(`\n── Calibración de la alerta (firma 2): rojo SOSTENIDO ≥2 cubos seguidos (${DIAS}d) ──`)
  console.log(`  ${rachas.length} racha(s) en ${DIAS} días → ${(rachas.length / DIAS).toFixed(1)}/día`)
  for (const r of rachas.sort((a, b) => a.desde.localeCompare(b.desde))) {
    console.log(`  ${r.desde}  ${r.endpoint.padEnd(40)} ${r.cubos} cubos (${r.cubos * LATENCY_BUCKET_MINUTES} min)`)
  }

  // ── 2-quater) LA FIRMA BUENA, medida sobre la forma REAL del incidente.
  // Los cubos del 28/07 fueron: 09:30 rojo (25.145 ms, 8 peticiones por encima del corte de 15 s
  // del cliente), 09:35 ámbar (4.732), 09:40 ámbar (3.272) y 09:45 severo pero con 6 muestras.
  // Ni «≥2 rojos a la vez» ni «≥2 rojos seguidos» describen eso. Lo que describe el daño es
  // DEGRADACIÓN SOSTENIDA: ≥2 cubos consecutivos en ámbar-o-peor con al menos uno rojo.
  const sostenidas: Array<{ endpoint: string; desde: string; cubos: number; peor: number }> = []
  const porEp = new Map<string, Array<{ t: number; status: string; p95: number }>>()
  for (const b of buckets) {
    const [v] = worstBucketPerEndpoint([b])
    if (v.category !== 'user_facing') continue
    if (v.status !== 'red' && v.status !== 'amber') continue
    if (!porEp.has(v.endpoint)) porEp.set(v.endpoint, [])
    porEp.get(v.endpoint)!.push({ t: new Date(v.bucketStart).getTime(), status: v.status, p95: v.p95Ms })
  }
  for (const [endpoint, arr] of porEp) {
    const orden = arr.sort((a, b) => a.t - b.t)
    let racha = [orden[0]]
    for (let i = 1; i <= orden.length; i++) {
      const seguido = i < orden.length && orden[i].t - orden[i - 1].t === LATENCY_BUCKET_MINUTES * 60_000
      if (seguido) { racha.push(orden[i]); continue }
      if (racha.length >= 2 && racha.some(x => x.status === 'red')) {
        sostenidas.push({
          endpoint, desde: new Date(racha[0].t).toISOString(),
          cubos: racha.length, peor: Math.max(...racha.map(x => x.p95)),
        })
      }
      racha = i < orden.length ? [orden[i]] : []
    }
  }
  console.log(`\n── FIRMA ELEGIDA: degradación SOSTENIDA (≥2 cubos seguidos ámbar+, ≥1 rojo, user_facing) ──`)
  console.log(`  ${sostenidas.length} en ${DIAS} días → ${(sostenidas.length / DIAS).toFixed(1)}/día`)
  for (const s of sostenidas.sort((a, b) => a.desde.localeCompare(b.desde))) {
    console.log(`  ${s.desde}  ${s.endpoint.padEnd(40)} ${s.cubos} cubos · peor p95 ${s.peor}ms`)
  }

  // ── 3) PRUEBA DE FUEGO: el incidente que motivó la tarea, ¿lo caza?
  const incidente = buckets.filter(b =>
    b.endpoint === '/api/v2/answer-and-save' &&
    b.bucketStart >= '2026-07-28T09:25' && b.bucketStart < '2026-07-28T09:50')
  console.log('\n── Prueba de fuego: el incidente del 28/07 09:30-09:45 UTC ──')
  if (!incidente.length) {
    console.log('  ⚠️ sin datos en esa ventana (¿retención de observable_events?) — no concluyente')
  } else {
    for (const v of worstBucketPerEndpoint(incidente)) {
      console.log(`  ${v.status === 'red' ? '🔴' : v.status === 'amber' ? '🟠' : '🟢'} ${v.bucketStart}  p95=${v.p95Ms}ms  n=${v.samples}  → ${v.status}`)
    }
    const cazado = overallEndpointLatencyStatus(worstBucketPerEndpoint(incidente)) === 'red'
    console.log(cazado
      ? '  ✅ el detector lo habría cazado en ROJO'
      : '  ❌ el detector NO lo habría cazado — recalibrar antes de encender nada')
  }

  await sql.end()
}

main().catch(e => { console.error('❌', e); process.exit(1) })
