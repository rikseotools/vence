// lib/flota/autenticacion.cjs — ¿este trabajador puede DE VERDAD trabajar? (T-486)
//
// ── EL PUNTO CIEGO QUE CIERRA ────────────────────────────────────────────────────────────────
// El latido demuestra que la MÁQUINA está viva y que alcanza la base de datos. No demuestra nada
// sobre Claude Code: el latido es node hablando con Postgres, y eso funciona igual con la sesión
// atascada en la pantalla de login.
//
// Medido el 05/08, en el primer arranque real de la flota: los dos trabajadores salieron 🟢 en el
// panel, latiendo cada pocos minutos, con su rol y su preflight en verde… y **ninguno de los dos
// estaba autenticado**. Llevaban veinte minutos delante de un «Select login method». El sistema
// entero decía que todo iba bien.
//
// Es exactamente el modo de fallo que este repo persigue en el contenido —el verde que significa
// «no lo he mirado» y se lee como «está bien»— aplicado al andamiaje. Y no se arregla mirando más
// veces el latido: hay que preguntarle a Claude Code si puede responder.
//
// ── POR QUÉ CLASIFICAR Y NO SOLO «FALLÓ» ────────────────────────────────────────────────────
// Las tres causas piden acciones distintas y confundirlas cuesta tiempo: sin credencial se pone
// una, con credencial inválida hay que acuñar otra (y ahí el error es del proveedor, no nuestro),
// y «no pude comprobarlo» no es ninguna de las dos — es no saber, que tiene que poder decirse.

/** Lo que se le pide para probar. Corto a propósito: esto se ejecuta a menudo y cuesta cuota. */
const SONDA = 'responde solo: ok'

/**
 * Traduce la salida de `claude -p` a un veredicto.
 *
 * @param salida  lo que imprimió el proceso (stdout + stderr)
 * @param codigo  su código de salida
 * @returns {estado, detalle}
 *
 * `estado`:
 *   · `autenticado`      — respondió
 *   · `token_invalido`   — hay credencial y el proveedor la rechaza (401 / invalid key)
 *   · `sin_credencial`   — no hay ninguna: se queda en la pantalla de login
 *   · `desconocido`      — falló por otra cosa (red, timeout, versión). NO se afirma nada.
 */
function clasificar(salida, codigo = null) {
  const s = String(salida || '')
  if (/invalid bearer token|401|invalid api key|authentication_error/i.test(s)) {
    return { estado: 'token_invalido', detalle: 'el proveedor rechaza la credencial: hay que acuñar otra' }
  }
  if (/select login method|claude account with subscription|\/login\b|login expired/i.test(s)) {
    return { estado: 'sin_credencial', detalle: 'se queda en la pantalla de login: no hay credencial utilizable' }
  }
  // El éxito se afirma por lo que RESPONDE, no por el código de salida: `claude -p` puede salir 0
  // habiendo escrito un error, y dar por bueno un 0 es cómo nacen los verdes falsos.
  if (/\bok\b/i.test(s) && codigo === 0) {
    return { estado: 'autenticado', detalle: null }
  }
  return { estado: 'desconocido', detalle: `no se pudo determinar (código ${codigo}): ${s.trim().slice(0, 120)}` }
}

/** ¿Puede este trabajador hacer su trabajo? Solo un estado dice que sí. */
const puedeTrabajar = (v) => v && v.estado === 'autenticado'

/**
 * Con qué severidad entra en el bus de observabilidad. La política vive aquí, como en fricción.
 *
 * Un trabajador que no puede autenticar es `error`: está arrancado, latiendo y ocupando su sitio
 * en el reparto sin poder hacer nada. `desconocido` es `warn` — no saber no es estar roto.
 */
const severidad = (v) => (v.estado === 'autenticado' ? 'info' : v.estado === 'desconocido' ? 'warn' : 'error')

/** La línea del panel. Dice qué pasa Y qué hacer. */
function diagnostico(trabajador, v) {
  switch (v.estado) {
    case 'autenticado': return null                       // lo normal no se pinta
    case 'token_invalido':
      return `🔴 ${trabajador}: token RECHAZADO por el proveedor — acuña otro con "claude setup-token" (el bueno empieza por sk-ant-oat01-)`
    case 'sin_credencial':
      return `🔴 ${trabajador}: SIN credencial, parado en la pantalla de login — está latiendo y ocupando sitio sin poder trabajar`
    default:
      return `🟠 ${trabajador}: no se pudo comprobar si puede trabajar — ${v.detalle}`
  }
}

module.exports = { SONDA, clasificar, puedeTrabajar, severidad, diagnostico }
