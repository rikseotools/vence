// lib/api/topic-data/vistaDesfasada.ts
//
// «La vista no lo sabe» NO es «no hay preguntas». [T-555]
//
// ## El fallo que cierra
//
// Los datos de un tema (cuántas preguntas hay, de qué leyes, por dificultad) se sirven desde la
// vista materializada `topic_law_question_summary`, que se refresca **una vez al día** (03:30
// UTC). Cuando alguien se construye o EDITA su propio temario —oposición personalizada—, su
// `topic_scope` nace después de ese refresco, así que durante horas la vista no tiene ni una fila
// de ese tema… y el conteo salía **0**.
//
// Con 0 preguntas, la pantalla del tema no pinta el botón de empezar (`maxQuestions > 0`) y
// muestra a la vez «Cargando preguntas…» y «Tema en preparación: este tema aún no tiene preguntas
// configuradas» — mientras, tres centímetros más abajo, le enseña al usuario las 67 respuestas que
// YA ha dado en ese mismo tema. No podía empezar ningún test de su temario.
//
// Caso real (04/08/2026): un usuario premium rehízo su temario a las 17:37, la vista se había
// calculado a las 14:32, y a las 20:11 pulsó «Práctica» cuatro veces seguidas, probó «Examen»,
// cerró sesión, volvió a entrar y acabó escribiendo al soporte. Sus 186 preguntas estaban en la
// base de datos todo el rato.
//
// ## Por qué se puede distinguir, y por qué eso es lo que salva el arreglo
//
// La vista se construye con `LEFT JOIN` desde `topic_scope`, así que **un tema con scope y sin
// preguntas SÍ tiene fila** (con `total_questions = 0`). Por tanto «ninguna fila» solo puede
// significar una cosa: la vista todavía no conoce este tema. Los dos estados no se confunden por
// construcción — no hace falta un umbral ni una heurística.
//
// Lo que NO se hace, y es deliberado: refrescar la vista al guardar un temario. Son 6.123 filas y
// `REFRESH MATERIALIZED VIEW` es todo-o-nada; ya provocó un incidente de timeout el 12/07 (ver el
// guardarraíl `refresh-topic-summary.timeout.spec.ts`). Pagar un refresco completo por cada
// edición de un usuario no escala. El fallo de caché se resuelve donde se detecta: cayendo al
// cálculo directo, que ya existe y es el mismo que se usa con la vista desactivada.
//
// PURO: no toca BD ni red. Decide; quien ejecuta es `getTopicFullData`.

export interface EntradaVistaDesfasada {
  /** Filas que la vista materializada devolvió para este tema. */
  filasEnVista: number
  /** Mapeos de `topic_scope` del tema. Si no hay, el tema no tiene materia asignada. */
  mapeosDeScope: number
}

/**
 * ¿Hay que ignorar la vista y calcular en directo?
 *
 * Solo cuando el tema **tiene materia asignada** (`topic_scope`) y aun así la vista no sabe nada
 * de él. Sin scope no hay nada que calcular y la respuesta de «cero» es correcta: ese tema está
 * de verdad sin armar, y ahí «Tema en preparación» es el mensaje honesto.
 */
export function debeCalcularEnDirecto({
  filasEnVista,
  mapeosDeScope,
}: EntradaVistaDesfasada): boolean {
  if (!Number.isFinite(filasEnVista) || !Number.isFinite(mapeosDeScope)) return false
  return mapeosDeScope > 0 && filasEnVista === 0
}
