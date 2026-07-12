// Guardrail del scaffolder create-oposicion: la validación PURA rechaza los fallos aprendidos.
// Importa la función REAL de producción (no una copia).
const { validateSpec, validateScope, buildConfigEntry } = require('../../scripts/create-oposicion.cjs')

function validSpec() {
  return {
    identity: {
      nombre: 'Escala de Ayudantes de Ejecución Penal - Euskadi', short_name: 'Ayudantes Ejecución Penal PV',
      slug: 'ayudantes-ejecucion-penal-pais-vasco', position_type: 'ayudantes_ejecucion_penal_pais_vasco',
      grupo: 'C', subgrupo: 'C1', categoria: 'C1', tipo_acceso: 'libre', administracion: 'autonomica',
      titulo_requerido: 'Bachiller o Técnico', coverage_level: 'con_tests',
    },
    examScoring: { penaltyDivisor: 3, source: 'BOPV 04/05/2026: 1/3.' },
    landing: {
      estadisticas: [{ numero: '100', texto: 'Plazas', color: 'text-green-600' }],
      faqs: [{ pregunta: '¿Plazas?', respuesta: '100' }],
    },
    bloques: [{ numero: 1, titulo: 'Parte común', icon: '⚖️' }, { numero: 2, titulo: 'Específica', icon: '🔒' }],
    temario: [
      { bloque: 1, numero: 1, topic_number: 1, titulo: 'La Constitución', epigrafe: 'La Constitución Española de 1978...' },
      { bloque: 2, numero: 1, topic_number: 101, titulo: 'Ejecución penal', epigrafe: 'Legislación penitenciaria vasca...' },
    ],
    convocatoria: { año: 2026, estado_proceso: 'inscripcion_abierta', diario_oficial: 'BOPV' },
  }
}

describe('validateSpec (guardrail scaffolder oposiciones)', () => {
  test('spec válido → sin errores', () => {
    expect(validateSpec(validSpec())).toEqual([])
  })

  test('estadisticas sin "numero" → error (guard incidente 500 SSR)', () => {
    const s = validSpec(); s.landing.estadisticas = [{ value: '100', texto: 'Plazas', color: 'x' }]
    expect(validateSpec(s).some(e => /estadisticas\[0\]\.numero/.test(e))).toBe(true)
  })

  test('faqs sin respuesta → error', () => {
    const s = validSpec(); s.landing.faqs = [{ pregunta: '¿?' }]
    expect(validateSpec(s).some(e => /faqs\[0\]\.respuesta/.test(e))).toBe(true)
  })

  test('slug y position_type no coinciden → error', () => {
    const s = validSpec(); s.identity.position_type = 'otra_cosa'
    expect(validateSpec(s).some(e => /deben coincidir/.test(e))).toBe(true)
  })

  test('slug no kebab-case → error', () => {
    const s = validSpec(); s.identity.slug = 'Ayudantes_PV'
    expect(validateSpec(s).some(e => /kebab-case/.test(e))).toBe(true)
  })

  test('topic_number duplicado → error', () => {
    const s = validSpec(); s.temario[1].topic_number = 1
    expect(validateSpec(s).some(e => /topic_number 1 duplicado/.test(e))).toBe(true)
  })

  test('tema que referencia un bloque inexistente → error', () => {
    const s = validSpec(); s.temario[0].bloque = 9
    expect(validateSpec(s).some(e => /no referencia un bloque/.test(e))).toBe(true)
  })

  test('sin examScoring → error', () => {
    const s = validSpec(); delete s.examScoring
    expect(validateSpec(s).some(e => /examScoring/.test(e))).toBe(true)
  })

  test('examScoring.penaltyDivisor negativo → error', () => {
    const s = validSpec(); s.examScoring.penaltyDivisor = -1
    expect(validateSpec(s).some(e => /penaltyDivisor/.test(e))).toBe(true)
  })

  test('penaltyDivisor null (sin penalización) es válido', () => {
    const s = validSpec(); s.examScoring.penaltyDivisor = null
    expect(validateSpec(s)).toEqual([])
  })

  test('falta convocatoria.estado_proceso → error (tarjeta catálogo en blanco)', () => {
    const s = validSpec(); delete s.convocatoria.estado_proceso
    expect(validateSpec(s).some(e => /convocatoria\.estado_proceso/.test(e))).toBe(true)
  })

  test('bloques_count incoherente → error', () => {
    const s = validSpec(); s.identity.bloques_count = 5
    expect(validateSpec(s).some(e => /bloques_count/.test(e))).toBe(true)
  })
})

