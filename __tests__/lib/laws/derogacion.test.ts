import {
  detectarDerogacionTotal,
  derogadaSegunMetadatos,
  esDerogacionTotal,
  gravedadDerogada,
} from '@/lib/laws/derogacion'

/**
 * [T-655] — el caso que lo estrena es REAL y su JSON está copiado del BOE tal cual
 * (`legislacion-consolidada/id/BOE-A-2015-4621/analisis`, consultado el 07/08/2026). Escribir el
 * fixture a mano sería probar el detector contra lo que yo creo que devuelve el BOE, que es
 * exactamente el error que este detector existe para no repetir.
 */
const ANALISIS_CABILDOS = {
  data: [{
    referencias: {
      posteriores: [{
        posterior: [
          { id_norma: 'BOE-A-2015-7654', relacion: { codigo: '110', texto: 'SE MODIFICA' }, texto: 'los arts. 54.5, 76.2, 91.1 y la disposición final 1, por Ley 11/2015, de 29 de diciembre' },
          { id_norma: 'BOE-A-2017-1234', relacion: { codigo: '120', texto: 'SE AÑADE' }, texto: 'la disposición adicional 3, por Ley 7/2017, de 27 de diciembre' },
          { id_norma: 'BOE-A-2026-17189', relacion: { codigo: '210', texto: 'SE DEROGA' }, texto: ', por Ley 3/2026, de 16 de junio' },
        ],
      }],
    },
  }],
}

describe('detectarDerogacionTotal — el caso real de la Ley 8/2015 de Cabildos Insulares', () => {
  it('la reconoce y dice POR QUÉ NORMA, para poder citarlo sin reescribirlo', () => {
    const d = detectarDerogacionTotal(ANALISIS_CABILDOS)
    expect(d).not.toBeNull()
    expect(d!.porNormaId).toBe('BOE-A-2026-17189')
    expect(d!.textoLiteral).toContain('SE DEROGA')
    expect(d!.textoLiteral).toContain('Ley 3/2026')
  })

  it('las modificaciones y añadidos NO la marcan derogada', () => {
    const soloCambios = { data: [{ referencias: { posteriores: [{ posterior: ANALISIS_CABILDOS.data[0].referencias.posteriores[0].posterior.slice(0, 2) }] } }] }
    expect(detectarDerogacionTotal(soloCambios)).toBeNull()
  })
})

describe('esDerogacionTotal — la distinción que hace usable al detector', () => {
  it('ENTERA: el BOE no nombra preceptos, empieza por la coma de la norma derogatoria', () => {
    expect(esDerogacionTotal(', por Ley 3/2026, de 16 de junio')).toBe(true)
    expect(esDerogacionTotal('la norma, por Ley 3/2026, de 16 de junio')).toBe(true)
  })

  it('PARCIAL: si nombra artículos o disposiciones, la ley SIGUE viva', () => {
    // Una ley grande acumula estas durante años: tratarlas como derogación total llenaría el
    // badge de ruido y el detector se acabaría ignorando.
    expect(esDerogacionTotal('el art. 5, por Ley 11/2015, de 29 de diciembre')).toBe(false)
    expect(esDerogacionTotal('los arts. 61.2 y 92, por Ley 8/2019, de 9 de abril')).toBe(false)
    expect(esDerogacionTotal('la disposición adicional 4, por Ley 7/2018')).toBe(false)
    expect(esDerogacionTotal('el capítulo III del título II, por Ley 1/2020')).toBe(false)
  })

  it('sin texto no afirma nada (una respuesta a medias no puede retirar una ley del temario)', () => {
    expect(esDerogacionTotal('')).toBe(false)
    expect(esDerogacionTotal(null)).toBe(false)
    expect(esDerogacionTotal(undefined)).toBe(false)
  })
})

describe('detectarDerogacionTotal — robustez ante lo que el BOE devuelva', () => {
  it('un análisis vacío o con otra forma no revienta ni inventa una derogación', () => {
    expect(detectarDerogacionTotal(null)).toBeNull()
    expect(detectarDerogacionTotal({})).toBeNull()
    expect(detectarDerogacionTotal({ data: [] })).toBeNull()
    expect(detectarDerogacionTotal({ data: [{ referencias: {} }] })).toBeNull()
    expect(detectarDerogacionTotal({ data: [{ referencias: { posteriores: 'no es lista' } }] })).toBeNull()
  })

  it('con dos derogaciones se queda con la ÚLTIMA publicada, que es la que decide', () => {
    const dos = { data: [{ referencias: { posteriores: [{ posterior: [
      { id_norma: 'BOE-A-2020-1', relacion: { texto: 'SE DEROGA' }, texto: ', por Ley 1/2020' },
      { id_norma: 'BOE-A-2026-17189', relacion: { texto: 'SE DEROGA' }, texto: ', por Ley 3/2026, de 16 de junio' },
    ] }] } }] }
    expect(detectarDerogacionTotal(dos)!.porNormaId).toBe('BOE-A-2026-17189')
  })
})

