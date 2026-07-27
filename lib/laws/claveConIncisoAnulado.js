'use strict'
//
// claveConIncisoAnulado — ¿la RESPUESTA CORRECTA de una pregunta reproduce un inciso que el
// Tribunal Constitucional ANULÓ?
//
// POR QUÉ EXISTE (T-169, 27/07/2026). El incidente fundacional de esta familia (art. 126.2
// LBRL / STC 103/2013, impugnación de Alfonso) fue exactamente eso: una clave que daba por
// válido un inciso ya anulado. Hasta hoy se vigilaba que el ARTÍCULO llevara nota de
// vigencia, pero **nadie comparaba la nota con lo que las preguntas dan por correcto**.
//
// Al revisar a mano las 50 preguntas del Código Civil apareció el caso vivo: la pregunta
// `9d361d19` (art. 92.8) marcaba como correcta «De un informe FAVORABLE del Ministerio
// Fiscal», y «favorable» es justo el inciso que anuló la STC 185/2012 — con su propia
// explicación citando la sentencia. Revisar a mano no escala (102 preguntas más en cola) y,
// sobre todo, no vigila el futuro: mañana entra otra pregunta igual.
//
// Ya tenemos las dos piezas en BD, así que esto es una comparación de subcadenas y no
// necesita un juez caro: `articles.vigencia_notes.annulledFragments` guarda el inciso
// LITERAL que el BOE marca como anulado, y la pregunta guarda su opción correcta.
//
// CALIBRACIÓN (medida sobre los 50 artículos que hoy tienen fragmentos):
//   · Hay fragmentos que NO son incisos sino MARCADORES del BOE — «(Anulado)», «(Anulada).»
//     — y rúbricas enteras («Artículo 4. Funciones del Consejo…»). Se descartan: casarlos
//     produciría ruido puro.
//   · Un fragmento LARGO no aparece en una clave por casualidad («Para reducir los costes
//     efectivos de los servicios el mencionado Ministerio decidirá sobre…») → banda ALTA.
//   · Uno CORTO sí puede ser coincidencia léxica: «favorable», «legalmente», «nieguen o».
//     Son justo los casos más peligrosos (el del art. 92.8 lo era) pero también los más
//     ruidosos, así que van a COLA DE REVISIÓN, no al badge. Misma lección que las bandas
//     de sobre-inclusión: al badge solo lo que es de alta precisión.
//
// Núcleo PURO: sin red ni BD. Tests: `__tests__/lib/laws/claveConIncisoAnulado.test.js`.

/** Marcador del BOE, no un inciso: «(Anulado)», «(Anulada).», «(Derogado)». */
const RE_MARCADOR = /^\(\s*(?:anulad|derogad)[oa]s?\s*\)\.?$/i
/** Rúbrica del artículo capturada por error como fragmento. */
const RE_RUBRICA = /^art(?:[íi]culo)?\.?\s+\d/i

/** Longitud a partir de la cual un fragmento se considera DISTINTIVO (no coincide por azar). */
const MIN_DISTINTIVO = 30

const norm = (s) =>
  String(s || '')
    .replace(/[«»""'']/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/**
 * Filtra los fragmentos que sirven para comparar: fuera marcadores, rúbricas y residuos.
 * @param {string[]|null|undefined} fragmentos `vigencia_notes.annulledFragments`
 * @returns {string[]}
 */
function fragmentosUtiles(fragmentos) {
  const out = []
  for (const f of fragmentos || []) {
    const t = String(f || '').trim()
    if (!t) continue
    if (RE_MARCADOR.test(t)) continue
    if (RE_RUBRICA.test(t)) continue
    if (norm(t).length < 4) continue // «o», «y»: no se puede comparar con nada
    out.push(t)
  }
  return out
}

/**
 * ¿La opción correcta reproduce alguno de los incisos anulados?
 *
 * @param {string} opcionCorrecta texto de la respuesta marcada como correcta
 * @param {string[]} fragmentos incisos anulados del artículo (literales del BOE)
 * @returns {{hallazgo:boolean, banda:'alta'|'revisar'|null, fragmento:string|null}}
 *   `alta`    → el fragmento es largo y distintivo: casi seguro que la clave enseña algo anulado.
 *   `revisar` → coincide un fragmento corto: puede ser coincidencia léxica, hay que mirarlo.
 */
function analizarClave(opcionCorrecta, fragmentos) {
  const clave = norm(opcionCorrecta)
  if (!clave) return { hallazgo: false, banda: null, fragmento: null }

  let corto = null
  for (const f of fragmentosUtiles(fragmentos)) {
    const frag = norm(f)
    if (!clave.includes(frag)) continue
    if (frag.length >= MIN_DISTINTIVO) return { hallazgo: true, banda: 'alta', fragmento: f }
    if (!corto) corto = f
  }
  return corto
    ? { hallazgo: true, banda: 'revisar', fragmento: corto }
    : { hallazgo: false, banda: null, fragmento: null }
}

module.exports = { analizarClave, fragmentosUtiles, MIN_DISTINTIVO }
