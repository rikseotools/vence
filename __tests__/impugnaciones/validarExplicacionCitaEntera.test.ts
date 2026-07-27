/**
 * La cita del blockquote se verifica ENTERA, no solo su arranque.
 *
 * Qué defiende: `validateQuotes` comparaba únicamente los primeros 80 caracteres normalizados
 * (`nq.slice(0, 80)`) y el resto no se miraba nunca. El guardarraíl existe literalmente para «cazar
 * citas inventadas», así que era ciego justo donde más duele: el arranque de un precepto suele ser
 * genérico («El plazo de presentación de solicitudes será de…») y lo que decide la respuesta
 * —plazos, mayorías, anchuras, órgano competente— vive al final.
 *
 * Cómo se cazó (27/07): atacando el propio validador. Se invirtió el FINAL de la cita del art. 4.1
 * CE —«siendo la ROJA de doble anchura que cada una de las AMARILLAS», o sea lo contrario de la
 * norma y exactamente el error que esa pregunta examina— y el validador la aprobó. Y no era una
 * regresión del arreglo de T-204: el `slice(0, 80)` ya estaba en la versión anterior.
 *
 * El equilibrio que fija este test: comprobar la cita entera NO puede convertir en «inventada» a la
 * cita legítima que elide tramos con «(...)» ni a la que cierra con su propia referencia. Medido
 * sobre 5.000 explicaciones vivas: sin esas dos concesiones el check levantaba 942 (18,8%), casi
 * todas correctas; con ellas, 165 (3,3%), y las revisadas a mano eran de verdad no literales.
 */
const path = require('path')
const { validateQuotes } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs')
)

const ART_4_CE =
  'La bandera de España está formada por tres franjas horizontales, roja, amarilla y roja, siendo la amarilla de doble anchura que cada una de las rojas.'

const ART_27_GALICIA =
  'En el marco del presente Estatuto corresponde a la Comunidad Autónoma gallega la competencia exclusiva de las siguientes materias: Uno. Organización de sus instituciones de autogobierno. Dos. Organización y régimen jurídico de las comarcas y parroquias rurales.'

const bloque = (texto: string) => `La respuesta correcta es la **D**.\n\n> ${texto}\n\n**A)** INCORRECTA — x`

describe('validateQuotes verifica la cita entera', () => {
  it('acepta la cita literal completa', () => {
    expect(validateQuotes(bloque(ART_4_CE), ART_4_CE)).toHaveLength(0)
  })

  it('CAZA la manipulación que vive más allá del carácter 80', () => {
    // Idéntica hasta bien pasado el umbral viejo; invertida al final.
    const invertida = ART_4_CE.replace(
      'siendo la amarilla de doble anchura que cada una de las rojas',
      'siendo la roja de doble anchura que cada una de las amarillas'
    )
    expect(invertida.slice(0, 80)).toEqual(ART_4_CE.slice(0, 80)) // el tramo que el check viejo miraba
    expect(validateQuotes(bloque(invertida), ART_4_CE)).toHaveLength(1)
  })

  it('acepta la cita que ELIDE un tramo con (...)', () => {
    const elidida =
      'En el marco del presente Estatuto corresponde a la Comunidad Autónoma gallega la competencia exclusiva de las siguientes materias (...) Organización y régimen jurídico de las comarcas y parroquias rurales.'
    expect(validateQuotes(bloque(elidida), ART_27_GALICIA)).toHaveLength(0)
  })

  it('acepta la cita que CIERRA con su propia referencia', () => {
    const conRef = `${ART_27_GALICIA} (art. 27 de la LO 1/1981, Estatuto de Autonomía de Galicia)`
    expect(validateQuotes(bloque(conRef), ART_27_GALICIA)).toHaveLength(0)
  })

  it('la referencia final no sirve de coartada: si el cuerpo NO casa, sigue fallando', () => {
    const falsa = `La bandera de España está formada por dos franjas verticales de color verde (art. 4.1 CE)`
    expect(validateQuotes(bloque(falsa), ART_4_CE)).toHaveLength(1)
  })

  it('comprueba entera también la cita corta (por debajo del umbral de troceo)', () => {
    expect(validateQuotes(bloque('tres franjas verticales'), ART_4_CE)).toHaveLength(1)
  })
})
