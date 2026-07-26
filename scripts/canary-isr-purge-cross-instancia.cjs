#!/usr/bin/env node
/**
 * canary-isr-purge-cross-instancia.cjs — ¿una purga alcanza a TODAS las instancias?
 *
 * POR QUÉ (incidente medido 25/07/2026): `revalidatePath()` en Next standalone
 * purga solo el proceso que atiende la petición. Con 8 tasks de Fargate detrás del
 * ALB, un POST a /api/purge-cache dejaba a 7 sirviendo HTML viejo hasta 24 h
 * (medido: 1 de cada 6 peticiones servía lo nuevo). El parche era repetir el POST
 * 15-20 veces y cruzar los dedos.
 *
 * QUÉ VERIFICA (el invariante, no que responda 200): tras UNA sola purga, ninguna
 * instancia sigue sirviendo la copia anterior. Se apoya en el fixture
 * /api/canary/isr, que es ISR real y expone `renderedAt` + `instance`; un 200 no
 * distingue "regenerado" de "rancio", que es justo el fallo a cazar.
 *
 * CÓMO: sondea la ruta hasta ver N instancias distintas → purga UNA vez → espera
 * el intervalo del daemon → vuelve a sondear y exige que TODO `renderedAt` sea
 * posterior a la purga.
 *
 * Uso:
 *   node scripts/canary-isr-purge-cross-instancia.cjs
 *   SONDEOS=60 ESPERA_MS=20000 node scripts/canary-isr-purge-cross-instancia.cjs
 *
 * Exit 1 si alguna instancia se quedó con la copia vieja (o si no se pudo medir).
 */
require('dotenv').config({ path: '.env.local' })

// Se mide contra el ALB, NO contra www.vence.es. Dos razones, ambas medidas el
// 26/07: (1) `SITE_URL` de `.env.local` es http://localhost:3000 → el canary
// habría medido una instancia local, siempre "verde", creyendo mirar la flota;
// (2) por www hay CloudFront delante y devuelve SIEMPRE la misma copia cacheada,
// aunque se pida con cache-buster, así que el reparto entre tasks queda tapado y
// el canary no puede ver más que una. Pidiendo al ALB con `Host: www.vence.es` sí
// se alcanza a las 8 tasks (verificado: 8 firmas distintas en 45 sondeos).
const ALB_HOST = process.env.CANARY_ALB_HOST || 'vence-backend-alb-300489916.eu-west-2.elb.amazonaws.com'
const BASE = process.env.CANARY_BASE_URL || `https://${ALB_HOST}`
// Se habla con el ALB por `https` nativo (sin dependencias): hace falta control
// del header Host y aceptar su certificado — es el de vence.es y aquí se le llama
// por el DNS de AWS, así que no casa. Tráfico interno de diagnóstico.
const https = require('https')
const RUTA = '/api/canary/isr'
const CRON_SECRET = process.env.CRON_SECRET
// Con 8 tasks y reparto del ALB, 40 sondeos dan margen de sobra para tocarlas todas.
const SONDEOS = Number(process.env.SONDEOS) || 40
// Intervalo del daemon (10 s por defecto) + margen de red y de re-render.
const ESPERA_MS = Number(process.env.ESPERA_MS) || 18_000

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET no configurado en .env.local')
  process.exit(2)
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

