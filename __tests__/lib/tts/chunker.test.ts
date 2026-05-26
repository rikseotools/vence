// __tests__/lib/tts/chunker.test.ts
//
// Tests del chunker puro de TTS. Sin DOM.

import {
  MAX_CHUNK_LENGTH,
  cleanText,
  prepareForSpeech,
  splitIntoChunks,
} from '@/lib/tts/chunker'

describe('cleanText', () => {
  it('elimina headers markdown #', () => {
    expect(cleanText('# Título\nContenido')).toBe('Título Contenido')
  })

  it('quita negrita ** **', () => {
    expect(cleanText('Este es **importante** texto')).toBe(
      'Este es importante texto',
    )
  })

  it('quita itálica * *', () => {
    expect(cleanText('Este es *enfatizado* texto')).toBe(
      'Este es enfatizado texto',
    )
  })

  it('quita citas >', () => {
    expect(cleanText('> Cita inicial\nLuego')).toBe('Cita inicial Luego')
  })

  it('reemplaza enlaces markdown por su texto', () => {
    expect(cleanText('Ver [BOE](https://boe.es) aquí')).toBe(
      'Ver BOE aquí',
    )
  })

  it('quita code ticks `', () => {
    expect(cleanText('Llamar a `función()` ahora')).toBe(
      'Llamar a función() ahora',
    )
  })

  it('reemplaza dobles saltos por puntos para que se entiendan como frases', () => {
    expect(cleanText('Primera frase\n\nSegunda frase')).toBe(
      'Primera frase. Segunda frase',
    )
  })

  it('mantiene el orden y no rompe contenido legal', () => {
    const input =
      '# Artículo 1\n\nLa **Constitución** garantiza:\n\n- la libertad\n- la igualdad'
    const out = cleanText(input)
    expect(out).toContain('Artículo 1')
    expect(out).toContain('Constitución')
    expect(out).toContain('libertad')
    expect(out).toContain('igualdad')
  })
})

describe('splitIntoChunks', () => {
  it('texto corto → 1 chunk', () => {
    expect(splitIntoChunks('Hola mundo.')).toEqual(['Hola mundo.'])
  })

  it('texto vacío → un chunk con cadena vacía', () => {
    expect(splitIntoChunks('')).toEqual([''])
  })

  it('respeta MAX_CHUNK_LENGTH', () => {
    const longText = Array.from(
      { length: 10 },
      (_, i) =>
        `Artículo ${i + 1}. Este es el contenido del artículo número ${i + 1} con texto suficientemente largo.`,
    ).join(' ')
    const chunks = splitIntoChunks(longText)
    for (const c of chunks) {
      // Tolerancia: una frase suelta puede exceder ligeramente
      expect(c.length).toBeLessThan(MAX_CHUNK_LENGTH + 100)
    }
  })

  it('no parte por mitad de palabra (cada chunk termina en puntuación o es frase única)', () => {
    const text =
      'Primera frase completa. Segunda frase completa. Tercera frase completa.'
    const chunks = splitIntoChunks(text)
    for (const c of chunks) {
      expect(c).toMatch(/[.!?;]$/)
    }
  })

  it('FIX OVERSIZE: frase única > MAX con comas se fuerza split por comas', () => {
    // Caso real: Art. 1 Reglamento Asamblea Madrid — 474 chars con 7
    // comas y un único punto al final. Chrome rechaza síncronamente
    // con 'synthesis-failed' chunks de ese tamaño.
    const artMadrid =
      'La Asamblea de Madrid, órgano legislativo y representativo del pueblo de Madrid, ejerce la potestad legislativa de la Comunidad, aprueba y controla los Presupuestos Generales de la misma, impulsa, orienta y controla la acción del Consejo de Gobierno y ejerce cualesquiera otras funciones que le otorguen las leyes, de acuerdo con las competencias que la Constitución Española, el Estatuto de Autonomía y el resto del ordenamiento jurídico atribuyen a la Comunidad de Madrid.'
    const chunks = splitIntoChunks(artMadrid)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH)
    }
    // Reconstrucción aproximada: no debe perder texto significativo.
    expect(chunks.join(' ').length).toBeGreaterThanOrEqual(artMadrid.length - chunks.length)
  })

  it('FIX OVERSIZE: frase única > MAX sin comas se fuerza split por palabras', () => {
    // Patológico: una frase larga sin comas ni puntos intermedios.
    const palabra = 'palabra'
    const long = Array.from({ length: 60 }, () => palabra).join(' ') + '.'
    expect(long.length).toBeGreaterThan(MAX_CHUNK_LENGTH)
    const chunks = splitIntoChunks(long)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH)
    }
  })

  it('FIX OVERSIZE: palabra única > MAX se devuelve íntegra (no rompe mid-char)', () => {
    // Caso patológico extremo: una "palabra" >MAX (URLs, identificadores).
    // Preferimos un chunk grande que romper a mitad de carácter.
    const monstruosa = 'A'.repeat(MAX_CHUNK_LENGTH + 50)
    const chunks = splitIntoChunks(monstruosa)
    expect(chunks.length).toBe(1)
    expect(chunks[0]).toBe(monstruosa)
  })

  it('texto largo simulando ley completa: chunks múltiples sin pérdida', () => {
    const articles = Array.from(
      { length: 50 },
      (_, i) =>
        `Artículo ${i + 1}. Este es el contenido del artículo número ${i + 1} que establece disposiciones importantes.`,
    ).join(' ')
    const chunks = splitIntoChunks(articles)
    expect(chunks.length).toBeGreaterThan(5)
    const reconstructed = chunks.join(' ')
    // Tolerancia: trim/spaces pueden añadir/quitar 1-2 chars por chunk
    expect(reconstructed.length).toBeGreaterThanOrEqual(articles.length - chunks.length)
  })
})

