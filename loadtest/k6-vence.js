/**
 * k6 load test profesional — Vence (Bloque 5 Fase E.4.2).
 *
 * Suite de 5 escenarios complementarios. Cada uno se invoca por separado
 * (TYPE env var) o todos juntos (default).
 *
 * Inspirado en patrón de SRE pro (basado en docs k6 + Datadog ESM 2025).
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ ESCENARIO  │ DURACIÓN │ VUs PICO │ PARA QUÉ                  │
 *   ├────────────┼──────────┼──────────┼──────────────────────────┤
 *   │ smoke      │   2 min  │     5    │ sanity check, valida       │
 *   │            │          │          │ que el script funciona.    │
 *   │ load       │  18 min  │  1000    │ simulacro pre-examen real. │
 *   │            │          │          │ p95<800ms o BLOQUEA cutover│
 *   │ stress     │  20 min  │  5000    │ encontrar el techo.        │
 *   │            │          │          │ ¿a qué carga rompe ECS?    │
 *   │ spike      │   5 min  │  2000    │ pico súbito viral          │
 *   │            │          │          │ (twitter share examen).    │
 *   │ soak       │   1 hora │   100    │ memory leaks, conexión DB. │
 *   └────────────┴──────────┴──────────┴──────────────────────────┘
 *
 * Uso:
 *   k6 run -e TYPE=smoke   loadtest/k6-vence.js     # rápido, validar script
 *   k6 run -e TYPE=load    loadtest/k6-vence.js     # PRE-CUTOVER
 *   k6 run -e TYPE=stress  loadtest/k6-vence.js     # encontrar límite
 *   k6 run -e TYPE=spike   loadtest/k6-vence.js     # tras Twitter viral
 *   k6 run -e TYPE=soak    loadtest/k6-vence.js     # antes de irse a dormir
 *
 *   k6 run -e TARGET=https://www.vence.es      ...   # baseline Vercel
 *   k6 run -e TARGET=https://preview-aws.vence.es ...# AWS challenger
 *
 *   k6 run -e POST_TO_OBSERVABILITY=1 -e INGEST_SECRET=$OBS ...  # publica resultado
 */
import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'
import exec from 'k6/execution'
import { SharedArray } from 'k6/data'

// ============================================================
// Config (overridable via env vars)
// ============================================================

const TARGET = __ENV.TARGET || 'https://preview-aws.vence.es'
const TYPE = (__ENV.TYPE || 'smoke').toLowerCase()
const POST_TO_OBSERVABILITY = __ENV.POST_TO_OBSERVABILITY === '1'
const INGEST_SECRET = __ENV.INGEST_SECRET || ''

// ============================================================
// Test data — oposiciones REALES de Vence (curadas de prod)
// ============================================================

const OPOSICIONES = new SharedArray('oposiciones', () => [
  'auxiliar-administrativo-estado',
  'auxiliar-administrativo-madrid',
  'auxiliar-administrativo-andalucia',
  'auxiliar-administrativo-castilla-leon',
  'auxiliar-administrativo-cataluna',
  'auxiliar-administrativo-galicia',
  'auxiliar-administrativo-valencia',
  'auxiliar-administrativo-aragon',
  'auxiliar-administrativo-asturias',
  'auxiliar-administrativo-extremadura',
])

const LEYES = new SharedArray('leyes', () => [
  'ley-39-2015',
  'ley-40-2015',
  'constitucion-espanola',
  'trebep',
  'lo-3-2018',
  'ley-19-2013',
])

// Distribución realista de tráfico (cuánto pesa cada acción).
// Total debe sumar 100. Basado en /admin/analytics dashboard.
const TRAFFIC_WEIGHTS = {
  home: 15,           // landing principal
  oposicionLanding: 25, // página de la oposición que estudia
  temario: 15,         // índice de temas
  temaDetail: 30,      // ★ pico real: el alumno está LEYENDO un tema
  leyDetail: 10,       // consulta de ley puntual
  ayuda: 2,            // poco tráfico
  sitemap: 1,          // bots SEO
  robots: 1,           // bots SEO
  observabilityIngest: 1, // RUM del cliente
}

// ============================================================
// Métricas custom
// ============================================================

const homeLat = new Trend('home_latency', true)
const oposicionLat = new Trend('oposicion_latency', true)
const temarioLat = new Trend('temario_latency', true)
const temaLat = new Trend('tema_latency', true)
const leyLat = new Trend('ley_latency', true)
const ayudaLat = new Trend('ayuda_latency', true)

const errors4xx = new Rate('errors_4xx')
const errors5xx = new Rate('errors_5xx')
const contentBroken = new Rate('content_broken') // 200 OK pero body roto
const reqTotal = new Counter('requests_total')

