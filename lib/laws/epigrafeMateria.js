'use strict'
//
// epigrafeMateria — NÚCLEO PURO: ¿el epígrafe de un tema habla de la MATERIA que regulan
// los artículos que ese tema tiene escopados de una ley?
//
// POR QUÉ EXISTE (26/07/2026, T-117). `audit-epigrafe-scope.cjs` decide si una ley del
// scope está "referenciada" en el epígrafe mirando si aparecen ≥2 tokens distintivos de
// su TÍTULO. Eso falla sistemáticamente con los epígrafes que describen la materia sin
// citar la norma, que son la mayoría: "Órganos de gobierno provinciales" no comparte dos
// palabras con "Ley 7/1985, Reguladora de las Bases del Régimen Local" y se marca en rojo
// como si la ley no pintara nada ahí.
//
// MEDIDO bank-wide el 26/07: **1.948 hallazgos** (835 WRONG_SUBJECT + 1.113 OVER) en 107
// de las 115 oposiciones auditadas. Sobre una muestra aleatoria de 140 pares (tema, ley)
// en los que la ley aporta ≥80% de las preguntas, 51 los marcaría la heurística actual y
// de esos el **82% tiene solapamiento de contenido ≥60%** — la materia encaja y el flag
// sobra. Con ese ruido el gate no sirve: en León hubo que descartar 10 de 11 rojos a mano.
//
// LA SEÑAL. Se comparan las palabras significativas del epígrafe contra el TEXTO de los
// artículos escopados, no contra el título de la ley. El texto siempre está (es el dato
// nuclear); los títulos de artículo NO: 129 de 163 artículos de la Ley 7/1985 y 143 de 187
// de la Constitución los tienen a NULL, así que una señal basada en títulos habría dado
// cero justo en las leyes más usadas.
//
// LO QUE ESTE NÚCLEO NO HACE. No dice si el scope es correcto — solo si la ley es del tema.
// La sobre-inclusión (scope MÁS ANCHO que el epígrafe) es otro detector distinto
// (`scopeOverInclusion`), y este no lo sustituye.

/** Normaliza a minúsculas sin tildes. */
const norm = (x) =>
  (x || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// Palabras que aparecen en cualquier epígrafe o en cualquier ley y por tanto no
// discriminan nada. Sin esta lista, epígrafes genéricos casarían con cualquier norma.
const STOP = new Set([
  'ley', 'organica', 'real', 'decreto', 'legislativo', 'reglamento', 'general', 'del', 'las',
  'los', 'por', 'para', 'sobre', 'que', 'con', 'una', 'sus', 'este', 'esta', 'publico',
  'publica', 'publicos', 'servicios', 'servicio', 'articulo', 'capitulo', 'titulo',
  'disposicion', 'otras', 'como', 'entre', 'cada', 'tras', 'ante', 'desde', 'hasta', 'sera',
  'seran', 'podra', 'podran', 'deben', 'debera', 'todos', 'todas', 'demas', 'mismo', 'misma',
  'cuando', 'donde', 'segun', 'dicho', 'dicha', 'especial', 'referencia', 'concepto',
  'clases', 'normas', 'materia', 'ambito', 'regimen',
])

/**
 * Palabras significativas de un texto: ≥5 letras, sin stopwords, sin referencias `N/AAAA`.
 * El umbral de 5 (y no 4) es deliberado: con 4 entran "arte", "base", "caso"… que casan
 * con cualquier texto legal y suben el ratio artificialmente.
 */
function palabrasClave(texto) {
  return [
    ...new Set(
      norm(texto)
        .replace(/\d+\/\d+/g, ' ')
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 5 && !STOP.has(w)),
    ),
  ]
}

/**
 * Marcadores de lenguas cooficiales. Un epígrafe en catalán/valenciano/gallego/euskera
 * comparado contra texto legal en castellano da ratio ~0 SIN que haya nada malo en el
 * scope: es un desajuste de idioma, no una ley fuera de tema. Caso real detectado el
 * 26/07 en `auxiliar_administrativo_diputacion_barcelona` ("Les hisendes locals i els seus
 * pressupostos", 14% contra el TRLRHL en castellano) — el único de la banda baja de toda
 * la muestra, y era falso positivo.
 */
