// [T-026] Marcar `is_virtual` saca una ley de la vigilancia de completitud PARA SIEMPRE y en
// silencio. Por eso el criterio es estrecho a propósito y se fija aquí: lo peligroso no es
// dejar fuera un contenedor, es colar una norma real.

const { clasificarContenedorInstitucional } = require('@/lib/laws/contenedorInstitucional')

const CONTENEDOR = {
  articulosActivos: 1,
  boeUrl: null,
  textoPrimerArticulo:
    'Contenido institucional (preguntas de hecho, no de articulado). Escindido del contenedor Instituciones Internacionales GC.',
}

describe('clasificarContenedorInstitucional', () => {
  it('reconoce el contenedor institucional declarado (OMS, OTAN, FMI…)', () => {
    const r = clasificarContenedorInstitucional(CONTENEDOR)
    expect(r.esContenedor).toBe(true)
  })

  it('NO marca una norma real de un solo artículo aunque no tenga fuente', () => {
    // Caso real del banco: «Protocolo nº 6 — Artículo único: el Parlamento Europeo tendrá su
    // sede en Estrasburgo…». Un artículo, sin fuente registrada, y es una norma de verdad:
    // marcarla virtual la dejaría sin vigilancia sin que nadie se entere.
    const r = clasificarContenedorInstitucional({
      articulosActivos: 1,
      boeUrl: null,
      textoPrimerArticulo: 'a) El Parlamento Europeo tendrá su sede en Estrasburgo…',
    })
    expect(r.esContenedor).toBe(false)
    expect(r.motivo).toMatch(/no se declara/)
  })

  it('con articulado NO es contenedor: si hay artículos, hay fuente que comparar', () => {
    const r = clasificarContenedorInstitucional({ ...CONTENEDOR, articulosActivos: 19 })
    expect(r.esContenedor).toBe(false)
    expect(r.motivo).toMatch(/19 art/)
  })

  it('si ya tiene fuente registrada NO se exime: se verifica contra ella', () => {
    const r = clasificarContenedorInstitucional({ ...CONTENEDOR, boeUrl: 'https://www.boe.es/…' })
    expect(r.esContenedor).toBe(false)
    expect(r.motivo).toMatch(/fuente registrada/)
  })

  it('tolera entradas incompletas sin romper', () => {
    expect(clasificarContenedorInstitucional({}).esContenedor).toBe(false)
    expect(clasificarContenedorInstitucional({ articulosActivos: 1, boeUrl: '   ', textoPrimerArticulo: null }).esContenedor).toBe(false)
  })

  it('una fuente en blanco cuenta como SIN fuente', () => {
    const r = clasificarContenedorInstitucional({ ...CONTENEDOR, boeUrl: '   ' })
    expect(r.esContenedor).toBe(true)
  })
})
