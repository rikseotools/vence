// lib/api/daily-limit/mensajes.ts
//
// El texto que ve quien agota su cupo diario. UNO SOLO, a propósito.
//
// ── POR QUÉ UNO SOLO (30/07/2026) ───────────────────────────────────────────
// Había dos mensajes distintos: «Has alcanzado el límite diario de preguntas» cuando topaba la
// CUENTA y «Este dispositivo ha alcanzado el límite diario» cuando topaba el DISPOSITIVO. Basta
// con cambiar de cuenta y comparar los dos textos para deducir cómo contamos — y, sabiéndolo, el
// siguiente paso es obvio: coger otro móvil.
//
// Lo señaló Manuel al revisar el mensaje: *"si dices esto, ya sabe que es por dispositivo,
// entonces cogerá el móvil de su pareja y luego el de su hijo"*. Tenía razón, y el arreglo no es
// suavizar el texto del dispositivo: es que **los dos casos digan exactamente lo mismo**, de forma
// que el mensaje no revele qué límite saltó.
//
// ── QUÉ DICE Y QUÉ NO ───────────────────────────────────────────────────────
// · Es CIERTO: se ha alcanzado el límite del plan gratuito. No miente en nada.
// · NO acusa a nadie de tener varias cuentas. Un falso positivo (una familia que comparte
//   ordenador) no recibe una insinuación sobre su honradez, que es algo que no se recupera.
// · NO explica el mecanismo. Quien quiera evadirlo tendrá que probar a ciegas, y cada intento le
//   cuesta una cuenta nueva Y un dispositivo distinto.
// · SÍ ofrece la salida: es el momento de mayor intención de compra del día.
//
// El invariante —que los dos caminos usen este mismo texto— lo fija
// `__tests__/guardrails/limiteDiarioMensajeUnico.test.ts`. Si alguien vuelve a personalizar el
// mensaje del dispositivo «para que se entienda mejor», CI se pone rojo: entenderlo mejor es
// exactamente el problema.

/**
 * Único mensaje de límite diario alcanzado, sea por cuenta o por dispositivo.
 *
 * ⚠️ NO crear variantes. Si hace falta distinguir los casos para telemetría, se distinguen en el
 * EVENTO (`device_daily_limit_blocked` lleva su `anchor`), nunca en lo que lee el usuario.
 */
export const MSG_LIMITE_DIARIO =
  'Has alcanzado el límite diario de preguntas del plan gratuito. Vuelve mañana o pásate a Premium para practicar sin límite.'

/**
 * Variante para el límite graduado (usuarios con muchos topes acumulados).
 *
 * Se mantiene distinta porque describe otra situación real —demanda alta, no cupo agotado— y
 * porque no revela nada del mecanismo de conteo.
 */
export const MSG_LIMITE_GRADUADO =
  'Vence tiene mucha demanda actualmente. Actualiza a Premium para acceso prioritario.'
