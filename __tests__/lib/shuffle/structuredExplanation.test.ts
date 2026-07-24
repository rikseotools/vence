import {
  StructuredExplanation,
  renderStructuredExplanation,
  parseLetterFormatExplanation,
  isStructuredExplanation,
  indexToLetter,
  letterToIndex,
} from '@/lib/shuffle/structuredExplanation'

describe('structuredExplanation — letras por posición', () => {
  const data: StructuredExplanation = {
    v: 1,
    cita: { ref: 'Art. 12.6 Decreto 30/2025', texto: 'corresponde al órgano competente en materia de atención a la ciudadanía' },
    options: {
      '0': 'No al órgano de administración electrónica.',
      '1': 'corresponde al órgano competente en materia de atención a la ciudadanía.',
      '2': 'No a la subsecretaría de cada departamento.',
      '3': 'No al centro directivo de publicidad institucional.',
    },
  }

  test('orden natural (sin barajar): letra de la correcta = su posición original', () => {
    const out = renderStructuredExplanation(data, { correctOption: 1, optionOrder: null, nOptions: 4 })
    expect(out).toContain('**Por qué B es correcta:**')
    expect(out).toContain('- **A)** No al órgano de administración electrónica.')
    expect(out).toContain('- **C)** No a la subsecretaría de cada departamento.')
    expect(out).toContain('- **D)** No al centro directivo de publicidad institucional.')
    // el header no debe listar la correcta como bullet
    expect(out).not.toMatch(/- \*\*B\)\*\*/)
  })

  test('barajado: la correcta (original 1) cae en posición 0 → header dice A y su razón viaja con ella', () => {
    // order[i] = original mostrado en posición i. Correcta (1) en pos 0.
    const order = [1, 0, 2, 3]
    const out = renderStructuredExplanation(data, { correctOption: 1, optionOrder: order, nOptions: 4 })
    expect(out).toContain('**Por qué A es correcta:** corresponde al órgano competente')
    // pos1=original0, pos2=original2, pos3=original3
    expect(out).toContain('- **B)** No al órgano de administración electrónica.')
    expect(out).toContain('- **C)** No a la subsecretaría de cada departamento.')
    expect(out).toContain('- **D)** No al centro directivo de publicidad institucional.')
  })

  test('barajado no trivial: cada razón sigue a SU opción y las letras son coherentes con la posición', () => {
    const order = [3, 1, 0, 2] // pos0=D,pos1=B(correcta),pos2=A,pos3=C
    const out = renderStructuredExplanation(data, { correctOption: 1, optionOrder: order, nOptions: 4 })
    expect(out).toContain('**Por qué B es correcta:**') // correcta cae en pos1 = letra B
    expect(out).toContain('- **A)** No al centro directivo de publicidad institucional.') // original3 en pos0=A
    expect(out).toContain('- **C)** No al órgano de administración electrónica.') // original0 en pos2=C
    expect(out).toContain('- **D)** No a la subsecretaría de cada departamento.') // original2 en pos3=D
  })

  test('frame select_incorrect invierte los encabezados', () => {
    const d2: StructuredExplanation = { ...data, frame: 'select_incorrect' }
    const out = renderStructuredExplanation(d2, { correctOption: 1, optionOrder: null, nOptions: 4 })
    expect(out).toContain('**Por qué B es la incorrecta:**')
    expect(out).toContain('**Por qué las demás son correctas:**')
  })

  test('3 opciones (D=null): no inventa la cuarta', () => {
    const d3: StructuredExplanation = { v: 1, options: { '0': 'ra', '1': 'rb', '2': 'rc' } }
    const out = renderStructuredExplanation(d3, { correctOption: 2, optionOrder: [2, 0, 1], nOptions: 3 })
    expect(out).toContain('**Por qué A es correcta:** rc')
    expect(out).toContain('- **B)** ra')
    expect(out).toContain('- **C)** rb')
    expect(out).not.toContain('D)')
  })
})

describe('isStructuredExplanation', () => {
  test('válida con cobertura completa', () => {
    expect(isStructuredExplanation({ v: 1, options: { '0': 'a', '1': 'b', '2': 'c', '3': 'd' } }, 4)).toBe(true)
  })
  test('inválida si falta una razón', () => {
    expect(isStructuredExplanation({ v: 1, options: { '0': 'a', '1': 'b', '2': 'c' } }, 4)).toBe(false)
  })
  test('inválida si razón vacía', () => {
    expect(isStructuredExplanation({ v: 1, options: { '0': 'a', '1': '  ', '2': 'c' } }, 3)).toBe(false)
  })
  test('inválida si v != 1 o no es objeto', () => {
    expect(isStructuredExplanation({ v: 2, options: { '0': 'a' } }, 1)).toBe(false)
    expect(isStructuredExplanation(null, 4)).toBe(false)
    expect(isStructuredExplanation('texto', 4)).toBe(false)
  })
})

describe('indexToLetter / letterToIndex', () => {
  test('ida y vuelta', () => {
    for (let i = 0; i < 5; i++) expect(letterToIndex(indexToLetter(i))).toBe(i)
    expect(letterToIndex('b')).toBe(1)
    expect(letterToIndex('Z')).toBe(-1)
  })
})

