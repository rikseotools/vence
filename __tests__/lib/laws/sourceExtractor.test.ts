import { extractArticleNumbers, compareSourceToDb, normalizeArticleNumber } from '@/lib/laws/sourceExtractor'

describe('extractArticleNumbers — formatos heterogéneos de boletines', () => {
  test('formato estándar "Artículo N.–"', () => {
    const t = 'Artículo 1.– Objeto.\nBla.\nArtículo 2.– Ámbito.\nBla.'
    expect([...extractArticleNumbers(t)]).toEqual(['1', '2'])
  })
  test('variantes: "Artículo. 43.–", "Artículo 47. ", bis y ter', () => {
    const t = 'Artículo. 43.– X.\nArtículo. 43. Bis.– Y.\nArtículo 47. Z.\nArtículo 63 bis.– W.\nArtículo 18 ter.- V.'
    expect(extractArticleNumbers(t)).toEqual(new Set(['43', '43 bis', '47', '63 bis', '18 ter']))
  })
  test('Bis en mayúscula normaliza a minúscula', () => {
    expect(extractArticleNumbers('Artículo 5 Bis.– X.').has('5 bis')).toBe(true)
  })
  test('texto sin articulado (plan/estrategia) → conjunto vacío', () => {
    const t = 'PLAN DE IGUALDAD. Eje 1. Objetivos. Medida 1.1. Acciones. Indicadores.'
    expect(extractArticleNumbers(t).size).toBe(0)
  })
  test('no confunde referencias cruzadas "del artículo 60 LOSU" en cuerpo con un artículo propio', () => {
    // "del artículo 60" no lleva el separador .–/. tras el número → no matchea
    const t = 'Artículo 1.– Los ingresos derivados de contratos del artículo 60 de la LOSU se rigen por...'
    expect([...extractArticleNumbers(t)]).toEqual(['1'])
  })
  test('null/empty → vacío', () => {
    expect(extractArticleNumbers(null).size).toBe(0)
    expect(extractArticleNumbers('').size).toBe(0)
  })
})

describe('compareSourceToDb — veredicto honesto', () => {
  test('completo → verified', () => {
    const src = 'Artículo 1.– a.\nArtículo 2.– b.\nArtículo 3.– c.'
    const r = compareSourceToDb(src, ['1', '2', '3'])
    expect(r.verdict).toBe('verified'); expect(r.missing).toEqual([]); expect(r.unparseable).toBe(false)
  })
  test('faltan artículos → incomplete con lista (caso ULE 9 de 74)', () => {
    const src = Array.from({ length: 74 }, (_, i) => `Artículo ${i + 1}.– x.`).join('\n')
    const r = compareSourceToDb(src, ['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(r.verdict).toBe('incomplete')
    expect(r.srcCount).toBe(74); expect(r.dbCount).toBe(9); expect(r.missing.length).toBe(65)
  })
  test('normaliza bis: DB "18 BIS" == fuente "18 bis"', () => {
    const src = 'Artículo 17.– a.\nArtículo 18.– b.\nArtículo 18 bis.– c.'
    const r = compareSourceToDb(src, ['17', '18', '18 BIS'])
    expect(r.verdict).toBe('verified')
  })
  test('fuente sin articulado (<3 arts) → unparseable, NO incomplete (anti-falso-incompleto)', () => {
    const r = compareSourceToDb('PLAN DE IGUALDAD. Ejes y medidas.', ['1', '2', '3', '4'])
    expect(r.unparseable).toBe(true)
    expect(r.verdict).not.toBe('incomplete')
  })
  test('fetch fallido (texto null) → unparseable, nunca finge verified sobre datos', () => {
    const r = compareSourceToDb(null, ['1', '2', '3'])
    expect(r.unparseable).toBe(true)
  })
})

describe('normalizeArticleNumber', () => {
  test('colapsa espacios y baja a minúscula', () => {
    expect(normalizeArticleNumber('  18   BIS ')).toBe('18 bis')
  })
  test('unifica sufijo con/sin espacio: "38bis" == "38 bis" == "38 BIS"', () => {
    expect(normalizeArticleNumber('38bis')).toBe('38 bis')
    expect(normalizeArticleNumber('38 bis')).toBe('38 bis')
    expect(normalizeArticleNumber('38 BIS')).toBe('38 bis')
    expect(normalizeArticleNumber('53ter')).toBe('53 ter')
  })
})
