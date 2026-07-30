#!/usr/bin/env npx tsx
/**
 * VIGÍA del pico — ¿vuelve a bloquearse el frontend cuando se generan PDFs? (T-270)
 *
 * ## Para qué
 *
 * El 29/07 la generación de PDFs del temario bloqueó el event-loop del contenedor que sirve, y todo
 * lo que servía ese contenedor se cayó con él: `/api/v2/answer-and-save` a p95 25.070 ms y **504 en
 * 28 endpoints distintos sobre 43 usuarios**. La Fase 1 puso un tope de renders concurrentes. La
 * pregunta que este vigía contesta es una sola: **¿basta?**
 *
 * No sustituye al indicador `endpoint_latency` del panel (que vigila a diario y alerta): esto es
 * para MIRAR UN PICO CONCRETO en vivo, con la firma completa del incidente junta, que en el panel
 * está repartida entre indicadores distintos.
 *
 * ## Qué mira, y por qué esas cuatro cosas juntas
 *
 * La firma del incidente NO es un número, es una coincidencia. Por separado, cada señal se explica
 * de otra forma; juntas, no:
 *   1. **PDFs generados** — la causa. Sin renders no hay bloqueo que explicar.
 *   2. **Lag del event-loop** — el mecanismo. Es lo que convierte un render en un problema de todos.
 *   3. **p95 de `answer-and-save`** — el daño en el camino crítico (guardar la respuesta de un test).
 *   4. **504** — el daño IRREFUTABLE: el usuario no recibió respuesta. Y ojo, viven en
 *      `observable_events` con `event_type='http_5xx'` y columna `ts`; buscarlos por `http_status`
 *      da vacío y hace concluir que no existen.
 *
 * ## Y de paso recoge lo que faltaba para calibrar
 *
 * Desde el 29/07 los eventos de PDF llevan `renderMs`/`stampMs`/`pages` (instrumentación de la Fase
 * 1a, ya desplegada). Este vigía los agrega: es la relación páginas↔coste que decide el umbral de
 * «esto no se renderiza en línea» — el número que hasta ahora había que poner a ojo.
 *
 * NO ESCRIBE NADA. Solo lee `observable_events`.
 *
 * Uso:  npx tsx scripts/vigia-pico-pdf.ts [--hasta "13:30"] [--cada 5]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : d
}
const HASTA = arg('--hasta', '13:30')          // hora LOCAL de fin
const CADA_MIN = Number(arg('--cada', '5'))

const url = process.env.DATABASE_URL
if (!url) { console.error('❌ falta DATABASE_URL'); process.exit(2) }
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 2 })

const dormir = (s: number) => new Promise(r => setTimeout(r, s * 1000))
const hhmm = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

/** Umbrales de la firma — importados del detector REAL, no copiados: un segundo criterio que
 *  deriva es peor que no tener criterio. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LATENCY_P95_THRESHOLDS, LATENCY_MIN_SAMPLES } = require('../lib/api/admin/endpoint-latency') as {
  LATENCY_P95_THRESHOLDS: { user_facing: { amber: number; red: number } }
  LATENCY_MIN_SAMPLES: number
}
const P95_ROJO = LATENCY_P95_THRESHOLDS.user_facing.red
const LAG_GRAVE_MS = 10_000

interface Muestra {
  pdfs: number; lagMax: number | null; p95: number | null; e504: number; usuarios504: number
  /** Cuántas peticiones sostienen ese p95. SIN esto la herramienta miente. */
  muestras: number
}

async function muestra(minutos: number): Promise<Muestra> {
  const [r] = await sql<Array<Muestra>>`
    SELECT
      (SELECT count(*)::int FROM observable_events
        WHERE event_type IN ('temario_pdf_served','temario_pdf_stamped')
          AND created_at > now() - (${minutos} || ' minutes')::interval) AS pdfs,
      (SELECT max(duration_ms)::int FROM observable_events
        WHERE event_type = 'event_loop_lag'
          AND created_at > now() - (${minutos} || ' minutes')::interval) AS "lagMax",
      (SELECT percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms)::int FROM observable_events
        WHERE event_type = 'request_completed' AND endpoint = '/api/v2/answer-and-save'
          AND duration_ms IS NOT NULL
          AND created_at > now() - (${minutos} || ' minutes')::interval) AS p95,
      (SELECT count(*)::int FROM observable_events
        WHERE event_type = 'request_completed' AND endpoint = '/api/v2/answer-and-save'
          AND duration_ms IS NOT NULL
          AND created_at > now() - (${minutos} || ' minutes')::interval) AS muestras,
      (SELECT count(*)::int FROM observable_events
        WHERE severity = 'error' AND event_type = 'http_5xx'
          AND ts > now() - (${minutos} || ' minutes')::interval) AS e504,
      (SELECT count(DISTINCT user_id)::int FROM observable_events
        WHERE severity = 'error' AND event_type = 'http_5xx'
          AND ts > now() - (${minutos} || ' minutes')::interval) AS "usuarios504"`
  return r
}

