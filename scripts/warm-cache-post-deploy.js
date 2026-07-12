#!/usr/bin/env node
// scripts/warm-cache-post-deploy.js
// Visita todas las páginas force-dynamic tras un deploy para que ningún
// usuario sea el primero en cargar una página fría.
//
// Estrategia: lee oposiciones + temas de BD para generar ~963 URLs,
// y las visita con concurrencia 8. Si no hay BD (CI sin secrets),
// parsea el sitemap de la web como fallback.
//
// Uso:
//   node scripts/warm-cache-post-deploy.js                           # producción
//   node scripts/warm-cache-post-deploy.js https://preview.vence.es  # preview
//
// Ejecutado automáticamente por GitHub Actions tras cada deploy exitoso.
// También se puede lanzar manualmente tras un deploy.

try { require('dotenv').config({ path: '.env.local' }) } catch {}

const BASE_URL = process.argv[2] || 'https://www.vence.es'
const CONCURRENT = 3      // peticiones simultáneas (8 saturaba BD con 963 SSR queries)
const TIMEOUT_MS = 30_000 // 30s timeout por página

// ============================================================================
// Generar URLs desde BD (método principal)
// ============================================================================

async function generateUrlsFromDB() {
  const { createClient } = require('@supabase/supabase-js')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const supabase = createClient(url, key)
  const urls = []

  // 1. Oposiciones activas: landing + test + temario index
  const { data: oposiciones } = await supabase
    .from('oposiciones')
    .select('slug')
    .eq('is_active', true)

  if (!oposiciones || oposiciones.length === 0) return null

  const opSlugs = oposiciones.map(o => o.slug)
  for (const slug of opSlugs) {
    urls.push(`/${slug}`)
    urls.push(`/${slug}/test`)
    urls.push(`/${slug}/temario`)
  }

  // 2. Temas de cada oposición: /{slug}/temario/tema-{N}
  const { data: topics } = await supabase
    .from('topics')
    .select('position_type, topic_number')
    .eq('disponible', true)
    .order('position_type')
    .order('topic_number')

  // Mapear position_type → slug (convention: _ → -)
  const ptToSlug = {}
  for (const slug of opSlugs) ptToSlug[slug.replace(/-/g, '_')] = slug

  for (const topic of topics || []) {
    const slug = ptToSlug[topic.position_type]
    if (slug) urls.push(`/${slug}/temario/tema-${topic.topic_number}`)
  }

  // 3. Páginas estáticas
  urls.push('/', '/leyes', '/oposiciones', '/teoria', '/test-oposiciones')
  urls.push('/temarios', '/psicotecnicos', '/ayuda')
  // /nuestras-oposiciones es 308 redirect → /oposiciones (ya incluido arriba). No warmar.

  // 4. Leyes top-SEO (/leyes/<slug>). Desde 12/07/2026 /leyes/[law] es on-demand
  //    (ya NO se prerenderiza en build — ver build-resilience-leyes-ondemand.md) →
  //    calentamos aquí las de más tráfico orgánico para que el 1er hit de Googlebot
  //    NO sea en frío. Set curado de los códigos legales mayores (verificados en RDS).
  //    Actualizar con `npm run gsc:seo` si el ranking de leyes cambia.
  for (const slug of HOT_LAW_SLUGS) urls.push(`/leyes/${slug}`)

  return urls
}

// Leyes de más tráfico orgánico (códigos legales mayores). Verificadas activas en
// RDS el 12/07/2026. Se calientan post-deploy porque /leyes/[law] es on-demand.
const HOT_LAW_SLUGS = [
  'constitucion-espanola', 'ley-39-2015', 'ley-40-2015', 'codigo-penal', 'codigo-civil',
  'ley-1-2000', 'lo-6-1985', 'rdl-5-2015', 'lprl', 'lo-3-2018', 'lo-3-2007', 'lo-2-1986',
  'lo-1-2004', 'ley-7-1985', 'ley-19-2013', 'ley-9-2017', 'ley-50-1997', 'ley-47-2003',
  'ley-29-1998', 'ley-38-2003', 'estatuto-trabajadores', 'tue', 'tfue',
]

