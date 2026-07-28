/**
 * Detector de artículos con el texto INCOMPLETO (T-241).
 *
 * Caso que lo motiva: al art. 4.9 del RGPD le faltaba en nuestra BD el párrafo segundo entero
 * («no se considerarán destinatarios las autoridades públicas que puedan recibir datos personales
 * en el marco de una investigación concreta…»). La explicación de una pregunta lo citaba
 * correctamente y el detector de citas la acusó de inventarse la cita: el defecto no era de la
 * explicación sino del artículo.
 */
const path = require('path')
const { articuloTruncado } = require(path.join(process.cwd(), 'lib/laws/articuloTruncado.js'))

const OFICIAL_4_9 =
  '«destinatario»: la persona física o jurídica, autoridad pública, servicio u otro organismo al ' +
  'que se comuniquen datos personales, se trate o no de un tercero. No obstante, no se considerarán ' +
  'destinatarios las autoridades públicas que puedan recibir datos personales en el marco de una ' +
  'investigación concreta de conformidad con el Derecho de la Unión o de los Estados miembros; el ' +
  'tratamiento de tales datos por dichas autoridades públicas será conforme con las normas en ' +
  'materia de protección de datos aplicables a los fines del tratamiento.'

describe('articuloTruncado', () => {
  test('CASO REAL RGPD 4.9: falta el párrafo final → truncado', () => {
    const nuestro = OFICIAL_4_9.slice(0, OFICIAL_4_9.indexOf('No obstante'))
    expect(articuloTruncado(nuestro, OFICIAL_4_9)).not.toBeNull()
  })

  test('el mismo texto completo → no truncado', () => {
    expect(articuloTruncado(OFICIAL_4_9, OFICIAL_4_9)).toBeNull()
  })

  test('tolera ruido tipográfico: tildes, comillas y espacios no deciden', () => {
    const conRuido = OFICIAL_4_9.replace(/«|»/g, '"').replace(/\s+/g, '  ').toUpperCase()
    expect(articuloTruncado(conRuido, OFICIAL_4_9)).toBeNull()
  })

  test('NO concluye cuando el oficial es demasiado corto (mejor callar que acusar)', () => {
    expect(articuloTruncado('Los españoles son mayores de edad a los dieciocho años.',
                            'Los españoles son mayores de edad a los dieciocho años.')).toBeNull()
    expect(articuloTruncado('cualquier cosa', 'texto oficial corto')).toBeNull()
  })

  test('un artículo con MÁS texto que el oficial (notas propias) no se marca si conserva el final', () => {
    expect(articuloTruncado(OFICIAL_4_9 + ' [Nota interna de estudio]', OFICIAL_4_9)).toBeNull()
  })
})
