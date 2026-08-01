// lib/multicuenta/aviso.ts
//
// Cuándo se le enseña a un usuario free el aviso de «una cuenta por persona y dispositivo».
//
// ── QUÉ ES ESTO ([T-418], 01/08/2026) ───────────────────────────────────────
// El cupo diario del plan gratuito se cuenta también por DISPOSITIVO (todas las cuentas free
// del aparato suman). Quien entra con una segunda cuenta en el mismo equipo se encuentra el
// cupo ya gastado, y hasta ahora eso ocurría sin explicación: la UI le dejaba contestar y el
// servidor tiraba cada respuesta con un 403 mudo (27 usuarios, 1.471 respuestas perdidas en 14
// días, medido).
//
// Decisión de Manuel: avisarle al entrar de que solo se permite una cuenta por persona y
// dispositivo, con un «Aceptar», **para que cuando luego le salga el muro haciendo un test ya
// sepa por qué**. No es un castigo aparte: el muro es el de siempre, el mismo modal de Premium
// que ve cualquier free que agota su cupo.
//
// ── POR QUÉ UNA VEZ AL DÍA Y NO UNA VEZ Y YA ────────────────────────────────
// Decisión de Manuel entre tres opciones. Una sola vez se olvida y deja de cumplir su función
// (que sepa que lo vemos); en cada carga de página sería un obstáculo. Una vez al día lo
// recuerda **mientras la situación siga ocurriendo** y desaparece solo cuando deja de ocurrir.
//
// Puro a propósito: la decisión se prueba sin navegador ni almacenamiento.

/** Clave de la aceptación. Lleva el usuario Y el día: al cambiar cualquiera de los dos, vuelve
 *  a salir. Va por usuario porque el aviso es de la CUENTA con la que entras, y el mismo equipo
 *  tiene varias. */
export function claveAceptacion(userId: string, hoyISO: string): string {
  return `multicuenta_ack:${userId}:${hoyISO}`
}

/** Día local en formato `YYYY-MM-DD`. El corte del cupo es de Madrid, pero aquí basta el día
 *  del propio dispositivo: solo decide cuándo repetir un aviso, no cuánto cupo queda. */
export function diaLocal(ahora: Date): string {
  const y = ahora.getFullYear()
  const m = String(ahora.getMonth() + 1).padStart(2, '0')
  const d = String(ahora.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface EntradaAviso {
  /** El servidor ha visto 2+ cuentas en este dispositivo (`multi_cuenta_dispositivo`). */
  multiCuenta: boolean
  /** A un premium no se le limita nada, así que avisarle sería acusarle sin consecuencia. */
  esPremium: boolean
  /** Sin usuario resuelto no se opina (sesión a medio cargar). */
  userId: string | null | undefined
  /** Lo que haya guardado ya para ese usuario y día. */
  yaAceptadoHoy: boolean
  /** El estado del cupo aún se está cargando: no enseñar nada todavía. */
  cargando?: boolean
}

/**
 * ¿Toca enseñar el aviso ahora mismo?
 *
 * Deliberadamente estricto: cualquier duda (sin usuario, cargando, sin señal) es NO. Enseñar de
 * más un aviso que insinúa multicuenta a quien no la tiene es peor que no enseñarlo.
 */
export function debeMostrarAviso(e: EntradaAviso): boolean {
  if (e.cargando) return false
  if (!e.userId) return false
  if (e.esPremium) return false
  if (!e.multiCuenta) return false
  return !e.yaAceptadoHoy
}