describe('prepareForSpeech (pipeline)', () => {
  it('limpia y divide en una sola llamada', () => {
    const input = '# Tema 1\n\n**Importante:** lee esto. Y esto también.'
    const chunks = prepareForSpeech(input)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.join(' ')).not.toContain('**')
    expect(chunks.join(' ')).not.toContain('#')
  })
})

import {
  firstChunkOfSection,
  prepareSectionsForSpeech,
} from '@/lib/tts/chunker'

describe('prepareSectionsForSpeech', () => {
  it('chunkea cada sección y conserva sectionIdx en cada chunk', () => {
    const sections = [
      { id: '1', label: 'Art 1', text: 'Frase uno. Frase dos.' },
      { id: '2', label: 'Art 2', text: 'Otra frase. Y otra más.' },
    ]
    const chunks = prepareSectionsForSpeech(sections)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // El primer chunk debe pertenecer a la sección 0
    expect(chunks[0].sectionIdx).toBe(0)
    // Algún chunk debe pertenecer a la sección 1
    expect(chunks.some((c) => c.sectionIdx === 1)).toBe(true)
  })

  it('cada chunk pertenece a exactamente una sección (no hay solape)', () => {
    const sections = [
      { id: '1', label: 'Art 1', text: 'Primera ley larga con mucho texto. Más frases para forzar chunks.' },
      { id: '2', label: 'Art 2', text: 'Segunda ley. Otra frase. Final.' },
    ]
    const chunks = prepareSectionsForSpeech(sections)
    // Las sectionIdx deben ser monótonas (porque cada sección se procesa entera antes de la siguiente)
    let prev = -1
    for (const c of chunks) {
      expect(c.sectionIdx).toBeGreaterThanOrEqual(prev)
      prev = c.sectionIdx
    }
  })

  it('secciones vacías no producen chunks vacíos', () => {
    const sections = [
      { id: '1', label: 'Art 1', text: 'Contenido real.' },
      { id: '2', label: 'Art 2 vacío', text: '' },
      { id: '3', label: 'Art 3', text: 'Más contenido.' },
    ]
    const chunks = prepareSectionsForSpeech(sections)
    for (const c of chunks) {
      expect(c.text.length).toBeGreaterThan(0)
    }
  })

  it('input completamente vacío devuelve un chunk vacío (no rompe)', () => {
    const chunks = prepareSectionsForSpeech([])
    expect(chunks.length).toBe(1)
    expect(chunks[0].text).toBe('')
  })
})

describe('firstChunkOfSection', () => {
  it('encuentra el primer chunk de cada sección', () => {
    const chunks = [
      { text: 'a', sectionIdx: 0 },
      { text: 'b', sectionIdx: 0 },
      { text: 'c', sectionIdx: 1 },
      { text: 'd', sectionIdx: 2 },
      { text: 'e', sectionIdx: 2 },
    ]
    expect(firstChunkOfSection(chunks, 0)).toBe(0)
    expect(firstChunkOfSection(chunks, 1)).toBe(2)
    expect(firstChunkOfSection(chunks, 2)).toBe(3)
  })

  it('devuelve -1 si la sección no existe', () => {
    const chunks = [{ text: 'a', sectionIdx: 0 }]
    expect(firstChunkOfSection(chunks, 99)).toBe(-1)
  })
})
