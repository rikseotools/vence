/**
 * El MARCO de la explicación lo dicta el ENUNCIADO, no la explicación (T-212, cabo de datos).
 *
 * Qué defiende: `parseImpugnacionFormatExplanation` no ponía `frame` nunca, así que toda pregunta de
 * «señale la INCORRECTA» transcrita desde el formato §5.1 guardaba `select_correct` implícito.
 * Medido el 28/07: **527 pendientes** en ese formato, y de las 17 de ese tipo ya estructuradas, 11
 * con el marco equivocado. Hoy no se nota porque las razones legacy traen su veredicto escrito y el
 * render lo respeta (`yaLoTrae`), pero el dato queda mintiendo y en cuanto una razón no traiga
 * veredicto propio el render la etiqueta al revés.
 *
 * El equilibrio: la inferencia tiene que ser ESTRICTA. Un falso positivo aquí es peor que un falso
 * negativo, porque marcaría como «señale la falsa» una pregunta normal y el render acabaría
 * llamando VERDADERAS a las opciones incorrectas.
 */
import {
  inferFrameFromQuestionText,
  parseImpugnacionFormatExplanation,
  renderStructuredExplanation,
} from '@/lib/shuffle/structuredExplanation'

describe('inferFrameFromQuestionText', () => {
  it.each([
    'Respecto al derecho a la propiedad privada del artículo 33, señale la afirmación INCORRECTA:',
    'Señale la respuesta incorrecta en relación al rootkit:',
    'Atendiendo a las formas de clasificación de los sistemas operativos, marque la clasificación INCORRECTA:',
    '¿Cuál de las siguientes afirmaciones sobre el recurso de alzada es falsa?',
    'Indique cuál de estas afirmaciones NO es cierta:',
    'Identifique la afirmación errónea sobre el silencio administrativo:',
  ])('reconoce el enunciado que pide la falsa: %s', (q) => {
    expect(inferFrameFromQuestionText(q)).toBe('select_incorrect')
  })

  it.each([
    'Según el artículo 31.2 de la Constitución Española, la programación del gasto responderá a los criterios de:',
    'Señale la respuesta correcta sobre el recurso de amparo:',
    '¿Cuál es el plazo de presentación de solicitudes?',
    // La palabra aparece, pero NO como instrucción del enunciado: no debe activar el marco.
    'El acto administrativo dictado por órgano incompetente puede ser convalidado cuando la incompetencia no sea determinante de nulidad. Señale el plazo:',
  ])('NO lo activa cuando el enunciado no pide la falsa: %s', (q) => {
    expect(inferFrameFromQuestionText(q)).toBeNull()
  })

  it('sin enunciado no inventa marco', () => {
    expect(inferFrameFromQuestionText(null)).toBeNull()
    expect(inferFrameFromQuestionText('')).toBeNull()
  })
})

describe('parseImpugnacionFormatExplanation propaga el marco', () => {
  const EXPL = [
    'La respuesta correcta es la **B**.',
    '',
    '**A)** INCORRECTA — Primera razón, con su fundamento.',
    '',
    '**B)** CORRECTA — Segunda razón, la de la opción que se marca.',
    '',
    '**C)** INCORRECTA — Tercera razón, con su fundamento.',
    '',
    '**D)** INCORRECTA — Cuarta razón, con su fundamento.',
  ].join('\n')

  it('guarda select_incorrect cuando el enunciado pide la falsa', () => {
    const data = parseImpugnacionFormatExplanation(EXPL, {
      correctOption: 1,
      nOptions: 4,
      questionText: 'Señale la afirmación INCORRECTA sobre el procedimiento:',
    })
    expect(data?.frame).toBe('select_incorrect')
  })

  it('no guarda marco en una pregunta normal (queda el default)', () => {
    const data = parseImpugnacionFormatExplanation(EXPL, {
      correctOption: 1,
      nOptions: 4,
      questionText: 'Señale la respuesta correcta sobre el procedimiento:',
    })
    expect(data?.frame).toBeUndefined()
  })

  it('sin questionText sigue funcionando igual que antes (retrocompatible)', () => {
    const data = parseImpugnacionFormatExplanation(EXPL, { correctOption: 1, nOptions: 4 })
    expect(data?.options['1']).toContain('la de la opción que se marca')
    expect(data?.frame).toBeUndefined()
  })

  it('NO cambia el texto servido: el veredicto que ya trae la razón se respeta', () => {
    const data = parseImpugnacionFormatExplanation(EXPL, {
      correctOption: 1,
      nOptions: 4,
      questionText: 'Señale la afirmación INCORRECTA sobre el procedimiento:',
    })!
    const render = renderStructuredExplanation(data, { correctOption: 1, optionOrder: null, nOptions: 4 })
    // Con marco select_incorrect la etiqueta sería "ES LA INCORRECTA", pero la razón legacy ya dice
    // "CORRECTA": se conserva tal cual, así que la guarda de no-regresión sigue pasando.
    expect(render).toContain('**B)** CORRECTA — Segunda razón')
    expect(render).not.toContain('ES LA INCORRECTA — CORRECTA')
  })
})
