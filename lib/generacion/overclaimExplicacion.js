/**
 * Detección de **OVERCLAIM en la explicación**: el razonamiento afirma MÁS de lo
 * que dice el artículo ("sin excepción", "sin excluir clase alguna", "nunca"…),
 * normalmente porque otro artículo de la misma norma sí establece el límite.
 *
 * Caso que lo motiva (26/07/2026, batch `gen_lbrl_2026-07-26`): sobre el art. 5
 * LBRL ("plena capacidad jurídica para … enajenar **toda clase de bienes**") la
 * explicación remataba *"…sin excluir clase alguna de bienes"*, cuando el
 * **art. 80** de la misma ley declara los bienes de dominio público
 * **inalienables**. Clave correcta, opción literal, gate mecánico en verde y
 * **las dos auditorías ciegas en PERFECT**: el defecto vivía solo en el "Por qué
 * X es correcta". Y no era inocuo — un distractor introducía justo esa salvedad,
 * así que la explicación le daba al opositor el argumento para impugnar la clave.
 *
 * ── Dos decisiones de diseño, ambas aprendidas a base de falsos positivos ──
 *
 * 1. **Es un AVISO, no un error duro.** Igual que el check de literalidad
 *    (§2.2 del manual), esto es un *filtro de sospechosos*: hay glosas absolutas
 *    perfectamente correctas. Un gate que falla de más se ignora, y con él se
 *    ignoran los fallos de verdad.
 *
 * 2. **Si el ABSOLUTO está en el propio artículo, no es overclaim.** El art. 2.2
 *    LBRL dice literalmente "o que, **en todo caso**, deban corresponder a los
 *    entes locales": repetirlo en la explicación es citar, no extrapolar. Por eso
 *    la comprobación es contra el texto del artículo, no una lista negra a secas.
 *
 * Tampoco se mira el **blockquote**: ahí va la cita literal de la ley, y los
 * absolutos que contenga son palabras del legislador.
 */

/**
 * Marcadores de absoluto. `re` se busca en el razonamiento; `enLey` es lo que se
 * busca en el artículo para decidir que el absoluto es del legislador y no del
 * redactor (más laxo a propósito: basta que la idea esté en la norma).
 */
const MARCADORES = [
  { termino: 'sin excepción', re: /sin excepci[óo]n(?:es)?\b/i, enLey: /sin excepci[óo]n/i },
  { termino: 'sin excluir', re: /sin excluir\b/i, enLey: /sin excluir/i },
  { termino: 'clase alguna', re: /(?:clase|tipo) alguna?\b/i, enLey: /(?:clase|tipo) alguna?/i },
  { termino: 'sin límite', re: /sin l[íi]mites?\b/i, enLey: /sin l[íi]mite/i },
  { termino: 'sin restricción', re: /sin restricci[óo]n(?:es)?\b/i, enLey: /sin restricci/i },
  { termino: 'ilimitado', re: /ilimitad[oa]s?\b/i, enLey: /ilimitad/i },
  { termino: 'en todo caso', re: /en todo caso\b/i, enLey: /en todo caso/i },
  { termino: 'en cualquier caso', re: /en cualquier caso\b/i, enLey: /en cualquier caso/i },
  { termino: 'en todos los casos', re: /en todos los casos\b/i, enLey: /en todos los casos/i },
  { termino: 'nunca', re: /\bnunca\b/i, enLey: /\bnunca\b/i },
  { termino: 'jamás', re: /\bjam[áa]s\b/i, enLey: /\bjam[áa]s\b/i },
  // "no cabe" se descartó tras la calibración: colisiona con el uso cotidiano
  // ("si no cabe la silla en el ascensor") y sus hits eran casi todos falsos.
  { termino: 'de forma absoluta', re: /(?:de forma|con car[áa]cter) absolut[oa]\b/i, enLey: /absolut/i },
  // "siempre" solo cuando es absoluto: "siempre que…" es una CONDICIÓN, no un
  // absoluto, y aparece en media legislación española.
  { termino: 'siempre', re: /\bsiempre\b(?!\s+que\b)/i, enLey: /\bsiempre\b/i },
]

/**
 * Quita el blockquote (cita literal de la ley) y se queda con el razonamiento de
 * la CLAVE: desde "**Por qué X es correcta:**" hasta "**Por qué las demás…**".
 *
 * Los bullets de distractores quedan FUERA a propósito. Calibrado sobre 4.000
 * explicaciones activas: ahí los absolutos casi siempre son legítimos porque el
 * bullet está **negando** el absoluto del distractor (*"No queda exento «en todo
 * caso»: subsiste la responsabilidad…"*, *"no cabe la oposición expresa"*).
 * Marcarlos convertiría el aviso en ruido — y un gate ruidoso se ignora entero.
 * El overclaim que hace daño es el que **avala la clave** de más.
 */
function razonamientoDe(explanation) {
  const sinCita = String(explanation || '')
    .split('\n')
    .filter((l) => !/^\s*>/.test(l))
    .join('\n')

  const ini = sinCita.match(/\*\*Por qué [ABCD] es correcta:\*\*/)
  if (!ini) return sinCita // formato no canónico: se analiza entero
  const desde = sinCita.slice(ini.index + ini[0].length)
  const fin = desde.search(/\*\*Por qué las demás/)
  return fin === -1 ? desde : desde.slice(0, fin)
}

/** Frase que contiene el match, para poder enseñarla en el aviso. */
function fraseDe(texto, idx) {
  const ini = Math.max(0, texto.lastIndexOf('.', idx) + 1)
  const finPunto = texto.indexOf('.', idx)
  const fin = finPunto === -1 ? texto.length : finPunto + 1
  return texto.slice(ini, fin).replace(/\s+/g, ' ').trim()
}

/**
 * @param {string} explanation Explicación tal cual está en BD.
 * @param {string} articuloContent Texto del artículo del que cuelga la pregunta.
 * @returns {{avisos: Array<{termino:string, frase:string}>}}
 */
function analizarOverclaim(explanation, articuloContent) {
  const razonamiento = razonamientoDe(explanation)
  const ley = String(articuloContent || '')
  const avisos = []

  for (const m of MARCADORES) {
    const hit = razonamiento.match(m.re)
    if (!hit) continue
    // El absoluto lo dice la propia norma → es cita, no extrapolación.
    if (m.enLey.test(ley)) continue
    avisos.push({ termino: m.termino, frase: fraseDe(razonamiento, hit.index) })
  }

  return { avisos }
}

module.exports = { analizarOverclaim, razonamientoDe, MARCADORES }
