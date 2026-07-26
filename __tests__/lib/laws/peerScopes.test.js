const { parecidoEpigrafe, rankPeers, mejorReferencia } = require('@/lib/laws/peerScopes')

// Epígrafes REALES del banco (26/07/2026).
const MADRID_T14 = 'Los recursos administrativos: concepto y clases. Las reclamaciones económicoadministrativas: nociones básicas. La Jurisdicción Contencioso-Administrativa: Su organización. Las partes. Actos impugnables. Las fases principales del procedimiento contencioso-administrativo.'
const AUX_MADRID_T7 = 'La Jurisdicción Contencioso-Administrativa: Su organización. Las partes. Actos impugnables. Las fases principales del procedimiento contencioso-administrativo.'
const OTRO_TEMA = 'El patrimonio único de la seguridad social: titularidad, adscripción, administración y custodia. El Fondo de Reserva.'

describe('parecidoEpigrafe', () => {
  test('el hermano con la misma frase literal puntúa alto', () => {
    expect(parecidoEpigrafe(MADRID_T14, AUX_MADRID_T7)).toBeGreaterThan(0.5)
  })

  test('materias distintas puntúan bajo aunque sean del mismo mundo administrativo', () => {
    expect(parecidoEpigrafe(MADRID_T14, OTRO_TEMA)).toBeLessThan(0.15)
  })

  test('las palabras de relleno no inflan el parecido', () => {
    // "concepto y clases", "nociones básicas", "referencia", "estudio particular"… aparecen en
    // medio banco: si contaran, cualquier par de epígrafes administrativos parecería hermano.
    const a = 'Los recursos: concepto y clases. Nociones básicas. Estudio particular.'
    const b = 'El presupuesto: concepto y clases. Nociones básicas. Estudio particular.'
    expect(parecidoEpigrafe(a, b)).toBeLessThan(0.5)
  })

  test('vacíos → 0, nunca NaN', () => {
    expect(parecidoEpigrafe('', AUX_MADRID_T7)).toBe(0)
    expect(parecidoEpigrafe(null, null)).toBe(0)
  })
})

describe('rankPeers / mejorReferencia', () => {
  const peers = [
    { pt: 'auxiliar_administrativo_madrid', epigrafe: AUX_MADRID_T7, scoped: 75, verificado: true },
    { pt: 'administrativo_aragon', epigrafe: 'La jurisdicción contencioso-administrativa. Su organización. Las partes. Actos impugnables. Idea general del proceso.', scoped: null, verificado: false },
    { pt: 'otra', epigrafe: OTRO_TEMA, scoped: 4, verificado: true },
  ]

  test('ordena por parecido y marca el hermano en el que apoyarse', () => {
    const r = rankPeers({ epigrafe: MADRID_T14 }, peers)
    expect(r[0].pt).toBe('auxiliar_administrativo_madrid')
    expect(r[0].util).toBe(true)
  })

  test('un hermano que tiene la ley ENTERA no sirve de referencia', () => {
    // Es el caso que hay que adjudicar, no la respuesta.
    const soloEnteros = peers.map((p) => ({ ...p, scoped: null }))
    expect(mejorReferencia({ epigrafe: MADRID_T14 }, soloEnteros).hay).toBe(false)
  })

  test('un hermano parecido pero SIN verificar se ofrece como pista, no como referencia', () => {
    const sinVerificar = [{ ...peers[0], verificado: false }]
    const r = mejorReferencia({ epigrafe: MADRID_T14 }, sinVerificar)
    expect(r.hay).toBe(false)
    expect(r.motivo).toMatch(/NO está verificado/)
    expect(r.peer.pt).toBe('auxiliar_administrativo_madrid')
  })

  test('sin hermanos parecidos lo dice, en vez of inventar una referencia', () => {
    const r = mejorReferencia({ epigrafe: MADRID_T14 }, [peers[2]])
    expect(r.hay).toBe(false)
    expect(r.peer).toBeNull()
  })

  test('la referencia trae el tamaño, que es lo que se cita al adjudicar', () => {
    expect(mejorReferencia({ epigrafe: MADRID_T14 }, peers).motivo).toMatch(/75 arts/)
  })
})
