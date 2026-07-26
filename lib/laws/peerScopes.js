// Núcleo PURO: buscar el tema HERMANO que ya acotó esta misma ley.
//
// Es el paso 2 de la evidencia comparada (T-154). `consensoBanco` responde en agregado —"¿tener
// esta ley entera es lo raro o lo normal?"— y esto responde la pregunta operativa que viene
// después: **¿quién más escopa esta ley con un epígrafe parecido, y cuánto se quedó?**
//
// POR QUÉ IMPORTA, con dos casos medidos:
//  · `administrativo_seguridad_social` T6 · LOPJ: el epígrafe es prosa y no hay bloques que
//    mapear. Dos oposiciones estatales con epígrafe casi idéntico la tenían en 75 y 73 arts →
//    esa fue la referencia, en vez de mi lectura de la prosa.
//  · `administrativo_madrid` T14 · Ley 29/1998: `auxiliar_administrativo_madrid` T7 tiene la
//    MISMA FRASE LITERAL, es de la misma administración y está verificado, con 75 artículos.
//    Además resolvió la duda que yo tenía —si "las fases principales del procedimiento" incluye
//    recursos y ejecución— sin necesidad de que yo opinara: no las incluye.
//
// CommonJS a propósito (como parseBoeSections.js): así lo usan a la vez los tests y el CLI
// `scripts/scope-over-inclusion.cjs`, SIN un mirror que se desincronice.

// Tokens de contenido: ≥5 letras para que entren "actos", "partes", "fases"… que es justo lo que
// distingue estos epígrafes, y fuera las palabras de relleno largas que aparecen en todos.
const RELLENO = new Set([
  'concepto', 'clases', 'nociones', 'basicas', 'general', 'generales', 'especial', 'referencia',
  'estudio', 'particular', 'sistema', 'regimen', 'normas', 'principales', 'aplicacion',
])
function tokens(s) {
  return (String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9ñ]{5,}/g) || [])
    .filter((w) => !RELLENO.has(w))
}

/**
 * Parecido entre dos epígrafes: Jaccard sobre tokens de contenido. 0..1.
 * Sin stemming a propósito — dos materias distintas que comparten raíz NO deben confundirse.
 */
function parecidoEpigrafe(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b))
  if (!A.size || !B.size) return 0
  const inter = [...A].filter((x) => B.has(x)).length
  const union = new Set([...A, ...B]).size
  return union ? inter / union : 0
}

/**
 * Ordena los temas hermanos por parecido de epígrafe, con la referencia lista para adjudicar.
 *
 * @param {{epigrafe:string}} base   el (tema, ley) sospechoso
 * @param {{epigrafe:string, scoped:number|null, verificado?:boolean}[]} peers  otros temas que
 *        escopan la MISMA ley. `scoped = null` significa que la tienen ENTERA.
 * @returns lista ordenada por (parecido desc), con `sim` y `util` = parecido alto + acotado +
 *          verificado, que es el hermano en el que de verdad se puede uno apoyar.
 */
function rankPeers(base, peers, opts) {
  const minSim = opts?.minSim ?? 0.45
  return (peers || [])
    .map((p) => {
      const sim = parecidoEpigrafe(base && base.epigrafe, p.epigrafe)
      return { ...p, sim, util: sim >= minSim && p.scoped != null && !!p.verificado }
    })
    .sort((a, b) => b.sim - a.sim || (a.scoped ?? Infinity) - (b.scoped ?? Infinity))
}

/**
 * ¿Hay un hermano en el que apoyarse? Devuelve el mejor, o por qué no lo hay.
 * NO decide el recorte: da la referencia y su procedencia, que es lo que se cita en la razón.
 */
function mejorReferencia(base, peers, opts) {
  const rank = rankPeers(base, peers, opts)
  const util = rank.find((p) => p.util)
  if (util) return { hay: true, peer: util, motivo: `hermano verificado con epígrafe ${(util.sim * 100).toFixed(0)}% parecido y ${util.scoped} arts` }
  const casi = rank.find((p) => p.sim >= (opts?.minSim ?? 0.45) && p.scoped != null)
  if (casi) return { hay: false, peer: casi, motivo: `el más parecido (${(casi.sim * 100).toFixed(0)}%) NO está verificado: sirve de pista, no de referencia` }
  return { hay: false, peer: null, motivo: 'ningún hermano con epígrafe suficientemente parecido y scope acotado' }
}

module.exports = { parecidoEpigrafe, rankPeers, mejorReferencia, tokens }
