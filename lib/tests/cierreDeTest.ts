// lib/tests/cierreDeTest.ts — cuánto espera la pantalla de resultados a que se
// guarden las respuestas, y qué se emite cuando esa espera no basta.
//
// ## Por qué existe ([T-315], 07/08/2026 — lo destapó una usuaria, no una alerta)
//
// Al terminar un test, `TestLayout` esperaba **20 segundos** a que la cola de
// `/api/v2/answer-and-save` drenara antes de cerrar el test en el servidor. Solo
// entonces aparecían la confirmación y los dos botones que la persona necesita
// ahí: «Revisar fallos» y «Practicar mis fallos».
//
// El día que el servidor se satura —que es lo que arregla el presupuesto único
// de `backend/src/answer-save/presupuesto.ts`— esa espera se agota entera. Para
// quien acaba de terminar un test, la pantalla se queda sin las acciones que
// esperaba justo cuando quería encadenar el siguiente. Es literalmente lo que
// reportó Lourdes (feedback `e790c7bf`): *«me ocurre cuando termino un test y
// quiero hacer otro»*.
//
// ## Por qué esperar 20 s no compraba nada
//
// Las respuestas NO dependen de esa espera para estar a salvo: viven en
// `localStorage`, la cola reintenta sola, y el cierre en servidor tiene un
// safety-net que rellena lo que falte (`cupo_safety_net`, que además cobra el
// cupo de lo que estrena). La espera solo servía para que ese safety-net
// trabajara menos en el caso común — y el caso común drena en menos de un
// segundo. Los 17 s restantes solo se pagan cuando algo va mal, que es
// exactamente cuando el usuario menos puede permitírselos.
//
// ## Y la señal que faltaba
//
// Nadie estaba contando a quién le pasa. El aviso que había era un
// `console.warn` y en 10 días dejó **6 apariciones**, ninguna de la usuaria que
// escribió — mientras el servidor tenía que rellenar respuestas entre 2 y 6
// veces al día, su sesión incluida. O sea: solo nos enterábamos cuando alguien
// se molestaba en escribirnos.

/**
 * Lo que la pantalla de resultados espera a que drene la cola antes de cerrar
 * el test en el servidor.
 *
 * 3 s cubre el caso común con margen de sobra (drena en <1 s) sin castigar al
 * usuario cuando el servidor va mal. No es 0 a propósito: dejar que el
 * safety-net rellene SIEMPRE convertiría el camino excepcional en el normal, y
 * un camino excepcional que se recorre siempre deja de estar vigilado.
 */
export const ESPERA_DRENADO_MS = 3_000

export interface AvisoDrenado {
  severity: 'warn'
  eventType: 'test_cierre_sin_drenar'
  errorMessage: string
  metadata: {
    pendientes: number
    esperaMs: number
    /** El servidor tendrá que rellenar: es el coste real, no un detalle. */
    rellenaraServidor: true
  }
}

/**
 * ¿Hay que dejar rastro del cierre de este test?
 *
 * Devuelve `null` cuando la cola drenó —el caso normal no emite nada: una señal
 * que se emite siempre no distingue nada— y el aviso cuando no drenó.
 *
 * @param drenado    lo que devolvió `waitForQueueDrain`
 * @param pendientes respuestas que siguen sin subir al agotarse la espera
 * @param esperaMs   cuánto se esperó (parametrizado para no clavar el número)
 */
export function avisoDeCierre(
  drenado: boolean,
  pendientes: number,
  esperaMs: number = ESPERA_DRENADO_MS,
): AvisoDrenado | null {
  if (drenado) return null
  return {
    severity: 'warn',
    eventType: 'test_cierre_sin_drenar',
    errorMessage: `La cola no drenó en ${esperaMs} ms al cerrar el test (${pendientes} pendientes)`,
    metadata: {
      // Nunca negativo: `pendientes` viene de un contador que puede llegar a 0
      // justo entre la comprobación y la emisión.
      pendientes: Math.max(0, pendientes),
      esperaMs,
      rellenaraServidor: true,
    },
  }
}
