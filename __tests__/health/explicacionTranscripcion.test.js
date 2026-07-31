const {
  clasificaTranscripcion,
  tieneAnalisisPorOpcion,
  quitaPreambulo,
  normaliza,
  COBERTURA_CASI,
} = require('../../lib/health/explicacionTranscripcion.cjs')

// ── Núcleo del cubo «explicación = transcripción del artículo» ───────────────
//
// El caso que lo funda es real (impugnación e60091bd, 31/07/2026): una pregunta con 46% de
// acierto en 130 exposiciones cuya explicación entera era el artículo 137 CE copiado. La
// impugnante creía que la clave estaba mal; la clave estaba bien y lo que faltaba era la
// explicación. Los textos de abajo son ese caso y sus vecinos del banco.

const ART_137 =
  'El Estado se organiza territorialmente en municipios, en provincias y en las Comunidades ' +
  'Autónomas que se constituyan. Todas estas entidades gozan de autonomía para la gestión de ' +
  'sus respectivos intereses.'

describe('clasificaTranscripcion — copia literal', () => {
  it('marca `literal` la explicación que es el artículo con su encabezado de referencia', () => {
    const r = clasificaTranscripcion({
      explanation: `Constitución Española.\nArtículo 137.\n${ART_137}`,
      articleContent: ART_137,
    })
    expect(r.clase).toBe('literal')
    expect(r.motivo).toBe('contenida_en_el_articulo')
  })

  it('marca `literal` aunque cambien saltos de línea, mayúsculas y tildes del maquetado', () => {
    const r = clasificaTranscripcion({
      explanation: 'Según el artículo 137 de la Constitución:\n\nEL ESTADO SE ORGANIZA ' +
        'TERRITORIALMENTE EN MUNICIPIOS,   EN PROVINCIAS Y EN LAS COMUNIDADES AUTONOMAS QUE SE ' +
        'CONSTITUYAN.',
      articleContent: ART_137,
    })
    expect(r.clase).toBe('literal')
  })
})

describe('clasificaTranscripcion — casi literal', () => {
  it('marca `casi` la copia que compacta el texto pero no aporta vocabulario propio', () => {
    const r = clasificaTranscripcion({
      // Mismas palabras del artículo, reordenadas: no aporta ni una palabra propia.
      explanation: 'Todas estas entidades (municipios, provincias y Comunidades Autónomas que ' +
        'se constituyan) gozan de autonomía para la gestión de sus respectivos intereses; así ' +
        'se organiza territorialmente el Estado.',
      articleContent: ART_137,
    })
    expect(r.clase).toBe('casi')
    expect(r.cobertura).toBeGreaterThanOrEqual(COBERTURA_CASI)
  })
})

describe('clasificaTranscripcion — lo que NO es este defecto', () => {
  it('no marca la explicación que razona opción por opción, aunque cite el artículo entero', () => {
    const r = clasificaTranscripcion({
      explanation: `${ART_137}\n\n**A)** INCORRECTA. El artículo 147 regula los Estatutos.\n\n` +
        '**C)** CORRECTA. Es el precepto que reconoce la autonomía.',
      articleContent: ART_137,
    })
    expect(r.clase).toBeNull()
    expect(r.motivo).toBe('analiza_opciones')
  })

  it('no marca la explicación que aporta razonamiento propio', () => {
    const r = clasificaTranscripcion({
      explanation: 'Conviene no confundir este precepto con el que garantiza expresamente la ' +
        'autonomía municipal y atribuye el gobierno del municipio al Ayuntamiento: aquel llega ' +
        'después y desarrolla la garantía institucional, mientras que aquí solo se enuncia el ' +
        'principio general aplicable también a diputaciones y cabildos insulares.',
      articleContent: ART_137,
    })
    expect(r.clase).toBeNull()
    expect(r.motivo).toBe('aporta_texto_propio')
  })

  it('no clasifica sobre textos demasiado cortos ni sin artículo', () => {
    expect(clasificaTranscripcion({ explanation: 'Es el 137.', articleContent: ART_137 }).motivo)
      .toBe('demasiado_corta')
    expect(clasificaTranscripcion({ explanation: ART_137, articleContent: null }).motivo)
      .toBe('sin_datos')
  })
})

describe('tieneAnalisisPorOpcion — la puerta que evita marcar explicaciones buenas', () => {
  it.each([
    ['**A)** INCORRECTA. …', true],
    ['- **B** El plazo es de diez días', true],
    ['La opción marcada es CORRECTA porque el plazo es de diez días', true],
    ['**Por qué las demás son incorrectas:**', true],
    ['El artículo fija un plazo de diez días hábiles.', false],
  ])('%s → %s', (texto, esperado) => {
    expect(tieneAnalisisPorOpcion(texto)).toBe(esperado)
  })
})

describe('quitaPreambulo — poda la referencia que ponemos nosotros, no el contenido', () => {
  it('quita el encabezado de norma y artículo', () => {
    expect(quitaPreambulo(normaliza('Constitución Española. Artículo 137. El Estado se organiza')))
      .toBe('el estado se organiza')
    expect(quitaPreambulo(normaliza('Según el artículo 19.1, para la válida constitución')))
      .toBe('para la valida constitucion')
  })

  it('no se come el texto cuando no hay preámbulo', () => {
    expect(quitaPreambulo(normaliza('El Estado se organiza territorialmente')))
      .toBe('el estado se organiza territorialmente')
  })
})
