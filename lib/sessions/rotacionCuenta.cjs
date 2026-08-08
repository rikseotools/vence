// lib/sessions/rotacionCuenta.cjs — ¿hay que mover esta sesión a la otra cuenta, y cuándo?
//
// ## Por qué existe ([T-709], 08/08/2026)
//
// Manuel: *«igual me quedo yo ahora sin poder terminar, y eso es un fallo»*. Toparse el límite
// semanal no avisa: la sesión deja de responder a media tarea. Hoy hay DOS cuentas y lo único
// que existe es **detección a posteriori** (`lib/flota/autenticacion.cjs` → `cuota_agotada`), que
// además solo PARA al trabajador. Nadie mira antes, y para las sesiones de persona no hay nada.
//
// ## SÍ hay dato de cuota, y es del proveedor (corregido el 08/08, el mismo día)
//
// La primera versión de este módulo afirmaba que «no hay API de cuota» y montaba una referencia
// EMPÍRICA: comparar con lo que esa cuenta gastó la última vez que se quedó seca. **Era falso.**
// La propia API devuelve, en cada respuesta, cabeceras `anthropic-ratelimit-unified-*` con:
//
//   · `5h-utilization` y `7d-utilization`  → la fracción consumida, exacta (0.0 – 1.0+)
//   · `7d-surpassed-threshold`             → el umbral que el PROVEEDOR considera aviso (0.75)
//   · `status` / `7d-status`               → `allowed` | `allowed_warning`
//   · `5h-reset` / `7d-reset`              → epoch en que se repone
//
// Se descubrió buscando otra cosa: había que distinguir dos tokens y la única forma de hacerlo
// sin gastar cuota fue mirar sus cabeceras — y ahí estaba el dato que se había dado por
// inexistente. La lección es la de siempre en esta casa: **antes de construir una estimación,
// comprobar si el dato real ya viene dado**. La estimación se mantuvo un rato en el código y
// habría envejecido mintiendo, porque un número que nadie puede desmentir no se corrige solo.
//
// Se conserva la comparación por referencia SOLO como respaldo, para cuando no se puede sondear
// (sin red, o un token que no se quiere gastar).
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
function estadoDeCuota({ consumido = 0, referencia = null, utilizacion = null } = {}) {
  // La utilización del PROVEEDOR manda sobre cualquier estimación nuestra: es el mismo número
  // con el que él decide cortarte.
  if (typeof utilizacion === 'number' && Number.isFinite(utilizacion) && utilizacion >= 0) {
    if (utilizacion >= MARGEN_URGENTE) return { estado: 'rotar_ya', fraccion: utilizacion, sinReferencia: false, fuente: 'proveedor' }
    if (utilizacion >= MARGEN_AVISO) return { estado: 'avisar', fraccion: utilizacion, sinReferencia: false, fuente: 'proveedor' }
    return { estado: 'holgado', fraccion: utilizacion, sinReferencia: false, fuente: 'proveedor' }
  }
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
  // `CLAUDE_CODE_CUENTA` viaja al lado del token porque la variable de la credencial NO dice a
  // qué cuenta pertenece: sin este dato, la sesión rotada se contaría como «principal» y la
  // medida por cuenta mentiría justo en el caso que existe para medir.
  const cuenta = envVar.endsWith('_SECUNDARIA') ? 'secundaria' : 'principal'
  const comando =
    `CLAUDE_CODE_OAUTH_TOKEN="$${envVar}" CLAUDE_CODE_CUENTA=${cuenta} exec claude${resume}`
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
