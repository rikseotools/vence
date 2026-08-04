/**
 * lib/shuffle/reviewCoords.ts — traducir las letras GUARDADAS al orden que el usuario VIO
 * al repasar un test terminado (T-472).
 *
 * ## El defecto que corrige (impugnación `8e9142c0`, MariSol, 01/08/2026)
 *
 * Una fila de `test_questions` de un test barajado guarda DOS cosas en sistemas de
 * coordenadas DISTINTOS, y hasta ahora nadie las reconciliaba al repasar:
 *
 *   · `full_question_context.options` → en el orden **MOSTRADO** (lo que vio el usuario),
 *      porque es lo que el cliente mandó al guardar la respuesta.
 *   · `user_answer` / `correct_answer` → letras en coordenadas **ORIGINALES** de la BD
 *      (`A` = `questions.option_a`), porque `answer-and-save` las desbaraja a propósito
 *      para que la fila sea coherente con el banco.
 *
 * `getTestReview` devolvía las dos juntas y la UI hacía `['A','B','C','D'].indexOf(letra)`
 * sobre las opciones mostradas → **señalaba como correcta la opción de al lado**. Medido
 * en RDS el 01/08: **446 de 577** exposiciones barajadas (24 usuarios, 110 tests) pintaban
 * la clave en la opción equivocada. El acierto/fallo guardado era correcto (lo recalcula
 * el servidor); lo que mentía era la pantalla de repaso, que es justo donde el opositor
 * se aprende la respuesta. La usuaria lo cazó: *«la respuesta correcta es la B, el
 * artículo 8 se refiere al responsable, no al encargado»*.
 *
 * ## Por qué se traduce hacia lo MOSTRADO y no al revés
 *
 * Podría desbarajarse el array de opciones para dejarlo en orden de BD. No se hace: el
 * usuario repasa lo que vio, y reordenarle las opciones le cambia el examen que hizo.
 * Se traducen las LETRAS, que es el dato que nadie recuerda.
 *
 * ## Fail-safe
 *
 * Ante un orden inválido o una letra que no está en el orden servido, NO se adivina: se
 * devuelve `'?'`, que la UI resuelve como «ninguna opción resaltada». Mejor no señalar
 * nada que señalar lo que no es — que es exactamente el fallo del que nace este módulo.
 *
 * PURO: sin BD, sin red, sin fecha. Tests en `__tests__/shuffle/reviewCoords.test.ts` y
 * verificación contra datos reales en `scripts/sim/sim-repaso-barajado.ts`.
 */

import { indexToLetter, letterToIndex } from '@/lib/question-options'
import { isValidExposureOrder } from '@/lib/shuffle/subsetOrder'

/** Letra que la UI resuelve como "ninguna opción" (`indexOf` → -1). */
export const LETRA_DESCONOCIDA = '?'

/** Valor con el que se guarda «la dejó en blanco» en `test_questions.user_answer`. */
export const EN_BLANCO = 'BLANK'

export type AnomaliaRepaso = 'orden_invalido' | 'letra_fuera_del_orden'

export interface CoordenadasRepaso {
  /** Letra de la respuesta del usuario EN EL ORDEN QUE VIO (null si dejó en blanco). */
  userAnswer: string | null
  /** Letra de la respuesta correcta EN EL ORDEN QUE VIO. */
  correctAnswer: string
  /** ¿Se ha traducido alguna letra? (false = la fila no estaba barajada). */
  remapeado: boolean
  /** Qué impidió traducir con garantías, si algo lo impidió. */
  anomalia: AnomaliaRepaso | null
}

export interface EntradaCoordenadasRepaso {
  /** `test_questions.option_order` tal cual sale de la BD (puede ser null/basura). */
  optionOrder: unknown
  /** Nº de opciones que se van a PINTAR (longitud del array que verá el usuario). */
  opcionesMostradas: number
  /**
   * ¿Las opciones que se van a pintar son las que vio el usuario (guardadas en
   * `full_question_context`), o se han recuperado de `questions` en orden natural?
   * Con opciones naturales NO se traduce nada: las letras ya casan.
   */
  opcionesSonLasVistas: boolean
  /** `test_questions.user_answer` (letra en coordenadas de BD) o null si fue en blanco. */
  userAnswer: string | null
  /** `test_questions.correct_answer` (letra en coordenadas de BD). */
  correctAnswer: string | null
}

