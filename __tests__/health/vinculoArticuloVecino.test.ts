/**
 * Calibración del detector `vinculo_articulo_vecino` (lib/health/vinculoArticuloVecino.cjs).
 *
 * Los casos vienen de la medición del 29/07/2026 sobre datos reales. Lo que más importa aquí no es
 * lo que CAZA sino lo que DESCARTA: sin las dos exclusiones el detector acierta 1 de 3 y se vuelve
 * ruido que enseña a ignorar el panel.
 */
const {
  esExaminable,
  clasificarVinculo,
  recall,
  RE_NEGATIVA,
} = require('@/lib/health/vinculoArticuloVecino.cjs')

// LO 3/2007: el caso REAL que originó el detector (impugnación 769c089e).
const LO32007 = new Map<string, string>([
  ['36', 'Los medios de comunicación social de titularidad pública velarán por la transmisión de una imagen igualitaria, plural y no estereotipada de mujeres y hombres en la sociedad, y promoverán el conocimiento y la difusión del principio de igualdad entre mujeres y hombres.'],
  ['37', 'La Corporación RTVE, en el ejercicio de su función de servicio público, perseguirá en su programación los siguientes objetivos: a) Reflejar adecuadamente la presencia de las mujeres. b) Utilizar el lenguaje en forma no sexista. d) Colaborar con las campañas institucionales dirigidas a fomentar la igualdad entre mujeres y hombres y a erradicar la violencia contra las mujeres.'],
  ['38', 'En el ejercicio de sus actividades, la Agencia EFE velará por el respeto del principio de igualdad entre mujeres y hombres y perseguirá en su actuación los siguientes objetivos.'],
])

describe('caza el caso que lo originó', () => {
  it('la pregunta de RTVE colgada del art. 36 apunta al 37', () => {
    const v = clasificarVinculo({
      questionText: 'Perseguirá en su programación el objetivo de colaborar con las campañas institucionales dirigidas a fomentar la igualdad entre mujeres y hombres:',
      correctText: 'La Corporación RTVE, en el ejercicio de su función de servicio público.',
      articleNumber: '36',
      articulosDeLaLey: LO32007,
    })
    expect(v.sospechoso).toBe(true)
    expect(v.sugerido).toBe('37')
  })

  it('una vez re-vinculada al 37, deja de marcarla', () => {
    const v = clasificarVinculo({
      questionText: 'Perseguirá en su programación el objetivo de colaborar con las campañas institucionales:',
      correctText: 'La Corporación RTVE, en el ejercicio de su función de servicio público.',
      articleNumber: '37',
      articulosDeLaLey: LO32007,
    })
    expect(v.sospechoso).toBe(false)
  })
})

describe('las exclusiones, que son lo que sostiene la precisión', () => {
  it('descarta «señale la INCORRECTA»: ahí el desajuste es POR DISEÑO', () => {
    // Caso real (CE): la respuesta correcta de una pregunta sobre PARTIDOS políticos es el texto de
    // los SINDICATOS (art. 7) precisamente porque es la que no encaja. El vínculo al art. 6 es el bueno.
    const v = esExaminable({
      questionText: 'Señale la respuesta incorrecta. Como señala la Constitución Española, los partidos políticos:',
      correctText: 'Contribuyen a la defensa y promoción de los intereses económicos y sociales que les son propios.',
    })
    expect(v.ok).toBe(false)
    expect(v.motivo).toBe('enunciado_de_negacion')
  })

  it.each([
    'Señale la afirmación INCORRECTA sobre el procedimiento',
    'Todas las siguientes son competencias EXCEPTO una',
    '¿Cuál de las siguientes NO es un principio rector?',
    'Indique cuál de estas afirmaciones es falsa',
    // Añadidos tras el piloto del 29/07: la primera versión de la regex se los comía.
    'el escenario de ingresos no tendrá en cuenta:',
    'El órgano no podrá acordar la medida cuando:',
    '¿Qué documentos no forma parte del expediente?',
    'La solicitud no incluye:',
  ])('reconoce la negación en: %s', (enunciado) => {
    expect(RE_NEGATIVA.test(enunciado)).toBe(true)
  })

  it('NO confunde una pregunta afirmativa corriente con una de negación', () => {
    expect(RE_NEGATIVA.test('¿Qué órgano aprueba el reglamento de la Cámara?')).toBe(false)
    expect(RE_NEGATIVA.test('Según el artículo 9, la prohibición de discriminación incluye:')).toBe(false)
  })

  it('descarta la meta-opción: su recall contra CUALQUIER artículo es cero', () => {
    for (const t of ['Todas son correctas.', 'A) y B) son correctas', 'Ninguna de las anteriores']) {
      expect(esExaminable({ questionText: '¿Cuál es el plazo?', correctText: t }).motivo).toBe('meta_opcion')
    }
  })

  it('descarta la opción demasiado corta para medir nada', () => {
    expect(esExaminable({ questionText: '¿Cuántos días?', correctText: 'Tres días' }).motivo).toBe('opcion_demasiado_corta')
  })
})

describe('umbrales: no acusa por un pelo', () => {
  it('si el artículo vinculado ya responde, ni mira a los vecinos', () => {
    const v = clasificarVinculo({
      questionText: '¿Qué persigue RTVE en su programación?',
      correctText: 'Colaborar con las campañas institucionales dirigidas a fomentar la igualdad entre mujeres y hombres.',
      articleNumber: '37',
      articulosDeLaLey: LO32007,
    })
    expect(v.motivo).toBe('el_propio_responde')
  })

  it('no marca si ningún vecino responde claramente mejor', () => {
    const ley = new Map([['5', 'texto sin relación alguna con la pregunta'], ['6', 'otro texto distinto e igual de ajeno']])
    const v = clasificarVinculo({
      questionText: '¿Cuál es el plazo de resolución del procedimiento sancionador ordinario?',
      correctText: 'Seis meses desde el acuerdo de iniciación del expediente sancionador',
      articleNumber: '5',
      articulosDeLaLey: ley,
    })
    expect(v.sospechoso).toBe(false)
    expect(v.motivo).toBe('ningun_vecino_mejor')
  })

  it('no revienta con artículos no numéricos (disposiciones adicionales, Art. 0)', () => {
    const v = clasificarVinculo({
      questionText: '¿Qué establece la disposición?',
      correctText: 'Una regla cualquiera con palabras suficientes para medir',
      articleNumber: 'DA-1',
      articulosDeLaLey: new Map([['DA-1', 'texto ajeno']]),
    })
    expect(v.sospechoso).toBe(false)
  })

  it('no marca si el artículo vinculado ni siquiera está en la ley cargada', () => {
    expect(clasificarVinculo({ questionText: 'x', correctText: 'palabras suficientes aquí dentro', articleNumber: '99', articulosDeLaLey: LO32007 }).motivo)
      .toBe('articulo_no_encontrado')
  })
})

describe('recall', () => {
  it('es 0 cuando la opción no comparte nada con el artículo', () => {
    expect(recall('gatos perros pájaros', 'el procedimiento administrativo común')).toBe(0)
  })
  it('es 1 cuando todas sus palabras están en el artículo', () => {
    expect(recall('igualdad efectiva', 'la igualdad efectiva de mujeres y hombres')).toBe(1)
  })
  it('no revienta con vacío', () => {
    expect(recall('', 'algo')).toBe(0)
  })
})