// ============================================================================
// Fallback: parsear sitemaps de la web (sin BD)
// ============================================================================

async function generateUrlsFromSitemap() {
  console.log('  ⚠️  Sin credenciales BD, usando sitemap como fallback...')
  const urls = []

  // Obtener sitemap index
  const indexRes = await fetch(`${BASE_URL}/sitemap.xml`)
  const indexXml = await indexRes.text()

  // Extraer URLs de sub-sitemaps
  const sitemapLocs = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])

  for (const loc of sitemapLocs) {
    const res = await fetch(loc)
    const xml = await res.text()
    const pageLocs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
    for (const pageUrl of pageLocs) {
      const path = pageUrl.replace(BASE_URL, '')
      if (path) urls.push(path)
    }
  }

  // Añadir las páginas que el sitemap no incluye pero son importantes
  urls.push('/', '/teoria', '/ayuda')

  return urls
}

// ============================================================================
// Fetch con timeout
// ============================================================================

async function warmUrl(url) {
  const fullUrl = `${BASE_URL}${url}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(fullUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VenceWarmup/1.0' },
    })
    clearTimeout(timer)
    return { url, status: res.status, ok: res.status === 200 }
  } catch (err) {
    clearTimeout(timer)
    const reason = err.name === 'AbortError' ? 'TIMEOUT' : err.code || 'ERROR'
    return { url, status: reason, ok: false }
  }
}

// ============================================================================
// Ejecutar con concurrencia limitada
// ============================================================================

async function warmBatch(urls, concurrent) {
  const results = { ok: 0, fail: 0, errors: [] }
  const queue = [...urls]
  let completed = 0

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift()
      if (!url) break
      const result = await warmUrl(url)
      completed++

      if (result.ok) {
        results.ok++
      } else {
        results.fail++
        results.errors.push(`${result.status} ${result.url}`)
      }

      if (completed % 50 === 0 || completed === urls.length) {
        const pct = Math.round((completed / urls.length) * 100)
        console.log(`  ${completed}/${urls.length} (${pct}%) — ${results.ok} OK, ${results.fail} fallos`)
      }
    }
  }

  const workers = Array.from({ length: concurrent }, () => worker())
  await Promise.all(workers)
  return results
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('📡 Generando lista de URLs...')

  let urls = await generateUrlsFromDB()
  let source = 'BD'
  if (!urls) {
    urls = await generateUrlsFromSitemap()
    source = 'sitemap'
  }

  console.log('')
  console.log(`🔥 Cache warmup post-deploy`)
  console.log(`   Base URL:     ${BASE_URL}`)
  console.log(`   Fuente:       ${source}`)
  console.log(`   Páginas:      ${urls.length}`)
  console.log(`   Concurrencia: ${CONCURRENT}`)
  console.log('')

  const start = Date.now()
  const results = await warmBatch(urls, CONCURRENT)
  const elapsed = Math.round((Date.now() - start) / 1000)

  console.log('')
  console.log(`✅ Completado en ${elapsed}s`)
  console.log(`   ${results.ok} OK / ${results.fail} fallos / ${urls.length} total`)

  if (results.errors.length > 0) {
    console.log('')
    console.log(`⚠️  Errores (${results.errors.length}):`)
    for (const e of results.errors.slice(0, 20)) {
      console.log(`   ${e}`)
    }
    if (results.errors.length > 20) {
      console.log(`   ... y ${results.errors.length - 20} más`)
    }
  }

  // Exit code no-zero si >10% de fallos
  if (results.fail > urls.length * 0.1) {
    console.error(`\n❌ Demasiados fallos (${results.fail}/${urls.length}). Revisar.`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})