/**
 * Traduce las letras guardadas (coordenadas de BD) a las letras que vio el usuario.
 *
 * Identidad —devuelve lo mismo que entra— en los tres casos en que traducir sería un
 * error: sin `option_order` (histórico y tests no barajados), con opciones naturales, y
 * con un orden que no se puede validar.
 */
export function resolverCoordenadasRepaso(
  entrada: EntradaCoordenadasRepaso,
): CoordenadasRepaso {
  const userAnswer = normalizarLetra(entrada.userAnswer)
  const correctAnswer = normalizarLetra(entrada.correctAnswer) ?? LETRA_DESCONOCIDA

  const identidad = (anomalia: AnomaliaRepaso | null = null): CoordenadasRepaso => ({
    userAnswer,
    correctAnswer,
    remapeado: false,
    anomalia,
  })

  // Sin barajado (histórico, o test servido en orden natural) → nada que traducir.
  if (entrada.optionOrder == null) return identidad()

  // Las opciones vienen de `questions` (orden de BD): las letras ya casan con ellas.
  // Traducir aquí desplazaría una fila que estaba bien.
  if (!entrada.opcionesSonLasVistas) return identidad()

  // Orden corrupto o desincronizado con lo que se va a pintar → no se adivina.
  if (!isValidExposureOrder(entrada.optionOrder, entrada.opcionesMostradas)) {
    return identidad('orden_invalido')
  }

  const orden = entrada.optionOrder as number[]
  const traducidaCorrecta = aPosicionMostrada(correctAnswer, orden)
  // `'BLANK'` es el valor con el que se guarda «la dejó en blanco» (feature de 15/04/2026), no
  // una letra: no hay nada que traducir y **no es una anomalía**. Se deja pasar tal cual para no
  // cambiar lo que recibe la pantalla en los tests sin barajar, que son la mayoría.
  //
  // ── LO QUE COSTÓ NO TENERLO (04/08/2026) ──────────────────────────────────────────────────
  // Los 13 `shuffle_option_order_invalid` que había en producción eran **los 13 en blanco**:
  // permutación correcta, fila bien puntuada, ni un solo caso de barajado roto. El daño no está
  // en la fila —se sirve igual— sino en la SEÑAL: [T-235] decide si el piloto de barajado se
  // amplía o se apaga vigilando que este evento **siga a cero**, y un contador que suma blancos
  // no puede responder a esa pregunta. Un detector que grita por algo normal deja de
  // distinguirse del que grita por algo roto.
  const enBlanco = userAnswer === EN_BLANCO
  const traducidaUsuario =
    userAnswer === null || enBlanco ? userAnswer : aPosicionMostrada(userAnswer, orden)

  const anomalia =
    traducidaCorrecta === LETRA_DESCONOCIDA || traducidaUsuario === LETRA_DESCONOCIDA
      ? 'letra_fuera_del_orden'
      : null

  return {
    userAnswer: traducidaUsuario,
    correctAnswer: traducidaCorrecta,
    remapeado: traducidaCorrecta !== correctAnswer || traducidaUsuario !== userAnswer,
    anomalia,
  }
}

/** Letra ORIGINAL (0=A en BD) → letra de la POSICIÓN en que se mostró. */
function aPosicionMostrada(letra: string, orden: number[]): string {
  const original = letterToIndex(letra)
  if (original < 0) return LETRA_DESCONOCIDA
  const mostrada = orden.indexOf(original)
  // La opción no se le llegó a mostrar (subconjunto servido, o dato incoherente):
  // no hay posición honesta a la que apuntar.
  if (mostrada < 0) return LETRA_DESCONOCIDA
  return indexToLetter(mostrada)
}

/** Recorta y normaliza a mayúscula; '' / null / no-string → null. */
function normalizarLetra(letra: string | null | undefined): string | null {
  if (typeof letra !== 'string') return null
  const limpia = letra.trim().toUpperCase()
  return limpia === '' ? null : limpia
}