const MARCADORES_COOFICIAL = [
  /\bels\b/, /\bles\b/, /\bdels\b/, /\bseus\b/, /\baixi\b/, /\bamb\b/, /\bque\s+es\b/,
  /\bdas\b/, /\bdos\b/, /\bnas\b/, /\bcoas\b/, /\bxestion\b/, /\bhaciendas?\s+locais\b/,
  /\baren\b/, /\betaz\b/, /\bherri\b/,
]

/** ¿El epígrafe parece escrito en una lengua cooficial distinta del castellano? */
function pareceCooficial(epigrafe) {
  const e = norm(epigrafe)
  return MARCADORES_COOFICIAL.some((re) => re.test(e))
}

/** Bandas de decisión. Calibradas sobre la muestra de 140 pares del 26/07. */
const UMBRAL_ENCAJA = 0.6
const UMBRAL_DUDOSO = 0.35
/**
 * Mínimo de palabras clave para atreverse a dar un veredicto. Con una o dos, el ratio solo
 * puede valer 0, 0,5 o 1: no mide nada, amplifica el azar. Un epígrafe telegráfico
 * ("El acto y sus fases") no es motivo para acusar a una ley de estar fuera de tema.
 */
const MIN_CLAVES = 3

/**
 * ¿La materia del epígrafe encaja con el contenido escopado de esa ley?
 *
 * @param {string} epigrafe  `topics.epigrafe`
 * @param {string} contenido concatenación del `content` de los artículos ESCOPADOS de esa
 *                           ley en ese tema (no de la ley entera: lo que se juzga es lo
 *                           que el tema sirve)
 * @returns {{banda:'encaja'|'dudoso'|'no_encaja'|'indeterminado', ratio:number,
 *            total:number, halladas:string[], motivo?:string}}
 *   `encaja`         → la ley es claramente del tema; NO debe generar hallazgo.
 *   `dudoso`         → zona gris; hallazgo de severidad baja, para revisión.
 *   `no_encaja`      → la materia no aparece en lo escopado; hallazgo real.
 *   `indeterminado`  → no se puede juzgar (epígrafe sin palabras clave, sin contenido, o
 *                      escrito en lengua cooficial frente a texto en castellano).
 */
function analizarMateria(epigrafe, contenido) {
  const claves = palabrasClave(epigrafe)
  if (claves.length < MIN_CLAVES) {
    return {
      banda: 'indeterminado',
      ratio: 0,
      total: claves.length,
      halladas: [],
      motivo: `el epígrafe solo aporta ${claves.length} palabra(s) significativa(s); hacen falta ${MIN_CLAVES} para juzgar`,
    }
  }
  if (!contenido || !String(contenido).trim()) {
    return { banda: 'indeterminado', ratio: 0, total: claves.length, halladas: [], motivo: 'sin contenido escopado que comparar' }
  }

  const texto = norm(contenido)
  const halladas = claves.filter((w) => texto.includes(w))
  const ratio = halladas.length / claves.length

  // El desajuste de idioma se juzga SOLO cuando el ratio ya es bajo: un epígrafe en
  // catalán cuyo contenido sí casa (porque comparten cultismos) no necesita excusa.
  if (ratio < UMBRAL_DUDOSO && pareceCooficial(epigrafe)) {
    return {
      banda: 'indeterminado',
      ratio,
      total: claves.length,
      halladas,
      motivo: 'epígrafe en lengua cooficial frente a texto legal en castellano — el solapamiento no es comparable',
    }
  }

  const banda = ratio >= UMBRAL_ENCAJA ? 'encaja' : ratio >= UMBRAL_DUDOSO ? 'dudoso' : 'no_encaja'
  return { banda, ratio, total: claves.length, halladas }
}

module.exports = {
  analizarMateria,
  palabrasClave,
  pareceCooficial,
  UMBRAL_ENCAJA,
  UMBRAL_DUDOSO,
  MIN_CLAVES,
  STOP,
}
