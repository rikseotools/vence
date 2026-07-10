// __tests__/navigation/backToArticleLink.test.ts
// Unit test de la lógica REAL del "Volver al artículo" (la misma fn que usa
// LawTestPageWrapper → sin falso verde de test-copia).
import {
  buildBackToArticleLink,
  buildArticleTestLink,
} from '@/lib/navigation/backToArticleLink'

describe('buildBackToArticleLink', () => {
  it('artículo único numérico → enlace al artículo (fix del bug)', () => {
    expect(buildBackToArticleLink('3', 'decreto-42-2019')).toEqual({
      href: '/teoria/decreto-42-2019/articulo-3',
      label: 'Volver al artículo 3',
      isPrimary: true,
    })
  })

  it('recorta espacios', () => {
    expect(buildBackToArticleLink('  14 ', 'ce')?.href).toBe('/teoria/ce/articulo-14')
  })

  it('VARIOS artículos → null (no hay "el" artículo)', () => {
    expect(buildBackToArticleLink('3,4', 'ce')).toBeNull()
    expect(buildBackToArticleLink('1,2,3', 'ce')).toBeNull()
  })

  it('no numérico (disposición) → null', () => {
    expect(buildBackToArticleLink('DA1', 'ce')).toBeNull()
    expect(buildBackToArticleLink('abc', 'ce')).toBeNull()
  })

  it('vacío / nulo / sin slug → null (cae a los enlaces de siempre)', () => {
    expect(buildBackToArticleLink('', 'ce')).toBeNull()
    expect(buildBackToArticleLink(null, 'ce')).toBeNull()
    expect(buildBackToArticleLink(undefined, 'ce')).toBeNull()
    expect(buildBackToArticleLink('3', '')).toBeNull()
    expect(buildBackToArticleLink('3', null)).toBeNull()
  })

  it('cero / negativos → null (no son artículos válidos)', () => {
    expect(buildBackToArticleLink('0', 'ce')).toBeNull()
    expect(buildBackToArticleLink('-5', 'ce')).toBeNull()
  })

  it('mezcla de válido + basura → toma el único válido', () => {
    // "3,abc" → solo 3 es válido → sigue siendo un único artículo
    expect(buildBackToArticleLink('3,abc', 'ce')?.href).toBe('/teoria/ce/articulo-3')
  })
})

describe('buildArticleTestLink', () => {
  it('genera el enlace al test acotado a un único artículo (con source=teoria)', () => {
    expect(buildArticleTestLink('decreto-42-2019', 10)).toBe(
      '/leyes/decreto-42-2019?selected_articles=10&source=teoria'
    )
  })

  it('ROUND-TRIP: el test lanzado desde el lector vuelve al MISMO artículo', () => {
    // Invariante clave del fix (bug manuel izquierdo): el CTA del lector debe
    // cerrar el bucle con "Volver al artículo" sin perder el artículo. Se prueban
    // juntos porque comparten el contrato del parámetro `selected_articles`.
    const lawSlug = 'decreto-42-2019-condiciones-trabajo-gva'
    for (const n of [1, 9, 10, 54]) {
      const testHref = buildArticleTestLink(lawSlug, n)
      // Extraer selected_articles tal como lo leería LawTestPageWrapper.
      const selected = new URL(testHref, 'https://x').searchParams.get('selected_articles')
      const back = buildBackToArticleLink(selected, lawSlug)
      expect(back?.href).toBe(`/teoria/${lawSlug}/articulo-${n}`)
    }
  })
})
