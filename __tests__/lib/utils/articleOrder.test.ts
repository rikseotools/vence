// __tests__/lib/utils/articleOrder.test.ts
//
// Verifica que compareArticleNumbers produce el orden BOE correcto en TODAS
// las familias documentadas en la taxonomía real de BD (1.176 article_numbers
// no numéricos distintos auditados el 2026-05-26).
//
// Si un test falla por una variante nueva, hay que añadirla al parser
// (lib/utils/articleOrder.ts) y al test correspondiente — sin volver a fiarse
// del orden lexicográfico que rompió la visualización del Estatuto CM.

import {
  ArticleCategory,
  compareArticleNumbers,
  parseArticleNumber,
  sortByArticleNumber,
} from '@/lib/utils/articleOrder'

/** Helper: ordena por number y devuelve solo los strings */
function sortRaw(arr: string[]): string[] {
  return [...arr].sort(compareArticleNumbers)
}

describe('parseArticleNumber — clasificación por categoría', () => {
  const cases: Array<[string, ArticleCategory]> = [
    // Exposición de motivos
    ['EM', ArticleCategory.EXPOSICION_DE_MOTIVOS],
    ['EMP', ArticleCategory.EXPOSICION_DE_MOTIVOS],
    ['EXP', ArticleCategory.EXPOSICION_DE_MOTIVOS],
    ['Exp', ArticleCategory.EXPOSICION_DE_MOTIVOS],
    ['exp', ArticleCategory.EXPOSICION_DE_MOTIVOS],

    // Preámbulo (todas las variantes vistas en BD)
    ['preámbulo', ArticleCategory.PREAMBULO],
    ['Preámbulo', ArticleCategory.PREAMBULO],
    ['Preambulo', ArticleCategory.PREAMBULO],
    ['preambulo', ArticleCategory.PREAMBULO],
    ['Preámbulo_II', ArticleCategory.PREAMBULO],
    ['preámbulo1a', ArticleCategory.PREAMBULO],
    ['pre', ArticleCategory.PREAMBULO],

    // Títulos y capítulos
    ['TP', ArticleCategory.TITULO],
    ['T1', ArticleCategory.TITULO],
    ['T10', ArticleCategory.TITULO],
    ['T1C1', ArticleCategory.TITULO],
    ['T3C3', ArticleCategory.TITULO],
    ['Cap. 1', ArticleCategory.TITULO],
    ['Cap. 6', ArticleCategory.TITULO],

    // Artículos numéricos básicos
    ['1', ArticleCategory.ARTICULO],
    ['10', ArticleCategory.ARTICULO],
    ['100', ArticleCategory.ARTICULO],

    // Artículos con bis/ter/quater
    ['1 bis', ArticleCategory.ARTICULO],
    ['100 ter', ArticleCategory.ARTICULO],
    ['84 quater', ArticleCategory.ARTICULO],
    ['100 quinquies', ArticleCategory.ARTICULO],
    ['84 bis 2', ArticleCategory.ARTICULO],

    // Sub-numéricos
    ['147.1', ArticleCategory.ARTICULO],
    ['8.20', ArticleCategory.ARTICULO],

    // Typos con underscore
    ['66_bis', ArticleCategory.ARTICULO],
    ['90_bis', ArticleCategory.ARTICULO],
    ['114_bis', ArticleCategory.ARTICULO],

    // Ordinales en palabras (artículos sueltos tipo "Primero", "Decimo")
    ['Primero', ArticleCategory.ARTICULO],
    ['Octavo', ArticleCategory.ARTICULO],
    ['Decimo', ArticleCategory.ARTICULO],

    // DA — todas sus variantes
    ['DA', ArticleCategory.DA],
    ['DA1', ArticleCategory.DA],
    ['DA 1', ArticleCategory.DA],
    ['DAunica', ArticleCategory.DA],
    ['DA Primera', ArticleCategory.DA],
    ['DA_adicional_primera', ArticleCategory.DA],
    ['DAcuadragésima', ArticleCategory.DA],
    ['DAvigesimoctava', ArticleCategory.DA],
    ['DAvigésima_primera', ArticleCategory.DA],
    ['dacuadragésima_cuarta', ArticleCategory.DA],
    ['Disposición Adicional Segunda', ArticleCategory.DA],
    ['DAU', ArticleCategory.DA],
    ['DA Nª', ArticleCategory.DA],

    // DT
    ['DT', ArticleCategory.DT],
    ['DT1', ArticleCategory.DT],
    ['DT Única', ArticleCategory.DT],
    ['DT_transitoria_primera', ArticleCategory.DT],
    ['dtvigésima_cuarta', ArticleCategory.DT],

    // DD
    ['DD', ArticleCategory.DD],
    ['DDunica', ArticleCategory.DD],
    ['DDU', ArticleCategory.DD],
    ['DA_derogatoria_unica', ArticleCategory.DD],

    // DF
    ['DF', ArticleCategory.DF],
    ['DF1', ArticleCategory.DF],
    ['DF 1ª', ArticleCategory.DF],
    ['DFunica', ArticleCategory.DF],
    ['DFprimera_bis', ArticleCategory.DF],
    ['Dfcuarta', ArticleCategory.DF],
    ['DA_final_primera', ArticleCategory.DF],
    ['Disposición Final Cuarta', ArticleCategory.DF],

    // Anexos
    ['Anexo I', ArticleCategory.ANEXO],
    ['Anexo II', ArticleCategory.ANEXO],
    ['Anexo X', ArticleCategory.ANEXO],
    ['Anexo_I', ArticleCategory.ANEXO],
    ['ANEXO III', ArticleCategory.ANEXO],
    ['anexo', ArticleCategory.ANEXO],
    ['A1', ArticleCategory.ANEXO],
    ['A3', ArticleCategory.ANEXO],

    // Romanos sueltos → Títulos
    ['I', ArticleCategory.TITULO],
    ['IV', ArticleCategory.TITULO],

    // Desconocidos al final
    ['Compromiso8', ArticleCategory.OTHER],
    ['Retos', ArticleCategory.OTHER],
    ['General', ArticleCategory.OTHER],
    ['Índice', ArticleCategory.OTHER],
  ]

  test.each(cases)('clasifica %j como categoría %s', (input, expected) => {
    expect(parseArticleNumber(input).category).toBe(expected)
  })
})

