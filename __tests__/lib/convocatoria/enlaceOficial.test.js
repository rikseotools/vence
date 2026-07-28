const { esOepSinConvocatoria, enlaceOficialEfectivo, rotuloEnlaceOficial, ESTADOS_SIN_CONVOCATORIA } =
  require('@/lib/convocatoria/enlaceOficial.cjs')

// Núcleo compartido por la PÁGINA (enlace + rótulo del botón oficial) y por el DETECTOR de enlaces.
// Existe porque esta regla vivía en un ternario suelto dentro de `app/[oposicion]/page.tsx` y los
// vigilantes no la conocían: juzgaban `programa_url` a pelo y marcaban URLs que nadie ve.

describe('esOepSinConvocatoria', () => {
  it('los estados PREVIOS a la convocatoria', () => {
    expect(esOepSinConvocatoria('sin_oep')).toBe(true)
    expect(esOepSinConvocatoria('oep_aprobada')).toBe(true)
  })

  it('con convocatoria (o posterior) es false', () => {
    expect(esOepSinConvocatoria('inscripcion_abierta')).toBe(false)
    expect(esOepSinConvocatoria('examen_realizado')).toBe(false)
  })

  it('lista NEGRA a propósito: un estado nuevo se trata como "hay convocatoria"', () => {
    // Permisivo, igual que se comportaba el sistema antes de existir el criterio. Con lista blanca,
    // añadir un estado dejaría landings mudas sin que nadie lo notara.
    expect(esOepSinConvocatoria('estado_que_no_existe_todavia')).toBe(false)
  })

  it('sin estado se asume `sin_oep` (lo más conservador: aún no hay convocatoria)', () => {
    expect(esOepSinConvocatoria(null)).toBe(true)
    expect(esOepSinConvocatoria(undefined)).toBe(true)
  })

  it('la lista de estados está congelada aquí, no repartida por el código', () => {
    expect([...ESTADOS_SIN_CONVOCATORIA].sort()).toEqual(['oep_aprobada', 'sin_oep'])
  })
})

describe('enlaceOficialEfectivo — el enlace que la landing enseña DE VERDAD', () => {
  const programaUrl = 'https://ejemplo.es/temario.pdf'
  const enlaceOep = 'https://boja.es/BOJA25-225-00003.pdf'

  it('sin convocatoria y CON documento de OEP → el documento de la OEP', () => {
    expect(enlaceOficialEfectivo({ estadoProceso: 'oep_aprobada', enlaceOep, programaUrl })).toBe(enlaceOep)
  })

  it('sin convocatoria y SIN documento → cae a programa_url', () => {
    expect(enlaceOficialEfectivo({ estadoProceso: 'oep_aprobada', enlaceOep: null, programaUrl })).toBe(programaUrl)
  })

  it('CON convocatoria publicada manda programa_url aunque exista documento de OEP', () => {
    expect(enlaceOficialEfectivo({ estadoProceso: 'inscripcion_abierta', enlaceOep, programaUrl })).toBe(programaUrl)
  })

  it('sin ningún enlace devuelve null, no undefined (contrato estable para el detector)', () => {
    expect(enlaceOficialEfectivo({ estadoProceso: 'oep_aprobada', enlaceOep: null, programaUrl: null })).toBeNull()
    expect(enlaceOficialEfectivo({ estadoProceso: 'inscripcion_abierta', enlaceOep: null, programaUrl: undefined })).toBeNull()
  })
})

describe('rotuloEnlaceOficial — lo que el botón PROMETE', () => {
  // Importa para juzgar: "Ver OEP en BOJA" no promete la convocatoria, así que enlazar el decreto
  // de la OEP (o incluso un temario) no es engañar; bajo "Ver convocatoria en BOJA" sí lo sería.
  it('sin convocatoria promete la OEP', () => {
    expect(rotuloEnlaceOficial({ estadoProceso: 'oep_aprobada', diarioOficial: 'BOJA' })).toBe('Ver OEP en BOJA')
  })

  it('con convocatoria promete la convocatoria', () => {
    expect(rotuloEnlaceOficial({ estadoProceso: 'inscripcion_abierta', diarioOficial: 'DOCM' })).toBe('Ver convocatoria en DOCM')
  })

  it('sin etiqueta cae a BOE (mismo defecto que la landing)', () => {
    expect(rotuloEnlaceOficial({ estadoProceso: 'inscripcion_abierta', diarioOficial: null })).toBe('Ver convocatoria en BOE')
  })
})
