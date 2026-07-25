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

// Producción por defecto, y OJO: NO se usa `SITE_URL` — en `.env.local` vale
// http://localhost:3000, así que el canary habría medido una instancia local
// (siempre una sola, siempre "verde") creyendo que miraba la flota de prod. Para
// apuntar a otro sitio a propósito: CANARY_BASE_URL=…
const BASE = process.env.CANARY_BASE_URL || 'https://www.vence.es'
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

/** Sondea la ruta y devuelve Map<instancia, renderedAt>. */
async function sondear(veces) {
  const vistas = new Map()
  for (let i = 0; i < veces; i++) {
    try {
      // Sin cache-buster A PROPÓSITO: queremos lo que cada instancia tiene guardado,
      // no forzar un render fresco (eso enmascararía el fallo).
      const res = await fetch(`${BASE}${RUTA}`, { cache: 'no-store' })
      if (!res.ok) continue
      const j = await res.json()
      if (j?.instance && j?.renderedAt) vistas.set(j.instance, j.renderedAt)
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
  console.log(`   instancias alcanzadas antes: ${antes.size}`)
  for (const [inst, ts] of antes) console.log(`     · ${inst} → ${ts}`)

  if (antes.size === 1) {
    console.warn('⚠️  solo se alcanzó UNA instancia: el canary no puede probar nada cross-instancia.')
    console.warn('    (¿desiredCount=1, o el ALB con afinidad de sesión?) Se aborta sin veredicto.')
    process.exit(1)
  }

  const tPurga = new Date()
  const res = await fetch(`${BASE}/api/purge-cache`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
    body: JSON.stringify({ path: RUTA }),
  })
  const body = await res.json().catch(() => ({}))
  console.log(`   purga enviada UNA vez → ${res.status} broadcast=${body?.broadcast}`)
  if (!res.ok) {
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
  for (const [inst, ts] of despues) {
    const regenerada = new Date(ts) > tPurga
    console.log(`     · ${inst} → ${ts} ${regenerada ? '✅ regenerada' : '❌ RANCIA'}`)
    if (!regenerada) rancias.push(inst)
  }

  if (rancias.length) {
    console.error(`\n❌ CANARY EN ROJO — ${rancias.length}/${despues.size} instancia(s) sirven la copia vieja tras la purga.`)
    console.error('   La purga NO es cross-instancia: mira el daemon (ISR_PURGE_WATCHER_ENABLED),')
    console.error('   el registro isr_purge_log en el KV y /api/internal/isr-apply.')
    process.exit(1)
  }

  console.log(`\n✅ CANARY OK — las ${despues.size} instancias alcanzadas regeneraron con UNA sola purga.`)
})().catch((e) => {
  console.error('❌ canary reventó:', e.message)
  process.exit(1)
})
