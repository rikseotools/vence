// __tests__/laws/boeExtractorOrdinales.test.ts
// Ordinales latinos del BOE ("177 bis", "177 terdecies") — T-045, 26/07/2026.
//
// ## El defecto que fija
//
// La alternación de ordinales estaba (a) INCOMPLETA y (b) MAL ORDENADA, y además
// duplicada en CUATRO sitios de `lib/boe-extractor.ts` con recortes distintos: dos
// paraban en `septies` y dos en `decies`. Consecuencias medidas en RDS:
//
//   · La LGT perdió `177 undecies`, `177 duodecies`, `177 terdecies` y `177 quaterdecies`.
//   · En "Artículo 177 terdecies" casaba `ter` (que iba ANTES en la alternación) y el resto
//     quedaba en el título → fila `article_number='177 quater'` con
//     `title='decies. Terminación de los procedimientos…'`. Mismo patrón en 4 leyes
//     (LGT, LIVA, LSC, RD 1221/1992).
//   · Lo peor: `GET /api/verify-articles` NO los reportaba como `missing_in_db` porque el
//     extractor tampoco los veía → daba un **verde falso** justo donde faltaba articulado.
//     Una verificación que no ve lo que falta no es una verificación.
//
// La regla que fijan estos tests: la alternación va de MÁS LARGA a más corta y llega
// hasta `quaterdecies`. Si alguien reordena o recorta la lista, se ponen rojos.

import { ORDINAL_SUFFIXES, spanishTextToNumber } from '@/lib/boe-extractor'

const re = new RegExp(`^Artículo\\s+(\\d+(?:\\s+(?:${ORDINAL_SUFFIXES}))?)\\.\\s*(.*)$`, 'i')

describe('ORDINAL_SUFFIXES — orden y cobertura', () => {
  it('está ordenada de más larga a más corta en los pares que colisionan', () => {
    // OJO: hay que comparar las ALTERNATIVAS partidas, no `indexOf` sobre la cadena —
    // "ter" aparece como substring dentro de "qua**ter**decies" y el índice engaña.
    const alts = ORDINAL_SUFFIXES.split('|')
    const pos = (s: string) => alts.indexOf(s)
    // "ter" es prefijo de "terdecies"; "qu[aá]ter" de "quaterdecies".
    expect(pos('terdecies')).toBeLessThan(pos('ter'))
    expect(pos('quaterdecies')).toBeLessThan(pos('qu[aá]ter'))
    expect(pos('decies')).toBeLessThan(pos('ter'))
  })

  it('cubre la serie completa que usa el BOE', () => {
    for (const ord of ['bis', 'ter', 'quinquies', 'sexies', 'septies', 'octies',
      'nonies', 'decies', 'undecies', 'duodecies', 'terdecies', 'quaterdecies']) {
      expect(ORDINAL_SUFFIXES).toContain(ord)
    }
  })
})

describe('parseo de cabecera de artículo con ordinal', () => {
  const casos: Array<[string, string, string]> = [
    // texto BOE                                        → número            → título
    ['Artículo 177. Procedimiento frente a sucesores', '177', 'Procedimiento frente a sucesores'],
    ['Artículo 177 bis. Actuaciones de asistencia mutua', '177 bis', 'Actuaciones de asistencia mutua'],
    ['Artículo 177 ter. Intercambio de información', '177 ter', 'Intercambio de información'],
    ['Artículo 177 decies. Motivos de oposición', '177 decies', 'Motivos de oposición'],
    ['Artículo 177 undecies. Competencia para revisar', '177 undecies', 'Competencia para revisar'],
    ['Artículo 177 duodecies. Suspensión del procedimiento', '177 duodecies', 'Suspensión del procedimiento'],
    // EL CASO QUE ROMPÍA: antes daba número="177 ter" y título="decies. Terminación…"
    ['Artículo 177 terdecies. Terminación de los procedimientos de recaudación', '177 terdecies', 'Terminación de los procedimientos de recaudación'],
    ['Artículo 177 quaterdecies. Régimen jurídico', '177 quaterdecies', 'Régimen jurídico'],
  ]

  for (const [texto, numero, titulo] of casos) {
    it(`"${texto.slice(0, 42)}…" → ${numero}`, () => {
      const m = texto.match(re)
      expect(m).not.toBeNull()
      expect(m![1]).toBe(numero)
      expect(m![2]).toBe(titulo)
    })
  }

  it('el ordinal NUNCA se cuela en el título (invariante del defecto)', () => {
    for (const [texto] of casos) {
      const m = texto.match(re)
      expect(m).not.toBeNull()
      // Ningún título debe EMPEZAR por un ordinal latino seguido de punto.
      expect(m![2]).not.toMatch(new RegExp(`^(?:${ORDINAL_SUFFIXES})\\.`, 'i'))
    }
  })

  it('acepta la variante con tilde "quáter" (el BOE usa las dos)', () => {
    for (const v of ['Artículo 177 quater. Presencia de funcionarios', 'Artículo 177 quáter. Presencia de funcionarios']) {
      const m = v.match(re)
      expect(m).not.toBeNull()
      expect(m![2]).toBe('Presencia de funcionarios')
    }
  })
})

describe('spanishTextToNumber con sufijo ordinal', () => {
  it('reconoce los ordinales altos, no solo hasta septies', () => {
    expect(spanishTextToNumber('ciento setenta y siete terdecies')).toBe('177 terdecies')
    expect(spanishTextToNumber('ciento setenta y siete quaterdecies')).toBe('177 quaterdecies')
  })

  it('sigue reconociendo los bajos (no se rompe lo que ya iba)', () => {
    expect(spanishTextToNumber('ciento setenta y siete bis')).toBe('177 bis')
    expect(spanishTextToNumber('ciento setenta y siete')).toBe('177')
  })
})
