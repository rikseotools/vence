const { claveNumero, emparejarArticulos } = require('../../../lib/salud/emparejarArticulos')

const art = (id, n) => ({ id, article_number: n })

describe('claveNumero', () => {
  it('iguala el caso real que bloqueaba la consolidación (37 quater / 37 quáter)', () => {
    expect(claveNumero('37 quater')).toBe(claveNumero('37 quáter'))
  })

  it('tolera mayúsculas, espacios repetidos y puntuación de relleno', () => {
    expect(claveNumero('  Art.  5 ')).toBe(claveNumero('art 5'))
    expect(claveNumero('PREÁMBULO')).toBe(claveNumero('preambulo'))
  })

  it('NO confunde ordinales distintos: bis, ter y quater son artículos distintos', () => {
    const k = ['37', '37 bis', '37 ter', '37 quater'].map(claveNumero)
    expect(new Set(k).size).toBe(4)
  })

  it('NO confunde números distintos', () => {
    expect(claveNumero('37')).not.toBe(claveNumero('137'))
    expect(claveNumero('3')).not.toBe(claveNumero('3.1'))
  })
})

describe('emparejarArticulos', () => {
  const viva = [art('v1', '37'), art('v2', '37 bis'), art('v3', '37 quáter'), art('v4', '38')]

  it('empareja por igualdad exacta y lo marca como tal', () => {
    const r = emparejarArticulos([art('m1', '38')], viva)
    expect(r.mapeo).toHaveLength(1)
    expect(r.mapeo[0]).toMatchObject({ exacto: true })
    expect(r.mapeo[0].a.id).toBe('v4')
  })

  it('empareja tras normalizar y lo SEÑALA (exacto=false) para que se revise', () => {
    const r = emparejarArticulos([art('m1', '37 quater')], viva)
    expect(r.mapeo[0].a.id).toBe('v3')
    expect(r.mapeo[0].exacto).toBe(false)
  })

  it('deja en soloEnMuerta lo que no existe en la superviviente', () => {
    const r = emparejarArticulos([art('m1', 'preámbulo')], viva)
    expect(r.mapeo).toHaveLength(0)
    expect(r.soloEnMuerta.map((a) => a.id)).toEqual(['m1'])
  })

  it('NO empareja cuando hay ambigüedad: adivinar movería contenido a ciegas', () => {
    const vivaAmbigua = [art('v1', '37 quater'), art('v2', '37 quáter')]
    const r = emparejarArticulos([art('m1', '37 quater')], vivaAmbigua)
    expect(r.mapeo).toHaveLength(0)
    expect(r.ambiguos).toHaveLength(1)
    expect(r.ambiguos[0].candidatos).toHaveLength(2)
  })

  it('un artículo con ordinal distinto NO se empareja con su hermano', () => {
    // "37 ter" no existe en la superviviente: tiene que salir como sin pareja,
    // NUNCA emparejado con "37 bis" ni con "37".
    const r = emparejarArticulos([art('m1', '37 ter')], viva)
    expect(r.mapeo).toHaveLength(0)
    expect(r.soloEnMuerta.map((a) => a.article_number)).toEqual(['37 ter'])
  })

  it('reparte correctamente un lote mixto', () => {
    const muerta = [art('m1', '37'), art('m2', '37 quater'), art('m3', 'preámbulo'), art('m4', '99')]
    const r = emparejarArticulos(muerta, viva)
    expect(r.mapeo.map((m) => m.de.id).sort()).toEqual(['m1', 'm2'])
    expect(r.soloEnMuerta.map((a) => a.id).sort()).toEqual(['m3', 'm4'])
    expect(r.ambiguos).toHaveLength(0)
  })
})