// ============================================================
// Escenarios — 5 perfiles distintos
// ============================================================

const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: 5,
    duration: '2m',
    tags: { test_type: 'smoke' },
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 },
      { duration: '2m', target: 500 },
      { duration: '2m', target: 1000 },
      { duration: '10m', target: 1000 }, // ★ sostenido pre-examen
      { duration: '3m', target: 0 },
    ],
    gracefulRampDown: '30s',
    tags: { test_type: 'load' },
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 500 },
      { duration: '3m', target: 1500 },
      { duration: '3m', target: 3000 },
      { duration: '5m', target: 5000 }, // ★ encontrar el techo
      { duration: '5m', target: 5000 },
      { duration: '2m', target: 0 },
    ],
    gracefulRampDown: '1m',
    tags: { test_type: 'stress' },
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 100 },
      { duration: '30s', target: 2000 }, // ★ pico súbito tras viral
      { duration: '2m', target: 2000 },
      { duration: '1m', target: 100 },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '30s',
    tags: { test_type: 'spike' },
  },
  soak: {
    executor: 'constant-vus',
    vus: 100,
    duration: '1h', // ★ leaks de memoria, conexiones colgadas
    tags: { test_type: 'soak' },
  },
}

if (!SCENARIOS[TYPE]) {
  throw new Error(`TYPE inválido: "${TYPE}". Usa: ${Object.keys(SCENARIOS).join(' | ')}`)
}

export const options = {
  scenarios: { [TYPE]: SCENARIOS[TYPE] },
  thresholds: {
    // ★ THRESHOLDS PARA "BLOQUEAR CUTOVER" — solo aplican a TYPE=load:
    http_req_failed: ['rate<0.01'],                  // <1% errores
    http_req_duration: ['p(95)<800', 'p(99)<2000'], // p95 <800ms, p99 <2s
    home_latency: ['p(95)<500'],                     // home CDN-cached, <500ms
    tema_latency: ['p(95)<1500'],                    // SSR/ISR, <1.5s
    errors_4xx: ['rate<0.05'],                       // <5% 4xx (404s sporadic OK)
    errors_5xx: ['rate<0.001'],                      // <0.1% 5xx
    content_broken: ['rate<0.01'],                   // <1% body inválido pese a 200
  },
  // En tipos no-load relajar thresholds (stress busca encontrar el techo,
  // spike es chaos, soak detecta leaks no latencia). Sobrescribimos:
  ...(TYPE === 'stress' && {
    thresholds: {
      // En stress NO bloqueamos por thresholds — queremos ver dónde cae.
      http_req_failed: ['rate>=0'],
    },
  }),
  ...(TYPE === 'spike' && {
    thresholds: {
      http_req_failed: ['rate<0.05'],         // 5% en spike es aceptable mientras autoscaling reacciona
      http_req_duration: ['p(95)<3000'],      // 3s p95 en spike
    },
  }),
  ...(TYPE === 'soak' && {
    thresholds: {
      http_req_failed: ['rate<0.005'],        // sostenido debe ser MUY estable
      http_req_duration: ['p(95)<1000'],
    },
  }),
  noConnectionReuse: false,
  userAgent: `Mozilla/5.0 k6/Vence-${TYPE}`,
  // No fail rápido — siempre completar para ver el patrón.
  noVUConnectionReuse: false,
}

// ============================================================
// Helpers — acciones reusables con asserts robustas
// ============================================================

const COMMON_HEADERS = {
  'X-Vence-LoadTest': TYPE,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
}

function tracked(resp, latencyMetric, name, expected) {
  reqTotal.add(1)
  if (latencyMetric) latencyMetric.add(resp.timings.duration)
  errors4xx.add(resp.status >= 400 && resp.status < 500 ? 1 : 0)
  errors5xx.add(resp.status >= 500 ? 1 : 0)

  const ok = check(resp, {
    [`${name} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name} body no vacío`]: (r) => (r.body?.length ?? 0) > (expected?.minBytes ?? 500),
    [`${name} content-type html/xml/json`]: (r) => {
      const ct = r.headers['Content-Type'] || ''
      return /text\/html|application\/(xml|json)/.test(ct)
    },
    ...(expected?.contains
      ? {
          [`${name} contiene "${expected.contains}"`]: (r) =>
            (r.body || '').toLowerCase().includes(expected.contains.toLowerCase()),
        }
      : {}),
  })

  if (!ok) contentBroken.add(1)
  else contentBroken.add(0)

  return resp
}

