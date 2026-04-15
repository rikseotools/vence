// scripts/backfill-target-oposicion.js
// One-shot retroactivo: asigna target_oposicion a usuarios con NULL cuyo
// registration_url contenga un slug identificable del catálogo.
//
// Ejecución manual (no es un cron):
//   node scripts/backfill-target-oposicion.js         # dry run (no escribe)
//   node scripts/backfill-target-oposicion.js --apply # aplica cambios
//
// Usa el mismo helper que el runtime (lib/api/auth/extract-oposicion.ts) vía
// dynamic import con tsx fallback o una re-implementación compatible.
//
// Alternativa simple: reproducir la lógica mínima aquí para evitar cargar
// todo el catálogo TS. La fuente de verdad queda en oposiciones.ts; aquí
// solo necesitamos el mapping slug→positionType, que podemos leer en runtime.

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const path = require('path')

// Cargar OPOSICIONES vía require del JSON cacheado si existe, o fallback a
// leer el TS crudo con regex (sin ts-node). Aquí hacemos el fallback simple:
// parsear el fichero fuente y extraer los slug/positionType pairs.
const fs = require('fs')
const source = fs.readFileSync(path.resolve(__dirname, '../lib/config/oposiciones.ts'), 'utf8')
const pairs = []
const re = /slug:\s*'([^']+)'[\s\S]{0,200}?positionType:\s*'([^']+)'/g
let m
while ((m = re.exec(source)) !== null) {
  pairs.push({ slug: m[1], positionType: m[2] })
}
const SLUG_MAP = new Map(pairs.map(p => [p.slug, p.positionType]))
const VALID_PT = new Set(pairs.map(p => p.positionType))

function extractOposicionFromUrl(url) {
  if (!url) return { positionType: null, reason: 'no_url' }
  let pathname, searchParams
  try {
    const u = new URL(url, 'https://vence.es')
    pathname = u.pathname
    searchParams = u.searchParams
  } catch {
    return { positionType: null, reason: 'url_parse_error' }
  }
  const first = pathname.split('/').filter(Boolean)[0]
  if (first && SLUG_MAP.has(first)) {
    return { positionType: SLUG_MAP.get(first), reason: 'slug_in_path' }
  }
  const utm = searchParams.get('utm_oposicion') || searchParams.get('opo')
  if (utm && VALID_PT.has(utm)) {
    return { positionType: utm, reason: 'utm_param' }
  }
  return { positionType: null, reason: 'ambiguous_or_unmappable' }
}

const APPLY = process.argv.includes('--apply')

;(async () => {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log('Catálogo cargado:', pairs.length, 'oposiciones')
  console.log('Modo:', APPLY ? '🚀 APPLY (escribirá cambios)' : '🔍 DRY RUN (no escribe)')
  console.log('---')

  // Paginado: todos los NULL con registration_url
  let all = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from('user_profiles')
      .select('id, email, registration_url, created_at')
      .is('target_oposicion', null)
      .not('registration_url', 'is', null)
      .range(f, f + 999)
    if (!data?.length) break
    all = all.concat(data)
    if (data.length < 1000) break
  }
  console.log('Candidatos (NULL con registration_url):', all.length)

  const stats = { asignados: 0, ambiguos: 0 }
  const reasonCounts = {}

  for (const u of all) {
    const ex = extractOposicionFromUrl(u.registration_url)
    reasonCounts[ex.reason] = (reasonCounts[ex.reason] || 0) + 1
    if (!ex.positionType) {
      stats.ambiguos++
      continue
    }
    console.log('  →', u.email.padEnd(35), u.registration_url.slice(0, 50).padEnd(50), '→', ex.positionType)
    if (APPLY) {
      const { error } = await s.from('user_profiles').update({
        target_oposicion: ex.positionType,
        first_oposicion_detected_at: new Date().toISOString(),
      }).eq('id', u.id)
      if (error) { console.error('    ❌', error.message); continue }
    }
    stats.asignados++
  }

  console.log('\n=== Resumen ===')
  console.log('  Asignados:', stats.asignados)
  console.log('  Ambiguos (sin cambio):', stats.ambiguos)
  console.log('  Por razón:', reasonCounts)
  if (!APPLY) console.log('\n(Dry run. Ejecutar con --apply para aplicar.)')
})()
