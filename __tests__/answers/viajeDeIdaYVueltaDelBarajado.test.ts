/**
 * EL VIAJE DE IDA Y VUELTA DE UNA RESPUESTA BARAJADA.
 *
 * Lo que defiende (28/07/2026): si el servidor sirve una pregunta con las opciones permutadas y esa
 * permutación NO vuelve al guardar, el servidor interpreta la posición MOSTRADA como si fuera la
 * original → **marca fallo a quien acertó y acierto a quien falló**, sin dejar rastro (la fila queda
 * perfectamente coherente consigo misma).
 *
 * No es hipotético: con el piloto encendido, `test_questions.option_order` estaba a NULL en el
 * 100 % de las filas de la historia, mientras que ejecutar la función real de servir devolvía 5 de
 * cada 20 preguntas permutadas de verdad. La construcción del payload vivía dentro de un componente
 * de mil líneas, así que nadie podía comprobar dónde se perdía el dato.
 *
 * Aquí se recorre el camino con las piezas REALES (la permutación del servidor y el constructor del
 * payload del cliente) y se afirma lo único que importa: **quien elige la opción correcta en
 * pantalla queda registrado como ACIERTO**.
 */
import { buildAnswerPayload, normalizeOptionOrder } from '@/lib/answers/buildAnswerPayload'
import { permutationFor, applyOrder } from '@/lib/shuffle/permute'
import { answerAndSaveRequestSchema } from '@/lib/api/v2/answer-and-save/schemas'

const QUESTION_ID = '00000000-0000-4000-8000-0000000000q1'.replace('q1', '11')
const SESSION_ID = '00000000-0000-4000-8000-000000000022'

/** Lo que hace el SERVIDOR al servir una pregunta barajada (mismo mecanismo que el endpoint). */
function servirBarajada(opcionesNaturales: string[], claveOriginal: number, nonce: string) {
  const order = permutationFor(QUESTION_ID, nonce, opcionesNaturales.length)
  const claveMostrada = order.indexOf(claveOriginal)
  return {
    id: QUESTION_ID,
    question_text: '¿Pregunta de prueba?',
    options: applyOrder(opcionesNaturales, order),
    correct_option: claveMostrada, // en coordenadas MOSTRADAS, como hace el endpoint
    option_order: order,
  }
}

/** Lo que hace el SERVIDOR al recibir la respuesta: mostrada → original, y compara. */
function corregirEnServidor(params: {
  userAnswer: number | null
  optionOrder: number[] | null
  claveOriginal: number
}): boolean {
  const { userAnswer, optionOrder, claveOriginal } = params
  if (userAnswer === null) return false
  const original = Array.isArray(optionOrder) ? optionOrder[userAnswer] : userAnswer
  return original === claveOriginal
}

describe('una respuesta acertada sobre opciones barajadas se registra como ACIERTO', () => {
  const naturales = ['Alfa (correcta)', 'Beta', 'Gamma', 'Delta']
  const CLAVE_ORIGINAL = 0 // "Alfa" es la buena en la BD

  // Varios nonces: con 4 opciones, la permutación deja la clave en su sitio 1 de cada 4 veces, así
  // que un solo caso podría pasar por casualidad y no probar nada.
  const NONCES = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']

  it('el camino completo respeta al usuario en TODAS las permutaciones', () => {
    let permutacionesQueMuevenLaClave = 0

    for (const nonce of NONCES) {
      const servida = servirBarajada(naturales, CLAVE_ORIGINAL, nonce)
      if (servida.correct_option !== CLAVE_ORIGINAL) permutacionesQueMuevenLaClave++

      // El usuario pincha la opción correcta TAL COMO LA VE.
      const payload = buildAnswerPayload({
        question: servida,
        answerIndex: servida.correct_option,
        isBlank: false,
        sessionId: SESSION_ID,
        questionIndex: 0,
        tema: 21,
      })

      // 1) el payload conserva la permutación…
      expect(payload.optionOrder).toEqual(servida.option_order)
      // 2) …y el contrato del endpoint la acepta sin perderla
      const validado = answerAndSaveRequestSchema.safeParse({
        ...payload,
        questionText: payload.questionText || 'x',
        explanation: '', timeSpent: 5, confidenceLevel: 'sure', interactionCount: 1,
        article: null, metadata: { id: QUESTION_ID },
      })
      expect(validado.success).toBe(true)

      // 3) y el servidor, con ella, corrige a favor del usuario
      expect(
        corregirEnServidor({
          userAnswer: payload.userAnswer,
          optionOrder: payload.optionOrder,
          claveOriginal: CLAVE_ORIGINAL,
        }),
      ).toBe(true)
    }

    // Si ninguna permutación moviera la clave, el test no estaría probando nada.
    expect(permutacionesQueMuevenLaClave).toBeGreaterThan(0)
  })

  it('SIN la permutación, el mismo acierto se registraría como FALLO (el bug que esto impide)', () => {
    const servida = servirBarajada(naturales, CLAVE_ORIGINAL, 'nonce-que-mueve')
    // Se simula el escenario real: alguien reconstruye la pregunta y se deja `option_order`.
    const sinOrden = { ...servida, option_order: undefined }
    const payload = buildAnswerPayload({
      question: sinOrden, answerIndex: servida.correct_option, isBlank: false,
      sessionId: SESSION_ID, questionIndex: 0, tema: 21,
    })
    expect(payload.optionOrder).toBeNull()

    const acierto = corregirEnServidor({
      userAnswer: payload.userAnswer, optionOrder: null, claveOriginal: CLAVE_ORIGINAL,
    })
    // Con la clave movida y sin orden, el servidor se equivoca. Este test documenta el daño:
    // si algún día el de arriba se pone rojo, es EXACTAMENTE esto lo que está pasando en producción.
    expect(servida.correct_option === CLAVE_ORIGINAL || acierto === false).toBe(true)
  })

  it('la pregunta NO barajada viaja con orden nulo (retrocompatible)', () => {
    const natural = {
      id: QUESTION_ID, question_text: 'x', options: naturales, correct_option: CLAVE_ORIGINAL,
      option_order: null,
    }
    const payload = buildAnswerPayload({
      question: natural, answerIndex: 0, isBlank: false, sessionId: SESSION_ID, questionIndex: 0, tema: 1,
    })
    expect(payload.optionOrder).toBeNull()
    expect(corregirEnServidor({ userAnswer: 0, optionOrder: null, claveOriginal: 0 })).toBe(true)
  })
})

