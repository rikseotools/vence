/**
 * @jest-environment node
 */
// `RE_NEGATIVA` — el filtro que excluye los enunciados de negación [T-465].
//
// ## Por qué existe este fichero
//
// La expresión la comparten los DOS detectores de vínculo (`vinculoArticuloVecino` y su hermano
// `instrumentoDerivado`), y se ha quedado corta **dos veces**:
//
//   · 29/07/2026 — la primera versión solo cubría unos pocos verbos tras «no».
//   · 01/08/2026 — se escapaban los dos enunciados con MÁS exposiciones de una muestra revisada a
//     mano: «¿Cuál de las siguientes funciones la Constitución Española NO ATRIBUYE al Gobierno?»
//     (87 exposiciones) y «…entre los que NO SE ENCUENTRA:» (70).
//
// **La lección del segundo caso no fue el verbo, fue la VENTANA:** el patrón `cuál de .{0,30} no`
// no llegaba a leer el «no» porque entre medias había 48 caracteres. Ampliar la lista de verbos no
// habría arreglado nada. Por eso los casos viven aquí y no en la cabeza de nadie.
//
// Los enunciados son TEXTO REAL del banco.
const { RE_NEGATIVA, norm } = require('../../lib/health/vinculoArticuloVecino.cjs')

const esNegativa = (t) => RE_NEGATIVA.test(norm(t))

describe('RE_NEGATIVA — enunciados que hay que EXCLUIR', () => {
  it('«no atribuye» con 48 caracteres de por medio (CE art. 97, 87 exposiciones)', () => {
    // El caso que destapó que el problema era la VENTANA, no la lista de verbos.
    expect(esNegativa('¿Cuál de las siguientes funciones la Constitución Española no atribuye al Gobierno?')).toBe(true)
  })

  it('«entre los que no se encuentra» (Ley 6/1990 Murcia, 70 exposiciones)', () => {
    expect(
      esNegativa('el Sistema de Archivos de la Región de Murcia estará integrado por órganos y centros, entre los que no se encuentra:'),
    ).toBe(true)
  })

  it.each([
    'Señale la respuesta incorrecta.',
    '¿Cuál de las siguientes NO es correcta?',
    'Todas las siguientes son ciertas EXCEPTO una.',
    'Señale cuál de los siguientes no es uno de los principios básicos.',
    '¿Qué requisito NO SE REQUIERE para acceder al puesto?',
    'Según el Decreto 80/2005, NO se considera procedimiento válido para otorgar el documento:',
  ])('sigue reconociendo las formas ya cubiertas: %s', (t) => {
    expect(esNegativa(t)).toBe(true)
  })
})

describe('RE_NEGATIVA — enunciados normales, que NO debe tragarse', () => {
  it.each([
    '¿Qué se entiende por discriminación horizontal?',
    'Según el art. 7, ¿quién aprueba el Plan Estratégico para la Igualdad?',
    'La Ley 12/2007 se estructura en:',
    'Los planes de igualdad de las consejerías serán evaluados:',
  ])('%s', (t) => {
    // Si estos se excluyeran, los detectores perderían cobertura en silencio — que es el modo de
    // fallo caro: un detector que calla parece que no encuentra nada.
    expect(esNegativa(t)).toBe(false)
  })

  it('la ventana ampliada NO se traga una pregunta larga sin negación', () => {
    expect(
      esNegativa(
        '¿Cuál de las siguientes competencias corresponde a la Consejería competente en materia de sanidad según el artículo 66 de la Ley 3/2009?',
      ),
    ).toBe(false)
  })
})