function thinkTime(min = 3, max = 8) {
  sleep(min + Math.random() * (max - min))
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function weightedAction() {
  // Suma de pesos → roulette wheel.
  const total = Object.values(TRAFFIC_WEIGHTS).reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (const [action, weight] of Object.entries(TRAFFIC_WEIGHTS)) {
    if (r < weight) return action
    r -= weight
  }
  return 'home' // fallback
}

// ============================================================
// Acciones del estudiante
// ============================================================

const ACTIONS = {
  home() {
    group('home', () => {
      const r = http.get(`${TARGET}/`, { headers: COMMON_HEADERS, tags: { name: 'home' } })
      tracked(r, homeLat, 'home', { minBytes: 1000, contains: 'vence' })
    })
  },
  oposicionLanding() {
    const slug = pick(OPOSICIONES)
    group(`oposicion-${slug}`, () => {
      const r = http.get(`${TARGET}/${slug}`, {
        headers: COMMON_HEADERS,
        tags: { name: 'oposicion-landing' },
      })
      tracked(r, oposicionLat, 'oposicion-landing', { minBytes: 2000 })
    })
  },
  temario() {
    const slug = pick(OPOSICIONES)
    group(`temario-${slug}`, () => {
      const r = http.get(`${TARGET}/${slug}/temario`, {
        headers: COMMON_HEADERS,
        tags: { name: 'temario' },
      })
      tracked(r, temarioLat, 'temario', { minBytes: 1500 })
    })
  },
  temaDetail() {
    const slug = pick(OPOSICIONES)
    const tema = 1 + Math.floor(Math.random() * 10) // T1-T10
    group(`tema-${tema}`, () => {
      const r = http.get(`${TARGET}/${slug}/temario/tema-${tema}`, {
        headers: COMMON_HEADERS,
        tags: { name: 'tema' },
      })
      tracked(r, temaLat, 'tema', { minBytes: 2000 })
    })
  },
  leyDetail() {
    const ley = pick(LEYES)
    group(`ley-${ley}`, () => {
      const r = http.get(`${TARGET}/leyes/${ley}`, {
        headers: COMMON_HEADERS,
        tags: { name: 'ley' },
      })
      tracked(r, leyLat, 'ley', { minBytes: 1500 })
    })
  },
  ayuda() {
    const r = http.get(`${TARGET}/ayuda`, { headers: COMMON_HEADERS, tags: { name: 'ayuda' } })
    tracked(r, ayudaLat, 'ayuda', { minBytes: 500 })
  },
  sitemap() {
    const r = http.get(`${TARGET}/sitemap.xml`, { tags: { name: 'sitemap' } })
    reqTotal.add(1)
    check(r, {
      'sitemap status 200': (resp) => resp.status === 200,
      'sitemap xml válido': (resp) =>
        resp.body?.includes('<?xml') && (resp.body.includes('<urlset') || resp.body.includes('<sitemapindex')),
    })
  },
  robots() {
    const r = http.get(`${TARGET}/robots.txt`, { tags: { name: 'robots' } })
    reqTotal.add(1)
    check(r, { 'robots 200': (resp) => resp.status === 200 })
  },
  observabilityIngest() {
    // Simula RUM client emitiendo eventos custom.
    const r = http.post(
      `${TARGET}/api/observability/ingest`,
      JSON.stringify({
        events: [
          {
            ts: new Date().toISOString(),
            source: 'frontend',
            severity: 'info',
            eventType: 'custom',
            errorMessage: `k6-loadtest-${TYPE}-vu${exec.vu.idInTest}`,
          },
        ],
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': TARGET,
        },
        tags: { name: 'observability-ingest' },
      },
    )
    reqTotal.add(1)
    check(r, { 'ingest 2xx': (resp) => resp.status >= 200 && resp.status < 300 })
  },
}

// ============================================================
// Test body — un VU es un "estudiante"
// ============================================================

export default function () {
  // Cada VU empieza por home (como un usuario real arrive).
  // Después navega de forma realista basada en weights.
  ACTIONS.home()
  thinkTime(1, 3)

  // 3-5 acciones más por VU.
  const numActions = 3 + Math.floor(Math.random() * 3)
  for (let i = 0; i < numActions; i++) {
    const action = weightedAction()
    ACTIONS[action]()
    thinkTime(2, 6)
  }
}

// ============================================================
// Hook al finalizar — resumen profesional + envío opcional
// ============================================================

export function handleSummary(data) {
  const ms = (v) => (v == null ? '?' : `${Math.round(v)}ms`)
  const pct = (v) => (v == null ? '?' : `${(v * 100).toFixed(2)}%`)
  const m = data.metrics

  const verdict = {
    error_rate_ok: (m.http_req_failed?.values.rate ?? 1) < 0.01,
    p95_ok: (m.http_req_duration?.values['p(95)'] ?? 9999) < 800,
    p99_ok: (m.http_req_duration?.values['p(99)'] ?? 9999) < 2000,
    home_p95_ok: (m.home_latency?.values['p(95)'] ?? 9999) < 500,
    tema_p95_ok: (m.tema_latency?.values['p(95)'] ?? 9999) < 1500,
    errors_5xx_ok: (m.errors_5xx?.values.rate ?? 1) < 0.001,
    content_ok: (m.content_broken?.values.rate ?? 1) < 0.01,
  }
  const passed = Object.values(verdict).every((v) => v)

  const summary = `
═══════════════════════════════════════════════════════════════════
  🎯 Vence — ${TYPE.toUpperCase()} test
  Target:    ${TARGET}
  Duración:  ${data.state.testRunDurationMs / 1000}s
═══════════════════════════════════════════════════════════════════

REQUESTS (${m.requests_total?.values.count ?? 0} total)
  p50 / p95 / p99:     ${ms(m.http_req_duration?.values['p(50)'])} / ${ms(
    m.http_req_duration?.values['p(95)'],
  )} / ${ms(m.http_req_duration?.values['p(99)'])}
  max:                 ${ms(m.http_req_duration?.values.max)}
  failed rate:         ${pct(m.http_req_failed?.values.rate)}

POR ENDPOINT (p95)
  home:                ${ms(m.home_latency?.values['p(95)'])}
  oposicion-landing:   ${ms(m.oposicion_latency?.values['p(95)'])}
  temario:             ${ms(m.temario_latency?.values['p(95)'])}
  tema (★):            ${ms(m.tema_latency?.values['p(95)'])}
  ley:                 ${ms(m.ley_latency?.values['p(95)'])}
  ayuda:               ${ms(m.ayuda_latency?.values['p(95)'])}

ERRORES
  4xx rate:            ${pct(m.errors_4xx?.values.rate)}
  5xx rate:            ${pct(m.errors_5xx?.values.rate)}
  content broken rate: ${pct(m.content_broken?.values.rate)}

VEREDICTO ${TYPE === 'load' ? '(★ aplica thresholds cutover)' : ''}
  ${verdict.error_rate_ok ? '✅' : '❌'} error rate < 1%       (real: ${pct(m.http_req_failed?.values.rate)})
  ${verdict.p95_ok ? '✅' : '❌'} p95 < 800ms             (real: ${ms(m.http_req_duration?.values['p(95)'])})
  ${verdict.p99_ok ? '✅' : '❌'} p99 < 2000ms            (real: ${ms(m.http_req_duration?.values['p(99)'])})
  ${verdict.home_p95_ok ? '✅' : '❌'} home p95 < 500ms        (real: ${ms(m.home_latency?.values['p(95)'])})
  ${verdict.tema_p95_ok ? '✅' : '❌'} tema p95 < 1500ms       (real: ${ms(m.tema_latency?.values['p(95)'])})
  ${verdict.errors_5xx_ok ? '✅' : '❌'} 5xx rate < 0.1%        (real: ${pct(m.errors_5xx?.values.rate)})
  ${verdict.content_ok ? '✅' : '❌'} content broken < 1%    (real: ${pct(m.content_broken?.values.rate)})

  ${passed ? '🟢 PASS — cutover GO' : '🔴 FAIL — investigar antes de cutover'}
═══════════════════════════════════════════════════════════════════
`

  // Post a observability si está configurado.
  if (POST_TO_OBSERVABILITY) {
    const payload = JSON.stringify({
      events: [
        {
          ts: new Date().toISOString(),
          source: 'gha',
          severity: passed ? 'info' : 'error',
          eventType: 'loadtest_result',
          errorMessage: `k6-${TYPE} ${passed ? 'PASS' : 'FAIL'} target=${TARGET}`,
          metadata: {
            type: TYPE,
            target: TARGET,
            requests_total: m.requests_total?.values.count,
            p50_ms: Math.round(m.http_req_duration?.values['p(50)'] ?? 0),
            p95_ms: Math.round(m.http_req_duration?.values['p(95)'] ?? 0),
            p99_ms: Math.round(m.http_req_duration?.values['p(99)'] ?? 0),
            failed_rate: m.http_req_failed?.values.rate,
            errors_5xx_rate: m.errors_5xx?.values.rate,
            duration_s: Math.round(data.state.testRunDurationMs / 1000),
            verdict,
          },
        },
      ],
    })
    const r = http.post(`${TARGET}/api/observability/ingest`, payload, {
      headers: { 'Content-Type': 'application/json', 'x-ingest-secret': INGEST_SECRET },
    })
    console.log(`[post-to-observability] HTTP ${r.status}`)
  }

  return {
    stdout: summary,
    './loadtest/k6-results.json': JSON.stringify(data, null, 2),
    [`./loadtest/k6-${TYPE}-summary.txt`]: summary,
  }
}
