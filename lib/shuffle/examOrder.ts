/**
 * lib/shuffle/examOrder.ts — persistir el orden de exposición del MODO EXAMEN. (T-277)
 *
 * ## Por qué existe
 *
 * Los tests de práctica ([T-267]) barajan/recortan y confían en que el CLIENTE devuelva
 * `option_order` con cada respuesta — funciona porque servir y responder son la MISMA
 * visita. El modo examen tiene un tercer momento que los tests de práctica no tienen:
 * REANUDAR. Si el orden no se persiste al SERVIR, un examen dejado a medias y retomado
 * ve un orden NUEVO (el nonce es aleatorio) y las respuestas ya dadas — guardadas contra
 * el orden viejo — apuntan a posiciones que ya no significan lo mismo. Es el escenario
 * que la ficha llama "corromper el examen reanudado": peor que no barajar.
 *
 * ## El diseño: el servidor es la única autoridad del orden
 *
 * A diferencia de T-267 (el cliente ECOA el `option_order` que recibió), aquí el orden se
 * graba UNA VEZ en `tests.questions_metadata.option_orders` al crear el examen — el único
 * momento en que se sirven las preguntas por primera vez — y de ahí en adelante `/api/exam/
 * answer`, `/api/exam/validate` y `/api/exam/resume` lo LEEN de la BD por `testId`+
 * `questionId`. El cliente nunca tiene que mandarlo de vuelta ni se confía en que lo haga
 * bien: elimina una clase entera de "el cliente mintió sobre el orden" sin más código.
 *
 * `test_questions.user_answer`/`correct_answer` SIGUEN en coordenadas ORIGINALES (0=A del
 * banco), exactamente igual que hoy sin barajado — el barajado es puramente una traducción
 * en el BORDE de la petición/respuesta. Nada que ya lea `test_questions` (stats, analítica)
 * tiene que enterarse de que el examen se sirvió barajado.
 */

import { displayedToOriginal, isValidOrder } from './permute'
import { MAX_OPCIONES_BANCO } from './subsetOrder'

export type OptionOrders = Record<string, number[]>

/** Una pregunta tal y como la sirve `/api/questions/filtered` (lo que le importa a este módulo). */
export interface ServedExamQuestion {
  id?: string | null
  option_order?: number[] | null
}

/**
 * Extrae `{questionId: order}` de las preguntas SERVIDAS al crear el examen. Solo incluye
 * las que de verdad se barajaron/recortaron (`option_order` presente) — la mayoría de
 * exámenes no tocan nada (oposición sin `examen_config` de barajado) y esto sale `{}`.
 */
export function buildOptionOrders(questions: ServedExamQuestion[]): OptionOrders {
  const out: OptionOrders = {}
  for (const q of questions) {
    if (!q.id || !Array.isArray(q.option_order) || q.option_order.length === 0) continue
    out[q.id] = q.option_order
  }
  return out
}

/**
 * Lee `option_orders` de `tests.questions_metadata` de forma segura (nunca lanza: un
 * metadata corrupto o de un examen viejo sin la clave se trata como "sin barajar", no
 * como un error — el examen histórico sigue funcionando exactamente como hoy).
 */
export function optionOrdersFromMetadata(metadata: unknown): OptionOrders {
  if (!metadata || typeof metadata !== 'object') return {}
  const raw = (metadata as { option_orders?: unknown }).option_orders
  if (!raw || typeof raw !== 'object') return {}
  const out: OptionOrders = {}
  for (const [questionId, order] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(order) && order.every((v) => Number.isInteger(v))) {
      out[questionId] = order as number[]
    }
  }
  return out
}

/**
 * El orden persistido para ESTA pregunta, o `null` si no se barajó (examen sin shuffle,
 * pregunta no elegible en su momento, o metadata sin esa clave — los tres se tratan
 * igual: servir/corregir en identidad, el comportamiento de siempre).
 *
 * Valida con `isValidOrder` contra `MAX_OPCIONES_BANCO`: un valor corrupto en la BD (no
 * debería poder pasar, pero un dato viejo o manipulado no puede tumbar la corrección) se
 * descarta como si no hubiera orden, nunca se usa a medias.
 */
export function orderForQuestion(orders: OptionOrders, questionId: string): number[] | null {
  const order = orders[questionId]
  if (!order) return null
  return isValidOrder(order, order.length) && order.length <= MAX_OPCIONES_BANCO ? order : null
}

/**
 * Letra MOSTRADA ('a'..'e', lo que el usuario clicó o lo que se le resalta) → letra
 * ORIGINAL del banco (lo que `test_questions`/`questions.correct_option` esperan).
 * `null`/vacía pasa igual (respuesta en blanco no se traduce, sigue en blanco).
 */
export function displayedLetterToOriginal(order: number[] | null, letter: string | null): string | null {
  if (!letter) return letter
  const idx = letter.toLowerCase().charCodeAt(0) - 97 // 'a' → 0
  if (idx < 0 || idx > 25) return letter // no es una letra de opción; no tocar
  const original = displayedToOriginal(order, idx)
  return String.fromCharCode(97 + original)
}

/**
 * Letra ORIGINAL (la que vive en `test_questions`) → letra MOSTRADA en el orden actual
 * (para reconstruir `savedAnswers` al reanudar, donde el cliente espera coordenadas de lo
 * que va a ver en pantalla).
 */
export function originalLetterToDisplayed(order: number[] | null, letter: string | null): string | null {
  if (!letter) return letter
  const idx = letter.toLowerCase().charCodeAt(0) - 97
  if (idx < 0 || idx > 25) return letter
  if (!order) return letter
  const pos = order.indexOf(idx)
  return pos === -1 ? letter : String.fromCharCode(97 + pos)
}
