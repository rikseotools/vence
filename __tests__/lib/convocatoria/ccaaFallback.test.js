const {
  CCAA_FALLBACK,
  normalizeCcaaKey,
  urlFallbackPorCcaa,
} = require('../../../lib/convocatoria/ccaaFallback.cjs')

describe('ccaaFallback — resolución del portal oficial por CCAA (T-616)', () => {
  describe('el caso que lo motiva: la etiqueta trae el boletín pegado', () => {
    // Medido el 06/08/2026: `regional_scan` emite la CCAA con el sufijo del
    // boletín y el mapa tenía las claves desnudas → "por CCAA: 0" asignaciones.
    const CON_SUFIJO = [
      ['Castilla y León (BOCYL)', 'Castilla y León'],
      ['C. Valenciana (DOGV)', 'C. Valenciana'],
      ['Canarias (BOC)', 'Canarias'],
      ['Navarra (BON)', 'Navarra'],
    ]
    it.each(CON_SUFIJO)('resuelve %s igual que %s', (conSufijo, desnuda) => {
      expect(urlFallbackPorCcaa(conSufijo)).toBe(urlFallbackPorCcaa(desnuda))
      expect(urlFallbackPorCcaa(conSufijo)).toEqual(expect.stringMatching(/^https:\/\//))
    })
  })

  it('País Vasco, que el mapa no tenía, ya resuelve (URL medida)', () => {
    expect(urlFallbackPorCcaa('País Vasco')).toContain('euskadi.eus')
    expect(urlFallbackPorCcaa('Euskadi')).toBe(urlFallbackPorCcaa('País Vasco'))
  })

  it('NO inventa portal para las CCAA cuya URL no se pudo medir', () => {
    // Medido el 06/08/2026: gencat / carm / asturias devuelven fetch_error con
    // las cabeceras del cron. Apuntarlas haría leer el mapa como "cubierta".
    for (const ccaa of ['Cataluña', 'Murcia (BORM)', 'Asturias (BOPA)', 'Baleares', 'Extremadura']) {
      expect(urlFallbackPorCcaa(ccaa)).toBeNull()
    }
  })

  it('sigue aceptando los códigos numéricos del PAG para Ceuta y Melilla', () => {
    // El agregador identifica las ciudades autónomas por código, no por nombre:
    // los dos espacios de claves conviven a propósito.
    expect(urlFallbackPorCcaa('51')).toContain('ceuta.es')
    expect(urlFallbackPorCcaa('52')).toContain('melilla.es')
    expect(urlFallbackPorCcaa('Melilla (BOME)')).toBe(urlFallbackPorCcaa('52'))
    expect(urlFallbackPorCcaa('Ciudad Autónoma de Melilla')).toBe(urlFallbackPorCcaa('52'))
  })

  it('acepta las variantes con que cada capa nombra la misma comunidad', () => {
    expect(urlFallbackPorCcaa('Comunitat Valenciana')).toBe(urlFallbackPorCcaa('C. Valenciana'))
    expect(urlFallbackPorCcaa('Castilla La Mancha')).toBe(urlFallbackPorCcaa('Castilla-La Mancha'))
    expect(urlFallbackPorCcaa('Euskadi')).toBe(urlFallbackPorCcaa('País Vasco'))
  })

  describe('no reconocer es un resultado legítimo, no un fallo', () => {
    // Devolver null hace que el llamador la reporte como "sin match". Inventarse
    // una URL sería peor: aparenta vigilancia y no vigila nada.
    it.each([[null], [undefined], [''], ['España'], ['España (agregador)'], ['Estado (BOE)'], ['Portugal']])(
      'devuelve null para %s',
      (label) => {
        expect(urlFallbackPorCcaa(label)).toBeNull()
      },
    )
  })

  it('normalizeCcaaKey quita sufijo, acentos y puntuación', () => {
    expect(normalizeCcaaKey('Castilla y León (BOCYL)')).toBe('castilla y leon')
    expect(normalizeCcaaKey('C. Valenciana')).toBe('c valenciana')
    expect(normalizeCcaaKey('  Aragón  ')).toBe('aragon')
  })

  it('ninguna URL del mapa está vacía ni es http plano', () => {
    for (const [k, url] of Object.entries(CCAA_FALLBACK)) {
      expect(`${k} → ${url}`).toEqual(expect.stringMatching(/ → https:\/\/\S+$/))
    }
  })
})
