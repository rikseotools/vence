// Unit del núcleo REAL de completitud de landing (lib/convocatoria/landingCompleteness.cjs),
// no una copia. Lo consumen el sweep nocturno (kind `landing_incompleta`), el audit manual y
// el gate de CI: si los tres leen el mismo núcleo, no pueden discrepar.
//
// Incidente que lo motiva (25/07): Aux. Admin. UAL publicada semanas con hero vacío, 0 FAQs,
// sin descripción y sin SEO. Solo se detectó al ir a mandarle tráfico.

const { classifyLandingCompleteness, PIEZAS, MIN_FAQS } = require('@/lib/convocatoria/landingCompleteness.cjs')

const completa = () => ({
  isActive: true,
  landingEstadisticas: [{ numero: '21', texto: 'Plazas', color: 'text-green-600' }],
  landingFaqs: [
    { pregunta: '¿a?', respuesta: 'b' },
    { pregunta: '¿c?', respuesta: 'd' },
    { pregunta: '¿e?', respuesta: 'f' },
  ],
  landingDescription: 'Preparación de la oposición…',
  seoTitle: 'Título SEO',
  seoDescription: 'Descripción SEO',
  tituloRequerido: 'ESO',
  examenConfig: { tipo: 'Oposición' },
})

describe('classifyLandingCompleteness — landing completa', () => {
  it('una landing con todo devuelve ok y sin faltantes', () => {
    expect(classifyLandingCompleteness(completa())).toEqual({ nivel: 'ok', severidad: null, faltan: [], ids: [] })
  })
})

describe('classifyLandingCompleteness — el caso real de Almería', () => {
  it('hero vacío + 0 FAQs + sin SEO ⇒ incompleta/error con todas las piezas', () => {
    const r = classifyLandingCompleteness({
      isActive: true,
      landingEstadisticas: [],
      landingFaqs: [],
      landingDescription: null,
      seoTitle: null,
      seoDescription: null,
      tituloRequerido: null,
      examenConfig: {},
    })
    expect(r.nivel).toBe('incompleta')
    expect(r.severidad).toBe('error')
    expect(r.ids).toEqual([
      'tarjetas_hero', 'faqs', 'descripcion', 'seo_title', 'seo_description', 'titulo_requerido', 'examen_config',
    ])
  })
})

describe('classifyLandingCompleteness — severidad por impacto en el opositor', () => {
  it('hero sin tarjetas es ERROR (la página se ve vacía al entrar)', () => {
    const r = classifyLandingCompleteness({ ...completa(), landingEstadisticas: [] })
    expect(r.severidad).toBe('error')
    expect(r.ids).toEqual(['tarjetas_hero'])
  })

  it(`menos de ${MIN_FAQS} FAQs es ERROR`, () => {
    const r = classifyLandingCompleteness({ ...completa(), landingFaqs: [{ pregunta: '¿a?', respuesta: 'b' }] })
    expect(r.severidad).toBe('error')
    expect(r.ids).toEqual(['faqs'])
  })

  it('solo falta SEO ⇒ mejorable/warn, no bloquea', () => {
    const r = classifyLandingCompleteness({ ...completa(), seoTitle: null, seoDescription: '  ' })
    expect(r.nivel).toBe('mejorable')
    expect(r.severidad).toBe('warn')
    expect(r.ids).toEqual(['seo_title', 'seo_description'])
  })

  it('un error entre varios warns manda: incompleta', () => {
    const r = classifyLandingCompleteness({ ...completa(), landingFaqs: [], seoTitle: null })
    expect(r.nivel).toBe('incompleta')
    expect(r.severidad).toBe('error')
  })
})

describe('classifyLandingCompleteness — defensivo', () => {
  it('landing NO publicada nunca genera hallazgo (se está construyendo)', () => {
    const r = classifyLandingCompleteness({ isActive: false, landingEstadisticas: [], landingFaqs: [] })
    expect(r).toEqual({ nivel: 'ok', severidad: null, faltan: [], ids: [] })
  })

  it('tipos corruptos (string doble-codificado, objeto donde toca array) cuentan como falta', () => {
    const r = classifyLandingCompleteness({
      ...completa(),
      landingEstadisticas: '[{"numero":"21"}]', // snapshot viejo doble-codificado
      landingFaqs: { pregunta: 'x' },
    })
    expect(r.ids).toEqual(['tarjetas_hero', 'faqs'])
    expect(r.severidad).toBe('error')
  })

  it('examen_config como array o null cuenta como vacío', () => {
    expect(classifyLandingCompleteness({ ...completa(), examenConfig: [] }).ids).toEqual(['examen_config'])
    expect(classifyLandingCompleteness({ ...completa(), examenConfig: null }).ids).toEqual(['examen_config'])
  })

  it('entrada nula o vacía no revienta (se juzga como publicada e incompleta)', () => {
    expect(() => classifyLandingCompleteness(null)).not.toThrow()
    expect(classifyLandingCompleteness(null).nivel).toBe('incompleta')
    expect(classifyLandingCompleteness({}).nivel).toBe('incompleta')
  })

  it('espacios en blanco no cuentan como contenido', () => {
    const r = classifyLandingCompleteness({ ...completa(), landingDescription: '   ' })
    expect(r.ids).toEqual(['descripcion'])
  })
})

describe('contrato del catálogo de piezas (escalabilidad)', () => {
  it('toda pieza declara id, severidad válida, etiqueta y predicado', () => {
    for (const p of PIEZAS) {
      expect(typeof p.id).toBe('string')
      expect(['error', 'warn']).toContain(p.severidad)
      expect(typeof p.etiqueta).toBe('string')
      expect(typeof p.falta).toBe('function')
    }
  })
  it('los ids son únicos (evita colisiones al añadir piezas)', () => {
    const ids = PIEZAS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