async function main() {
  console.log(`\n👁  Vigía del pico — hasta las ${HASTA}, muestreando cada ${CADA_MIN} min`)
  console.log(`   Firma que busca: PDFs + event-loop bloqueado + p95 de answer-and-save + 504 A LA VEZ.\n`)
  console.log(`   Suelo de muestras: ${LATENCY_MIN_SAMPLES} — por debajo, el p95 es el máximo y NO cuenta como firma.\n`)
  console.log('   hora   PDFs   lag máx   p95 a&s          504 (usr)  veredicto')
  console.log('   ─────  ─────  ────────  ───────────────  ─────────  ─────────')

  const alertas: string[] = []
  let vueltas = 0
  while (true) {
    const ahora = new Date()
    if (hhmm(ahora) >= HASTA) break
    const m = await muestra(CADA_MIN)

    // El veredicto exige COINCIDENCIA, no un número suelto: un p95 alto sin PDFs es otra cosa, y
    // unos PDFs sin lag son exactamente lo que queremos ver (que la Fase 1 funcione).
    // ⚠️ SUELO DE MUESTRAS — la lección que costó una falsa alarma el 30/07. Con n=3 en 5 minutos,
    // `percentile_disc(0.95)` devuelve el MÁXIMO, así que 3 peticiones lentas sueltas se leían como
    // «p95 de 25 s» y parecían una degradación que no existía (sin 504, sin lag, tráfico plano).
    // El detector del panel ya tenía este suelo; esta herramienta se escribió sin él. Un p95 sin
    // muestras detrás no es una medida, es el peor caso disfrazado de estadística.
    const p95Fiable = m.muestras >= LATENCY_MIN_SAMPLES
    const grave = m.pdfs > 0 && (
      (m.lagMax ?? 0) >= LAG_GRAVE_MS || m.e504 > 0 || (p95Fiable && (m.p95 ?? 0) >= P95_ROJO))
    const veredicto = grave ? '🔴 FIRMA'
      : (m.p95 ?? 0) >= P95_ROJO && !p95Fiable ? `⚠️ pico suelto (n=${m.muestras}, no es p95)`
      : m.pdfs > 0 ? '🟢 PDFs sin daño' : '·'
    if (grave) alertas.push(`${hhmm(ahora)} · ${m.pdfs} PDFs · lag ${Math.round((m.lagMax ?? 0) / 1000)}s · p95 ${m.p95}ms · ${m.e504} 504 (${m.usuarios504} usuarios)`)

    console.log(`   ${hhmm(ahora)}  ${String(m.pdfs).padStart(5)}  ${String(m.lagMax ?? '—').padStart(8)}  ${String(m.p95 ?? '—').padStart(9)} (n=${String(m.muestras).padStart(3)})  ${String(m.e504).padStart(4)} (${m.usuarios504})   ${veredicto}`)
    vueltas++
    await dormir(CADA_MIN * 60)
  }

  console.log('\n════════ VEREDICTO ════════')
  if (vueltas === 0) {
    // Cero muestras NO es un veredicto verde: es no haber mirado. Decir «se sostiene» sin haber
    // observado nada sería exactamente el verde-falso que este vigía existe para evitar.
    console.log('⚠️  NINGUNA muestra tomada: la ventana ya había pasado o `--hasta` estaba mal.')
    console.log('   Esto NO dice nada sobre la contención — no se ha mirado.')
  } else if (!alertas.length) {
    console.log(`✅ ${vueltas} muestras y NINGUNA con la firma: hubo PDFs sin arrastrar al resto.`)
    console.log('   La contención de la Fase 1 se sostiene en este pico. (Un pico limpio no cierra')
    console.log('   la cuestión para siempre, pero es la evidencia que faltaba.)')
  } else {
    console.log(`🔴 La firma apareció ${alertas.length} vez/veces — la Fase 1 NO basta:`)
    for (const a of alertas) console.log('   · ' + a)
    console.log('   → toca Fase 2 (sacar el render del camino servido). Diseño en T-159.')
  }

  console.log('\n── Coste de render medido en la ventana (lo que calibra el umbral) ──')
  const coste = await sql`
    SELECT CASE WHEN (metadata->>'pages')::int <= 30 THEN 'a) <=30 pag'
                WHEN (metadata->>'pages')::int <= 60 THEN 'b) 31-60'
                WHEN (metadata->>'pages')::int <= 120 THEN 'c) 61-120'
                ELSE 'd) >120 pag' END AS banda,
           count(*)::int AS n,
           round(avg((metadata->>'renderMs')::int + (metadata->>'stampMs')::int))::int AS cpu_medio_ms,
           max((metadata->>'renderMs')::int + (metadata->>'stampMs')::int) AS cpu_peor_ms
      FROM observable_events
     WHERE event_type = 'temario_pdf_stamped' AND metadata ? 'renderMs'
       AND created_at > now() - interval '6 hours'
     GROUP BY 1 ORDER BY 1`
  if (!coste.length) {
    console.log('   (sin datos instrumentados todavía: no ha habido renders frescos en 6 h)')
  } else console.table(coste)

  await sql.end()
}

main().catch(e => { console.error('❌', e); process.exit(1) })
