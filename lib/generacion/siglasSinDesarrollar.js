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
  // No es una norma, pero se comporta igual: el opositor no puede responder si no
  // sabe qué es. Se colaron 2 preguntas del lote gen_regage (26/07/2026) con la
  // sigla SOLO en las opciones —incluida la correcta— porque no estaba catalogada
  // y `RE_CANDIDATA` no la ve (el guion parte la palabra y solo mira el enunciado).
  'REG-AGE': /Registro Electr[óo]nico General/i,
  LOPDGDD: /Ley Org[áa]nica 3\/2018|Protecci[óo]n de Datos Personales/i,
  // [T-115] Se coló en un lote de la campaña de huérfanos: una explicación citaba "el
  // art. X del CP" sin desarrollar, ilegible para quien no la tenga catalogada.
  CP: /Ley Org[áa]nica 10\/1995|C[óo]digo Penal/i,
  // Añadida el 06/08/2026 (T-278, primer batch generado contra el RGC: Mecánico Conductor
  // del Estado T10 "La velocidad"). Sin catalogar, salía como `candidata` en las 22
  // preguntas del batch — aviso correcto, pero que se repetiría en cada tema de la
  // oposición (9 temas en elaboración) si nadie amplía el diccionario.
  RGC: /Real Decreto 1428\/2003|Reglamento General de Circulaci[óo]n/i,
  // Añadida el 08/08/2026 al revisar [T-679]: la explicación de una pregunta del lote de
  // Guardia Civil T17 decía "los declara la CETIC según el artículo 10" sin desarrollarla en
  // ningún punto anterior de ESA pregunta. El gate no la vio por partida doble — no estaba
  // catalogada Y `analizarSiglas` se invocaba sin el campo `explanation` —, así que se coló
  // pese a las dos auditorías. Catalogarla evita que se repita en los batches siguientes de
  // esta misma norma, que quedan 3 de 5 artículos por cubrir.
  CETIC: /Comisi[óo]n de Estrategia TIC/i,
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
  const enOpciones = (opciones || []).join(' ')
  // La sigla se busca en enunciado Y OPCIONES: las dos cosas las lee el opositor.
  // Antes solo se miraba el enunciado y se colaron 2 preguntas del lote gen_regage
  // (26/07/2026) con la sigla únicamente en las opciones —incluida la correcta—,
  // ilegibles servidas sueltas. Lo cazó una auditoría LLM, no el gate.
  // …Y EN LA EXPLICACIÓN, desde [T-679] (08/08/2026). Hasta entonces la explicación solo contaba
  // para dar una sigla por DESARROLLADA, nunca para detectarla: una sigla que aparecía SOLO ahí
  // era invisible para el gate. Así se coló «los declara la CETIC según el artículo 10» en un lote
  // de Guardia Civil, pasando por delante de las DOS auditorías. La explicación la lee el opositor
  // igual que el enunciado, así que la regla es la misma en los tres sitios.
  // Coste medido antes de tocarlo, sobre los 4 lotes generados a mano (64 preguntas):
  // 0 marcadas hoy → 0 marcadas con el cambio. Ninguna aparece por ampliar la ventana.
  const dondeAparece = texto + ' ' + enOpciones + ' ' + String(explicacion || '')
  const visible = texto + ' ' + enOpciones + ' ' + String(explicacion || '')

  const faltan = []
  for (const [sigla, re] of Object.entries(DESARROLLO)) {
    if (ALLOWLIST.has(sigla)) continue
    if (!new RegExp(`\\b${sigla}\\b`).test(dondeAparece)) continue
    // Se considera desarrollada si el nombre aparece en CUALQUIER parte visible.
    // Eso absorbe de paso la excepción §2.2-quater (si la respuesta ES la norma, el
    // desarrollo está en la opción y no hace falta cantarlo en el enunciado).
    if (re.test(visible)) continue
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
