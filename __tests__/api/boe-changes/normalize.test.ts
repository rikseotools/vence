import {
  normalizeLegalText,
  stripEditorialNotes,
  extractBoeArticles,
  classifyContentChange,
  extractVigenciaDate,
  decodeEntities,
  type OurArticle,
} from '@/lib/api/boe-changes/normalize'

describe('normalizeLegalText — neutraliza ruido determinista, NO tolera contenido', () => {
  it('quita el ESPACIO ANTES DE COMA que mete el HTML del BOE en los enlaces', () => {
    // Caso real Hacienda GVA: "de 27 de abril , a las" (BOE) vs "de 27 de abril, a las" (correcto)
    const boe = 'la Ley 2/2012, de 27 de abril , a las universidades'
    const nuestro = 'la Ley 2/2012, de 27 de abril, a las universidades'
    expect(normalizeLegalText(boe)).toBe(normalizeLegalText(nuestro))
  })

  it('unifica comillas tipográficas, NBSP y espacios múltiples', () => {
    expect(normalizeLegalText('«texto»  con   espacios')).toBe(
      normalizeLegalText('"texto" con espacios'),
    )
  })

  it('NO iguala textos con una palabra distinta (recall: mismo largo, sentido opuesto)', () => {
    // "podrán" → "deberán": misma longitud aprox, cambio jurídico sustantivo → DEBE divergir.
    const a = 'las convocatorias podrán establecer requisitos adicionales'
    const b = 'las convocatorias deberán establecer requisitos adicionales'
    expect(normalizeLegalText(a)).not.toBe(normalizeLegalText(b))
  })
})

describe('stripEditorialNotes — quita metadatos del BOE, conserva articulado', () => {
  it('elimina "Se modifica…", "Última actualización…", "[Bloque]"', () => {
    const input = [
      '1. Corresponde a la conselleria la gestión.',
      'Se modifica el apartado 1 por el art. 96.2 de la Ley 6/2024, de 5 de diciembre.',
      'Ref. BOE-A-2025-1',
      'Última actualización, publicada el 31/05/2025, en vigor a partir del 01/06/2025.',
      '[Bloque 13: #a9]',
    ].join('\n')
    expect(stripEditorialNotes(input)).toBe('1. Corresponde a la conselleria la gestión.')
  })
})

describe('extractBoeArticles — parsea el articulado (incluye bis, excluye título y notas)', () => {
  const html = `
    <p class="articulo">Artículo 8. Competencias del conseller.</p>
    <p>1. Corresponde al conseller aprobar las relaciones de puestos de trabajo.</p>
    <p class="nota">Se modifica el apartado 1 por el art. 96.2 de la Ley 6/2024, de 5 de diciembre.</p>
    <p>Ref. BOE-A-2025-1</p>
    <p class="articulo">Artículo 8 bis. Órgano de coordinación.</p>
    <p>1. Se crea el órgano de coordinación interdepartamental.</p>
    <p class="articulo">Artículo 9. Registro de personal.</p>
    <p>1. El registro es único.</p>`

  it('extrae cada artículo sin el título ni las notas editoriales', () => {
    const arts = extractBoeArticles(html)
    expect(arts.get('8')).toBe('1. Corresponde al conseller aprobar las relaciones de puestos de trabajo.')
    expect(arts.get('8')).not.toContain('Competencias') // título fuera
    expect(arts.get('8')).not.toContain('Se modifica') // nota editorial fuera
  })

  it('captura los artículos con modificador ("8 bis") como entrada propia', () => {
    const arts = extractBoeArticles(html)
    expect(arts.get('8 bis')).toBe('1. Se crea el órgano de coordinación interdepartamental.')
    expect(arts.get('9')).toBe('1. El registro es único.')
  })
})

describe('classifyContentChange — el corazón: falso positivo vs cambio real', () => {
  const ours = (m: Record<string, OurArticle>) => new Map(Object.entries(m))
  const boe = (m: Record<string, string>) => new Map(Object.entries(m))

  it('RE-CONSOLIDACIÓN (solo espacio-antes-de-coma) → NO es cambio real', () => {
    const v = classifyContentChange(
      ours({ '2': { content: 'la Ley 2/2012, de 27 de abril, a las universidades', active: true } }),
      boe({ '2': 'la Ley 2/2012, de 27 de abril , a las universidades' }),
    )
    expect(v.isRealChange).toBe(false)
    expect(v.changedArticles).toEqual([])
  })

  it('CAMBIO REAL de una palabra del mismo largo (recall) → SÍ es cambio real', () => {
    const v = classifyContentChange(
      ours({ '5': { content: 'las convocatorias podrán establecer requisitos', active: true } }),
      boe({ '5': 'las convocatorias deberán establecer requisitos' }),
    )
    expect(v.isRealChange).toBe(true)
    expect(v.changedArticles).toContain('5')
  })

  it('APARTADO AÑADIDO → cambio real', () => {
    const v = classifyContentChange(
      ours({ '7': { content: '1. Primer apartado.', active: true } }),
      boe({ '7': '1. Primer apartado. 2. Nuevo apartado añadido por reforma.' }),
    )
    expect(v.isRealChange).toBe(true)
  })

  it('ARTÍCULO QUE SERVIMOS y ya NO está en el BOE (derogado) → cambio real', () => {
    const v = classifyContentChange(
      ours({ '81': { content: '1. Contenido vigente que servimos.', active: true } }),
      boe({}),
    )
    expect(v.isRealChange).toBe(true)
    expect(v.changedArticles).toEqual(['81:removed'])
  })

  it('ARTÍCULO INACTIVO (no lo servimos) que difiere → NO dispara', () => {
    // Caso art 11 FPV / art 81 Hacienda: suprimido en BOE, ya inactivo en BD.
    const v = classifyContentChange(
      ours({ '11': { content: 'texto viejo largo que ya no servimos', active: false } }),
      boe({ '11': '(Suprimido)' }),
    )
    expect(v.isRealChange).toBe(false)
  })

  it('LEY ENTERA idéntica salvo ruido de enlaces en varios artículos → NO dispara', () => {
    const v = classifyContentChange(
      ours({
        '1': { content: 'según el artículo 3, letra a.', active: true },
        '2': { content: 'de acuerdo con la Ley 40/2015, de 1 de octubre.', active: true },
        '3': { content: 'texto sin cambios.', active: true },
      }),
      boe({
        '1': 'según el artículo 3 , letra a.',
        '2': 'de acuerdo con la Ley 40/2015 , de 1 de octubre.',
        '3': 'texto sin cambios.',
      }),
    )
    expect(v.isRealChange).toBe(false)
  })
})

describe('extractVigenciaDate — metadato informativo (no decisorio)', () => {
  it('extrae la fecha de "Última actualización, publicada el"', () => {
    expect(extractVigenciaDate('… Última actualización, publicada el 31/05/2025, en vigor …')).toBe('31/05/2025')
  })
  it('null si no hay fecha', () => {
    expect(extractVigenciaDate('sin fecha aquí')).toBeNull()
  })
})

describe('decodeEntities', () => {
  it('decodifica las entidades del BOE y numéricas', () => {
    expect(decodeEntities('funci&oacute;n p&uacute;blica &#8212; art&iacute;culo')).toBe('función pública — artículo')
  })
})
