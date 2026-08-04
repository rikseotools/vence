/**
 * @jest-environment node
 */
// «La vista no lo sabe» NO es «no hay preguntas» (T-555).
//
// El fallo: la vista materializada de conteos se refresca una vez al día, así que un temario
// creado o editado después del refresco no tiene ni una fila en ella. Servir ese hueco como
// «0 preguntas» dejaba a un usuario premium SIN PODER EMPEZAR ningún test de su propio temario
// —la pantalla no pinta el botón si el total es 0— mientras sus 186 preguntas estaban en la BD.
//
// Lo que hace que el arreglo sea seguro y no una heurística: la vista lleva LEFT JOIN desde
// `topic_scope`, así que un tema con materia y SIN preguntas sí tiene fila (con 0). Por eso los
// dos estados no se pueden confundir, y por eso este criterio no necesita umbrales.

import { debeCalcularEnDirecto } from '@/lib/api/topic-data/vistaDesfasada'

describe('debeCalcularEnDirecto — cuándo ignorar la vista', () => {
  it('CAE AL DIRECTO cuando el tema tiene materia y la vista no lo conoce', () => {
    // El caso real: `topic_scope` creado a las 17:37, vista calculada a las 14:32.
    expect(debeCalcularEnDirecto({ filasEnVista: 0, mapeosDeScope: 1 })).toBe(true)
  })

  it('NO cae al directo si la vista sí tiene datos (el 99% de las veces)', () => {
    // Esto es lo que protege el rendimiento: la vista existe para no hacer la consulta cara.
    expect(debeCalcularEnDirecto({ filasEnVista: 3, mapeosDeScope: 3 })).toBe(false)
  })

  it('un tema DE VERDAD vacío (fila con 0 preguntas) NO dispara el cálculo directo', () => {
    // Aquí «0 preguntas» es la respuesta correcta y «Tema en preparación» el mensaje honesto:
    // la vista SÍ conoce el tema, simplemente no hay preguntas. Confundir este caso con el
    // anterior haría pagar la consulta cara a todos los temas vacíos del banco.
    expect(debeCalcularEnDirecto({ filasEnVista: 1, mapeosDeScope: 1 })).toBe(false)
  })

  it('sin materia asignada NO se calcula nada: no hay de dónde sacar preguntas', () => {
    // Un tema sin `topic_scope` está de verdad sin armar. Caer al directo sería recorrer la BD
    // para llegar al mismo cero, en cada visita y para siempre — la vista nunca tendrá su fila.
    expect(debeCalcularEnDirecto({ filasEnVista: 0, mapeosDeScope: 0 })).toBe(false)
  })

  it('con datos ilegibles no se inventa nada (fail-safe hacia la vista)', () => {
    expect(debeCalcularEnDirecto({ filasEnVista: NaN, mapeosDeScope: 2 })).toBe(false)
    expect(debeCalcularEnDirecto({ filasEnVista: 0, mapeosDeScope: NaN })).toBe(false)
    expect(debeCalcularEnDirecto({} as never)).toBe(false)
  })

  it('varios scopes y vista vacía también cae al directo', () => {
    // Los temas de una personalizada suelen tener 1-5 scopes; ninguno cambia la decisión.
    expect(debeCalcularEnDirecto({ filasEnVista: 0, mapeosDeScope: 5 })).toBe(true)
  })
})
