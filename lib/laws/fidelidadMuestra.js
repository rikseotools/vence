'use strict'
//
// fidelidadMuestra — NÚCLEO PURO para el punto ciego de `lib/laws/completeness.ts` (T-240,
// documentado en `docs/runbooks/completitud-leyes.md` §"COMPLETO ≠ FIEL", caso T-193).
//
// `classifyLawCompleteness` responde «¿están todos los artículos?» contando filas. El RGPD
// contestaba que sí —99/99, sin huecos— con **72 de esos 99 artículos reescritos en paráfrasis**.
// Barrer las 126 leyes activas artículo por artículo contra su fuente es caro (miles de fetches
// al BOE/EUR-Lex) y no hace falta para DETECTAR el patrón: basta MUESTREAR unos pocos artículos
// por ley y ver si el patrón de paráfrasis aparece. Si aparece en la muestra, la ley entera pide
// auditoría — igual que una muestra biológica no necesita analizar el órgano entero para decir
// que hay que mirarlo.
//
// Este módulo NO fetchea nada y NO decide fuentes por su cuenta más allá de RECONOCER cuál es la
// oficial: reutiliza `compararArticuloOficial` (ya existente y probado, 14 tests) para el
// veredicto por artículo — no se reescribe esa lógica — y `esIdEurLex`/`esCelexNoConsolidado` de
// `eurlexConsolidado.js` para no duplicar el criterio de qué CELEX es válido.
//
// Por qué NO se usa el espejo del BOE para normas UE (repetido aquí porque es el error que ya
// costó una ficha, T-184): el espejo (`DOUE-*`) reproduce el acto ORIGINAL con erratas; el RGPD
// tiene una corrección de errores (DO L 127, 23/05/2018) que solo trae el CONSOLIDADO de EUR-Lex
// (`CELEX:0…`). Comparar contra el espejo daría paráfrasis DONDE NO LAS HAY.

const { esIdEurLex, esCelexNoConsolidado } = require('./eurlexConsolidado')

/**
 * Elige una muestra representativa y determinista de una lista (ya ordenada) de elementos.
 * Reparte los índices de forma UNIFORME sobre el rango en vez de coger los primeros N: los
 * primeros artículos de una ley (definiciones, objeto) suelen ser cortos y genéricos — cogerlos
 * siempre sesgaría la muestra hacia el tramo menos probable de tener paráfrasis.
 *
 * @template T
 * @param {T[]} elementos ya ordenados (p.ej. por número de artículo)
 * @param {number} n tamaño de muestra deseado
 * @returns {T[]} hasta `n` elementos, en el orden original
 */
function elegirMuestra(elementos, n) {
  const arr = Array.isArray(elementos) ? elementos : []
  if (!Number.isFinite(n) || n <= 0 || !arr.length) return []
  if (arr.length <= n) return arr.slice()
  if (n === 1) return [arr[Math.floor((arr.length - 1) / 2)]]
  const indices = new Set()
  for (let i = 0; i < n; i++) indices.add(Math.round((i * (arr.length - 1)) / (n - 1)))
  return [...indices].sort((a, b) => a - b).map((i) => arr[i])
}

/**
 * Resuelve, a partir de `laws.boe_url`, CON QUÉ FUENTE comparar el texto de una ley.
 *
 * @param {string|null} boeUrl
 * @returns {{tipo:'boe', id:string} | {tipo:'eurlex', id:string} | {tipo:null, motivo:string, detalle?:string}}
 *   `tipo: null` cubre tres casos que NO son "no se puede", son "esto no es asunto de este
 *   detector": sin URL (`sin_fuente`), CELEX del acto original en vez del consolidado
 *   (`celex_no_consolidado` — el mismo caso que bloquea `actualizar-articulo-oficial.cjs`), o una
 *   URL que no es ni BOE consolidado ni EUR-Lex (`fuente_no_reconocida`: portales de entidad,
 *   espejo DOUE del BOE, etc. — research manual, no mecanizable).
 */
function resolverFuente(boeUrl) {
  const url = String(boeUrl || '').trim()
  if (!url) return { tipo: null, motivo: 'sin_fuente' }
  const boe = url.match(/\b(BOE-[A-Z]-\d{4}-\d+)\b/)
  if (boe) return { tipo: 'boe', id: boe[1] }
  // `%3A` es el `:` codificado en la URL (`?uri=CELEX%3A32013D0336`); ambas formas conviven en la
  // tabla real (medido 06/08/2026: de 42 leyes scope=eu, unas usan `CELEX:` y otras `CELEX%3A`).
  const celex = url.replace(/%3A/gi, ':').match(/CELEX:([0-9A-Za-z()-]+)/i)
  if (celex && esIdEurLex(celex[1])) {
    if (esCelexNoConsolidado(celex[1])) return { tipo: null, motivo: 'celex_no_consolidado', detalle: celex[1] }
    return { tipo: 'eurlex', id: `CELEX:${celex[1]}` }
  }
  return { tipo: null, motivo: 'fuente_no_reconocida' }
}

