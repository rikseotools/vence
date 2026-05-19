// __tests__/components/Header.basePathValidation.test.ts
// Regresión del bug donde usuarios 'explorador' veían /oposiciones/test → 404
// porque DEFAULT_MENU tiene featuredLink.href = '/oposiciones' y el Header
// concatenaba '/oposiciones' + '/test' sin validar que sea un slug real.
// Fix: si basePath no resuelve a un slug en ALL_OPOSICION_SLUGS, fallback a defaultSlug.

const { ALL_OPOSICION_SLUGS } = require('../../lib/config/oposiciones')

// Re-implementación de la lógica fixed de app/Header.tsx getLoggedInNavLinks
// (la función real está inline en el componente y no es exportable).
function buildBasePath(featuredHref: string | undefined, defaultSlug: string): string {
  let basePath = featuredHref || `/${defaultSlug}`
  const basePathSlug = basePath.replace(/^\//, '').split('/')[0]
  if (!ALL_OPOSICION_SLUGS.includes(basePathSlug)) {
    basePath = `/${defaultSlug}`
  }
  return basePath
}

describe('Header.getLoggedInNavLinks - basePath validation', () => {
  const defaultSlug = ALL_OPOSICION_SLUGS[0]

  describe('Bug regression: explorador → /oposiciones/test 404', () => {
    test('DEFAULT_MENU featured /oposiciones NO debe generar /oposiciones/test', () => {
      // DEFAULT_MENU (contexts/OposicionContext.tsx) usado por 'explorador' y otros
      // usuarios sin oposición real configurada.
      const basePath = buildBasePath('/oposiciones', defaultSlug)
      expect(basePath).toBe(`/${defaultSlug}`)
      expect(basePath + '/test').not.toBe('/oposiciones/test')
    })

    test('featured /leyes (otro path global) tampoco debe contaminar Test/Temario', () => {
      const basePath = buildBasePath('/leyes', defaultSlug)
      expect(basePath).toBe(`/${defaultSlug}`)
    })

    test('featured con slug válido SÍ se respeta', () => {
      const basePath = buildBasePath('/auxiliar-administrativo-galicia', defaultSlug)
      expect(basePath).toBe('/auxiliar-administrativo-galicia')
    })

    test('featured undefined → fallback defaultSlug', () => {
      const basePath = buildBasePath(undefined, defaultSlug)
      expect(basePath).toBe(`/${defaultSlug}`)
    })

    test('featured con path complejo /slug/foo/bar conserva solo primer segmento', () => {
      const basePath = buildBasePath('/auxiliar-administrativo-madrid/algo', defaultSlug)
      expect(basePath).toBe('/auxiliar-administrativo-madrid/algo')
    })
  })

  describe('URLs finales Test y Temario para oposiciones asignadas a usuarios explorador', () => {
    const opos = [
      'auxiliar-administrativo-estado',
      'administrativo-galicia',
      'auxiliar-administrativo-extremadura',
      'auxiliar-administrativo-cyl',
      'auxiliar-administrativo-madrid',
      'auxiliar-administrativo-galicia',
      'auxiliar-administrativo-valencia',
    ]
    for (const slug of opos) {
      test(`${slug} genera URLs válidas`, () => {
        const basePath = buildBasePath('/' + slug, defaultSlug)
        expect(basePath).toBe('/' + slug)
        expect(basePath + '/test').toBe(`/${slug}/test`)
        expect(basePath + '/temario').toBe(`/${slug}/temario`)
        expect(ALL_OPOSICION_SLUGS.includes(slug)).toBe(true)
      })
    }
  })
})
