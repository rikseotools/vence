// lib/exam/correccionBloqueada.ts
//
// ¿Este examen se quedó a medias porque su corrección FALLÓ, o porque la persona lo abandonó?
// Núcleo puro. Decidirlo mal en un sentido deja al opositor sin su nota; en el otro, le
// inventa una nota de un examen que nunca terminó.
//
// ## Por qué existe ([T-671], 08/08/2026)
//
// Durante el incidente del 07/08 las peticiones salían sin token y `/api/exam/validate` las
// rechazaba. El daño no fue solo el rato perdido: **las respuestas SÍ se guardaron** (van por
// `/api/exam/answer`, que sí funcionaba) y hasta se guardaron ya corregidas, pero la fila de
// `tests` se quedó con `is_completed=false` y `score=0`. Es decir, el trabajo está entero en la
// base de datos y el opositor no puede verlo por ninguna pantalla.
//
// Caso medido: `rbsc87`, premium de tres días, **ocho exámenes** el 07/08, ninguno completado.
// Cinco de ellos tienen sus respuestas guardadas y corregidas (18/25, 17/23, 13/24, 12/23,
// 6/14); los otros tres no tienen ni una fila — los abandonó al minuto de empezarlos.
//
// ## El criterio, y por qué no vale «tiene respuestas»
//
// Un examen abandonado a mitad TAMBIÉN tiene respuestas corregidas, y la línea base de
// abandonos es de 4-13 al día (medido sobre 10 días). Repararlos a todos convertiría cada
// abandono en un examen «terminado» con una nota que nadie quiso sacar.
//
// Lo que distingue al reparable es que **no quedaba nada por corregir**: todas las filas que se
// guardaron tienen veredicto, y no falta ninguna pregunta por responder. Ese estado solo se
// alcanza cuando la persona llegó al final y pulsó corregir.
//
// El caso `6/14` de arriba enseña por qué hace falta el segundo requisito: 14 respuestas de un
// examen de 25 es alguien que lo dejó, no alguien a quien le falló la corrección — aunque sus 14
// estén corregidas. Se clasifica como abandonado y NO se toca.

export type EstadoDeExamen =
  /** Ya está bien: tiene nota y su fila lo dice. */
  | 'ya_completo'
  /** Respondió todo y la corrección no pudo cerrarse. Reparable. */
  | 'correccion_bloqueada'
  /** Lo dejó a medias. No se toca: inventarle una nota es peor que no dársela. */
  | 'abandonado'
  /** Ni una respuesta guardada: no hay nada que reparar. */
  | 'vacio'

/**
 * Cuánto de un examen hay que haber respondido para considerarlo terminado. No es 100 % a
 * propósito: en modo examen se puede entregar dejando alguna en blanco, y `rbsc87` entregó
 * 23 de 25 en dos de los suyos. Por debajo de esto ya no es «entregar», es «irse».
 */
export const MINIMO_RESPONDIDO = 0.8

export function estadoDeExamen(t: {
  isCompleted: boolean
  totalQuestions: number
  /** Filas guardadas en `test_questions` para este test. */
  guardadas: number
  /** De las guardadas, cuántas tienen `is_correct` decidido. */
  corregidas: number
}): EstadoDeExamen {
  if (t.isCompleted) return 'ya_completo'
  if (t.guardadas === 0) return 'vacio'
  // Si queda algo sin corregir, el examen no llegó al final por este camino: no es el fallo
  // que esto repara y no se puede saber qué nota le correspondía.
  if (t.corregidas < t.guardadas) return 'abandonado'
  if (t.totalQuestions > 0 && t.guardadas / t.totalQuestions < MINIMO_RESPONDIDO) return 'abandonado'
  return 'correccion_bloqueada'
}

/** ¿Se puede reparar sin inventarle nada al usuario? */
export function esReparable(e: EstadoDeExamen): boolean {
  return e === 'correccion_bloqueada'
}
