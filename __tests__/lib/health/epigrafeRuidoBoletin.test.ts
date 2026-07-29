/**
 * @jest-environment node
 */
// Unitarios del núcleo PURO que detecta cabecera/pie de PDF de boletín incrustado en un epígrafe
// (T-171). Importa el módulo REAL de producción, nunca una copia.
//
// El caso de origen (27/07): en `ordenanza-ayuntamiento-cordoba` el T8 traía el pie del boletín
// PARTIENDO LA FRASE por la mitad, y el T10 el pie de firma entero. De los 4 «hallazgos» del
// barrido bank-wide, **2 eran falsos positivos por «Depósito legal»**, que es materia legítima en
// biblioteconomía — la mitad. Por eso ese término no puede acusar solo, y hay test que lo fija.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analizarEpigrafe, epigrafesSucios } = require('@/lib/health/epigrafeRuidoBoletin.cjs') as {
  analizarEpigrafe: (t: string | null | undefined) => {
    sucio: boolean; marcadores: string[]; ambiguosIgnorados: string[]
  }
  epigrafesSucios: (
    f: Array<{ slug?: string; tema?: number; epigrafe?: string | null }>,
  ) => Array<{ slug?: string; tema?: number; marcadores: string[] }>
}

// El texto REAL del tema 8 de Córdoba, con el pie partiendo la frase.
const T8_CORDOBA =
  'Prevención de riesgos laborales. Medidas preventivas y pautas de de la Provincia Este documento ' +
  'es una copia electrónica de un documento firmado. Fima automática 2F177891AA88 Nº 99 p. 7474 ' +
  'actuación ante incendios y emergencias.'

describe('analizarEpigrafe — el caso real de Córdoba', () => {
  it('CAZA el pie incrustado en mitad de la frase (T8)', () => {
    const r = analizarEpigrafe(T8_CORDOBA)
    expect(r.sucio).toBe(true)
    expect(r.marcadores.length).toBeGreaterThanOrEqual(2)
  })

  it('caza cada marcador inequívoco por separado', () => {
    for (const texto of [
      'Tema 3. Este documento es una copia electrónica de un documento original',
      'Tema 3. Código Seguro de Verificación: 2F177891AA88',
      'Tema 3. Powered by TCPDF (www.tcpdf.org)',
      'Tema 3. Fima automática 2F177891AA88',
      'Tema 3. Boletín Oficial de la Provincia de Alicante',
      'Tema 3. Nº 99 p. 7474',
    ]) {
      expect(analizarEpigrafe(texto).sucio).toBe(true)
    }
  })
})

describe('analizarEpigrafe — lo que NO puede marcar', () => {
  it('«Depósito legal» SOLO no acusa: es materia legítima de biblioteconomía', () => {
    // Fue la causa de 2 de los 4 hallazgos del barrido del 27/07 — la mitad eran falsos positivos.
    const r = analizarEpigrafe(
      'Tema 12. El Depósito legal: concepto, normativa reguladora y procedimiento de solicitud.',
    )
    expect(r.sucio).toBe(false)
    expect(r.ambiguosIgnorados).toContain('Depósito legal')
  })

  it('pero SÍ suma cuando ya hay un marcador inequívoco al lado', () => {
    const r = analizarEpigrafe(
      'Tema 12. Depósito legal. Boletín Oficial de la Provincia de Córdoba, Nº 99 p. 7474',
    )
    expect(r.sucio).toBe(true)
    expect(r.marcadores.some(m => /dep[óo]sito legal/i.test(m))).toBe(true)
  })

  it('un epígrafe normal sale limpio (el detector no nace encendido)', () => {
    for (const texto of [
      'Tema 1. La Constitución Española de 1978: estructura y contenido.',
      'Tema 5. El acto administrativo: concepto, clases y elementos.',
      'Tema 9. Procedimiento administrativo común de las Administraciones Públicas.',
    ]) {
      expect(analizarEpigrafe(texto).sucio).toBe(false)
    }
  })

  it('tolera nulo, vacío y no-cadena', () => {
    expect(analizarEpigrafe(null).sucio).toBe(false)
    expect(analizarEpigrafe(undefined).sucio).toBe(false)
    expect(analizarEpigrafe('').sucio).toBe(false)
    // @ts-expect-error — entrada inválida a propósito
    expect(analizarEpigrafe(42).sucio).toBe(false)
  })
})

describe('epigrafesSucios — el lote', () => {
  it('devuelve solo los sucios, con su evidencia', () => {
    const r = epigrafesSucios([
      { slug: 'ordenanza-ayuntamiento-cordoba', tema: 8, epigrafe: T8_CORDOBA },
      { slug: 'aux-admin-estado', tema: 1, epigrafe: 'Tema 1. La Constitución Española de 1978.' },
      { slug: 'biblioteconomia', tema: 12, epigrafe: 'Tema 12. El Depósito legal: concepto.' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].slug).toBe('ordenanza-ayuntamiento-cordoba')
    expect(r[0].marcadores.length).toBeGreaterThan(0)
  })

  it('lista vacía y ausencia de lista no rompen', () => {
    expect(epigrafesSucios([])).toEqual([])
    // @ts-expect-error — el llamador puede no tener nada que pasar
    expect(epigrafesSucios(undefined)).toEqual([])
  })
})
