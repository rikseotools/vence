/**
 * El recuadro "Tu Evolución en esta pregunta" NO puede afirmar dos cosas opuestas a la vez.
 *
 * Bug real (28/07/2026, feedback 108cc2a8 de MariSol, premium de Valencia): las bolitas y el
 * porcentaje salían de la fila guardada (verdad del servidor) y la cabecera del resultado que
 * calculaba el cliente. Dos fuentes para el mismo hecho → el mismo recuadro se contradecía:
 *
 *   · respondió A → ACIERTO en `test_questions`  →  cabecera: «Sigues fallando esta pregunta (0/2)»
 *   · respondió B → FALLO   en `test_questions`  →  cabecera: «¡Progreso! Antes fallaste, ahora acertaste»
 *
 * Los datos de estos tests son SUS intentos reales (id de sesión y resultados incluidos), no
 * inventados: si alguien vuelve a separar las dos fuentes, estos casos se ponen rojos.
 */
import { calcularEvolucionCompleta } from '@/components/QuestionEvolution'

const SESION_EN_CURSO = '0354e830-0000-4000-8000-000000000001'

/** Fila tal como la devuelve /api/v2/question-evolution/history (ORDER BY created_at ASC). */
const fila = (over: { is_correct: boolean; test_id?: string; created_at: string }) => ({
  id: `row-${over.created_at}`,
  user_answer: 'A',
  correct_answer: 'A',
  is_correct: over.is_correct,
  was_blank: false,
  confidence_level: null,
  time_spent_seconds: 12,
  created_at: over.created_at,
  test_id: over.test_id ?? 'sesion-vieja',
  question_order: 1,
})

describe('la cabecera y las bolitas beben de la misma verdad', () => {
  it('caso real 4ed7bbcc: acertó el último intento → la cabecera NO puede decir que sigue fallando', () => {
    const history = [
      fila({ is_correct: false, created_at: '2026-06-04T21:20:00Z' }),
      fila({ is_correct: true, created_at: '2026-07-28T14:28:00Z', test_id: SESION_EN_CURSO }),
    ]
    // El cliente se equivocó y dijo "fallo" (es lo que produjo el mensaje que ella vio).
    const evo = calcularEvolucionCompleta(history as never, {
      is_correct: false,
      was_blank: false,
      time_spent_seconds: 10,
      confidence_level: null,
      test_id: SESION_EN_CURSO,
    })
    expect(evo.mensaje).not.toMatch(/Sigues fallando/i)
    expect(evo.mensaje).toMatch(/acertaste|aciertas/i)
    expect(evo.tasaAciertos).toBe(50) // 1 de 2, como en la BD
    expect(evo.discrepanciaClienteServidor).toEqual({ cliente: false, servidor: true })
  })

  it('caso real 3bdd3565: falló el último intento → la cabecera NO puede felicitarle', () => {
    const history = [
      fila({ is_correct: true, created_at: '2026-06-04T21:18:00Z' }),
      fila({ is_correct: false, created_at: '2026-06-04T21:23:00Z' }),
      fila({ is_correct: false, created_at: '2026-06-07T17:40:00Z' }),
      fila({ is_correct: false, created_at: '2026-06-07T17:59:00Z' }),
      fila({ is_correct: false, created_at: '2026-06-18T10:57:00Z' }),
      fila({ is_correct: false, created_at: '2026-07-28T14:32:00Z', test_id: SESION_EN_CURSO }),
    ]
    const evo = calcularEvolucionCompleta(history as never, {
      is_correct: true, // el cliente creyó que había acertado
      was_blank: false,
      time_spent_seconds: 8,
      confidence_level: null,
      test_id: SESION_EN_CURSO,
    })
    expect(evo.mensaje).not.toMatch(/acertaste/i)
    expect(evo.mensaje).toMatch(/Sigues fallando/i)
    expect(evo.tasaAciertos).toBe(17) // 1 de 6, como en la BD
    expect(evo.discrepanciaClienteServidor).toEqual({ cliente: true, servidor: false })
  })

  it('caso real 89021fe8: la fracción de la cabecera cuadra con el porcentaje', () => {
    const history = [
      fila({ is_correct: false, created_at: '2026-06-07T17:39:00Z' }),
      fila({ is_correct: true, created_at: '2026-06-15T08:45:00Z' }),
      fila({ is_correct: true, created_at: '2026-07-28T14:32:00Z', test_id: SESION_EN_CURSO }),
    ]
    const evo = calcularEvolucionCompleta(history as never, {
      is_correct: true,
      was_blank: false,
      time_spent_seconds: 15,
      confidence_level: null,
      test_id: SESION_EN_CURSO,
    })
    // Ella vio "(3/3)" con un 67% al lado: imposible. 2 de 3 es lo que dice la BD.
    expect(evo.mensaje).toContain('2/3')
    expect(evo.tasaAciertos).toBe(67)
    expect(evo.discrepanciaClienteServidor).toBeNull() // aquí cliente y servidor sí coincidían
  })

  it('sin fila persistida aún (guardado asíncrono en vuelo) se usa el resultado del cliente', () => {
    // No es una concesión: es el feedback instantáneo. Mientras la fila no aterriza, lo único
    // que hay es lo que el cliente acaba de calcular, y el usuario debe ver algo coherente.
    const history = [fila({ is_correct: false, created_at: '2026-06-04T21:20:00Z' })]
    const evo = calcularEvolucionCompleta(history as never, {
      is_correct: true,
      was_blank: false,
      time_spent_seconds: 9,
      confidence_level: null,
      test_id: SESION_EN_CURSO, // sesión distinta de la de la fila → aún no persistido
    })
    expect(evo.mensaje).toMatch(/acertaste/i)
    expect(evo.totalIntentos).toBe(2) // el intento en memoria cuenta
    expect(evo.discrepanciaClienteServidor).toBeNull() // no hay con qué contrastar
  })

  it('un intento en blanco persistido no se convierte en acierto', () => {
    const enBlanco = { ...fila({ is_correct: false, created_at: '2026-07-28T14:40:00Z', test_id: SESION_EN_CURSO }), was_blank: true }
    const evo = calcularEvolucionCompleta([enBlanco] as never, {
      is_correct: true,
      was_blank: false,
      time_spent_seconds: 5,
      confidence_level: null,
      test_id: SESION_EN_CURSO,
    })
    expect(evo.mensaje).not.toMatch(/acertaste|aciertas/i)
    expect(evo.blancosAbsolutos).toBe(1)
  })
})