describe('compareArticleNumbers — orden por categoría', () => {
  it('preámbulo va antes de cualquier artículo', () => {
    expect(compareArticleNumbers('preámbulo', '1')).toBeLessThan(0)
    expect(compareArticleNumbers('1', 'preámbulo')).toBeGreaterThan(0)
  })

  it('exposición de motivos va antes del preámbulo', () => {
    expect(compareArticleNumbers('EM', 'preámbulo')).toBeLessThan(0)
  })

  it('artículos van antes que disposiciones', () => {
    expect(compareArticleNumbers('100', 'DA1')).toBeLessThan(0)
    expect(compareArticleNumbers('1000', 'DA1')).toBeLessThan(0)
  })

  it('DA va antes de DT', () => {
    expect(compareArticleNumbers('DA1', 'DT1')).toBeLessThan(0)
  })

  it('DT va antes de DD', () => {
    expect(compareArticleNumbers('DT1', 'DD1')).toBeLessThan(0)
  })

  it('DD va antes de DF', () => {
    expect(compareArticleNumbers('DD1', 'DF1')).toBeLessThan(0)
  })

  it('DF va antes de anexos', () => {
    expect(compareArticleNumbers('DF1', 'Anexo I')).toBeLessThan(0)
  })

  it('anexos van antes de los desconocidos', () => {
    expect(compareArticleNumbers('Anexo I', 'Compromiso8')).toBeLessThan(0)
  })
})

describe('compareArticleNumbers — orden numérico dentro de "Artículo"', () => {
  it('artículos numéricos se ordenan por número, no por string', () => {
    const result = sortRaw(['10', '2', '1', '20', '3'])
    expect(result).toEqual(['1', '2', '3', '10', '20'])
  })

  it('N va antes que N bis, que va antes que N ter, que va antes que (N+1)', () => {
    const result = sortRaw(['84 bis', '84', '85', '84 ter', '84 quater'])
    expect(result).toEqual(['84', '84 bis', '84 ter', '84 quater', '85'])
  })

  it('N.M (subnumérico) va entre N y N+1', () => {
    const result = sortRaw(['148', '147', '147.2', '147.1'])
    expect(result).toEqual(['147', '147.1', '147.2', '148'])
  })

  it('"N_bis" (typo con underscore) se equipara a "N bis"', () => {
    expect(compareArticleNumbers('66_bis', '66 bis')).toBe(0)
  })

  it('ordinales en palabras se ordenan numéricamente', () => {
    const result = sortRaw(['Tercero', 'Primero', 'Segundo', 'Decimo', 'Octavo'])
    expect(result).toEqual(['Primero', 'Segundo', 'Tercero', 'Octavo', 'Decimo'])
  })
})

