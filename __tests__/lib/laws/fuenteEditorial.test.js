// [T-144] Registrar la fuente oficial de un contenedor editorial (ODM, Agenda 2030, planes de
// Gobierno Abierto, Protocolos UE…) para desbloquear el Paso 1 del manual. El riesgo es el
// mismo que motivó T-395 (lib/laws/completeness.ts): un `is_ok:true` sin verificación real es
// un falso verde. Estos tests fijan que el validador lo impide por construcción.

const {
  validarEntradaFuenteEditorial,
  validarPlanFuenteEditorial,
  resumenFuenteEditorial,
} = require('@/lib/laws/fuenteEditorial')

const ENTRADA_OK = {
  lawId: 'a450177e-d787-4cb3-996d-dbe15cc95c99',
  nombre: 'Objetivos de Desarrollo del Milenio (2000-2015)',
  fuenteUrl: 'https://www.un.org/millenniumgoals/',
  mensaje: 'Portal oficial ONU: los 8 títulos coinciden exactos con los 8 artículos en BD, verificado en vivo.',
  paso1Completo: false,
}

describe('validarEntradaFuenteEditorial', () => {
  it('acepta una entrada bien formada con paso1Completo:false', () => {
    expect(validarEntradaFuenteEditorial(ENTRADA_OK)).toEqual({ ok: true })
  })

  it('rechaza un lawId que no es uuid', () => {
    const r = validarEntradaFuenteEditorial({ ...ENTRADA_OK, lawId: 'no-es-un-uuid' })
    expect(r.ok).toBe(false)
    expect(r.problema).toMatch(/uuid/)
  })

  it('rechaza una fuenteUrl que no es http(s)', () => {
    const r = validarEntradaFuenteEditorial({ ...ENTRADA_OK, fuenteUrl: 'ftp://algo.com' })
    expect(r.ok).toBe(false)
    expect(r.problema).toMatch(/URL http/)
  })

  it('rechaza un mensaje demasiado corto (sello sin contenido)', () => {
    const r = validarEntradaFuenteEditorial({ ...ENTRADA_OK, mensaje: 'ok, revisado' })
    expect(r.ok).toBe(false)
    expect(r.problema).toMatch(/corto/)
  })

  it('exige paso1Completo explícito (no se asume ni true ni false)', () => {
    const { paso1Completo, ...sinCampo } = ENTRADA_OK
    const r = validarEntradaFuenteEditorial(sinCampo)
    expect(r.ok).toBe(false)
    expect(r.problema).toMatch(/explícito/)
  })

  it('EL RIESGO CENTRAL: paso1Completo:true exige que el mensaje describa una comparación real, no una frase genérica', () => {
    const r = validarEntradaFuenteEditorial({
      ...ENTRADA_OK,
      paso1Completo: true,
      mensaje: 'Todo correcto, fuente registrada y lista para usar sin más.',
    })
    expect(r.ok).toBe(false)
    expect(r.problema).toMatch(/no describe una comparación real/)
  })

  it('paso1Completo:true SÍ se acepta cuando el mensaje describe la comparación', () => {
    const r = validarEntradaFuenteEditorial({
      ...ENTRADA_OK,
      paso1Completo: true,
      mensaje: 'Verificado artículo a artículo contra la fuente: los 8 objetivos y sus 21 metas coinciden letra por letra.',
    })
    expect(r.ok).toBe(true)
  })
})

describe('validarPlanFuenteEditorial', () => {
  it('rechaza un plan vacío', () => {
    expect(validarPlanFuenteEditorial([]).ok).toBe(false)
  })

  it('acepta un plan de varias entradas válidas y distintas', () => {
    const otra = { ...ENTRADA_OK, lawId: '466fb9ed-5f90-402f-b15a-885ca1002309', nombre: 'Agenda 2030' }
    const r = validarPlanFuenteEditorial([ENTRADA_OK, otra])
    expect(r.ok).toBe(true)
    expect(r.problemas).toEqual([])
  })

  it('rechaza lawId duplicado dentro del mismo plan', () => {
    const r = validarPlanFuenteEditorial([ENTRADA_OK, { ...ENTRADA_OK, nombre: 'Duplicado' }])
    expect(r.ok).toBe(false)
    expect(r.problemas.some((p) => p.includes('duplicado'))).toBe(true)
  })

  it('acumula TODOS los problemas del plan, no solo el primero', () => {
    const rota1 = { ...ENTRADA_OK, lawId: 'no-uuid' }
    const rota2 = { ...ENTRADA_OK, lawId: '466fb9ed-5f90-402f-b15a-885ca1002309', mensaje: 'corto' }
    const r = validarPlanFuenteEditorial([rota1, rota2])
    expect(r.problemas.length).toBe(2)
  })
})

describe('resumenFuenteEditorial', () => {
  it('con paso1Completo:false deja is_ok:false — nunca "verificado" a medias', () => {
    const r = resumenFuenteEditorial(ENTRADA_OK, '2026-08-07T10:00:00.000Z')
    expect(r.is_ok).toBe(false)
    expect(r.no_consolidated_text).toBe(true)
    expect(r.source).toBe(ENTRADA_OK.fuenteUrl)
    expect(r.message).toBe(ENTRADA_OK.mensaje)
    expect(r.via).toBe('fuente_editorial_registrada')
  })

  it('con paso1Completo:true, is_ok pasa a true', () => {
    const r = resumenFuenteEditorial({ ...ENTRADA_OK, paso1Completo: true }, '2026-08-07T10:00:00.000Z')
    expect(r.is_ok).toBe(true)
  })

  it('nunca incluye is_virtual — eso es una exención distinta (contenedorInstitucional.js)', () => {
    const r = resumenFuenteEditorial(ENTRADA_OK, '2026-08-07T10:00:00.000Z')
    expect(r).not.toHaveProperty('is_virtual')
  })
})
