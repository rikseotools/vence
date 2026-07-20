import { readFileSync } from 'fs'
import { join } from 'path'

// GUARDRAIL de producto (Manuel, 20/07): en un BANNER nunca se muestra una convocatoria
// de menos de 10 plazas. Antes el banner de la home solo personalizaba por familia y
// ordenaba por cierre: de 51 convocatorias vivas, 24 tenían ≤4 plazas y 14 UNA sola, y el
// teaser general llegaba a mostrar 9 de 10 con ≤4 — la primera imagen del sitio para un
// usuario nuevo. Este test falla si alguien quita el filtro de una de las dos superficies.
//
// OJO: la página SEO /oposiciones/inscripcion-abierta ("ver todas") queda FUERA a
// propósito: ahí "todas" significa todas y es donde vive la cola larga de SEO.

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('GUARDRAIL: los banners no muestran convocatorias de menos de 10 plazas', () => {
  it('el mínimo vive en la fuente de verdad compartida', () => {
    const src = read('lib/oposiciones/inscripcion.ts')
    expect(src).toMatch(/export const BANNER_MIN_PLAZAS = 10/)
    expect(src).toMatch(/export function hasSignificantPlazas/)
    expect(src).toMatch(/export function isBannerWorthy/)
  })

  it('el banner de la home filtra por el predicado compartido', () => {
    const src = read('app/page.tsx')
    expect(src).toMatch(/isBannerWorthy/)
  })

  it('el banner autenticado filtra por plazas en SQL', () => {
    const src = read('app/api/v2/banner/open-inscriptions/route.ts')
    expect(src).toMatch(/BANNER_MIN_PLAZAS/)
    expect(src).toMatch(/gte\(oposiciones\.plazasLibres, BANNER_MIN_PLAZAS\)/)
  })
})