describe('gravedadDerogada — una ley muerta que nadie estudia no es una urgencia', () => {
  it('ERROR si sostiene temas vivos: hay gente estudiando normativa que ya no existe', () => {
    expect(gravedadDerogada({ temasQueLaSirven: 1, preguntasActivas: 751 })).toBe('error')
  })

  it('WARN si no la sirve ningún tema: es deuda del catálogo, no daño a un alumno', () => {
    expect(gravedadDerogada({ temasQueLaSirven: 0, preguntasActivas: 300 })).toBe('warn')
  })
})

describe('REGRESIÓN: el falso positivo que apareció al estrenarlo (07/08/2026)', () => {
  // Texto REAL del RDL 8/2015 (Ley General de la Seguridad Social), copiado del BOE. Empieza por
  // coma —como una derogación total— pero lo que cae es un artículo. La sirven 47 temas con 674
  // preguntas activas: darla por derogada habría mandado a alguien a retirar del temario la Ley
  // General de la Seguridad Social.
  const TEXTO_REAL = ', con efectos desde el 1 de enero de 2023, el art. 312, la disposición final 6, SE MODIFICA determinados preceptos y SE AÑADE las disposiciones adicionales 49 a 50, por Real Decreto-ley 13/2022, de 26 de julio'

  it('una derogación PARCIAL con cláusula de efectos no cuenta como total', () => {
    expect(esDerogacionTotal(TEXTO_REAL)).toBe(false)
  })

  it('pero una TOTAL con cláusula de efectos sí, que es lo que la distingue', () => {
    expect(esDerogacionTotal(', con efectos de 30 de junio de 2026, por Ley 3/2026, de 16 de junio')).toBe(true)
  })

  it('y el barrido entero sobre ese análisis no la marca', () => {
    const rdl = { data: [{ referencias: { posteriores: [{ posterior: [
      { id_norma: 'BOE-A-2022-1', relacion: { texto: 'SE DEROGA' }, texto: TEXTO_REAL },
    ] }] } }] }
    expect(detectarDerogacionTotal(rdl)).toBeNull()
  })
})

describe('derogadaSegunMetadatos — la fuente AUTORITATIVA (07/08/2026)', () => {
  const meta = (estatus: string, fecha?: string) => ({ data: [{ estatus_derogacion: estatus, fecha_derogacion: fecha }] })

  it('los cinco casos REALES, con los valores que devuelve el BOE', () => {
    // Los mismos que costaron la calibración a mano de la heurística.
    expect(derogadaSegunMetadatos(meta('S', '20260630')).derogada).toBe(true)   // Cabildos
    expect(derogadaSegunMetadatos(meta('S', '20250520')).derogada).toBe(true)   // Extranjería
    expect(derogadaSegunMetadatos(meta('S', '20260508')).derogada).toBe(true)   // Orden HFP (la que la heurística NO veía)
    expect(derogadaSegunMetadatos(meta('N')).derogada).toBe(false)              // Seguridad Social (derogada en PARTE)
    expect(derogadaSegunMetadatos(meta('N')).derogada).toBe(false)              // TREBEP (vigente)
  })

  it('normaliza la fecha AAAAMMDD para no volver a parsearla en cada consumidor', () => {
    expect(derogadaSegunMetadatos(meta('S', '20260508')).fecha).toBe('2026-05-08')
  })

  it('sin fecha o con basura no inventa una', () => {
    expect(derogadaSegunMetadatos(meta('S')).fecha).toBeNull()
    expect(derogadaSegunMetadatos(meta('S', 'mayo')).fecha).toBeNull()
  })

  it('una respuesta vacía o rara NO da por derogada una ley viva', () => {
    expect(derogadaSegunMetadatos(null).derogada).toBe(false)
    expect(derogadaSegunMetadatos({}).derogada).toBe(false)
    expect(derogadaSegunMetadatos({ data: [{}] }).derogada).toBe(false)
  })
})
