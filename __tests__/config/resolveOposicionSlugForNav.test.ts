// __tests__/config/resolveOposicionSlugForNav.test.ts
// Layer 1 (unit) del fix del "rebote de oposición" tras un test global.
//
// Bug real (jinayda32 / flor7687, 10/07/2026): al terminar un test lanzado desde
// la campana ("/test/rapido") o la práctica IA, la navegación fin-de-test usaba
// `getOposicionSlugFromPathname(pathname)`, que para una URL SIN slug devolvía
// `ALL_OPOSICION_SLUGS[0]` (= "tecnico-informatica" desde el alta de TAI el
// 07/07) → botaba al usuario a Informática en lugar de SU oposición.
import {
  resolveOposicionSlugForNav,
  getOposicionSlugFromPathname,
  FLAGSHIP_OPOSICION_SLUG,
  ALL_OPOSICION_SLUGS,
  ID_TO_SLUG,
} from '@/lib/config/oposiciones'

describe('resolveOposicionSlugForNav', () => {
  it('1) slug explícito en la URL gana (contexto de esa oposición)', () => {
    expect(resolveOposicionSlugForNav('/auxiliar-administrativo-madrid/test/tema/5', 'auxiliar_administrativo_valencia'))
      .toBe('auxiliar-administrativo-madrid')
    // aunque el usuario sea de otra, la URL manda si trae slug conocido
    expect(resolveOposicionSlugForNav('/auxiliar-administrativo-estado/test', null))
      .toBe('auxiliar-administrativo-estado')
  })

  it('2) ruta GLOBAL sin slug + usuario logueado → SU oposición (por id)', () => {
    // Caso jinayda (Madrid) terminando un test de la campana
    expect(resolveOposicionSlugForNav('/test/rapido', 'auxiliar_administrativo_madrid'))
      .toBe('auxiliar-administrativo-madrid')
    // Caso flor (Valencia) terminando la práctica IA
    expect(resolveOposicionSlugForNav('/test/mantener-racha', 'auxiliar_administrativo_valencia'))
      .toBe('auxiliar-administrativo-valencia')
  })

  it('2b) admite también que le pasen ya el SLUG del usuario', () => {
    expect(resolveOposicionSlugForNav('/test/rapido', 'auxiliar-administrativo-madrid'))
      .toBe('auxiliar-administrativo-madrid')
  })

  it('2c) admite también el positionType (para ExamLayout)', () => {
    // positionType del catálogo → slug (ni id ni slug directamente)
    const { POSITION_TYPE_TO_SLUG } = jest.requireActual('@/lib/config/oposiciones')
    const [pt, slug] = Object.entries(POSITION_TYPE_TO_SLUG)[0] as [string, string]
    expect(resolveOposicionSlugForNav('/test/rapido', pt)).toBe(slug)
  })

  it('3) ruta global + anónimo/sin oposición → FLAGSHIP estable (NUNCA [0])', () => {
    expect(resolveOposicionSlugForNav('/test/rapido', null)).toBe(FLAGSHIP_OPOSICION_SLUG)
    expect(resolveOposicionSlugForNav('/test/rapido', undefined)).toBe(FLAGSHIP_OPOSICION_SLUG)
    expect(resolveOposicionSlugForNav(null, null)).toBe(FLAGSHIP_OPOSICION_SLUG)
  })

  it('id de usuario inválido/desconocido → FLAGSHIP (no rompe ni bota)', () => {
    expect(resolveOposicionSlugForNav('/test/rapido', 'basura_que_no_existe'))
      .toBe(FLAGSHIP_OPOSICION_SLUG)
  })

  it('REGRESIÓN "bug Raquel": una ruta global NUNCA resuelve a ALL_OPOSICION_SLUGS[0] si [0] no es el flagship', () => {
    const primero = ALL_OPOSICION_SLUGS[0]
    // Solo es un test significativo mientras [0] ≠ flagship (hoy [0]='tecnico-informatica')
    if (primero !== FLAGSHIP_OPOSICION_SLUG) {
      expect(resolveOposicionSlugForNav('/test/rapido', null)).not.toBe(primero)
      expect(getOposicionSlugFromPathname('/test/rapido')).not.toBe(primero)
    }
    // el flagship designado sí debe ser un slug real del catálogo
    expect(ALL_OPOSICION_SLUGS).toContain(FLAGSHIP_OPOSICION_SLUG)
  })

  it('getOposicionSlugFromPathname: back-compat = URL o FLAGSHIP (sin oposición de usuario)', () => {
    expect(getOposicionSlugFromPathname('/auxiliar-administrativo-cyl/test')).toBe('auxiliar-administrativo-cyl')
    expect(getOposicionSlugFromPathname('/test/rapido')).toBe(FLAGSHIP_OPOSICION_SLUG)
    expect(getOposicionSlugFromPathname(null)).toBe(FLAGSHIP_OPOSICION_SLUG)
  })

  it('coherencia: el slug devuelto para un id de usuario coincide con ID_TO_SLUG', () => {
    const someId = Object.keys(ID_TO_SLUG)[0]
    expect(resolveOposicionSlugForNav('/test/rapido', someId)).toBe(ID_TO_SLUG[someId])
  })
})
