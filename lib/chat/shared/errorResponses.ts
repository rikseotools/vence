/**
 * Respuestas de ERROR del chat — fuente única para producirlas Y para reconocerlas.
 *
 * ## Por qué existe (28/07/2026)
 *
 * El chat sirvió **210 respuestas de error a usuarios** y `ai_chat_logs.had_error` estaba en
 * **`false` en las 210**. El campo existe, `insertChatLog` lo acepta… y quien lo llama nunca se
 * lo pasaba. Consecuencia: un fallo que duró semanas **no salió en ninguna alerta ni en el
 * panel de salud**, y lo único que lo destapó fueron 27 usuarios pulsando el pulgar abajo.
 *
 * Dos causas reales, medidas en las trazas: **179 fallos** por un modelo que ya no existe
 * (`claude-sonnet-4-20250514` → 404, del 15/06 al 09/07, ya corregido) y **27** por
 * *"Your credit balance is too low"* (del 08/05 al 26/07).
 *
 * ## Por qué una fuente única y no un `if` en cada sitio
 *
 * Los textos estaban escritos a mano en cinco ficheros. Detectar el error comparando cadenas
 * sueltas es exactamente cómo se rompe esto la próxima vez: alguien cambia una coma en un
 * dominio y el detector deja de verlo **en silencio**. Aquí el mismo módulo compone el mensaje
 * y decide si un texto es de error, así que no pueden divergir.
 */

/** Motivo del fallo. Determina qué se le dice al usuario. */
export type MotivoErrorChat =
  /** El proveedor rechazó por falta de saldo. Reintentar NO va a funcionar. */
  | 'sin_saldo'
  /** Proveedor saturado (429/503/529). Reintentar más tarde SÍ tiene sentido. */
  | 'saturado'
  /** Cualquier otro fallo. */
  | 'generico'

export const MENSAJES: Record<MotivoErrorChat, string> = {
  // No se le pide que reintente: con la cuenta sin saldo, insistir no puede funcionar y
  // pedírselo es hacerle perder el tiempo. Se le ofrece la salida que SÍ existe.
  sin_saldo:
    '⚠️ **El asistente no está disponible ahora mismo.**\n\nNo es cosa tuya ni de tu conexión: es un problema nuestro y ya lo estamos mirando. Mientras tanto puedes seguir con los tests y el temario con normalidad.',
  saturado:
    '⚠️ **Nuestro sistema de razonamiento avanzado está saturado en este momento.**\n\nPor favor, espera unos minutos y vuelve a intentarlo.',
  generico:
    '⚠️ **Ha ocurrido un error generando la respuesta.**\n\nPor favor, vuelve a intentarlo en unos minutos.',
}

/**
 * Clasifica el fallo del proveedor. Recibe el status HTTP y el mensaje crudo porque Anthropic
 * manda la falta de saldo como **400** (`invalid_request_error`), no como un 402: mirar solo
 * el status la confundiría con un error de programación nuestro.
 */
export function clasificarErrorProveedor(status?: number, mensaje?: string): MotivoErrorChat {
  if (/credit balance is too low|insufficient[_ ]quota|billing/i.test(mensaje ?? '')) return 'sin_saldo'
  if (status === 429 || status === 503 || status === 529) return 'saturado'
  return 'generico'
}

/** El texto que ve el usuario para ese motivo. */
export function mensajeDeError(motivo: MotivoErrorChat): string {
  return MENSAJES[motivo]
}

/**
 * ¿Este texto es una respuesta de error? Lo usa la ruta para marcar `had_error` al guardar el
 * log, que es de donde cuelgan las alertas.
 *
 * Reconoce también los textos **antiguos**, escritos a mano en los dominios antes de que este
 * módulo existiera: mientras queden desplegados, o mientras se consulten logs viejos, seguir
 * viéndolos importa tanto como ver los nuevos.
 */
export function esRespuestaDeError(texto: string | null | undefined): boolean {
  if (!texto) return false
  const t = texto.slice(0, 400)
  if (Object.values(MENSAJES).some((m) => t.includes(m.slice(0, 40)))) return true
  // ⚠️ NO vale con "empieza por ⚠️ y dice error". El chat usa esa misma marca para avisar de
  // una **discrepancia en la pregunta** ("POSIBLE ERROR DETECTADO", "Posible error en la
  // respuesta marcada"), que es una función que hace BIEN: está señalando que nuestra clave
  // puede estar mal. Contarlas como fallo del sistema metía 21 falsos positivos en la
  // simulación sobre los 15.400 mensajes reales — y un detector ruidoso acaba ignorándose,
  // que es como se pierde el que sí importa.
  if (/posible error (detectado|en la respuesta)/i.test(t)) return false
  return (
    /Ha ocurrido un error generando la (explicaci[oó]n|respuesta)/i.test(t) ||
    /Hubo un error al procesar tu consulta/i.test(t) ||
    /est[aá] saturado en este momento/i.test(t) ||
    /El asistente no est[aá] disponible ahora mismo/i.test(t)
  )
}
