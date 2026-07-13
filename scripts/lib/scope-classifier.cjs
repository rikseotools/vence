'use strict'
/**
 * scope-classifier.cjs — CORAZÓN del pipeline de verificación de scope (Sistema 1).
 *
 * PURO (sin BD, sin IO) → testeable. Dado un cambio propuesto por los agentes
 * (quitar/añadir artículos de una ley en un tema) + su contexto enriquecido,
 * decide si es AUTO-SEGURO (recorte estructural claro, impacto bajo) o si debe
 * pasar por PUERTA DE JUICIO humano.
 *
 * Codifica las lecciones de la sesión 13/07 (GVA), para que NINGUNA sesión
 * futura repita el fallo de borrar contenido implícito:
 *   - reglamento_desarrolla: se vacía un Decreto/Orden que desarrolla una ley
 *     nombrada en el epígrafe (caso T17: Decreto 77/2019). NUNCA auto-quitar.
 *   - epigrafe_tematico: el epígrafe describe la materia por concepto, no por
 *     estructura (caso T8: Ley 4/2023 "medidas en el ámbito administrativo").
 *   - impacto_alto: el recorte afecta a muchas preguntas → merece ojos aunque
 *     sea estructural (caso T10: 272 preguntas).
 *   - delta_invalido / epigrafe_no_localizable: dato sospechoso → gate por cautela.
 *
 * Filosofía: CONSERVADOR. Ante cualquier duda → judgment_gate. auto_safe solo
 * cuando TODO está limpio. El gate nunca pierde datos; solo pide confirmación.
 */

const RE_REGLAMENTO = /\b(decreto|orden|reglamento|real\s+decreto|instrucci[oó]n|resoluci[oó]n)\b/i
const RE_STRUCT = /(t[ií]tulo|cap[ií]tulo|secci[oó]n|subsecci[oó]n|art[íi]culo|art\.|libro|anexo|disposici[oó]n)/i
const RE_TEMATICO = /(\bmedidas\b|en materia de|normativa de desarrollo|desarrollo reglamentario|principios rectores)/i

const DEFAULT_IMPACT_THRESHOLD = 150

const GATE_FLAGS = new Set([
  'delta_invalido',
  'reglamento_desarrolla',
  'epigrafe_tematico',
  'epigrafe_no_localizable',
  'impacto_alto',
])

function hasChange(ch) {
  return (ch.quitar && ch.quitar.length > 0) || (ch.anadir && ch.anadir.length > 0)
}

/**
 * Segmento del epígrafe que corresponde a una ley concreta: desde su mención
 * (por número "40/2015" o por token del nombre) hasta la siguiente ley o el
 * final. Acepta VARIOS localizadores (short_name + nombre completo), porque el
 * short_name puede ser sigla (LPRL) y el epígrafe citar el número (31/1995).
 * Heurístico y CONSERVADOR: si no se localiza con ninguno, devuelve null (→ gate).
 */
function epigrafeSegment(epigrafe, ...locators) {
  if (!epigrafe) return null
  const text = String(epigrafe)
  const flat = locators.flat().filter(Boolean)
  let idx = -1
  let matchLen = 1
  // 1) por número de ley (de cualquiera de los localizadores)
  for (const loc of flat) {
    const numMatch = String(loc).match(/\d+\/\d{2,4}/)
    if (numMatch) {
      const at = text.indexOf(numMatch[0])
      if (at >= 0) { idx = at; matchLen = numMatch[0].length; break }
    }
  }
  // 2) por token significativo del nombre
  if (idx < 0) {
    for (const loc of flat) {
      const tok = String(loc).split(/\s+/).find((w) => w.replace(/[^\wáéíóúñ]/gi, '').length > 4)
      if (tok) {
        const at = text.toLowerCase().indexOf(tok.toLowerCase())
        if (at >= 0) { idx = at; matchLen = tok.length; break }
      }
    }
  }
  if (idx < 0) return null
  // buscar la SIGUIENTE ley empezando PASADO el número/token actual (si no,
  // el propio "31/1995" partido en "1/1995" parecería otra ley y cortaría el
  // segmento a 1 carácter).
  const afterAt = idx + matchLen
  const rest = text.slice(afterAt)
  const nextNum = rest.search(/\d+\/\d{2,4}/)
  const end = nextNum >= 0 ? afterAt + nextNum : text.length
  return text.slice(idx, end)
}

/**
 * @param {object} ch  cambio enriquecido:
 *   { ley, quitar:[], anadir:[], epigrafe, lawsInTema, emptiesLaw, impacto, deltaValid }
 * @param {object} opts { impactThreshold }
 * @returns {{ category:'auto_safe'|'judgment_gate', flags:string[] }}
 */
function classifyChange(ch, opts) {
  const o = opts || {}
  const threshold = o.impactThreshold != null ? o.impactThreshold : DEFAULT_IMPACT_THRESHOLD
  const flags = []

  if (!hasChange(ch)) return { category: 'auto_safe', flags: ['sin_cambio'] }

  // dato sospechoso: los arts a quitar no estaban, o los a añadir ya estaban
  if (ch.deltaValid === false) flags.push('delta_invalido')

  const quita = ch.quitar && ch.quitar.length > 0

  // reglamento que desarrolla una ley nombrada (implícito): decreto/orden vaciado
  // por completo en un tema con ≥2 leyes → probablemente desarrolla otra.
  if (quita && ch.emptiesLaw && RE_REGLAMENTO.test(String(ch.ley || '')) && (ch.lawsInTema || 1) >= 2) {
    flags.push('reglamento_desarrolla')
  }

  // epígrafe temático (no delimitado por estructura) para esta ley → interpretativo
  if (quita) {
    const seg = epigrafeSegment(ch.epigrafe, ch.leyNombre, ch.ley)
    if (seg == null) {
      flags.push('epigrafe_no_localizable')
    } else if (!RE_STRUCT.test(seg) || RE_TEMATICO.test(seg)) {
      flags.push('epigrafe_tematico')
    }
  }

  // impacto alto: muchas preguntas dejan el tema → ojos humanos aunque sea limpio
  if ((ch.impacto || 0) > threshold) flags.push('impacto_alto')

  const gate = flags.some((f) => GATE_FLAGS.has(f))
  return { category: gate ? 'judgment_gate' : 'auto_safe', flags }
}

/**
 * Veredicto por TEMA para topic_scope_verification: 'correct' si TODOS sus
 * cambios son auto_safe (y se aplicarán); 'issues' si alguno va a la puerta.
 */
function temaVerdict(changeResults) {
  const anyGate = changeResults.some((r) => r.category === 'judgment_gate')
  return anyGate ? 'issues' : 'correct'
}

module.exports = {
  classifyChange,
  temaVerdict,
  epigrafeSegment,
  DEFAULT_IMPACT_THRESHOLD,
  GATE_FLAGS,
  _re: { RE_REGLAMENTO, RE_STRUCT, RE_TEMATICO },
}
