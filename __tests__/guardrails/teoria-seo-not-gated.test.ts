// Guardrail SEO: el límite de búsquedas NO debe gatear el ACCESO a leyes.
//
// El gate de búsquedas (lib/api/featureLimits) solo puede vivir en el endpoint
// de búsqueda. Las páginas de teoría que rankean en Google —catálogo, ley,
// artículo— DEBEN quedar libres y crawleables. Si un refactor futuro importa el
// primitivo de límite en esas rutas, este test lo caza antes de romper el SEO.

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : '')

describe('guardrail: el SEO de teoría no se gatea', () => {
  const seoRoutes = [
    'app/teoria/page.tsx', // catálogo (listado indexable)
    'app/teoria/[law]/[articleNumber]/page.tsx', // artículo (lo que rankea)
    'app/api/teoria/[law]/[articleNumber]/route.ts', // API del artículo
    'app/api/teoria/articles/route.ts',
    'app/api/teoria/sections/route.ts',
  ]

  it.each(seoRoutes)('%s NO importa el primitivo de límite (queda libre/crawleable)', (route) => {
    const src = read(route)
    expect(src).not.toMatch(/featureLimits|checkFeatureLimit|getFeatureLimitStatus|consumeFeatureLimit/)
  })

  it('la página de artículo sigue declarando robots index:true (indexable)', () => {
    const src = read('app/teoria/[law]/[articleNumber]/page.tsx')
    expect(src).toMatch(/index:\s*true/)
  })

  it('el gate SÍ vive en el endpoint de búsqueda (y solo ahí)', () => {
    const search = read('app/api/teoria/search/route.ts')
    expect(search).toMatch(/getFeatureLimitStatus|consumeFeatureLimit/)
  })
})
