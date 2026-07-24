// __tests__/navigation/lawTestLink.test.ts
// Unit de la lógica PURA REAL del CTA "Hacer test de {ley}" del temario (fix T-073).
// Importa la función de producción (no una copia → sin falso verde si el código real cambia).
import { buildLawTestLink, parseSelectedArticlesScope } from '@/lib/navigation/backToArticleLink'

describe('buildLawTestLink (fix T-073: acotar el test de ley al scope del tema)', () => {
  it('un solo artículo → selected_articles con ese artículo + source=temario', () => {
    expect(buildLawTestLink('ce', [14])).toBe('/leyes/ce?selected_articles=14&source=temario')
  })

  it('varios artículos → lista separada por comas, en orden', () => {
    expect(buildLawTestLink('ce', [1, 2, 3, 9])).toBe(
      '/leyes/ce?selected_articles=1,2,3,9&source=temario',
    )
  })

  it('acepta identificadores no numéricos (disposiciones) tal cual', () => {
    expect(buildLawTestLink('lo-3-2007', ['1', 'DA1', '2'])).toBe(
      '/leyes/lo-3-2007?selected_articles=1,DA1,2&source=temario',
    )
  })

  it('normaliza números y strings mezclados y recorta espacios', () => {
    expect(buildLawTestLink('ce', [1, ' 2 ', '3'])).toBe(
      '/leyes/ce?selected_articles=1,2,3&source=temario',
    )
  })

  it('deduplica preservando el orden de primera aparición', () => {
    expect(buildLawTestLink('ce', [14, 14, 1, 14, 1])).toBe(
      '/leyes/ce?selected_articles=14,1&source=temario',
    )
  })

  it('ignora entradas vacías', () => {
    expect(buildLawTestLink('ce', ['', 1, '  ', 2])).toBe(
      '/leyes/ce?selected_articles=1,2&source=temario',
    )
  })

  it('source override respetado (p.ej. otro origen futuro)', () => {
    expect(buildLawTestLink('ce', [1], 'sidebar')).toBe(
      '/leyes/ce?selected_articles=1&source=sidebar',
    )
  })

  it('NUNCA enlaza a la ley pelada cuando hay artículos (regresión T-073)', () => {
    const url = buildLawTestLink('ce', [1, 2, 3])
    expect(url).toContain('selected_articles=')
    expect(url).not.toBe('/leyes/ce')
    expect(url).not.toBe('/leyes/ce?source=temario')
  })

  it('defensivo: sin artículos → enlace a la ley pero con source (visible para observabilidad)', () => {
    expect(buildLawTestLink('ce', [])).toBe('/leyes/ce?source=temario')
    expect(buildLawTestLink('ce', ['', '  '])).toBe('/leyes/ce?source=temario')
    // @ts-expect-error — robustez ante null en runtime
    expect(buildLawTestLink('ce', null)).toBe('/leyes/ce?source=temario')
  })

  it('codifica identificadores con espacio (disposiciones): 55 ter / 64 bis (regresión review T-073)', () => {
    expect(buildLawTestLink('ce', ['55 ter', '64 bis'])).toBe(
      '/leyes/ce?selected_articles=55%20ter,64%20bis&source=temario',
    )
    // separadores = comas literales; los tokens quedan codificados
    const sel = new URL('https://x' + buildLawTestLink('ce', ['55 ter', '64 bis'])).searchParams.get('selected_articles')
    expect(sel).toBe('55 ter,64 bis') // URLSearchParams los decodifica de vuelta
  })
})

describe('parseSelectedArticlesScope (parser real del serving — preserva strings, NO parseInt)', () => {
  it('preserva identificadores no-numéricos (disposiciones) — el defecto que cazó la review', () => {
    expect(parseSelectedArticlesScope('DA1,55 ter,IV,O2')).toEqual(['DA1', '55 ter', 'IV', 'O2'])
  })

  it('numéricos como string', () => {
    expect(parseSelectedArticlesScope('1,2,14')).toEqual(['1', '2', '14'])
  })

  it('recorta espacios, ignora vacíos, deduplica en orden', () => {
    expect(parseSelectedArticlesScope(' 1 , ,1, 2 ,2')).toEqual(['1', '2'])
  })

  it('vacío / null / undefined → []', () => {
    expect(parseSelectedArticlesScope('')).toEqual([])
    expect(parseSelectedArticlesScope(null)).toEqual([])
    expect(parseSelectedArticlesScope(undefined)).toEqual([])
  })

  it('ROUND-TRIP end-to-end: buildLawTestLink → URLSearchParams(decode) → parseSelectedArticlesScope devuelve los MISMOS ids (incl. disposiciones)', () => {
    const ids = ['1', 'DA1', '55 ter', '64 bis']
    const url = buildLawTestLink('ce', ids)
    const decoded = new URL('https://x' + url).searchParams.get('selected_articles') // lo que ve LawTestPageWrapper
    expect(parseSelectedArticlesScope(decoded)).toEqual(ids)
  })
})
