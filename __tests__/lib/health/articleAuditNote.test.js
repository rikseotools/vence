const {
  ARTICLE_AUDIT_NOTE_RE_SRC_SQL,
  isArticleAuditNote,
  matchedArticleAuditNotes,
} = require('../../../lib/health/articleAuditNote.cjs')

// El defecto: el TEXTO DEL ARTÍCULO (la teoría que estudia el opositor) lleva incrustada la
// nota de un pase de auditoría anterior. Los casos de abajo son TEXTO REAL del banco
// (06/08/2026, `articles.content`), no inventados.
describe('detector article_audit_note — casos reales', () => {
  const REALES = [
    // Correos T3 — el caso literal citado en la ficha [T-253] (CityPaq)
    'Si no es recogido, el destinatario **NO puede retirarlo en la oficina de referencia en 5 días naturales** (esa afirmación es INCORRECTA). El procedimiento exacto aplica plazos y condiciones específicos.',
    // Correos T7 — el que la ficha original NO veía: "incorrecta" en negrita markdown
    'no es cierto que sea imposible inutilizarla una vez contabilizada el gasto; esa afirmación es **incorrecta**).',
    // Correos T1 — nota histórica
    'El procedimiento de HERA no se implantó en las elecciones autonómicas (esa afirmación es incorrecta).',
    // Modelado y Diseño de BD
    'Tampoco es cierto que la normalización *minimice las relaciones entre tablas* (esa afirmación es INCORRECTA): la normalización **descompone** en más relaciones bien formadas.',
    // Programación Orientada a Objetos y UML — sujeto "esta", no "esa"
    'afirmar que "la herencia entre dos clases puede ser múltiple y todo lenguaje orientado a objetos debe ofrecer esta posibilidad": esta afirmación es **INCORRECTA**. La herencia múltiple no es obligatoria.',
    // Ciberseguridad CCN-CERT — "Esta" con mayúscula al inicio de frase
    'la clave no tiene que ser necesariamente un número (puede ser cualquier cadena de caracteres). Esta afirmación es **incorrecta** y aparece como trampa en exámenes.',
    // Reglamento Defensor Pueblo GC — con guion largo antes
    'no designa a sus propios Vocales ni puede poner fin a sus funciones por sí mismo — esa afirmación es **incorrecta**).',
  ]

  it.each(REALES)('marca: %s', (texto) => {
    expect(isArticleAuditNote(texto)).toBe(true)
  })

  it('captura las VARIAS apariciones dentro de un mismo artículo (Correos T3 tiene 16)', () => {
    const dos = REALES[0] + ' Más texto normal. ' + REALES[2]
    expect(matchedArticleAuditNotes(dos).length).toBe(2)
  })
})

describe('detector article_audit_note — NO marca contenido legítimo', () => {
  const LEGITIMAS = [
    // El falso positivo REAL que motivó exigir "afirmación" como sujeto obligatorio
    // (Access 365, medido 06/08/2026): es una trampa de examen explicada, no una nota de
    // auditoría — y "esta" aparece dentro de "respuesta", no como palabra suelta.
    'Si una pregunta menciona "0 para falso y -1 para verdadero" y pregunta si el tamaño es 1 byte, también es **incorrecta** porque el tamaño es 1 bit, no 1 byte.',
    'Si una pregunta menciona que el tipo de dato booleano de Access almacena "0 para falso y 1 para verdadero", la respuesta es **incorrecta** porque Access usa -1.',
    // Prosa legal/técnica normal que usa "incorrecto" sin ser una nota de auditoría
    'Una contraseña se considera incorrecta si no cumple los requisitos mínimos de longitud y complejidad.',
    'El artículo 45.2 establece el procedimiento aplicable en caso de que la solicitud sea incorrecta o esté incompleta.',
    // "esta"/"esa" como demostrativo normal, sin la palabra "afirmación" cerca
    'Esta ley entrará en vigor a los veinte días de su publicación en el BOE.',
    'Esa modificación no afecta a los artículos ya vigentes.',
  ]

  it.each(LEGITIMAS)('NO marca: %s', (texto) => {
    expect(isArticleAuditNote(texto)).toBe(false)
  })

  it('vacío o nulo no revienta', () => {
    expect(isArticleAuditNote('')).toBe(false)
    expect(isArticleAuditNote(null)).toBe(false)
    expect(isArticleAuditNote(undefined)).toBe(false)
    expect(matchedArticleAuditNotes(null)).toEqual([])
  })
})

describe('article_audit_note — el GOTCHA de \\b vs \\y (Postgres ARE)', () => {
  // \b en Postgres NO es límite de palabra (medido en vivo: 'esta es' ~* '\besta' → false).
  // La fuente SQL usa \y, la fuente JS usa \b — mismo patrón, distinto marcador de límite,
  // y ambos coinciden en el resultado real (no es solo un detalle de sintaxis).
  it('la fuente SQL usa \\y (límite de palabra en ARE), no \\b', () => {
    expect(ARTICLE_AUDIT_NOTE_RE_SRC_SQL).toMatch(/^\\y/)
    expect(ARTICLE_AUDIT_NOTE_RE_SRC_SQL).not.toMatch(/^\\b/)
  })
})
