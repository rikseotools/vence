// lib/sessions/rotacionCuenta.cjs — ¿hay que mover esta sesión a la otra cuenta, y cuándo?
//
// ## Por qué existe ([T-709], 08/08/2026)
//
// Manuel: *«igual me quedo yo ahora sin poder terminar, y eso es un fallo»*. Toparse el límite
// semanal no avisa: la sesión deja de responder a media tarea. Hoy hay DOS cuentas y lo único
// que existe es **detección a posteriori** (`lib/flota/autenticacion.cjs` → `cuota_agotada`), que
// además solo PARA al trabajador. Nadie mira antes, y para las sesiones de persona no hay nada.
//
// ## El problema de medir «cuánta cuota queda»
//
// **No hay API de cuota.** El proveedor no publica cuánto llevas ni cuánto te falta: solo te
// corta. Así que aquí no se inventa un porcentaje —sería un número que nadie puede desmentir, y
// esos se rellenan a ojo— sino que se compara con **lo que esta misma cuenta consumió la última
// vez que topó**, que es un dato REAL y nuestro (`observable_events`, `llm_call` de suscripción).
//
// Consecuencias, y son las que hacen usable esto:
//   · La primera vez que una cuenta topa, este módulo NO puede avisar. Lo dice (`sinReferencia`)
//     en vez de callar: «no lo sé» tiene que poder decirse.
//   · A partir de ahí el umbral es empírico y se corrige solo cada vez que se vuelve a topar.
//
// ## Por qué la rotación no puede ser «en caliente»
//
// La cuenta se fija AL ARRANCAR la sesión (`CLAUDE_CODE_OAUTH_TOKEN` del entorno). No hay forma
// de cambiarla a media conversación. Rotar = **relanzar el panel** con la otra credencial y
// `--resume`, que conserva el hilo. Por eso el aviso tiene que llegar con margen: rotar cuesta
// unos segundos, pero solo si te enteras ANTES de que te corten.

/**
 * Margen con el que se avisa, en tanto por uno del consumo de referencia.
 *
 * 0,80 y no 0,95 a propósito: el aviso tiene que dar tiempo a TERMINAR lo que estás haciendo y
 * rotar en una pausa natural, no a que te pille a mitad de un commit. Con el 95 % el aviso llega
 * cuando ya da igual.
 */
const MARGEN_AVISO = 0.8

/** Por encima de esto ya no es un aviso: es que hay que rotar ya. */
const MARGEN_URGENTE = 0.93

/**
 * @param consumido    tokens de la cuenta en la ventana actual
 * @param referencia   tokens que esta cuenta llevaba la última vez que topó, o null si nunca
 * @returns `{ estado, fraccion, sinReferencia }` con
 *   `estado ∈ 'holgado' | 'avisar' | 'rotar_ya' | 'desconocido'`
 */
function estadoDeCuota({ consumido = 0, referencia = null } = {}) {
  if (!referencia || referencia <= 0) {
    // Sin referencia no se afirma nada. Es el caso de la PRIMERA vez, y decir «holgado» ahí
    // sería exactamente la mentira que deja a alguien tirado a media tarea.
    return { estado: 'desconocido', fraccion: null, sinReferencia: true }
  }
  const fraccion = consumido / referencia
  if (fraccion >= MARGEN_URGENTE) return { estado: 'rotar_ya', fraccion, sinReferencia: false }
  if (fraccion >= MARGEN_AVISO) return { estado: 'avisar', fraccion, sinReferencia: false }
  return { estado: 'holgado', fraccion, sinReferencia: false }
}

/**
 * ¿A qué cuenta se movería esta sesión? La OTRA que tenga credencial y no esté ella misma
 * apurada — mover a una cuenta que también está a punto de topar es cambiar de silla en el
 * Titanic, y además gasta el `--resume`.
 *
 * @param actual        cuenta en uso
 * @param candidatas    `[{ cuenta, estado }]` de todas las disponibles
 * @returns el nombre de la cuenta destino, o null si no hay ninguna sana
 */
function destinoDeRotacion({ actual, candidatas = [] } = {}) {
  const sanas = candidatas.filter(
    (c) => c.cuenta !== actual && (c.estado === 'holgado' || c.estado === 'desconocido'),
  )
  if (!sanas.length) return null
  // Preferir una con margen MEDIDO sobre una desconocida: entre «sé que le queda» y «no sé»,
  // se elige la primera. Si solo hay desconocidas, se usa igual — es mejor que quedarse.
  const conMedida = sanas.find((c) => c.estado === 'holgado')
  return (conMedida || sanas[0]).cuenta
}

/**
 * La orden que relanza un panel de tmux en la otra cuenta, conservando el hilo.
 *
 * Se devuelve como DATO (no se ejecuta aquí) para que se pueda revisar en seco antes de matar
 * el panel de alguien: `respawn-pane -k` mata lo que haya dentro, y eso no se hace a ciegas.
 *
 * @param panel     destino de tmux (`sesion:ventana.panel`)
 * @param cwd       directorio en el que arrancar (el worktree de esa sesión)
 * @param envVar    variable con la credencial de destino (p.ej. CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA)
 * @param sesionId  id de conversación a reanudar, o null para empezar limpia
 */
function ordenDeRotacion({ panel, cwd, envVar, sesionId = null } = {}) {
  if (!panel || !cwd || !envVar) return null
  const resume = sesionId ? ` --resume ${sesionId}` : ''
  // `exec` para que el panel no se quede con una shell intermedia colgando, y la credencial se
  // pasa por el entorno del propio comando: no se escribe en ningún fichero ni en el historial.
  const comando = `CLAUDE_CODE_OAUTH_TOKEN="$${envVar}" exec claude${resume}`
  return {
    panel,
    comando,
    argv: ['tmux', 'respawn-pane', '-k', '-c', cwd, '-t', panel, 'bash', '-lc', comando],
  }
}

module.exports = {
  estadoDeCuota,
  destinoDeRotacion,
  ordenDeRotacion,
  MARGEN_AVISO,
  MARGEN_URGENTE,
}
