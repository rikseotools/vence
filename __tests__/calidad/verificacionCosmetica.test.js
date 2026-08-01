/**
 * @jest-environment node
 */
// Núcleo puro de «quien reescribe no firma» [T-465].
//
// Las firmas de los casos son TEXTO REAL de `ai_verification_results`, no inventado. La que abre el
// bloque es la que dio por buenas las siete preguntas que un usuario impugnó una a una.
const {
  clasificarFirma,
  soloVerificadaPorPasesCosmeticos,
} = require('../../lib/calidad/verificacionCosmetica.cjs')

const FIRMA_REAL =
  'Revisión masiva uncited: explicación reescrita con formato didáctico, blockquote y análisis por opción.'

describe('un pase cosmético no puede firmar verificación de contenido', () => {
  it('el caso real: reescribió la explicación y firmó los tres flags con confianza alta', () => {
    const r = clasificarFirma({ explanation: FIRMA_REAL, article_ok: true, answer_ok: true, explanation_ok: true })
    expect(r.infractora).toBe(true)
    expect(r.motivo).toBe('cosmetico_firma_fondo')
    expect(r.flags).toEqual(['article_ok', 'answer_ok'])
  })

  it('explanation_ok SÍ lo puede firmar: es lo que acaba de hacer', () => {
    // Quien reescribe la explicación está en posición de decir si quedó bien. Lo que no puede
    // afirmar es que el artículo contenga la respuesta.
    const r = clasificarFirma({ explanation: FIRMA_REAL, article_ok: null, answer_ok: null, explanation_ok: true })
    expect(r.infractora).toBe(false)
    expect(r.motivo).toBe('cosmetico_sin_firmar_fondo')
  })

  it.each([
    ['Revisión masiva cramped: explicación reescrita con formato didáctico.'],
    ['Explicación reescrita al formato didáctico obligatorio.'],
    ['Fase2 relink: explicación reescrita didáctica + re-vinculada.'],
    ['v2.1 relink Word: re-vinculada a art correcto + explicación reescrita.'],
    ['needs_review v2.1: explicación reescrita didáctica.'],
  ])('reconoce la familia entera de pases cosméticos: %s', (firma) => {
    const r = clasificarFirma({ explanation: firma, article_ok: true, answer_ok: true })
    expect(r.infractora).toBe(true)
  })

  it('una verificación DE VERDAD firma lo que quiera: no es cosmética', () => {
    const r = clasificarFirma({
      explanation:
        'El art. 7 contiene literalmente la periodicidad de cuatro años; la opción marcada coincide con el texto.',
      article_ok: true,
      answer_ok: true,
    })
    expect(r.infractora).toBe(false)
    expect(r.motivo).toBe('proposito_no_cosmetico')
  })

  it('false NO es lo mismo que true: marcar un defecto sí está permitido', () => {
    // `false` = «lo he mirado y está mal». Eso es información, y un pase cosmético que la detecta de
    // paso hace bien en dejarla. Lo prohibido es afirmar que está BIEN sin haberlo comprobado.
    const r = clasificarFirma({ explanation: FIRMA_REAL, article_ok: false, answer_ok: false })
    expect(r.infractora).toBe(false)
  })
})

describe('preguntas que solo se sostienen sobre pases cosméticos', () => {
  it('una pregunta con SOLO pases cosméticos figura como verificada sin estarlo', () => {
    expect(
      soloVerificadaPorPasesCosmeticos([
        { explanation: FIRMA_REAL },
        { explanation: 'Revisión masiva cramped: explicación reescrita.' },
      ]),
    ).toBe(true)
  })

  it('si además tiene una verificación real, no hay problema', () => {
    expect(
      soloVerificadaPorPasesCosmeticos([
        { explanation: FIRMA_REAL },
        { explanation: 'Verificado contra el BOE: el art. 32 no menciona el Plan de 2023.' },
      ]),
    ).toBe(false)
  })

  it('sin ninguna verificación NO es este problema, es otro', () => {
    expect(soloVerificadaPorPasesCosmeticos([])).toBe(false)
  })
})
