// lib/security/sessionIpTracking.ts
//
// Cuándo registrar la IP de la sesión. Núcleo PURO: sin red, sin DOM, testeable.
//
// ── EL FALLO QUE ARREGLA (T-314) ────────────────────────────────────────────
// El registro de IP se cayó del 80% al 1% el 03/07/2026, y estuvo 27 días roto sin una sola
// señal. La causa no fue un bug de red ni del endpoint —que funciona— sino **de qué se colgó el
// disparador**: `trackSessionIP()` se llamaba solo en el evento `SIGNED_IN` del listener de auth.
//
// Al flipear a Auth.js, ese evento dejó de llegar en la práctica. Su adaptador emula los eventos
// por polling:
//     const first = lastUserId === undefined
//     const event = first ? 'INITIAL_SESSION' : uid ? 'SIGNED_IN' : 'SIGNED_OUT'
// Con una cookie de 30 días, quien vuelve YA logueado produce `INITIAL_SESSION`, nunca
// `SIGNED_IN`. Solo lo emite el login fresco dentro de la misma pestaña — ese 1% que quedó.
//
// ── LA REGLA DE DISEÑO ──────────────────────────────────────────────────────
// La condición correcta NO es «qué evento ha llegado» sino **«hay usuario y hace tiempo que no
// registramos su IP»**. Eso es cierto con Auth.js, con Supabase y con lo que venga después: un
// disparador colgado del vocabulario de una librería se rompe en el siguiente cambio de librería,
// y —esto es lo grave— se rompe EN SILENCIO.
//
// ── POR QUÉ CON VENTANA Y NO EN CADA CARGA ──────────────────────────────────
// Si se llamara en cada montaje del contexto, cada navegación sería una escritura. Con una ventana
// de horas basta: lo que se persigue es «desde qué IP estudió hoy esta cuenta», no un histórico de
// clics. `auth_token_mint_waste` ya enseñó lo que pasa cuando algo se dispara por carga de página.

/** Horas entre registros para un mismo usuario. Una IP por franja basta para el antifraude. */
export const TRACK_IP_TTL_HOURS = 6

export interface TrackDecisionInput {
  /** ¿Hay usuario autenticado ahora mismo? */
  userId: string | null | undefined
  /** Marca del último registro para ESE usuario (epoch ms), o null si no hay. */
  lastTrackedAtMs: number | null | undefined
  /** Usuario al que corresponde la marca: si no coincide, hay que registrar igual. */
  lastTrackedUserId?: string | null
  nowMs: number
  ttlHours?: number
}

/**
 * ¿Toca registrar la IP ahora?
 *
 * Deliberadamente NO recibe el evento de auth: esa fue la causa del fallo. Solo mira si hay
 * usuario y cuánto hace del último registro suyo.
 */
export function shouldTrackSessionIp(input: TrackDecisionInput): boolean {
  const { userId, lastTrackedAtMs, lastTrackedUserId, nowMs } = input
  if (!userId) return false

  // Cambió la cuenta en este navegador: registrar SIEMPRE, sin esperar a que venza la ventana.
  // Es justo el gesto que caracteriza al farmeo multicuenta y el que más interesa capturar.
  if (lastTrackedUserId && lastTrackedUserId !== userId) return true

  if (lastTrackedAtMs == null) return true
  const ttlMs = (input.ttlHours ?? TRACK_IP_TTL_HOURS) * 3600_000
  const transcurrido = nowMs - lastTrackedAtMs
  // Un reloj que va hacia atrás (cambio de hora, reloj del sistema tocado) NO puede dejar de
  // registrar para siempre: ante una marca futura, se registra.
  if (transcurrido < 0) return true
  return transcurrido >= ttlMs
}

/** Serializa la marca para el almacén del navegador. */
export function encodeTrackMark(userId: string, nowMs: number): string {
  return `${userId}|${nowMs}`
}

/** Lee la marca; tolera formatos viejos o corruptos devolviendo "no hay marca". */
export function decodeTrackMark(
  raw: string | null | undefined,
): { userId: string | null; atMs: number | null } {
  if (!raw || typeof raw !== 'string') return { userId: null, atMs: null }
  const [userId, ts] = raw.split('|')
  const atMs = Number(ts)
  if (!userId || !Number.isFinite(atMs) || atMs <= 0) return { userId: null, atMs: null }
  return { userId, atMs }
}
