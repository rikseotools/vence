#!/usr/bin/env node
// scripts/canary-banner-observability.cjs
//
// CANARY end-to-end de la observabilidad del banner "Inscripción abierta" + catalogadas.
// Prueba el camino REAL de almacenamiento: inserta un evento como los que emite el
// cliente, lo lee de vuelta de observable_events con su slug, y limpia. Exit 1 si algo
// del round-trip falla → apto para CI/cron de canary.
//
// Por qué un script y NO un test jest: el entorno jest mockea @supabase/realtime-js y
// rompe el insert de supabase-js. Aquí, node real, funciona. El CONTRATO (que el payload
// pasa la validación del endpoint) sí está en __tests__/integration/bannerObservabilityCanary.
//
// Uso: node scripts/canary-banner-observability.cjs   (carga .env.local si está)

const { createClient } = require('@supabase/supabase-js')

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('⏭️  Sin credenciales (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — canary saltado')
  process.exit(0)
}

const s = createClient(URL, KEY)
const marker = `__canary_banner_${Date.now()}`
const slug = 'auxiliar-administrativo-uned'

async function main() {
  // 1. INSERT como lo haría el ingest (source=frontend, event_type, metadata con slug)
  const ins = await s.from('observable_events').insert({
    source: 'frontend',
    severity: 'info',
    event_type: 'banner_inscription_viewed',
    metadata: { slug, canary: marker },
  })
  if (ins.error) throw new Error(`INSERT falló: ${ins.error.message}`)

  // 2. READ de vuelta por el marker — el camino que usará el admin para medir
  const { data, error } = await s
    .from('observable_events')
    .select('event_type, metadata')
    .eq('event_type', 'banner_inscription_viewed')
    .contains('metadata', { canary: marker })
  if (error) throw new Error(`READ falló: ${error.message}`)
  if (!data || data.length < 1) throw new Error('READ no encontró el evento insertado')
  if (data[0].metadata?.slug !== slug) throw new Error(`slug no persistió: ${JSON.stringify(data[0].metadata)}`)

  // 3. CLEANUP
  const del = await s.from('observable_events').delete().contains('metadata', { canary: marker })
  if (del.error) throw new Error(`CLEANUP falló: ${del.error.message}`)

  console.log(`✅ CANARY OK — banner_inscription_viewed round-trip (insert→read slug='${slug}'→cleanup)`)
}

main().catch((e) => {
  console.error(`❌ CANARY FALLÓ — ${e.message}`)
  process.exit(1)
})
