/**
 * §2.2-quater del manual `generar-preguntas-con-ia.md`: cada pregunta debe ser
 * AUTOCONTENIDA. Los tests salen barajados y sueltos, así que una pregunta no
 * puede depender de que la sigla se haya desarrollado en otra — hay que dar el
 * nombre completo en su primera aparición y dejar la sigla entre paréntesis.
 *
 * Origen de la regla: impugnación de Laura García (02/07/2026), "LBRL" a pelo.
 * Origen de ESTE detector: en el lote de Agentes de Tributos de Canarias
 * (25/07/2026) se colaron 46 enunciados con "IGIC" y 27 con "AIEM" sin
 * desarrollar. El gate mecánico no miraba §2.2-quater, así que solo los cazó
 * una auditoría LLM — y por casualidad, porque solo se le pasaron 19 de 379.
 * Una regla que únicamente vigila un juez caro es una regla que se incumple.
 *
 * Dos niveles, a propósito:
 *   - `faltan`: siglas del DICCIONARIO usadas sin su desarrollo → error duro.
 *     Determinista: sabemos el nombre completo, así que sabemos si está.
 *   - `candidatas`: mayúsculas que parecen sigla (van tras artículo: "del X",
 *     "al X", "el X") y no están en el diccionario → aviso para AMPLIARLO.
 *     El filtro del artículo evita el ruido de las mayúsculas enfáticas
 *     ("NINGUNA", "MUY GRAVE"), que no van precedidas de artículo.
 */

/** Siglas universales que pueden ir crudas (§2.2-quater). */
const ALLOWLIST = new Set(['CE', 'UE', 'TREBEP', 'LOPJ', 'TUE', 'TFUE'])

/**
 * sigla → expresión que reconoce su desarrollo. Ampliar al añadir normas: una
 * sigla ausente de aquí no da error, sale como `candidata`.
 */
const DESARROLLO = {
  IGIC: /Impuesto General Indirecto Canario/i,
  AIEM: /Arbitrio sobre Importaciones y Entregas de Mercanc/i,
  LGT: /Ley 58\/2003|Ley General Tributaria/i,
  RGGIT: /Real Decreto 1065\/2007|Reglamento General de las actuaciones/i,
  RGR: /Real Decreto 939\/2005|Reglamento General de Recaudaci/i,
  RGRVA: /Real Decreto 520\/2005|revisi[óo]n en v[íi]a administrativa/i,
  RGST: /Real Decreto 2063\/2004|r[ée]gimen sancionador tributario/i,
  ITPAJD: /Transmisiones Patrimoniales y Actos Jur[íi]dicos Documentados/i,
  IRPF: /Impuesto sobre la Renta de las Personas F[íi]sicas/i,
  IVA: /Impuesto sobre el Valor A[ñn]adido/i,
  REF: /R[ée]gimen Econ[óo]mico y? ?Fiscal/i,
  LPAC: /Ley 39\/2015|Procedimiento Administrativo Com[úu]n/i,
  LRJSP: /Ley 40\/2015|R[ée]gimen Jur[íi]dico del Sector P[úu]blico/i,
  EBEP: /Estatuto B[áa]sico del Empleado P[úu]blico/i,
  LBRL: /Ley 7\/1985|Bases del R[ée]gimen Local/i,
  LOREG: /Ley Org[áa]nica 5\/1985|R[ée]gimen Electoral General/i,
  LGP: /Ley 47\/2003|Ley General Presupuestaria/i,
  LPRL: /Ley 31\/1995|Prevenci[óo]n de Riesgos Laborales/i,
  LOPDGDD: /Ley Org[áa]nica 3\/2018|Protecci[óo]n de Datos Personales/i,
}

const RE_CANDIDATA = /\b(?:el|la|los|las|del|al|de la|de los|de las)\s+([A-Z][A-Z0-9]{1,7})\b/g

/**
 * @param {string} enunciado texto de la pregunta.
 * @param {string} [explicacion] la explicación cuenta como parte visible.
 * @param {string[]} [opciones] para la excepción "la respuesta es la propia norma".
 * @returns {{faltan: string[], candidatas: string[]}}
 */
function analizarSiglas(enunciado, explicacion = '', opciones = []) {
  const texto = String(enunciado || '')
  const visible = texto + ' ' + String(explicacion || '')
  const enOpciones = (opciones || []).join(' ')

  const faltan = []
  for (const [sigla, re] of Object.entries(DESARROLLO)) {
    if (ALLOWLIST.has(sigla)) continue
    if (!new RegExp(`\\b${sigla}\\b`).test(texto)) continue
    if (re.test(visible)) continue
    // Excepción §2.2-quater: si la respuesta ES la propia norma, desarrollarla
    // en el enunciado cantaría la solución.
    if (re.test(enOpciones)) continue
    faltan.push(sigla)
  }

  const candidatas = []
  for (const m of texto.matchAll(RE_CANDIDATA)) {
    const s = m[1]
    if (ALLOWLIST.has(s) || DESARROLLO[s] || faltan.includes(s)) continue
    if (!candidatas.includes(s)) candidatas.push(s)
  }

  return { faltan, candidatas }
}

module.exports = { analizarSiglas, ALLOWLIST, DESARROLLO }