describe('validateScope (guardrail FASE 3 — evita el fallo grueso de reuse)', () => {
  function specWithScope(scope) { const s = validSpec(); s.scope = scope; return s }

  test('sin sección scope → sin errores (opcional)', () => {
    expect(validateScope(validSpec())).toEqual([])
  })

  test('scope válido (artículos + wholeLaw + vacío) → sin errores', () => {
    expect(validateScope(specWithScope({
      1: [{ law: 'CE', articles: ['1', '2', '10'] }],
      101: [{ law: 'CP', wholeLaw: true }],
      // un tema En desarrollo (vacío) es legítimo
    }))).toEqual([])
  })

  test('DUPLICADO exacto de scope entre dos temas → error (caza T109=T110, T124=T112 de hoy)', () => {
    const s = specWithScope({
      1: [{ law: 'CE', articles: ['1', '2'] }],
      101: [{ law: 'CE', articles: ['2', '1'] }], // mismo scope (orden distinto) → duplicado
    })
    expect(validateScope(s).some(e => /mismo scope que el tema/.test(e))).toBe(true)
  })

  test('entrada sin law → error', () => {
    expect(validateScope(specWithScope({ 1: [{ articles: ['1'] }] })).some(e => /necesita 'law'/.test(e))).toBe(true)
  })

  test('entrada sin articles ni wholeLaw → error', () => {
    expect(validateScope(specWithScope({ 1: [{ law: 'CE' }] })).some(e => /'articles'.*wholeLaw/.test(e))).toBe(true)
  })

  test('scope de un tema inexistente en el temario → error', () => {
    expect(validateScope(specWithScope({ 999: [{ law: 'CE', articles: ['1'] }] })).some(e => /no existe en el temario/.test(e))).toBe(true)
  })

  test('articles vacío → error', () => {
    expect(validateScope(specWithScope({ 1: [{ law: 'CE', articles: [] }] })).some(e => /no puede estar vacío/.test(e))).toBe(true)
  })
})

describe('buildConfigEntry (FASE 4 — entrada oposiciones.ts desde el spec)', () => {
  const entry = buildConfigEntry(validSpec())

  test('incluye id/slug/positionType coherentes', () => {
    expect(entry).toMatch(/id: 'ayudantes_ejecucion_penal_pais_vasco'/)
    expect(entry).toMatch(/slug: 'ayudantes-ejecucion-penal-pais-vasco'/)
    expect(entry).toMatch(/positionType: 'ayudantes_ejecucion_penal_pais_vasco'/)
  })

  test('totalTopics == nº de temas del temario', () => {
    expect(entry).toMatch(/totalTopics: 2/)
  })

  test('específica lleva displayNumber (topic_number>100)', () => {
    expect(entry).toMatch(/id: 101, name: '.*', displayNumber: 1/)
  })

  test('común NO lleva displayNumber', () => {
    expect(entry).toMatch(/id: 1, name: 'La Constitución' \},/)
  })

  test('examScoring y administracion desde el spec', () => {
    expect(entry).toMatch(/penaltyDivisor: 3/)
    expect(entry).toMatch(/administracion: 'autonomica'/)
  })

  test('escapa comillas simples en nombres', () => {
    const s = validSpec(); s.temario[0].titulo = "L'Hospitalet de prueba"
    expect(buildConfigEntry(s)).toContain("L\\'Hospitalet de prueba")
  })

  test('genera navLinks con el slug', () => {
    expect(entry).toMatch(/href: '\/ayudantes-ejecucion-penal-pais-vasco\/test'/)
  })
})
