// __tests__/integration/postTestOposicionBounce.test.ts
// SIMULACIÓN del journey real que rompió (10/07/2026):
// usuario con oposición → lanza test GLOBAL (campana "/test/rapido", "mantener-racha",
// práctica IA) → al terminar, "Volver a Tests" debe llevar a SU oposición, no rebotar.
//
// Reproduce a las dos reporteras reales: jinayda32 (Madrid) y flor7687 (Valencia).
import {
  resolveOposicionSlugForNav,
  FLAGSHIP_OPOSICION_SLUG,
  ALL_OPOSICION_SLUGS,
} from '@/lib/config/oposiciones'

// Rutas de test GLOBALES (sin slug de oposición en la URL) desde donde se lanzan
// tests: la campana (NotificationBell → /test/rapido, /test/mantener-racha) y la
// práctica IA. Son deliberadamente globales (position_type NULL).
const GLOBAL_TEST_ROUTES = [
  '/test/rapido',
  '/test/mantener-racha',
  '/test/aleatorio',
  '/test/por-leyes',
]

const REPORTERS = [
  { email: 'jinayda32', oposicionId: 'auxiliar_administrativo_madrid', slug: 'auxiliar-administrativo-madrid' },
  { email: 'flor7687', oposicionId: 'auxiliar_administrativo_valencia', slug: 'auxiliar-administrativo-valencia' },
]

describe('journey: fin de test global no rebota de oposición', () => {
  for (const r of REPORTERS) {
    for (const route of GLOBAL_TEST_ROUTES) {
      it(`${r.email} (${r.oposicionId}) termina en ${route} → vuelve a SU oposición`, () => {
        const dest = `/${resolveOposicionSlugForNav(route, r.oposicionId)}/test`
        expect(dest).toBe(`/${r.slug}/test`)
        // y explícitamente NO a la 1ª del config (Técnico Informática) ni al flagship
        expect(dest).not.toBe(`/${ALL_OPOSICION_SLUGS[0]}/test`)
      })
    }
  }

  it('mismo journey pero ANÓNIMO → flagship estable (no [0])', () => {
    for (const route of GLOBAL_TEST_ROUTES) {
      expect(resolveOposicionSlugForNav(route, null)).toBe(FLAGSHIP_OPOSICION_SLUG)
    }
  })

  it('si el usuario está EN una oposición concreta (URL con slug), respeta esa', () => {
    // Explorando un test de otra oposición: la URL manda (comportamiento previo OK)
    expect(resolveOposicionSlugForNav('/auxiliar-administrativo-cyl/test/tema/3', 'auxiliar_administrativo_madrid'))
      .toBe('auxiliar-administrativo-cyl')
  })
})
