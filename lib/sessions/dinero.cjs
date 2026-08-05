// lib/sessions/dinero.cjs — lo que MUEVE DINERO lo ejecuta una persona. (T-486)
//
// ── POR QUÉ NACE, Y POR QUÉ NO EXISTÍA ANTES ────────────────────────────────────────────────
// Hasta el 05/08/2026 lo que impedía que un trabajador tocara dinero era que **no tenía con qué**:
// su entorno no llevaba claves de Stripe, ni de Bitrefill, ni de Ads. El propio supervisor lo
// escribía como justificación de correr en `bypassPermissions`: «la contención NO es el diálogo de
// permisos, son las credenciales: esta máquina no tiene claves de AWS ni de Stripe».
//
// Ese día se les dio el entorno completo para que pudieran resolver tareas profundas, y con él
// **dos claves `sk_live`** (cuentas Manuel y Nila), el token de Bitrefill (compra vales de verdad)
// y los de Google/Meta Ads (gastan presupuesto). La contención desapareció de golpe y sin que
// nadie lo decidiera — exactamente el modo de fallo que `aprobacion.cjs` ya había anticipado para
// los envíos: «es un accidente del aprovisionamiento».
//
// Así que la regla se DECLARA aquí y se hace cumplir en el punto de escritura, no en el texto del
// encargo. Un encargo se puede ignorar; esto no.
//
// ── QUÉ NO ES ESTO ──────────────────────────────────────────────────────────────────────────
// No sustituye a no mandar la credencial (`entornoTrabajador.cjs`, que es la capa fuerte). Las dos
// se ponen a propósito: la primera hace que no PUEDA, ésta hace que no lo intente aunque un día
// vuelva a poder. Una sola de las dos se cae sola en cuanto alguien cambie el aprovisionamiento.

/** Lo que nunca ejecuta un autónomo. Cada entrada dice QUÉ mueve y CON QUÉ. */
const OPERACIONES_DE_DINERO = {
  stripe: 'cobros, reembolsos, cupones o suscripciones en Stripe (claves sk_live, dinero real)',
  vales: 'compra o emisión de vales regalo en Bitrefill (dinero real)',
  ads: 'presupuestos, pujas o campañas en Google Ads / Meta Ads (gasta presupuesto)',
  plan: 'el plan de pago de un usuario (premium/free) o sus tablas de pagos',
}

/**
 * ¿Puede este rol ejecutar esta operación por su cuenta?
 *
 * @param rol   'persona' | 'trabajador' (de `lib/sessions/sid.cjs`)
 * @param tipo  una clave de OPERACIONES_DE_DINERO
 *
 * Solo una persona. **Y «no sé qué rol soy» cuenta como trabajador**, igual que en los envíos: el
 * rol lo declara quien arranca la sesión, así que su ausencia no es una persona delante — es una
 * sesión que nadie declaró. Fail-closed, como todo lo que decide un autónomo.
 */
function puedeTocarDinero(rol, tipo) {
  if (!OPERACIONES_DE_DINERO[tipo]) {
    return { ok: false, motivo: `operación de dinero desconocida: "${tipo}" (añádela a OPERACIONES_DE_DINERO)` }
  }
  if (rol === 'persona') return { ok: true, motivo: null }
  return { ok: false, motivo: `${OPERACIONES_DE_DINERO[tipo]} — esto lo ejecuta una persona, siempre` }
}

/** Lo que se le imprime a quien se ha parado: el porqué Y la salida (un bloqueo sin salida se rodea). */
function mensajeBloqueo(tipo) {
  return [
    '',
    '⛔ ESTO MUEVE DINERO. NO LO EJECUTA UN TRABAJADOR AUTÓNOMO.',
    '',
    `   Ibas a tocar: ${OPERACIONES_DE_DINERO[tipo] || tipo}`,
    '',
    '   Un error aquí no se arregla con un commit: se le cobra a alguien, o se le deja de cobrar.',
    '   Y no hay nadie delante de ti para verlo.',
    '',
    '   LO QUE SÍ TIENES QUE HACER — dilo y que lo ejecute una persona:',
    '     node scripts/backlog.cjs preguntar "<qué hay que hacer y por qué>" [--tarea T-nnn]',
    '',
    '   (si eres una persona y esto te ha parado: te falta VENCE_SESSION_ROLE=persona)',
    '',
  ].join('\n')
}

/**
 * La puerta, tal y como la llaman los scripts. **Único sitio que hay que invocar.**
 *
 * Devuelve `true` si puede seguir; si no, imprime el porqué y devuelve `false` (el llamador decide
 * el código de salida, para no reventarle el proceso a nadie desde una librería).
 */
function exigirPersonaParaDinero(tipo, { log = console.error } = {}) {
  const { rol } = require('./sid.cjs')
  const v = puedeTocarDinero(rol(), tipo)
  if (v.ok) return true
  log(mensajeBloqueo(tipo))
  return false
}

module.exports = { OPERACIONES_DE_DINERO, puedeTocarDinero, mensajeBloqueo, exigirPersonaParaDinero }
