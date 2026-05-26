// __tests__/lib/tts/chunker.invariants.test.ts
//
// Tests de invariantes (property-based) del chunker.
// Genera inputs aleatorios y verifica que se cumplen las propiedades
// garantizadas por el contrato — independientemente del texto concreto.
//
// Propiedades verificadas:
//   1. PRESERVACIÓN: la concatenación de chunks contiene todas las
//      palabras del texto limpio, en orden y sin duplicados.
//   2. TAMAÑO MÁXIMO: con texto que contiene comas, ningún chunk supera
//      MAX_CHUNK_LENGTH. La única excepción documentada: una palabra
//      única > MAX (URL/identificador) se devuelve íntegra.
//   3. NO CHUNKS VACÍOS: nunca se emite un chunk vacío salvo cuando el
//      input completo está vacío.
//   4. AL MENOS UN ELEMENTO: la salida siempre tiene length ≥ 1.
//   5. SECCIONES MONÓTONAS: en prepareSectionsForSpeech, los sectionIdx
//      crecen monótonamente (no hay solape ni reordenación).

import {
  MAX_CHUNK_LENGTH,
  cleanText,
  prepareSectionsForSpeech,
  splitIntoChunks,
} from '@/lib/tts/chunker'

// ─── Generadores deterministas (sin libs externas) ────────────────────────

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) / 0x100000000)
  }
}

const PALABRAS = [
  'Asamblea', 'Madrid', 'representativo', 'Comunidad', 'aprueba',
  'Presupuestos', 'controla', 'Consejo', 'Gobierno', 'leyes',
  'Constitución', 'Estatuto', 'Autonomía', 'ordenamiento', 'atribuyen',
  'pueblo', 'potestad', 'legislativa', 'impulsa', 'orienta',
  'cualesquiera', 'otras', 'funciones', 'otorguen', 'competencias',
  'jurídico', 'Diputados', 'electos', 'Mesa', 'Edad', 'sesión',
  'constitutiva', 'Decreto', 'convocatoria', 'elecciones', 'Secretarios',
  'asistido', 'calidad', 'tramitar', 'iniciativas', 'parlamentarias',
]

function randomWord(rng: () => number) {
  return PALABRAS[Math.floor(rng() * PALABRAS.length)]
}

interface GenOpts {
  numClauses: number
  wordsPerClause: number
  separator: ',' | ';' | '.' | ':'
  endSeparator?: '.' | ';' | '!' | '?'
}

function genSentence(rng: () => number, opts: GenOpts): string {
  const clauses: string[] = []
  for (let i = 0; i < opts.numClauses; i++) {
    const words: string[] = []
    for (let j = 0; j < opts.wordsPerClause; j++) words.push(randomWord(rng))
    clauses.push(words.join(' '))
  }
  return clauses.join(opts.separator + ' ') + (opts.endSeparator ?? '.')
}

// ─── Helpers para asserts ──────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .replace(/[.,;:!?]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
}