describe('normalización de la permutación (lo que llega del cliente no siempre es limpio)', () => {
  it('acepta una permutación válida', () => {
    expect(normalizeOptionOrder([2, 0, 1, 3])).toEqual([2, 0, 1, 3])
  })

  it('trata como "sin barajar" lo que no es una permutación de verdad', () => {
    // Un array vacío o con basura serializada NO puede llegar al servidor como si fuera un orden:
    // ahí decide si una respuesta cuenta como acierto.
    expect(normalizeOptionOrder(undefined)).toBeNull()
    expect(normalizeOptionOrder(null)).toBeNull()
    expect(normalizeOptionOrder([])).toBeNull()
    expect(normalizeOptionOrder(['2', '0'])).toBeNull()
    expect(normalizeOptionOrder([1.5, 0])).toBeNull()
    expect(normalizeOptionOrder([-1, 0, 1, 2])).toBeNull()
    expect(normalizeOptionOrder('2,0,1,3')).toBeNull()
  })
})

describe('guardarraíl: el componente NO puede volver a construir el payload por su cuenta', () => {
  // El bug vivió porque esta construcción estaba incrustada en TestLayout, fuera del alcance de
  // cualquier test. Si alguien la reescribe ahí dentro, el ida y vuelta deja de estar protegido
  // aunque los tests de arriba sigan en verde: estarían probando una copia que ya no se usa.
  it('TestLayout usa el constructor compartido y no una copia a mano', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path') as typeof import('path')
    const src = readFileSync(join(__dirname, '..', '..', 'components', 'TestLayout.tsx'), 'utf8')

    expect(src).toContain('buildAnswerPayload(')
    // Toda permutación que salga del componente pasa por el núcleo compartido: o la construye
    // `buildAnswerPayload`, o se normaliza con `normalizeOptionOrder`. Una asignación cruda
    // (`optionOrder: q.option_order ?? null`) es justo la línea que se perdía al reconstruir la
    // pregunta, y la que dejaba pasar basura como si fuera un orden real.
    // Se extrae el VALOR asignado y se comprueba explícitamente (un lookahead negativo aquí
    // retrocede sobre el espacio y da falsos positivos).
    const asignaciones = [...src.matchAll(/optionOrder\s*:\s*([^,\n]+)/g)].map((m) => m[1].trim())
    const crudas = asignaciones.filter((v) => !v.startsWith('normalizeOptionOrder('))
    expect(crudas).toEqual([])
  })
})

describe('el payload en blanco no inventa respuesta', () => {
  it('userAnswer null y isBlank true', () => {
    const payload = buildAnswerPayload({
      question: { id: QUESTION_ID, question_text: 'x', options: ['a', 'b'], option_order: [1, 0] },
      answerIndex: 2, isBlank: true, sessionId: SESSION_ID, questionIndex: 3, tema: 5,
    })
    expect(payload.userAnswer).toBeNull()
    expect(payload.isBlank).toBe(true)
    // aun en blanco, la permutación viaja: la fila queda autodescriptiva
    expect(payload.optionOrder).toEqual([1, 0])
  })
})
