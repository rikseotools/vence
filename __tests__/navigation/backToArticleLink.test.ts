// __tests__/navigation/backToArticleLink.test.ts
// Unit test de la lógica REAL del "Volver al artículo" (la misma fn que usa
// LawTestPageWrapper → sin falso verde de test-copia).
import {
  buildBackToArticleLink,
  buildArticleTestLink,
  backToLawButtonLabel,
  buildLawFilterLink,
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

describe('backToLawButtonLabel — T-313, el botón "volver a la ley" visible DURANTE el test', () => {
  // Bug real: LawTestPageWrapper construye `{ href, label, isPrimary }` (el tipo NO
  // declara `.text`), pero el botón de arriba del test leía `.text` → undefined →
  // caía SIEMPRE al genérico. El usuario que llega desde el temario a un test de un
  // único artículo (auto-arrancado, sin pasar por el configurador visible) nunca veía,
  // en ningún momento del test, que ese botón lleva de vuelta al filtro de artículos.
  it('con el objeto real que construye LawTestPageWrapper, muestra la ley (no el genérico)', () => {
    const backToLaw = { href: '/leyes/lo-3-2007', label: '📚 Volver a LO 3/2007', isPrimary: true }
    expect(backToLawButtonLabel(backToLaw)).toBe('📚 Volver a LO 3/2007')
  })

  it('sin backToLaw (test que no es de ley), cae al genérico', () => {
    expect(backToLawButtonLabel(undefined)).toBe('Volver a Tests')
    expect(backToLawButtonLabel(null)).toBe('Volver a Tests')
  })

  it('backToLaw presente pero sin label (dato roto), cae al genérico en vez de mostrar vacío', () => {
    expect(backToLawButtonLabel({ label: '' })).toBe('Volver a Tests')
    expect(backToLawButtonLabel({})).toBe('Volver a Tests')
  })

  it('acepta un fallback propio', () => {
    expect(backToLawButtonLabel(undefined, 'Salir')).toBe('Salir')
  })

  // Regresión directa del bug: un objeto con SOLO `.text` (la forma que el código
  // roto esperaba) no tiene `.label`, así que cae al genérico — demuestra que antes
  // del fix el botón real, con el objeto real de LawTestPageWrapper, nunca podía
  // mostrar el nombre de la ley.
  it('un objeto con .text pero sin .label (la forma que el bug esperaba) cae al genérico', () => {
    const conSoloText = { text: '📚 Volver a LO 3/2007' } as unknown as { label?: string }
    expect(backToLawButtonLabel(conSoloText)).toBe('Volver a Tests')
  })
})

describe('buildLawFilterLink — T-367, camino desde el temario hasta el filtro de artículos', () => {
  it('NO lleva selected_articles (a propósito: no debe auto-arrancar el test)', () => {
    const href = buildLawFilterLink('ce')
    expect(href).not.toMatch(/selected_articles/)
  })

  it('lleva abrir_filtro=1 para que el panel no nazca plegado otra vez', () => {
    expect(buildLawFilterLink('ce')).toBe('/leyes/ce?abrir_filtro=1&source=temario_filtro')
  })

  it('acepta un source propio para diferenciar el origen en observabilidad', () => {
    expect(buildLawFilterLink('ce', 'otro_origen')).toBe('/leyes/ce?abrir_filtro=1&source=otro_origen')
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