describe('compareArticleNumbers — orden dentro de Disposiciones', () => {
  it('DA1 < DA2 < DA10 (numérico, no lexicográfico)', () => {
    const result = sortRaw(['DA10', 'DA2', 'DA1'])
    expect(result).toEqual(['DA1', 'DA2', 'DA10'])
  })

  it('"DA Primera" se equipara a "DA1" en orden', () => {
    expect(compareArticleNumbers('DA Primera', 'DA1')).toBe(0)
  })

  it('"DA_adicional_primera" se equipara a "DA1"', () => {
    expect(compareArticleNumbers('DA_adicional_primera', 'DA1')).toBe(0)
  })

  it('"DAcuadragésima" se ordena como ordinal 40', () => {
    // DA1 (1) < DA10 (10) < DAcuadragésima (40) < DAcuadragésima_cuarta (44)
    const result = sortRaw(['DAcuadragésima', 'DA1', 'DAcuadragésima_cuarta', 'DA10'])
    expect(result).toEqual(['DA1', 'DA10', 'DAcuadragésima', 'DAcuadragésima_cuarta'])
  })

  it('"DAvigesimoctava" → 28; "DAvigésima_primera" → 21', () => {
    const result = sortRaw(['DAvigesimoctava', 'DAvigésima_primera', 'DA20'])
    expect(result).toEqual(['DA20', 'DAvigésima_primera', 'DAvigesimoctava'])
  })

  it('"DA_derogatoria_unica" se mapea a DD (no DA)', () => {
    expect(parseArticleNumber('DA_derogatoria_unica').category).toBe(ArticleCategory.DD)
  })

  it('"DA_final_primera" se mapea a DF (no DA)', () => {
    expect(parseArticleNumber('DA_final_primera').category).toBe(ArticleCategory.DF)
  })

  it('DF + bis: "DFprimera_bis" entre DF1 y DF2', () => {
    const result = sortRaw(['DF2', 'DFprimera_bis', 'DF1'])
    expect(result).toEqual(['DF1', 'DFprimera_bis', 'DF2'])
  })

  it('"Disposición Adicional Segunda" se equipara a DA2', () => {
    expect(compareArticleNumbers('Disposición Adicional Segunda', 'DA2')).toBe(0)
  })

  it('"DFunica" == "DF Única"', () => {
    expect(compareArticleNumbers('DFunica', 'DF Única')).toBe(0)
  })

  it('"DAU" abreviado equivale a única (orden 1)', () => {
    expect(parseArticleNumber('DAU').primary).toBe(1)
  })
})

describe('compareArticleNumbers — orden dentro de Anexos', () => {
  it('Anexo I < Anexo II < ... < Anexo X', () => {
    const result = sortRaw(['Anexo X', 'Anexo II', 'Anexo I', 'Anexo IX', 'Anexo V'])
    expect(result).toEqual(['Anexo I', 'Anexo II', 'Anexo V', 'Anexo IX', 'Anexo X'])
  })

  it('Anexo I y Anexo_I son equivalentes', () => {
    expect(compareArticleNumbers('Anexo I', 'Anexo_I')).toBe(0)
  })
})

describe('compareArticleNumbers — caso real Estatuto CM (LO 3/1983)', () => {
  // Replica exacta de las article_numbers no numéricos del Estatuto CM en BD (2026-05-26).
  it('produce el orden BOE: preámbulo → 1..70 → DA1, DA2 → DT1..DT7 → DF', () => {
    const articleNumbers = [
      'DF',         // Disposición Final
      'DT5', 'DT6', 'DT1', 'DT2', 'DT3', 'DT4', 'DT7',
      'preámbulo',  // estaba al final por lexicográfico
      'DA1', 'DA2',
      '1', '2', '3', '70',
    ]
    const sorted = sortRaw(articleNumbers)
    expect(sorted).toEqual([
      'preámbulo',
      '1', '2', '3', '70',
      'DA1', 'DA2',
      'DT1', 'DT2', 'DT3', 'DT4', 'DT5', 'DT6', 'DT7',
      'DF',
    ])
  })
})

describe('sortByArticleNumber — helper sobre arrays de objetos', () => {
  it('ordena sin mutar el array original', () => {
    const arr = [
      { id: 'a', articleNumber: 'DT1' },
      { id: 'b', articleNumber: '5' },
      { id: 'c', articleNumber: 'preámbulo' },
      { id: 'd', articleNumber: 'DA2' },
    ]
    const sorted = sortByArticleNumber(arr, (x) => x.articleNumber)
    expect(sorted.map((x) => x.id)).toEqual(['c', 'b', 'd', 'a'])
    // No-mutación
    expect(arr.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('tolera valores null/undefined sin reventar', () => {
    const arr = [
      { id: 'a', articleNumber: null },
      { id: 'b', articleNumber: '1' },
      { id: 'c', articleNumber: undefined },
    ]
    const sorted = sortByArticleNumber(arr, (x) => x.articleNumber)
    // El 1 (Artículo) va antes que los null/undefined (OTHER).
    expect(sorted[0].id).toBe('b')
  })
})
