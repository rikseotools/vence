const {
  AUDIT_NOTE_PATS,
  isAuditNoteExplanation,
  matchedAuditNotePatterns,
} = require('../../../lib/health/auditNoteExplanation.cjs')

// El defecto: la «explicación» que lee el opositor es en realidad la nota que un pase de IA
// escribió SOBRE la pregunta. Los casos de abajo son TEXTO REAL del banco (28/07/2026), no
// inventados: son los que el detector daba por inexistentes mientras estaban servidos.
describe('detector audit_note_explanation — casos reales que el detector NO veía', () => {
  const REALES = [
    // se juzga a sí misma
    'La explicación confunde el art. 150.2 (transferencia/delegación de competencias estatales) con el art. 150.3 (leyes de armonización).',
    'La explicación proporcionada desvía el razonamiento hacia los tipos de poder del art. 6.4 en lugar de justificar directamente que el art. 6.3.d incluye el "período de tiempo".',
    'La respuesta correcta B es válida: el art. 17.2 establece que… La explicación es incorrecta porque argumenta que C es correcta y explica el art. 17.1.',
    'La explicación menciona que se pueden conocer nombre, apellidos, DNI y firma, pero la respuesta marcada (C) solo dice "nombre y apellidos".',
    'La explicación solo menciona tres de los ítems del art.18.1 y omite el ítem c).',
    // el «explanation» a medio traducir, que es el mismo defecto
    'La explanation original razonó incorrectamente sobre la opción A.',
    'La explanation cita "art. 89" como fundamento, pero la regla figura en el art. 88.7.',
    // instrucciones de arreglo dirigidas a quien mantiene el banco
    'Debe reescribirse para justificar B con el texto del art. 17.2.',
    'Debe reorientarse la justificación al art. 6.3 y sus letras a)-e).',
    'Corregir eliminando la referencia a «leyes de armonización» y centrando la explicación en el art. 150.2.',
    'La pregunta habla de "fase de iniciación"; conviene aclarar este matiz para evitar confusión con el art.56.2.',
    // certifica en vez de explicar
    'Las opciones B, C y D son incorrectas por razones bien explicadas.',
  ]

  it.each(REALES)('marca: %s', (texto) => {
    expect(isAuditNoteExplanation(texto)).toBe(true)
  })

  it('dice POR QUÉ marcó, para poder triarlo', () => {
    expect(matchedAuditNotePatterns('Debe reescribirse para justificar B.')).toContain('Debe reescribirse')
    expect(matchedAuditNotePatterns('Una explicación normal y corriente.')).toEqual([])
  })
})

describe('detector audit_note_explanation — NO marca explicaciones legítimas', () => {
  // Un detector que llena la bandeja de explicaciones correctas se acaba ignorando, y entonces
  // deja de proteger de nada. Estos textos son formato canónico del manual (§8.1 y §5.1).
  const LEGITIMAS = [
    'La respuesta correcta es la **B**.\n\n> "Los interesados tienen derecho a no aportar documentos…"\n\n**Por qué B es correcta:** recoge el supuesto del artículo.',
    '**Por qué D es correcta:** reproduce la finalidad literal del artículo 45.2.\n\n**Por qué las demás son incorrectas:**\n- **A)** El precepto no menciona la operatividad.',
    'Como se ha visto, el plazo general es de diez días hábiles; debe mencionarse que puede ampliarse hasta cinco días más.',
    'Conviene revisar el contexto de la norma: el artículo se ubica en el capítulo de la potestad sancionadora.',
    'La explicación anterior desarrolla el principio de tipicidad; aquí interesa el de proporcionalidad.',
  ]

  it.each(LEGITIMAS)('no marca: %s', (texto) => {
    expect(isAuditNoteExplanation(texto)).toBe(false)
  })

  it('vacío o nulo no es un hallazgo', () => {
    expect(isAuditNoteExplanation('')).toBe(false)
    expect(isAuditNoteExplanation(null)).toBe(false)
    expect(isAuditNoteExplanation(undefined)).toBe(false)
  })
})

describe('detector audit_note_explanation — forma de la lista', () => {
  it('conserva los diez literales de la remesa original (no se pierde cobertura al ampliar)', () => {
    for (const p of [
      'La explicación omite', 'La explicación debería', 'La explicación actual',
      'Esta pregunta debería', 'posible errata', 'Nota técnica:',
      'respuesta oficial del examen', 'debería ser impugnada',
      'debería haberse ANULADO', 'debería haber especificado',
    ]) {
      expect(AUDIT_NOTE_PATS).toContain(p)
    }
  })

  it('no hay patrones duplicados ni vacíos (el SQL genera un ILIKE por cada uno)', () => {
    expect(new Set(AUDIT_NOTE_PATS).size).toBe(AUDIT_NOTE_PATS.length)
    expect(AUDIT_NOTE_PATS.every((p) => typeof p === 'string' && p.trim().length > 3)).toBe(true)
  })

  it('la comparación es insensible a mayúsculas, como el ILIKE de los gemelos', () => {
    expect(isAuditNoteExplanation('la explicación CONFUNDE los dos apartados')).toBe(true)
  })
})
