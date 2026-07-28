// lib/health/auditNoteExplanation.cjs — núcleo puro del detector `audit_note_explanation`:
// preguntas ACTIVAS cuya «explicación» es en realidad la NOTA que un pase de IA anterior
// escribió SOBRE la pregunta, en vez de la explicación que el opositor necesita.
//
// ## Por qué este fichero existe (y por qué se amplió el 28/07/2026)
//
// La lista original eran 10 literales sacados de una remesa concreta (los ~46 casos
// remediados el 10/07). Funcionó para aquella remesa y luego se quedó **en verde mintiendo**:
// el 28/07 el barrido nocturno reportaba **0** hallazgos de este kind mientras había **24
// preguntas activas** con el mismo defecto, escrito con otras palabras. Las cazó una persona
// de refilón, revisando el cubo de explicaciones apelotonadas — no el sensor.
//
// La lección no es «añadir diez literales más»: es que el defecto no está en una frase
// concreta sino en un ACTO — la explicación **habla de sí misma o de la pregunta** en vez de
// explicar la materia. Por eso los patrones nuevos se agrupan por ese acto:
//
//   1. **Se juzga a sí misma**: «La explicación confunde…», «La explicación es incorrecta
//      porque argumenta que C…», «La explicación proporcionada desvía el razonamiento…».
//   2. **Da instrucciones de arreglo** (imperativos dirigidos a quien mantiene el banco):
//      «Debe reescribirse para justificar B», «Debe reorientarse la justificación al art.
//      6.3», «Corregir eliminando la referencia a…», «Revisar el contexto aplicación…».
//   3. **Habla de las opciones en tercera persona evaluadora**: «Las opciones B, C y D son
//      incorrectas por razones bien explicadas» (no explica: certifica que ya se explicó).
//
// ## Calibración (medida sobre el banco, no supuesta)
//
// Todos los patrones exigen un sujeto/verbo que solo aparece en prosa META. Se dejaron FUERA
// a propósito los que dan falsos positivos en explicaciones legítimas:
//
//   · «la explicación anterior» — frecuente y legítimo en textos didácticos encadenados.
//   · «conviene aclarar» / «hay que precisar» a secas — muletillas normales de una buena
//     explicación; solo se marcan cuando el sujeto es *la explicación misma*.
//   · «la respuesta correcta es X» — es el ARRANQUE canónico del formato §5.1, no una nota.
//
// Remediar NUNCA es automático: hay que verificar la clave contra el artículo y reescribir la
// explicación (estructurada, ver `scripts/aplicar-explicacion.ts`), o mandarla a
// `needs_human`. Manual: `docs/maintenance/revisar-preguntas-con-agente.md`.

// ## Segunda recaída, un día después (29/07/2026): por qué ya NO basta una lista de literales
//
// El 28/07 se amplió la lista de 10 a 21 literales y el detector volvió a verde. El 29/07, la
// campaña del cubo de explicaciones apelotonadas encontró **4 notas de auditoría más** entre 73
// preguntas, y el detector recién ampliado **no veía ninguna de las 4**. Al medirlo sobre el
// banco vivo apareció el tamaño real del punto ciego:
//
//   · preguntas ACTIVAS cuya explicación habla de sí misma:  **96**
//   · de esas, las que veían los 21 literales:                 **0**
//
// Cero. Otra vez en verde mintiendo, con el mismo acto y otras palabras: «La explicación es
// incoherente», «La explicación debe reflejar», «La explicación no advierte», «La explicación
// original cita erróneamente», «La explicación está vacía», «La explicación no responde a la
// pregunta»… Una lista de literales no puede ganar esta carrera: cada remesa de IA inventa un
// verbo nuevo y el literal se queda fijado a la remesa que se remedió.
//
// Por eso el criterio pasa a ser un PATRÓN del acto, no un catálogo de frases: **el sujeto es
// «la explicación» y el verbo la juzga**. Se mantiene la lista de literales porque cubre casos
// con OTRO sujeto («Esta pregunta debería», «Nota técnica:», «Debe reescribirse») que el patrón
// no ve — las dos vías son complementarias, no redundantes (su intersección medida es 0).
//
// Calibración sobre el banco vivo (29/07/2026), no supuesta: muestra ALEATORIA de 25 de las 96
// → 25 son notas de auditoría reales, 0 falsos positivos. Se comprobó además que las
// continuaciones legítimas de «La explicación es…» («es la siguiente», «es sencilla», «radica
// en», «se encuentra en», «está en el art.») tienen **0 apariciones** en el banco.
//
// Punto ciego ASUMIDO: «la explicación anterior» queda FUERA a propósito (prosa didáctica
// legítima encadenando dos explicaciones), igual que antes.
const AUDIT_NOTE_META_RE_SRC =
  'la explicaci[oó]n\\s+(es|no|debe|deber|de la respuesta|del enunciado|dada|actual|original|' +
  'proporcionada|aportada|ofrecida|resulta|contiene|confunde|omite|menciona|cita|se refiere|est[aá])'

