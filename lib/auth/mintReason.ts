// lib/auth/mintReason.ts — POR QUÉ se acuña un access token. Taxonomía CERRADA y compartida
// por el cliente (que es quien lo sabe) y el servidor (que es quien lo registra).
//
// ## Por qué existe (T-210, 28/07/2026)
//
// Se arregló el desperdicio de acuñación (9 copias del patrón «refreshSession() y si no
// getSession()» convergidas en `auth.getAccessToken()`), se desplegó, y al re-medir salió
// **−39%** en vez del −96,6% previsto. Al ir a explicar el 61% restante **no se pudo**: el
// evento `auth_token_minted` registraba CUÁNTAS acuñaciones había y por qué VÍA
// (`authjs_session`/`bridge`), pero no **por qué motivo**. Sin ese dato solo cabía conjeturar
// — y la conjetura mejor fundada (un bucle del backoff de 60 s por sesiones que no cuajan)
// **la refutaron los datos**: esos usuarios tenían CERO 401.
//
// Regla del manual de observabilidad que esto implementa: *si has tenido que suponer, falta
// un campo*.
//
// ## Por qué la lista vive AQUÍ y no duplicada a cada lado
//
// El cliente deriva el motivo y lo manda en una cabecera; el servidor lo valida antes de
// escribirlo. Si cada lado tuviera su propia lista, se separarían en el primer motivo nuevo y
// las consultas mentirían en silencio (el servidor guardaría `desconocido` para un motivo que
// el cliente cree estar mandando bien). Una definición, dos consumidores.
//
// ## Cómo se consulta (lo que esto desbloquea)
//
//   SELECT metadata->>'reason' motivo, count(*)*10 reales, count(DISTINCT user_id) usuarios
//   FROM observable_events
//   WHERE event_type='auth_token_minted' AND metadata->>'via'='authjs_session'
//     AND ts > now()-interval '24 hours'
//   GROUP BY 1 ORDER BY 2 DESC;
//
// Con eso, el 61% que hoy no se explica pasa a ser una fila con nombre. Y el arreglo que
// venga después se decide con datos, no con la mejor historia disponible.

/**
 * Motivos posibles. Cerrada a propósito: una taxonomía abierta se convierte en texto libre y
 * dejas de poder agrupar. Si hace falta uno nuevo, se añade aquí (y los tests de ambos lados
 * lo ven).
 */
export const MINT_REASONS = [
  /** Primera acuñación de este contexto JS: carga de página o pestaña nueva. La caché del
   *  adapter vive en MEMORIA, así que este motivo es el SUELO real del sistema — el que hizo
   *  que la predicción del −96,6% (derivada del TTL de 1 h) fuera inalcanzable. */
  'carga_inicial',
  /** Había token cacheado pero ya no era reusable (dentro del margen de renovación o pasado).
   *  Es el motivo SANO en una sesión larga: ~1 por hora de token. */
  'expirado',
  /** No había token en caché sin ser la primera vez: algo la invalidó (signOut, 401 previo,
   *  logout en otra pestaña). Si domina, el problema es que la caché se está tirando. */
  'cache_miss',
  /** El caller pidió explícitamente frescura (`refreshSession`, callback de OAuth, login con
   *  id_token). Si domina, es que alguien volvió a forzar renovaciones — el bug de T-210. */
  'forzado',
  /** El cliente no mandó motivo o mandó uno no reconocido (cliente viejo tras un deploy,
   *  cabecera perdida por un proxy). NO se descarta el evento: se cuenta como lo que es. */
  'desconocido',
] as const

export type MintReason = (typeof MINT_REASONS)[number]

/** Cabecera que transporta el motivo del cliente al servidor. */
export const MINT_REASON_HEADER = 'X-Mint-Reason'

/**
 * Deriva el motivo desde el estado del adapter. PURA: sin relojes ni globals, para poder
 * fijarla con tests.
 *
 * @param estado.forzado    el caller exigió red (force)
 * @param estado.hayCache   hay un token cacheado ahora mismo
 * @param estado.acuñoAntes este contexto JS ya acuñó alguna vez (distingue carga inicial de
 *                          caché invalidada — la diferencia entre «el suelo del sistema» y
 *                          «algo está tirando la caché», que piden arreglos distintos)
 */
export function deriveMintReason(estado: {
  forzado?: boolean
  hayCache?: boolean
  acuñoAntes?: boolean
}): MintReason {
  if (estado.forzado) return 'forzado'
  if (estado.hayCache) return 'expirado' // había token y aun así toca renovar
  return estado.acuñoAntes ? 'cache_miss' : 'carga_inicial'
}

/**
 * Valida lo que llega del cliente ANTES de escribirlo en telemetría. Nunca se guarda texto
 * libre venido del navegador: sería un vector de basura (o de inyección de cardinalidad) en
 * `observable_events`, y rompería los `GROUP BY` con los que se lee esto.
 */
export function sanitizeMintReason(raw: unknown): MintReason {
  if (typeof raw !== 'string') return 'desconocido'
  const v = raw.trim().toLowerCase()
  return (MINT_REASONS as readonly string[]).includes(v) ? (v as MintReason) : 'desconocido'
}
