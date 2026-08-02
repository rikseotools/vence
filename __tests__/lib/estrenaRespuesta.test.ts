/**
 * `estrenaRespuesta` — la frontera entre «responder» y «rectificar» en los exámenes que
 * PRE-CREAN sus filas (T-450).
 *
 * Por qué existe: el examen normal y el simulacro escriben una fila por pregunta al
 * abrirse, con la respuesta vacía. Así que «la fila ya existe» NO significa «ya
 * respondió» — significa que el examen está abierto. Confundir las dos cosas es lo que
 * dejó a 100 usuarios free respondiendo 4.975 preguntas de simulacro en 7 días sin que
 * el contador diario se moviera (medido el 02/08/2026 en producción).
 *
 * La regla se equivoca en las dos direcciones y ambas cuestan:
 *   · demasiado estricta → se cobra al rectificar, y el usuario se queda sin cupo
 *     habiendo respondido menos (el incidente original de T-260, caso Sergio);
 *   · demasiado laxa → no se cobra nunca, que es el hueco que cierra este arreglo.
 */

import { debeConsumirCupo, estrenaRespuesta } from '@/lib/api/dailyLimit'

describe('estrenaRespuesta', () => {
  it('una casilla en blanco (null) se estrena: cobra', () => {
    expect(estrenaRespuesta(null)).toBe(true)
  })

  it('una casilla sin tocar (undefined) se estrena', () => {
    expect(estrenaRespuesta(undefined)).toBe(true)
  })

  it('la cadena vacía es una casilla en blanco, no una respuesta', () => {
    expect(estrenaRespuesta('')).toBe(true)
  })

  it('espacios en blanco tampoco son una respuesta', () => {
    // Defensa contra el dato sucio: una fila pre-creada con ' ' no puede hacer que la
    // primera respuesta del usuario salga gratis.
    expect(estrenaRespuesta('   ')).toBe(true)
  })

  it('rectificar una respuesta ya dada NO se estrena: no cobra dos veces', () => {
    expect(estrenaRespuesta('a')).toBe(false)
    expect(estrenaRespuesta('D')).toBe(false)
  })

  it('el marcador de blanco explícito de la BD sí es una respuesta registrada', () => {
    // `was_blank` viaja en su propia columna; si `user_answer` trae una letra, hubo
    // guardado previo y no se vuelve a cobrar.
    expect(estrenaRespuesta('x')).toBe(false)
  })
})

describe('la frontera completa: estrena → saveAction → cupo', () => {
  const flujo = (previo: string | null, isPremium: boolean) =>
    debeConsumirCupo(estrenaRespuesta(previo) ? 'saved_new' : 'already_saved', isPremium)

  it('free que responde por primera vez: consume 1', () => {
    expect(flujo(null, false)).toBe(true)
  })

  it('free que se lo piensa y cambia la respuesta: no consume otra vez', () => {
    expect(flujo('b', false)).toBe(false)
  })

  it('premium: nunca consume, responda lo que responda', () => {
    expect(flujo(null, true)).toBe(false)
    expect(flujo('b', true)).toBe(false)
  })

  it('un examen entero de 25 respuestas nuevas consume 25, y repasarlas no suma', () => {
    const nuevas = Array.from({ length: 25 }, () => flujo(null, false)).filter(Boolean).length
    const repasos = Array.from({ length: 25 }, () => flujo('a', false)).filter(Boolean).length
    expect(nuevas).toBe(25)
    expect(repasos).toBe(0)
  })
})
