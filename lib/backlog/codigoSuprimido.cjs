// lib/backlog/codigoSuprimido.cjs — detecta que un push SUPRIME código de la infraestructura de
// coordinación entre sesiones (scripts/*.cjs de raíz, lib/backlog/**, lib/sessions/**,
// lib/calidad/**, .husky/*) que ya estaba publicado en `origin/main`. Núcleo PURO: recibe las
// dos versiones del fichero (texto), no habla con git. (T-443, 05/08/2026)
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
// El 31/07 el commit 6f3e26261 (T-441, otra sesión) subió una copia RANCIA de
// `scripts/backlog.cjs`: perdió 92 líneas —casi todo el cableado de [T-427] hacia
// `lib/backlog/gitFichas.cjs`— sin que nada protestara. El módulo y sus 13 tests seguían en
// `main`, así que el CI no se quejaba de ELLOS… pero ya no los llamaba nadie. Un arreglo vivo
// e inerte, que es peor que uno que falta: parece desplegado. Se cazó por casualidad, al
// reejecutar el guardarraíl de fuente desde la misma sesión que lo había escrito.
//
// `contexto-push-guard.cjs` (T-428) ya protegía con esta misma idea —comparar contra
// `origin/main`, no contra el padre de tus commits, porque solo así se caza el caso del MERGE—
// pero solo miraba el CUERPO DE LAS FICHAS en el markdown. El mismo fallo sobre CÓDIGO no lo
// miraba nadie. Este módulo es su hermano.
//
// ── QUÉ MIDE, Y POR QUÉ ASÍ ─────────────────────────────────────────────────────────────────
// Líneas SIGNIFICATIVAS (no vacías, no puro relleno de comentario tipo `// ────`, con contenido
// real) que existen en la versión de `origin/main` y NO existen en la versión que se va a
// pushear. Se cuenta por MULTICONJUNTO —cuántas veces aparece cada línea en cada lado—, no por
// conjunto: así una línea que se repite legítimamente (una llave de cierre, un `return null`)
// no computa como «suprimida» solo por aparecer una vez menos por azar; hace falta que
// desaparezcan MÁS repeticiones de las que hay en el lado nuevo.
//
// No se compara CARÁCTER a carácter (como hace `perdidaDeContexto.cjs` con las fichas, que son
// prosa) porque el código se reordena, se envuelve, se indenta distinto — y una línea de código
// dice lo mismo aunque cambie de sitio. Comparar por línea tolera reordenar y penaliza solo lo
// que de verdad desaparece.
//
// ── ALCANCE, A PROPÓSITO ESTRECHO ───────────────────────────────────────────────────────────
// Solo la infraestructura de coordinación entre sesiones — el propio sistema que este incidente
// puso en duda. Generalizarlo a TODO el código de producción dispararía en cualquier refactor
// legítimo (borrar código muerto, simplificar una función) y el aviso se dejaría de leer: la
// misma lección que ya escribieron [T-428] sobre el markdown y [T-375] sobre los guardarraíles
// imposibles de satisfacer. Ver `scripts/codigo-push-guard.cjs` para la lista de rutas exacta.

/** Líneas que no aportan nada al comparar: vacías, o puro relleno decorativo de comentario. */
const RE_RELLENO = /^[-=─═#*/\s]*$/

/** Suelo de longitud (tras recortar espacio) para que una línea cuente como significativa. */
const MIN_LONGITUD_LINEA = 6

/**
 * Multiset de líneas significativas: Map<líneaRecortada, vecesQueAparece>.
 * @param {string} texto
 * @returns {Map<string, number>}
 */
function lineasSignificativas(texto) {
  const mapa = new Map()
  for (const linea of String(texto || '').split('\n')) {
    const t = linea.trim()
    if (t.length < MIN_LONGITUD_LINEA) continue
    if (RE_RELLENO.test(t)) continue
    mapa.set(t, (mapa.get(t) || 0) + 1)
  }
  return mapa
}

/**
 * Compara dos versiones de un fichero de código y devuelve qué líneas se suprimen.
 *
 * @param {string} origen     contenido en `origin/main`
 * @param {string} propuesto  contenido que se va a pushear (HEAD)
 * @returns {{suprimidas: Array<{linea:string, faltan:number}>, total: number, totalOrigen: number, ratio: number}}
 */
function findCodigoSuprimido(origen, propuesto) {
  const O = lineasSignificativas(origen)
  const P = lineasSignificativas(propuesto)
  const suprimidas = []
  let total = 0
  let totalOrigen = 0

  for (const [linea, vecesO] of O) {
    totalOrigen += vecesO
    const vecesP = P.get(linea) || 0
    const faltan = vecesO - vecesP
    if (faltan > 0) {
      suprimidas.push({ linea, faltan })
      total += faltan
    }
  }

  suprimidas.sort((a, b) => b.faltan - a.faltan)
  return { suprimidas, total, totalOrigen, ratio: totalOrigen > 0 ? total / totalOrigen : 0 }
}

/** Suelo por defecto: por debajo de esto, un puñado de líneas sueltas no justifica el bloqueo. */
const MIN_LINEAS_SUPRIMIDAS = 15

/**
 * @param {{total:number}} resultado
 * @param {{minLineas?:number}} [opts]
 */
function esBloqueante(resultado, opts = {}) {
  const min = opts.minLineas ?? MIN_LINEAS_SUPRIMIDAS
  return (resultado?.total || 0) >= min
}

module.exports = {
  lineasSignificativas,
  findCodigoSuprimido,
  esBloqueante,
  MIN_LINEAS_SUPRIMIDAS,
  MIN_LONGITUD_LINEA,
}