describe('parseLetterFormatExplanation — migración del §8.1', () => {
  const realExample = `> **Art. 12.6 Decreto 30/2025**
> "La gestión y coordinación del sistema de información de atención a la ciudadanía y del catálogo de procedimientos y servicios corresponde al órgano competente en materia de atención a la ciudadanía."

**Por qué B es correcta:** corresponde al órgano competente en materia de atención a la ciudadanía.

**Por qué las demás son incorrectas:**
- **A)** No al órgano de administración electrónica.
- **C)** No a la subsecretaría de cada departamento.
- **D)** No al centro directivo de publicidad institucional.`

  test('parsea cita + razón correcta + bullets a estructura completa', () => {
    const parsed = parseLetterFormatExplanation(realExample, { correctOption: 1, nOptions: 4 })
    expect(parsed).not.toBeNull()
    expect(parsed!.v).toBe(1)
    expect(parsed!.cita?.ref).toContain('Art. 12.6 Decreto 30/2025')
    expect(parsed!.cita?.texto).toContain('atención a la ciudadanía')
    expect(parsed!.options['1']).toContain('órgano competente')
    expect(parsed!.options['0']).toContain('administración electrónica')
    expect(parsed!.options['2']).toContain('subsecretaría')
    expect(parsed!.options['3']).toContain('publicidad institucional')
  })

  test('round-trip: parse → render en orden natural preserva header y bullets', () => {
    const parsed = parseLetterFormatExplanation(realExample, { correctOption: 1, nOptions: 4 })!
    const rendered = renderStructuredExplanation(parsed, { correctOption: 1, optionOrder: null, nOptions: 4 })
    expect(rendered).toContain('**Por qué B es correcta:**')
    expect(rendered).toContain('- **A)** No al órgano de administración electrónica.')
    expect(rendered).toContain('- **C)** No a la subsecretaría de cada departamento.')
    expect(rendered).toContain('- **D)** No al centro directivo de publicidad institucional.')
  })

  test('round-trip + barajado: la razón de la correcta viaja a su nueva letra', () => {
    const parsed = parseLetterFormatExplanation(realExample, { correctOption: 1, nOptions: 4 })!
    const order = [1, 0, 2, 3] // correcta (orig 1) a pos 0 = A
    const rendered = renderStructuredExplanation(parsed, { correctOption: 1, optionOrder: order, nOptions: 4 })
    expect(rendered).toContain('**Por qué A es correcta:** corresponde al órgano competente')
    expect(rendered).toContain('- **B)** No al órgano de administración electrónica.')
  })

  test('párrafo largo multibloque (razón correcta con varios párrafos) parsea', () => {
    const long = `> **Art. 39.1 RDL 5/2015 (TREBEP)**: "Los órganos... son los Delegados de Personal y las Juntas de Personal."

**Por qué B es correcta:**

El art. 39.1 TREBEP enumera taxativamente los dos órganos. No existen otros.

**Por qué las demás son incorrectas:**

- **A)** Incorrecta. Los Comités de empresa son de los trabajadores laborales.
- **C)** Incorrecta. Los delegados sindicales son de las secciones sindicales.
- **D)** Incorrecta. Combina bien pero añade los Comités de empresa.`
    const parsed = parseLetterFormatExplanation(long, { correctOption: 1, nOptions: 4 })
    expect(parsed).not.toBeNull()
    expect(parsed!.options['1']).toContain('taxativamente')
    expect(parsed!.options['0']).toContain('Comités de empresa')
    expect(parsed!.options['3']).toContain('Combina bien')
  })

  test('devuelve null si la cabecera no coincide con correct_option (no migrar a ciegas)', () => {
    const parsed = parseLetterFormatExplanation(realExample, { correctOption: 2, nOptions: 4 })
    expect(parsed).toBeNull()
  })

  test('devuelve null si falta el bullet de alguna opción (cobertura incompleta)', () => {
    const incompleto = `**Por qué B es correcta:** razón.

**Por qué las demás son incorrectas:**
- **A)** falta la C y la D.`
    expect(parseLetterFormatExplanation(incompleto, { correctOption: 1, nOptions: 4 })).toBeNull()
  })

  test('cierre "**Clave:**" tras los bullets → outro (no se pega a la última opción)', () => {
    const conClave = `**Por qué B es correcta:** el fuero es el del deudor.

**Por qué las demás son incorrectas:**
- **A)** Sitúa el fuero en el acreedor.
- **C)** Repite el error del acreedor.
- **D)** No existe fuero a voluntad del acreedor.

**Clave:** Monitorio: fuero exclusivo del deudor.`
    const parsed = parseLetterFormatExplanation(conClave, { correctOption: 1, nOptions: 4 })!
    expect(parsed).not.toBeNull()
    // la razón de D NO debe contener el "Clave"
    expect(parsed.options['3']).toContain('No existe fuero')
    expect(parsed.options['3']).not.toContain('Clave')
    expect(parsed.outro).toContain('**Clave:**')
    // al barajar (D→posición mostrada A), el Clave sigue AL FINAL, no en medio
    const order = [3, 1, 2, 0] // pos0=D, pos1=B(correcta), pos2=C, pos3=A
    const out = renderStructuredExplanation(parsed, { correctOption: 1, optionOrder: order, nOptions: 4 })
    const claveIdx = out.indexOf('**Clave:**')
    const lastBulletIdx = out.lastIndexOf('- **')
    expect(claveIdx).toBeGreaterThan(lastBulletIdx) // Clave después del último bullet
  })

  test('devuelve null en texto libre sin formato §8.1', () => {
    expect(parseLetterFormatExplanation('La respuesta es correcta porque el artículo lo dice.', { correctOption: 0, nOptions: 4 })).toBeNull()
    expect(parseLetterFormatExplanation('', { correctOption: 0, nOptions: 4 })).toBeNull()
    expect(parseLetterFormatExplanation(null, { correctOption: 0, nOptions: 4 })).toBeNull()
  })
})
