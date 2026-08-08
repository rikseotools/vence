const { UMBRAL_PLACEHOLDER, esContenidoPlaceholder } = require('../../../lib/generacion/articuloPlaceholder')

describe('esContenidoPlaceholder (T-374: cierra la puerta por la que entraron 7.202 preguntas)', () => {
  it('el marcador real que causó T-374 es placeholder', () => {
    expect(esContenidoPlaceholder('⏳ Teoría pendiente (contenedor enfermería).')).toBe(true)
  })

  it('vacío, null o undefined son placeholder', () => {
    expect(esContenidoPlaceholder('')).toBe(true)
    expect(esContenidoPlaceholder(null)).toBe(true)
    expect(esContenidoPlaceholder(undefined)).toBe(true)
  })

  it('solo espacios en blanco es placeholder (no basta con longitud sin trim)', () => {
    expect(esContenidoPlaceholder(' '.repeat(200))).toBe(true)
  })

  it('texto real de temario (>=120 caracteres) NO es placeholder', () => {
    const real = 'El trastorno de personalidad límite se caracteriza por un patrón de inestabilidad ' +
      'en las relaciones interpersonales, la autoimagen y los afectos, con impulsividad marcada.'
    expect(real.length).toBeGreaterThanOrEqual(120)
    expect(esContenidoPlaceholder(real)).toBe(false)
  })

  it('el umbral es exactamente el mismo que usa el ratchet (single source of truth)', () => {
    expect(UMBRAL_PLACEHOLDER).toBe(120)
    expect(esContenidoPlaceholder('x'.repeat(119))).toBe(true)
    expect(esContenidoPlaceholder('x'.repeat(120))).toBe(false)
  })
})
