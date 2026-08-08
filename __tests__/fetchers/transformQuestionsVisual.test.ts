/**
 * `transformQuestions` no puede perder el contenido VISUAL de una pregunta.
 *
 * ## Por qué existe este fichero teniendo ya `testFetchers.test.ts`
 *
 * Aquel **reimplementa** `transformQuestions` dentro del propio test (una copia local de la
 * función), así que pasa en verde diga lo que diga el código real. Aquí se importa la función de
 * producción: es la única forma de que el test pueda fallar cuando el código se rompa.
 *
 * ## El fallo que fija
 *
 * Una usuaria impugnó (`c9339594`): *«No aparece el icono por lo que no se puede responder»*. La
 * pregunta tenía su imagen guardada en `content_data.image_base64`, el endpoint
 * `/api/questions/filtered` la devolvía, y `TestLayout` la pinta con `<ContentDataRenderer
 * contentData={currentQ.content_data} imageUrl={currentQ.image_url} …>`. El eslabón roto era este
 * transform, que **no copiaba ninguno de los dos campos**: el renderer recibía `undefined` y no
 * pintaba nada.
 *
 * Eran 13 preguntas activas, servidas 171 veces, varias con CERO aciertos — pedían identificar un
 * icono que nadie llegaba a ver. Y no es la primera vez: `lib/api/filtered-questions/queries.ts`
 * ya lleva un comentario que dice «definir una sola vez para evitar que se olviden campos (como
 * image_url)». Por eso esto se fija con un test y no con cuidado.
 */
// `lib/testFetchers` importa Auth.js y el cliente de eventos al cargarse. `transformQuestions` no
// usa ni uno ni otro —es una función pura de mapeo— pero sin estos mocks el módulo se queda
// colgado al importarse y el test nunca termina.
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/api/fetchWithChallenge', () => ({ fetchWithChallenge: jest.fn() }))
jest.mock('@/lib/observability/client', () => ({ emitClientEvent: jest.fn() }))

import { transformQuestions } from '@/lib/testFetchers'

const preguntaConIcono = {
  id: 'fd5086ff-2fbb-46a1-ad74-655c4d69bc76',
  question_text: '¿Qué utilidad tiene el siguiente icono de Writer?',
  option_a: 'Insertar campo',
  option_b: 'Insertar nota al pie',
  option_c: 'Insertar remisión',
  option_d: 'Insertar Marcador',
  correct_option: 2,
  explanation: 'El icono muestra dos documentos superpuestos…',
  primary_article_id: 'art-1',
  image_url: null,
  content_data: { image_base64: 'data:image/png;base64,iVBORw0KGgo=' },
  articles: { id: 'art-1', article_number: '1', title: 'Interfaz', content: '…', laws: { name: 'LibreOffice Writer', short_name: 'Writer' } },
}

describe('transformQuestions — contenido visual', () => {
  it('conserva content_data: sin él, una pregunta de icono se sirve MUDA', () => {
    const [q] = transformQuestions([preguntaConIcono])
    expect(q.content_data).toEqual({ image_base64: 'data:image/png;base64,iVBORw0KGgo=' })
  })

  it('conserva image_url (el otro camino de imagen, el de Storage)', () => {
    const [q] = transformQuestions([{ ...preguntaConIcono, image_url: 'https://x/icono.png', content_data: null }])
    expect(q.image_url).toBe('https://x/icono.png')
  })

  it('una pregunta SIN visual expone los campos a null, no undefined (el renderer los compara)', () => {
    const { image_url, content_data, ...sinVisual } = preguntaConIcono
    const [q] = transformQuestions([sinVisual])
    expect(q.image_url).toBeNull()
    expect(q.content_data).toBeNull()
  })

  it('no se pierde por el camino lo que ya se conservaba (clave y explicación)', () => {
    const [q] = transformQuestions([preguntaConIcono])
    expect(q.correct_option).toBe(2)
    expect(q.explanation).toContain('dos documentos superpuestos')
    expect(q.options).toHaveLength(4)
  })
})
