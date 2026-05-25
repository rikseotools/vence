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

  it('frase única > MAX se devuelve sin partir', () => {
    const long = 'A'.repeat(300) + '.'
    const result = splitIntoChunks(long)
    expect(result.length).toBe(1)
    expect(result[0]).toBe(long)
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
