'use strict'
// lib/observability/llmErrorKind.cjs — NÚCLEO PURO: qué CLASE de fallo devolvió el proveedor.
//
// ## Por qué existe (26/07/2026)
//
// La app llevaba desde las 09:37 sin poder hablar con Anthropic —494 llamadas fallidas en un
// día, el radar de convocatorias (`detect_notas`, `oep_signals`) muerto— y el sistema lo sabía:
// el canario emitía `canary_ai_model_failed` cada 10 minutos y las alertas saltaron. Lo que NO
// decía en ningún sitio era **qué había pasado**: el evento guardaba `ok:false` y el mensaje
// crudo del proveedor en otra columna, así que para distinguir "sin saldo" de "clave revocada"
// hubo que ir a probar la clave a mano contra la API.
//
// Y la diferencia es TODA: sin saldo se arregla pagando, una clave revocada se arregla
// regenerándola, un 429 se arregla esperando y un modelo retirado se arregla cambiando el
// modelo. Una alerta que no distingue eso obliga a repetir el diagnóstico cada vez.
//
// Este módulo convierte el mensaje del proveedor en una CLASE estable que se guarda en el evento
// (`metadata.errorKind`), se puede agregar y se puede poner en el texto de la alerta.
//
// Puro y en JS plano a propósito: lo requieren el núcleo del frontend (`llm.ts`), el gemelo del
// backend (que no puede importar `lib/` del frontend, y lo replica con test de paridad) y los
// scripts de diagnóstico. Una sola tabla de patrones, tres consumidores.

/** Clases de fallo, ordenadas de más a menos accionable. */
const CLASES = [
  {
    kind: 'sin_credito',
    // Anthropic lo devuelve como 400 invalid_request_error (NO como 402), que es justo lo que
    // hizo pensar en un fallo de petición: "Your credit balance is too low to access the
    // Anthropic API. Please go to Plans & Billing…". OpenAI usa 429 insufficient_quota.
    re: /credit balance is too low|insufficient[_ ]quota|billing_hard_limit|exceeded your current quota|payment required/i,
    accion: 'recarga saldo en el proveedor (Plans & Billing). No es un bug de código.',
  },
  {
    kind: 'auth_invalida',
    re: /authentication_error|api key is invalid|invalid[_ ]api[_ ]key|incorrect api key|unauthorized/i,
    accion: 'la clave está revocada o es de otra cuenta: regenérala y actualízala donde toque.',
  },
  {
    kind: 'permiso',
    re: /permission_error|does not have access|not allowed to access|forbidden/i,
    accion: 'la clave existe pero no tiene permiso sobre ese modelo/organización.',
  },
  {
    kind: 'rate_limit',
    re: /rate[_ ]limit|too many requests|429/i,
    accion: 'se está pidiendo más rápido de lo permitido: reintentar con espera.',
  },
  {
    kind: 'modelo_no_disponible',
    re: /model[^.]{0,40}(not found|does not exist|deprecated|retired)|not_found_error/i,
    accion: 'el modelo ya no existe o no está disponible: cambiar el modelo configurado.',
  },
  {
    kind: 'sobrecarga',
    re: /overloaded|server_error|internal server error|503|502|bad gateway/i,
    accion: 'problema temporal del proveedor: reintentar.',
  },
  {
    kind: 'timeout',
    re: /timeout|timed out|aborted|ETIMEDOUT|ECONNRESET/i,
    accion: 'la llamada no llegó a completarse: revisar red o subir el timeout.',
  },
]

/**
 * Clasifica el fallo de una llamada a un LLM.
 * @param {string|null|undefined} mensaje  mensaje/cuerpo devuelto por el proveedor (crudo vale)
 * @param {number|null|undefined} [status] código HTTP, si se conoce
 * @returns {{kind:string, accion:string}}  `kind:'otro'` cuando no se reconoce (nunca inventa)
 */
function clasificarErrorLlm(mensaje, status) {
  const txt = `${status != null ? `${status} ` : ''}${mensaje == null ? '' : String(mensaje)}`
  if (!txt.trim()) return { kind: 'desconocido', accion: 'el fallo no dejó mensaje: revisar el call-site.' }
  for (const c of CLASES) {
    if (c.re.test(txt)) return { kind: c.kind, accion: c.accion }
  }
  // Los códigos son la última red, DESPUÉS de los mensajes: un 400 de Anthropic puede ser falta
  // de saldo (lo más caro de confundir), así que el texto manda sobre el número.
  if (status === 401) return { kind: 'auth_invalida', accion: CLASES[1].accion }
  if (status === 403) return { kind: 'permiso', accion: CLASES[2].accion }
  if (status === 429) return { kind: 'rate_limit', accion: CLASES[3].accion }
  if (status != null && status >= 500) return { kind: 'sobrecarga', accion: CLASES[5].accion }
  return { kind: 'otro', accion: 'sin patrón conocido: mirar `error_message` del evento.' }
}

/** ¿Esta clase de fallo exige intervención humana (no se arregla reintentando)? */
function requiereIntervencion(kind) {
  return kind === 'sin_credito' || kind === 'auth_invalida' || kind === 'permiso' || kind === 'modelo_no_disponible'
}

module.exports = { CLASES, clasificarErrorLlm, requiereIntervencion }