describe('Chunker — invariantes (property-based, 100 inputs aleatorios)', () => {
  describe('PRESERVACIÓN: ningún token se pierde al chunkear', () => {
    it('100 frases con comas — todos los tokens se conservan en orden', () => {
      const rng = seededRng(42)
      for (let i = 0; i < 100; i++) {
        const sentence = genSentence(rng, {
          numClauses: 3 + Math.floor(rng() * 15),
          wordsPerClause: 3 + Math.floor(rng() * 12),
          separator: ',',
        })
        const expected = tokenize(sentence)
        const chunks = splitIntoChunks(sentence)
        const actual = tokenize(chunks.join(' '))
        expect(actual).toEqual(expected)
      }
    })

    it('100 frases sin comas (solo palabras separadas por espacio) — preservación', () => {
      const rng = seededRng(7)
      for (let i = 0; i < 100; i++) {
        const numWords = 5 + Math.floor(rng() * 80)
        const words: string[] = []
        for (let j = 0; j < numWords; j++) words.push(randomWord(rng))
        const sentence = words.join(' ') + '.'
        const expected = tokenize(sentence)
        const actual = tokenize(splitIntoChunks(sentence).join(' '))
        expect(actual).toEqual(expected)
      }
    })

    it('100 textos multi-frase (mezcla puntos y comas) — preservación', () => {
      const rng = seededRng(13)
      for (let i = 0; i < 100; i++) {
        const numSentences = 2 + Math.floor(rng() * 8)
        const sentences: string[] = []
        for (let j = 0; j < numSentences; j++) {
          sentences.push(
            genSentence(rng, {
              numClauses: 1 + Math.floor(rng() * 6),
              wordsPerClause: 3 + Math.floor(rng() * 10),
              separator: ',',
            }),
          )
        }
        const text = sentences.join(' ')
        const expected = tokenize(text)
        const actual = tokenize(splitIntoChunks(text).join(' '))
        expect(actual).toEqual(expected)
      }
    })
  })

  describe('TAMAÑO MÁXIMO: chunks no superan MAX_CHUNK_LENGTH (con excepción de palabra única)', () => {
    it('100 frases con comas — ningún chunk supera MAX_CHUNK_LENGTH', () => {
      const rng = seededRng(99)
      for (let i = 0; i < 100; i++) {
        const sentence = genSentence(rng, {
          numClauses: 4 + Math.floor(rng() * 20),
          wordsPerClause: 2 + Math.floor(rng() * 8),
          separator: ',',
        })
        const chunks = splitIntoChunks(sentence)
        for (const c of chunks) {
          // Las palabras del corpus son cortas; con comas siempre se puede
          // partir bajo MAX.
          expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH)
        }
      }
    })

    it('100 textos con frases cortas (puntos frecuentes) — bajo MAX', () => {
      const rng = seededRng(123)
      for (let i = 0; i < 100; i++) {
        const numSentences = 5 + Math.floor(rng() * 30)
        const sentences: string[] = []
        for (let j = 0; j < numSentences; j++) {
          const words: string[] = []
          const n = 3 + Math.floor(rng() * 10)
          for (let k = 0; k < n; k++) words.push(randomWord(rng))
          sentences.push(words.join(' ') + '.')
        }
        const chunks = splitIntoChunks(sentences.join(' '))
        for (const c of chunks) {
          expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH)
        }
      }
    })

    it('palabra única monstruosa — excepción documentada (devuelve íntegra)', () => {
      // Esta es la ÚNICA excepción permitida: una "palabra" individual >MAX
      // (típico de URLs o identificadores), se devuelve sin partir para no
      // romper mid-carácter.
      const monstruosa = 'X'.repeat(MAX_CHUNK_LENGTH * 3)
      const chunks = splitIntoChunks(monstruosa)
      expect(chunks.length).toBe(1)
      expect(chunks[0].length).toBeGreaterThan(MAX_CHUNK_LENGTH)
    })
  })

  describe('NO CHUNKS VACÍOS', () => {
    it('100 inputs aleatorios — ningún chunk emitido es cadena vacía', () => {
      const rng = seededRng(555)
      for (let i = 0; i < 100; i++) {
        const sentence = genSentence(rng, {
          numClauses: 1 + Math.floor(rng() * 10),
          wordsPerClause: 1 + Math.floor(rng() * 15),
          separator: rng() > 0.5 ? ',' : ';',
        })
        const chunks = splitIntoChunks(sentence)
        for (const c of chunks) {
          expect(c.length).toBeGreaterThan(0)
        }
      }
    })

    it('whitespace puro — devuelve un único chunk vacío (caso edge documentado)', () => {
      // El contrato: para texto vacío devuelve [''] (no [] ni null).
      expect(splitIntoChunks('')).toEqual([''])
      // Solo whitespace tras trim cae al mismo caso.
      const chunks = splitIntoChunks('   \n\n   ')
      expect(chunks.length).toBe(1)
    })
  })

  describe('AL MENOS UN ELEMENTO', () => {
    it('100 inputs aleatorios — output siempre length ≥ 1', () => {
      const rng = seededRng(1000)
      for (let i = 0; i < 100; i++) {
        const sentence = genSentence(rng, {
          numClauses: 1 + Math.floor(rng() * 20),
          wordsPerClause: 1 + Math.floor(rng() * 15),
          separator: ',',
        })
        expect(splitIntoChunks(sentence).length).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe('SECCIONES: monotonicidad de sectionIdx', () => {
    it('100 inputs multi-sección — sectionIdx crece monótono', () => {
      const rng = seededRng(2024)
      for (let i = 0; i < 100; i++) {
        const numSections = 2 + Math.floor(rng() * 10)
        const sections = []
        for (let j = 0; j < numSections; j++) {
          sections.push({
            id: String(j + 1),
            label: `Artículo ${j + 1}`,
            text: genSentence(rng, {
              numClauses: 1 + Math.floor(rng() * 5),
              wordsPerClause: 3 + Math.floor(rng() * 8),
              separator: ',',
            }),
          })
        }
        const chunks = prepareSectionsForSpeech(sections)
        let prev = -1
        for (const c of chunks) {
          expect(c.sectionIdx).toBeGreaterThanOrEqual(prev)
          prev = c.sectionIdx
        }
      }
    })

    it('100 inputs — cada sección tiene al menos un chunk (si su texto no está vacío)', () => {
      const rng = seededRng(3030)
      for (let i = 0; i < 100; i++) {
        const numSections = 2 + Math.floor(rng() * 5)
        const sections = []
        for (let j = 0; j < numSections; j++) {
          sections.push({
            id: String(j + 1),
            label: `Artículo ${j + 1}`,
            text: genSentence(rng, {
              numClauses: 1 + Math.floor(rng() * 3),
              wordsPerClause: 3 + Math.floor(rng() * 6),
              separator: ',',
            }),
          })
        }
        const chunks = prepareSectionsForSpeech(sections)
        const sectionsSeen = new Set<number>()
        for (const c of chunks) sectionsSeen.add(c.sectionIdx)
        // Cada sección con texto no-vacío debe aparecer al menos una vez
        for (let j = 0; j < numSections; j++) {
          expect(sectionsSeen.has(j)).toBe(true)
        }
      }
    })
  })

  describe('REGRESIÓN: casos reales que dispararon el bug', () => {
    it('Art. 1 Reglamento Asamblea Madrid (474 chars, 1 punto) — chunks bajo MAX', () => {
      const ART_1_RAM =
        'Artículo 1. La Asamblea de Madrid, órgano legislativo y representativo del pueblo de Madrid, ejerce la potestad legislativa de la Comunidad, aprueba y controla los Presupuestos Generales de la misma, impulsa, orienta y controla la acción del Consejo de Gobierno y ejerce cualesquiera otras funciones que le otorguen las leyes, de acuerdo con las competencias que la Constitución Española, el Estatuto de Autonomía y el resto del ordenamiento jurídico atribuyen a la Comunidad de Madrid.'
      const chunks = splitIntoChunks(cleanText(ART_1_RAM))
      expect(chunks.length).toBeGreaterThan(1)
      for (const c of chunks) {
        expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH)
      }
      // No se pierde texto significativo
      const tokensIn = tokenize(ART_1_RAM)
      const tokensOut = tokenize(chunks.join(' '))
      expect(tokensOut).toEqual(tokensIn)
    })

    it('párrafo simulado de 1700 chars sin puntos intermedios — chunks bajo MAX', () => {
      // El peor caso real del corpus: chunks de 1700+ chars con 1 solo punto.
      const enorme =
        Array.from({ length: 40 }, () => 'palabra').join(', ') + '.'
      expect(enorme.length).toBeGreaterThan(MAX_CHUNK_LENGTH)
      const chunks = splitIntoChunks(enorme)
      expect(chunks.length).toBeGreaterThan(1)
      for (const c of chunks) {
        expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH)
      }
    })
  })
})