/** GET/POST al ALB con Host forzado y certificado no verificado. Devuelve {status, json}. */
function pedir(ruta, { method = 'GET', body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: ALB_HOST,
        path: ruta,
        method,
        rejectUnauthorized: false,
        servername: 'www.vence.es',
        headers: { Host: 'www.vence.es', ...headers },
      },
      (res) => {
        let d = ''
        res.on('data', (c) => (d += c))
        res.on('end', () => {
          let json = null
          try { json = JSON.parse(d) } catch { /* respuesta no-JSON */ }
          resolve({ status: res.statusCode, json })
        })
      }
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

/**
 * Sondea la ruta y devuelve Map<firma, {instance, renderedAt}>.
 *
 * La firma es el `renderedAt` (ms), no el `instance`: hasta que el fixture con id
 * de proceso llegue a prod, todas las tasks devolvían `0.0.0.0#1` (en Fargate el
 * HOSTNAME es 0.0.0.0 y el pid siempre 1) y agrupar por `instance` colapsaba las 8
 * en una. El instante de render sí es único por instancia.
 */
async function sondear(veces) {
  const vistas = new Map()
  for (let i = 0; i < veces; i++) {
    try {
      // Sin cache-buster A PROPÓSITO: queremos lo que cada instancia tiene guardado,
      // no forzar un render fresco (eso enmascararía el fallo).
      const { status, json: j } = await pedir(RUTA)
      if (status !== 200) continue
      if (j?.renderedAt) vistas.set(j.renderedAt, { instance: j.instance, renderedAt: j.renderedAt })
    } catch {
      /* un blip de red no invalida la medición */
    }
  }
  return vistas
}

;(async () => {
  console.log(`🐤 canary purga ISR cross-instancia — ${BASE}${RUTA}`)

  const antes = await sondear(SONDEOS)
  if (antes.size === 0) {
    console.error('❌ no se pudo leer el fixture ni una vez (¿desplegado? ¿ruta accesible?)')
    process.exit(1)
  }
  // OJO (medido 26/07): la ruta es `force-static`, así que Next la prerenderiza en
  // BUILD TIME y las N tasks salen del deploy sirviendo LA MISMA copia horneada en
  // la imagen (mismo renderedAt, y el `instance` es el del contenedor que hizo el
  // build, no el de ninguna task). Por eso aquí lo normal es ver UNA sola firma:
  // eso no es un fallo, es el estado inicial — y es justo lo que la hace buena
  // señal. Tras la purga, cada instancia que se entere regenera con SU hostname y
  // SU hora; las que no se enteren se quedan con la firma del build.
  const firmasViejas = new Set(antes.keys())
  console.log(`   firmas antes de purgar: ${firmasViejas.size}`)
  for (const v of antes.values()) console.log(`     · ${v.instance} → ${v.renderedAt}`)

  const tPurga = new Date()
  const purga = await pedir('/api/purge-cache', {
    method: 'POST',
    body: JSON.stringify({ path: RUTA }),
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
  })
  const body = purga.json || {}
  console.log(`   purga enviada UNA vez → ${purga.status} broadcast=${body?.broadcast}`)
  if (purga.status !== 200) {
    console.error('❌ la purga no fue aceptada')
    process.exit(1)
  }
  if (body?.broadcast === false) {
    console.error('❌ la purga NO quedó registrada en el KV (broadcast=false): las demás instancias')
    console.error('   no pueden enterarse. Revisa el sink de caché (CACHE_PROVIDER / credenciales).')
    process.exit(1)
  }

  console.log(`   esperando ${ESPERA_MS} ms (sondeo del daemon + margen)…`)
  await dormir(ESPERA_MS)

  const despues = await sondear(SONDEOS)
  console.log(`   instancias alcanzadas después: ${despues.size}`)

  const rancias = []
  for (const { instance: inst, renderedAt: ts } of despues.values()) {
    // Rancia = sigue sirviendo una firma anterior a la purga (típicamente la del
    // build). Se comprueba por fecha Y contra el conjunto de firmas viejas, para
    // no depender solo de relojes de máquinas distintas.
    const regenerada = new Date(ts) > tPurga && !firmasViejas.has(ts)
    console.log(`     · ${inst} → ${ts} ${regenerada ? '✅ regenerada' : '❌ RANCIA'}`)
    if (!regenerada) rancias.push(inst)
  }

  if (rancias.length) {
    console.error(`\n❌ CANARY EN ROJO — ${rancias.length}/${despues.size} instancia(s) sirven la copia vieja tras la purga.`)
    console.error('   La purga NO es cross-instancia: mira el daemon (ISR_PURGE_WATCHER_ENABLED),')
    console.error('   el registro isr_purge_log en el KV y /api/internal/isr-apply.')
    process.exit(1)
  }

  if (despues.size < 2) {
    // Con una sola instancia distinta no se ha demostrado nada CROSS-instancia:
    // podría ser la misma task respondiendo siempre. Verde a medias = rojo.
    console.error(`\n❌ SIN VEREDICTO — tras la purga solo se distinguió 1 instancia: no prueba el reparto`)
    console.error('   entre tasks. Sube SONDEOS o comprueba desiredCount / afinidad del ALB.')
    process.exit(1)
  }

  console.log(`\n✅ CANARY OK — las ${despues.size} instancias alcanzadas regeneraron con UNA sola purga.`)
})().catch((e) => {
  console.error('❌ canary reventó:', e.message)
  process.exit(1)
})
