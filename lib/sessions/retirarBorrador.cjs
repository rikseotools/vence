// lib/sessions/retirarBorrador.cjs — cerrar el caso RETIRA su borrador del embudo. (T-486, 06/08)
//
// ── POR QUÉ EXISTE, MEDIDO ──────────────────────────────────────────────────────────────────
// El embudo (`session_questions`) es donde un trabajador autónomo deja lo que no puede enviar él
// —un borrador para una persona— y es lo PRIMERO que sale en `npm run flota`, porque su coste
// corre mientras nadie lo lee.
//
// Pero cerrar la impugnación no retiraba su borrador. Medido el 06/08: **15 borradores abiertos**
// cuyos 15 casos estaban ya `resolved` o `rejected` (comprobados uno a uno contra
// `question_disputes` y `psychometric_question_disputes`) — resueltos y ENVIADOS por otras
// sesiones. O sea que el panel llevaba días pidiendo a Manuel que aprobara cosas ya enviadas.
//
// Es el mismo modo de fallo que ya tiene ficha propia en esta casa: **una señal que no se apaga
// sola acaba mintiendo**, y una lista que miente se deja de mirar — que es peor que no tenerla.
// El sitio del arreglo es el HECHO que la vuelve obsoleta (cerrar el caso), no la pantalla.
//
// ── SE COMPARTE A PROPÓSITO ─────────────────────────────────────────────────────────────────
// Lo usan los dos cierres (`impugnaciones/cerrar.ts` y `cerrar-feedback.ts`). Copiar el UPDATE en
// cada uno es como nacieron los cinco escritores de `seguimiento_url` [T-130]: el día que cambie
// el criterio, uno se queda atrás y vuelve a haber señal fantasma.
'use strict'

/**
 * Retira los borradores del embudo que apuntan a este caso.
 *
 * @param {any} sql        cliente `postgres` (porsager) ya conectado
 * @param {string} casoId  id de la impugnación / feedback que se acaba de cerrar
 * @param {string} motivo  por qué deja de hacer falta (queda escrito: quien lo lea después
 *                         tiene que poder distinguir «se envió» de «se descartó»)
 * @returns {Promise<number>} cuántos se retiraron (0 es lo normal: no todo caso tuvo borrador)
 *
 * FAIL-OPEN: un fallo aquí NO puede tumbar un cierre que ya se hizo — el email ya salió y la
 * impugnación ya está resuelta. Como mucho queda una fila de más, que es el estado de antes.
 */
async function retirarBorradoresDe(sql, casoId, motivo) {
  if (!sql || !casoId) return 0
  try {
    // Se busca por `draft_target`, que es donde el CLI escribe a quién apunta el borrador. Se
    // compara por PREFIJO porque ahí conviven el uuid entero y la forma corta de 8 caracteres
    // con la que se anotan a mano — las dos aparecen en filas reales.
    const filas = await sql`
      UPDATE public.session_questions
         SET status = 'withdrawn', answered_at = now(),
             answer = ${`Retirado automáticamente: el caso se cerró (${motivo}). El borrador ya no hace falta.`}
       WHERE kind = 'borrador' AND status = 'open'
         AND (draft_target LIKE ${'%' + casoId + '%'}
              OR draft_target LIKE ${'%' + String(casoId).slice(0, 8) + '%'})
      RETURNING id`
    return filas.length
  } catch {
    return 0
  }
}

module.exports = { retirarBorradoresDe }
