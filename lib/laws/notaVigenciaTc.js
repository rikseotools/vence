'use strict'
//
// notaVigenciaTc — NÚCLEO PURO: clasifica la NOTA DE VIGENCIA que el BOE consolidado
// cuelga de un artículo cuando el Tribunal Constitucional se ha pronunciado sobre él.
//
// POR QUÉ EXISTE (26/07/2026, T-132). `annulledProvisions.ts` solo caza la fórmula de
// NULIDAD (`inconstitucional`, `nulidad`, `anulado`) y lo hace, además, desde el
// **análisis** del BOE. Eso deja fuera una clase entera y muy frecuente en leyes estatales
// con incidencia autonómica:
//
//     "Téngase en cuenta que se declara que el apartado 4 NO ES CONFORME CON EL ORDEN
//      CONSTITUCIONAL DE COMPETENCIAS, en los términos del fundamento jurídico 6 G) c),
//      por la Sentencia del TC 68/2021, de 18 de marzo. Ref. BOE-A-2021-6614"
//
// Contiene "constitucional" pero NO "inconstitucional", así que el filtro de nulidad
// —que exige el prefijo *in-* a propósito, para no casar con "constitucionalidad"— pasa
// de largo. Resultado: `article_annulled_unmarked` llevaba 0 findings con esta clase
// entera fuera de radar.
//
// Y HAY UN SEGUNDO MOTIVO PARA QUE VIVA APARTE DEL ANÁLISIS: el análisis del BOE **no
// enumera** los artículos afectados por la vía competencial. Para la LCSP dice
// literalmente *"y no conforme con el orden constitucional de competencias LO INDICADO"*
// — sin decir qué. El dato por-artículo solo está en la nota del texto consolidado, que
// es lo que este módulo clasifica (la extrae `boeBloqueVigente.bloqueVigente`).
//
// LA REMEDIACIÓN NO ES LA MISMA, y por eso la clase se distingue en vez de fundirse:
//   · `nulidad`      → el inciso NO existe; una pregunta que lo dé por válido está mal.
//   · `competencial` → el precepto NO es nulo: es inaplicable como básico o en las CCAA
//                      con competencia propia. Procede NOTA DE VIGENCIA, no jubilar
//                      preguntas — pero una pregunta que lo dé por aplicable sin matiz
//                      sí es impugnable.

/** Fórmula competencial del TC. Cubre singular/plural y "conforme(s)". */
const RE_COMPETENCIAL =
  /no\s+(?:es|son|resulta[n]?)\s+conforme[s]?\s+con\s+el\s+orden\s+constitucional\s+de\s+competencias/i

/** Fórmula de nulidad. Exige el prefijo `in-` para no casar con "constitucionalidad". */
const RE_NULIDAD = /\binconstitucional|\bnul(?:idad|o|a|os|as)\b|\banulad/i

/** La nota tiene que venir de un pronunciamiento, no de cualquier aviso del BOE. */
const RE_DECLARA = /\bse\s+declara|\bdeclarad[oa]s?\b/i

/** 'Sentencia del TC 68/2021' / 'STC 68/2021' / 'Sentencia 103/2013' → 'STC 68/2021'. */
function parseSentencia(nota) {
  const m = String(nota || '').match(/(?:STC|Sentencia(?:\s+del\s+TC)?)\s+(\d+\/\d{4})/i)
  return m ? `STC ${m[1]}` : null
}

/** 'Ref. BOE-A-2021-6614' → 'BOE-A-2021-6614'. */
function parseRefBoe(nota) {
  const m = String(nota || '').match(/\b(BOE-[A-Z]-\d{4}-\d+)\b/)
  return m ? m[1] : null
}

/**
 * Apartado(s) afectados, best-effort: "el apartado 4", "los apartados 2 y 3",
 * "el párrafo segundo del apartado 4". Sirve para el mensaje del hallazgo, no para
 * decidir: si no se puede extraer, el hallazgo sigue siendo válido a nivel de artículo.
 */
function parseApartados(nota) {
  const out = new Set()
  const re = /apartad(?:o|os)\s+([\d.\s,y]+)/gi
  let m
  while ((m = re.exec(String(nota || ''))) !== null) {
    for (const tok of m[1].split(/[,\sy]+/)) {
      const t = tok.trim().replace(/\.$/, '')
      if (/^\d+(?:\.\d+)?$/.test(t)) out.add(t)
    }
  }
  return [...out]
}

/**
 * Clasifica una nota de vigencia del BOE consolidado.
 *
 * @param {string|null|undefined} nota `notaVigencia` de `bloqueVigente()`
 * @returns {{clase:'nulidad'|'competencial'|'otra'|null, sentencia:string|null,
 *            refBoe:string|null, apartados:string[], nota:string}}
 *   `null`          → no hay nota.
 *   `otra`          → hay nota pero no es un pronunciamiento del TC (entrada en vigor,
 *                     remisión a otra norma…). NO genera hallazgo.
 *   `nulidad`       → inciso/apartado declarado inconstitucional y nulo.
 *   `competencial`  → declarado no conforme con el orden constitucional de competencias.
 *
 * ORDEN DE COMPROBACIÓN: primero nulidad, después competencial. Una misma nota puede
 * mencionar las dos cosas (la STC 68/2021 anula incisos de unos artículos y declara otros
 * no conformes con el orden de competencias); cuando ocurre, debe mandar la clase más
 * restrictiva para el opositor, que es la nulidad — el inciso directamente no existe.
 */
function clasificarNotaVigencia(nota) {
  const t = String(nota || '').trim()
  if (!t) return { clase: null, sentencia: null, refBoe: null, apartados: [], nota: '' }

  const base = {
    sentencia: parseSentencia(t),
    refBoe: parseRefBoe(t),
    apartados: parseApartados(t),
    nota: t,
  }
  if (!RE_DECLARA.test(t)) return { clase: 'otra', ...base }
  if (RE_NULIDAD.test(t)) return { clase: 'nulidad', ...base }
  if (RE_COMPETENCIAL.test(t)) return { clase: 'competencial', ...base }
  return { clase: 'otra', ...base }
}

/**
 * ¿Nuestro `content` refleja YA el pronunciamiento competencial?
 *
 * Se comprueba aparte de `articleCarriesVigenciaNote` (que busca la fórmula de nulidad)
 * porque un artículo con nota competencial NO contiene las palabras "inconstitucional" ni
 * "nulo": si se reutilizara aquel check, todo artículo competencial saldría siempre como
 * "sin marcar" aunque lo hubiéramos anotado bien.
 *
 * @param {string|null|undefined} content `articles.content`
 * @returns {boolean}
 */
function contentReflejaCompetencial(content) {
  const t = String(content || '')
  if (RE_COMPETENCIAL.test(t)) return true
  if (/nota\s+de\s+vigencia/i.test(t) && /competencias/i.test(t)) return true
  return false
}

module.exports = {
  clasificarNotaVigencia,
  contentReflejaCompetencial,
  parseSentencia,
  parseRefBoe,
  parseApartados,
  RE_COMPETENCIAL,
  RE_NULIDAD,
}