// Literales que se buscan con ILIKE '%…%' (case-insensitive por el propio operador).
// ORDEN ESTABLE: el guardarraíl de paridad compara esta lista con la del backend POR VALOR.
const AUDIT_NOTE_PATS = [
  // — remesa original (10/07/2026) —
  'La explicación omite',
  'La explicación debería',
  'La explicación actual',
  'Esta pregunta debería',
  'posible errata',
  'Nota técnica:',
  'respuesta oficial del examen',
  'debería ser impugnada',
  'debería haberse ANULADO',
  'debería haber especificado',
  // — ampliación 28/07/2026: la explicación se juzga a sí misma —
  'La explicación confunde',
  'La explicación proporcionada',
  'La explicación es incorrecta',
  'La explicación menciona',
  'La explicación solo menciona',
  'La explicación no debe',
  'la explicación debe precisar',
  'La explanation',
  // — ampliación 28/07/2026: instrucciones de arreglo dirigidas al mantenedor —
  'Debe reescribirse',
  'Debe reorientarse',
  'Corregir eliminando',
  'conviene aclarar este matiz',
  // — ampliación 28/07/2026: certifica en vez de explicar —
  'por razones bien explicadas',
]

// ## Punto ciego ASUMIDO (no ignorado)
//
// Se probaron y DESCARTARON dos patrones que habrían cazado un caso real más cada uno pero
// son prosa legítima en una explicación didáctica: **«debe mencionarse que»** («Debe
// mencionarse que el plazo se cuenta…») y **«Revisar el contexto»**. El caso real que se
// escapa por ahí es una nota sobre atajos de Excel («Revisar el contexto aplicación antes de
// afirmar qué hace cada atajo»); afinar el literal hasta cazarla sería sobreajustar a una
// sola pregunta y no generalizaría. Este detector es `warn` de triaje, no una puerta: se
// prefiere perder ese caso a que la bandeja se llene de explicaciones correctas y se acabe
// ignorando (misma decisión que en `visualDeixis.cjs`).

/** El patrón del ACTO, como RegExp de JS. En SQL es el mismo `source` con `~*`. */
const AUDIT_NOTE_META_RE = new RegExp(AUDIT_NOTE_META_RE_SRC, 'i')

/**
 * ¿El texto es (o contiene) una nota de auditoría en vez de una explicación?
 * Puro: mismo criterio que la consulta SQL de los dos gemelos del sweep (literales por ILIKE
 * OR el patrón meta por `~*`).
 */
function isAuditNoteExplanation(texto) {
  if (!texto) return false
  const s = String(texto)
  const t = s.toLowerCase()
  return AUDIT_NOTE_PATS.some((p) => t.includes(p.toLowerCase())) || AUDIT_NOTE_META_RE.test(s)
}

/** Los patrones que casan, para poder decir POR QUÉ se marcó (triaje). */
function matchedAuditNotePatterns(texto) {
  if (!texto) return []
  const s = String(texto)
  const t = s.toLowerCase()
  const out = AUDIT_NOTE_PATS.filter((p) => t.includes(p.toLowerCase()))
  const meta = s.match(AUDIT_NOTE_META_RE)
  // El patrón meta se reporta con el TROZO que casó, no con la regex: quien triaje quiere leer
  // «la explicación no advierte», no una expresión regular de 300 caracteres.
  if (meta) out.push(`meta:«${meta[0]}…»`)
  return out
}

module.exports = {
  AUDIT_NOTE_PATS,
  AUDIT_NOTE_META_RE_SRC,
  AUDIT_NOTE_META_RE,
  isAuditNoteExplanation,
  matchedAuditNotePatterns,
}
