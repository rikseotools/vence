// __tests__/components/HeaderNavOposicionRace.test.ts
// Anti-race de la oposición en los nav links del Header (bug Raquel: "se me cambia la
// oposición al practicar"). Réplica de getLoggedInNavLinks (app/Header.tsx) — la real es
// inline y no exportable. Verifica que:
//  1) con oposición PRE-HIDRATADA (oposicionId set aunque loading=true) → Test/Temario a
//     la oposición del usuario, NUNCA a Estado.
//  2) en la ventana sin-caché (loading + sin oposicionId) → se OMITEN Test/Temario en vez
//     de apuntar a Estado (nunca se navega a la oposición equivocada).
//  3) usuario genuinamente sin oposición (no loading) → flagship por defecto (slug real).
import { ALL_OPOSICION_SLUGS, getOposicion } from '@/lib/config/oposiciones'

const DEFAULT_SLUG = ALL_OPOSICION_SLUGS[0]
const COMMON = ['/leyes', '/test/por-leyes', '/psicotecnicos/test', '/oposiciones']

function loggedInNavHrefs(oposicionId: string | null, loading: boolean): string[] {
  const opoSlug = oposicionId ? getOposicion(oposicionId)?.slug : null
  const opoResolved = !!opoSlug && ALL_OPOSICION_SLUGS.includes(opoSlug)
  if (opoResolved) return [`/${opoSlug}/test`, `/${opoSlug}/temario`, ...COMMON]
  if (loading) return COMMON
  return [`/${DEFAULT_SLUG}/test`, `/${DEFAULT_SLUG}/temario`, ...COMMON]
}

const MADRID = 'auxiliar_administrativo_madrid'

describe('Header getLoggedInNavLinks — anti-race oposición (bug Raquel)', () => {
  it('1) oposición PRE-HIDRATADA durante loading → Test apunta a Madrid, NO a Estado', () => {
    const hrefs = loggedInNavHrefs(MADRID, /* loading */ true)
    expect(hrefs).toContain('/auxiliar-administrativo-madrid/test')
    expect(hrefs).toContain('/auxiliar-administrativo-madrid/temario')
    expect(hrefs).not.toContain('/auxiliar-administrativo-estado/test')
  })

  it('2) loading SIN oposición (1er load sin caché) → OMITE Test/Temario, NO navega a Estado', () => {
    const hrefs = loggedInNavHrefs(null, true)
    expect(hrefs).toEqual(COMMON)
    expect(hrefs).not.toContain('/auxiliar-administrativo-estado/test')
    expect(hrefs).not.toContain('/auxiliar-administrativo-estado/temario')
    // No hay ningún link de "Test de oposición" (el único /test es psicotécnicos):
    const opoTestLinks = hrefs.filter(h => h.endsWith('/test') && h !== '/psicotecnicos/test')
    expect(opoTestLinks).toHaveLength(0)
  })

  it('3) usuario logueado SIN oposición (no loading) → flagship por defecto (slug real)', () => {
    const hrefs = loggedInNavHrefs(null, false)
    expect(hrefs).toContain(`/${DEFAULT_SLUG}/test`)
    expect(DEFAULT_SLUG).toBe('auxiliar-administrativo-estado')
  })

  it('regresión: nunca genera /oposiciones/test (404) — el default es un slug real', () => {
    expect(loggedInNavHrefs(null, false)).not.toContain('/oposiciones/test')
    expect(ALL_OPOSICION_SLUGS.includes(DEFAULT_SLUG)).toBe(true)
  })

  it('otra oposición (no-Estado) también resuelve a la suya durante loading', () => {
    const hrefs = loggedInNavHrefs('auxiliar_administrativo_carm', true)
    expect(hrefs).toContain('/auxiliar-administrativo-carm/test')
    expect(hrefs).not.toContain('/auxiliar-administrativo-estado/test')
  })
})