// Clases de `compararArticuloOficial` que SÍ demuestran que el texto es el oficial (aunque tenga
// defectos de FORMA corregibles reescribiendo: errata puntual, orden de párrafos).
const FIABLES = new Set(['identico', 'erratas', 'reordenado'])
// Clases que son el defecto de FIDELIDAD que este detector busca: falta texto oficial
// (`incompleto`) o hay texto que no viene del oficial (`contaminado`, que es donde cae la
// paráfrasis — un párrafo reescrito no es "el mismo con erratas", es material que el residuo no
// reconoce como oficial).
const NO_FIABLES = new Set(['incompleto', 'contaminado'])

/**
 * Agrega los veredictos de `compararArticuloOficial` de una muestra en un veredicto POR LEY.
 *
 * @param {string[]} clases el `.clase` de cada artículo muestreado (incluye `sin_oficial`)
 * @param {{umbral?: number, minMedibles?: number}} [opts]
 *   `umbral` — proporción de no-fiables en lo MEDIBLE que dispara `auditoria_completa`. Por
 *   defecto 0,6 — "si 3 de 5 salen contaminado, esa ley pide auditoría entera" (la propia ficha
 *   de origen, T-240).
 *   `minMedibles` — con menos observaciones que esto, un ratio es ruido y NO puede disparar
 *   `auditoria_completa` (baja a `revisar_muestra` como mucho). Por defecto 3. Nace de un falso
 *   positivo REAL medido al construir este detector: la LECrim (BOE-A-1882-6036) tiene DOS
 *   bloques rotulados "Artículo 1" en el índice del BOE —el del Real Decreto que aprueba el
 *   Código, y el del propio Código— y `mapaBloquesPorArticulo` se queda con el primero (una
 *   limitación conocida y preexistente de `boeBloqueVigente.js`, compartida por
 *   `reactivar-articulo-boe.cjs`/`actualizar-articulo-oficial.cjs`, no algo que arregle este
 *   módulo). Con `n=2` esto dio 1/1 = 100% "contaminado" → `auditoria_completa` en FALSO: el
 *   propio art. 1 de nuestra BD es idéntico al del Código, solo que se comparó contra el bloque
 *   equivocado. Con el `n` por defecto (5) el ratio ya diluye a 1/4 = 25% y no dispara — pero una
 *   ley con muy pocos artículos activos podría seguir teniendo casi toda su muestra en ese único
 *   artículo, así que el mínimo absoluto es el cinturón de seguridad.
 * @returns {{muestra:number, medibles:number, inconclusos:number, noFieles:number,
 *            ratioNoFiel:number|null, veredicto:'fiel'|'revisar_muestra'|'auditoria_completa'|'inconcluso'}}
 */
function clasificarFidelidadLey(clases, opts = {}) {
  const umbral = typeof opts.umbral === 'number' ? opts.umbral : 0.6
  const minMedibles = typeof opts.minMedibles === 'number' ? opts.minMedibles : 3
  const lista = Array.isArray(clases) ? clases : []
  // `sin_oficial` (no se pudo leer la fuente) no cuenta ni a favor ni en contra: una lectura
  // fallida no es evidencia de paráfrasis, y afirmar lo contrario sería EXACTAMENTE el error que
  // este módulo corrige en el sentido opuesto (ver el fail-safe equivalente en
  // `verificar-articulos-vs-boe.cjs`: "no he podido leer" ≠ "no coincide").
  const medibles = lista.filter((c) => FIABLES.has(c) || NO_FIABLES.has(c))
  const noFieles = medibles.filter((c) => NO_FIABLES.has(c))
  const ratioNoFiel = medibles.length ? noFieles.length / medibles.length : null

  let veredicto
  if (!medibles.length) veredicto = 'inconcluso'
  else if (ratioNoFiel >= umbral && medibles.length >= minMedibles) veredicto = 'auditoria_completa'
  else if (noFieles.length > 0) veredicto = 'revisar_muestra'
  else veredicto = 'fiel'

  return {
    muestra: lista.length,
    medibles: medibles.length,
    inconclusos: lista.length - medibles.length,
    noFieles: noFieles.length,
    ratioNoFiel,
    veredicto,
  }
}

module.exports = { elegirMuestra, resolverFuente, clasificarFidelidadLey, FIABLES, NO_FIABLES }
