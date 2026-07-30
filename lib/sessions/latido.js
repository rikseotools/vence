/**
 * ¿Qué sesión de trabajo (worktree) está VIVA? — núcleo puro, sin BD ni procesos.
 *
 * ## Por qué existe (T-296, 30/07/2026)
 *
 * Al querer limpiar había **15 worktrees de sesión** y **9 conversaciones activas**, y ninguna forma
 * de emparejarlas. La limpieza acabó en una lista de 10 candidatas a borrar que era *una conjetura
 * vestida de inventario*. Las tres señales que se probaron y NO sirven:
 *
 *   · **La fecha del directorio.** Una sesión viva puede pasar horas sin tocar su worktree (entre
 *     mensajes no ejecuta nada) y una muerta puede tenerlo recién tocado por un proceso suelto.
 *   · **El `cwd` de la transcripción.** Todas dicen `/home/manuel/Documentos/github/vence`: las
 *     sesiones arrancan en el repo principal y entran al worktree por comandos.
 *   · **La rama o el `.session-id`.** Existen desde que se creó el worktree; no dicen nada de ahora.
 *
 * Lo único que prueba vida es una SEÑAL con hora, y las bandas de abajo son deliberadamente
 * conservadoras en la dirección que importa: el error caro no es dejar un worktree de más en el
 * disco, es **borrar el trabajo de una sesión viva**. Por eso «sin señales» exige 24 h de silencio y
 * la respuesta a «¿puedo borrarlo?» nunca es sí a secas: es «sin señales desde hace X, y limpio».
 */

/** Bandas de vida. En minutos, desde la última señal. */
const VIVA_MIN = 15
const RECIENTE_MIN = 120
const DORMIDA_MIN = 24 * 60

/**
 * Clasifica una sesión por su última señal.
 * @param {Date|string|null} ultimaSenal
 * @param {Date} ahora
 * @returns {{estado:'viva'|'reciente'|'dormida'|'sin_senales', minutos:number|null, borrable:boolean}}
 *
 * `borrable` es una CONDICIÓN NECESARIA, no un permiso: dice «por la señal, nadie la está usando».
 * Quien borre tiene que mirar además que no haya trabajo sin pushear (eso lo sabe git, no esto).
 */
function clasificarSenal(ultimaSenal, ahora = new Date()) {
  if (!ultimaSenal) return { estado: 'sin_senales', minutos: null, borrable: true }
  const t = ultimaSenal instanceof Date ? ultimaSenal : new Date(ultimaSenal)
  if (isNaN(t.getTime())) return { estado: 'sin_senales', minutos: null, borrable: true }
  // Una señal en el FUTURO (reloj desajustado entre máquinas, o una fila escrita a mano) se trata
  // como recién vista: suponer «muerta» por un reloj torcido es justo el error que no se puede
  // cometer aquí.
  const minutos = Math.max(0, Math.round((ahora.getTime() - t.getTime()) / 60_000))
  if (minutos < VIVA_MIN) return { estado: 'viva', minutos, borrable: false }
  if (minutos < RECIENTE_MIN) return { estado: 'reciente', minutos, borrable: false }
  if (minutos < DORMIDA_MIN) return { estado: 'dormida', minutos, borrable: false }
  return { estado: 'sin_senales', minutos, borrable: true }
}

/** «hace 3 min» · «hace 2 h» · «hace 5 días» · «nunca». Para que la lista se lea de un vistazo. */
function formatearAntiguedad(minutos) {
  if (minutos == null) return 'nunca'
  if (minutos < 1) return 'ahora mismo'
  if (minutos < 60) return `hace ${minutos} min`
  if (minutos < 48 * 60) return `hace ${Math.round(minutos / 60)} h`
  return `hace ${Math.round(minutos / (60 * 24))} días`
}

/** Etiqueta con semáforo, la que se pinta en el listado. */
function etiquetaEstado(estado) {
  return { viva: '🟢 viva', reciente: '🟡 reciente', dormida: '🟠 dormida', sin_senales: '⚪ sin señales' }[estado] || estado
}

/**
 * Pares de nombres que se distinguen por MENOS de lo que un humano nota al teclear: un guion, un
 * carácter, o solo el orden de dos letras seguidas.
 *
 * Trampa observada el 30/07: `sesion-0729-b` (viva) y `sesion-0729b` (sin señales) convivían en el
 * mismo directorio. Equivocarse al cerrar borra el trabajo de la otra, y el listado no avisaba de
 * nada. Se compara sobre el nombre SIN separadores: así `x-y` y `xy` salen como el mismo riesgo.
 */
function nombresCasiIdenticos(slugs) {
  const pares = []
  const norm = (s) => s.replace(/[-_]/g, '')
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = slugs[i]
      const b = slugs[j]
      if (a === b) continue
      if (norm(a) === norm(b) || distanciaMenorQue2(norm(a), norm(b))) pares.push([a, b])
    }
  }
  return pares
}

/** ¿Se llega de `a` a `b` con UNA edición (insertar, borrar o cambiar un carácter)? */
function distanciaMenorQue2(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  if (a === b) return true
  const [corta, larga] = a.length <= b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let ediciones = 0
  while (i < corta.length && j < larga.length) {
    if (corta[i] === larga[j]) { i++; j++; continue }
    if (++ediciones > 1) return false
    if (corta.length === larga.length) { i++; j++ } else { j++ }
  }
  return ediciones + (larga.length - j) + (corta.length - i) <= 1
}

module.exports = {
  VIVA_MIN, RECIENTE_MIN, DORMIDA_MIN,
  clasificarSenal, formatearAntiguedad, etiquetaEstado, nombresCasiIdenticos,
}
