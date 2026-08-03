/**
 * Una OPCIÓN que nombra a otras por su letra no puede barajarse: al reordenar, esa opción pasa a
 * señalar a otras distintas. Cuando además esa opción es LA CLAVE, barajar rompe la respuesta
 * correcta, no solo la redacción.
 *
 * Qué defiende, con el caso que lo motiva (T-409, 03/08): `optionsReferenceOtherOptions` cubría
 * «las opciones A y C» —mayúscula, sin paréntesis, unidas por «y»— y la variante con el sustantivo
 * elidido («la B)»), pero NO la forma plural con paréntesis, ni la letra en minúscula tras
 * «opciones», ni la conjunción «o». Tres preguntas ACTIVAS y `shuffle_mode='full'` se estaban
 * sirviendo barajables con la clave escrita así: `95003f09` («Por los indicados en las opciones A)
 * o C)»), `57ed7965` y `daa99a80`.
 *
 * El equilibrio que hay que conservar: la letra en minúscula tras «opciones» SÍ es referencia a
 * otra opción, mientras que tras «letra» o «apartado» es una cita legal y no lo es (eso lo defiende
 * `guardaAntiLetraCitasLegales.test.ts`). Y el cierre de la letra con `)` o límite de palabra es lo
 * que impide leer «Respuestas de bajo nivel» como «respuesta D» + «e» + «opción B».
 */

const { optionsReferenceOtherOptions } = require('../../lib/shuffle/classifyShuffleMode')

const marca = (texto: string): boolean => optionsReferenceOtherOptions([texto])

describe('una opción que cita a OTRAS opciones se detecta', () => {
  it.each([
    // Las tres que se estaban sirviendo barajadas — conjunción «o» y letras con paréntesis.
    'Por los indicados en las opciones A) o C).',
    'Lo descrito en las opciones B) o C).',
    'En las indicadas en las opciones B) o C).',
    // Minúscula con paréntesis: aquí la palabra que precede es «opciones»/«respuestas», no «letra».
    'Las opciones a) y c) son correctas.',
    'Las respuestas a) y b) son correctas.',
    'A los indicados en las opciones a) y c).',
    // La forma que ya se cubría antes, que no puede perderse.
    'Son correctas las opciones A y C',
    'Las respuestas B y C son correctas.',
  ])('marca %j', (texto) => {
    expect(marca(texto)).toBe(true)
  })
})

describe('no confunde el lenguaje corriente con una referencia cruzada', () => {
  it.each([
    // El motivo del cierre `(?:\)|\b)`: sin él, «de b…» se lee como letra D + conjunción E + letra B.
    // Los cuatro salieron del banco vivo al medir el patrón (5 falsos positivos del anterior).
    'Respuestas de bajo nivel dirigidas por el antígeno.',
    'Una nueva funcionalidad de Dialnet, que incorpora mejoras en las opciones de búsqueda, filtros y en su interfaz',
    'No empleando nunca las respuestas de D.A.A. como reafirmación.',
    // Una opción normal, sin ninguna letra suelta.
    'Acceso a una variedad de opciones de entrega disponibles en el país de destino.',
  ])('no marca %j', (texto) => {
    expect(marca(texto)).toBe(false)
  })

  it('«Todas las respuestas…» la sigue marcando OTRO patrón, y está bien que así sea', () => {
    // Salió en la misma medición, como uno de los 5 que el patrón anterior marcaba y este ya no.
    // Pero no queda desprotegida ni debe quedarlo: es un «todas las anteriores» redactado en prosa,
    // y esa es una meta-opción que no se baraja por construcción. La caza el patrón
    // `todas|ninguna + las + respuestas|opciones`, que es el suyo.
    expect(marca('Todas las respuestas se encuentran dentro de las opciones de búsqueda avanzada de Word')).toBe(true)
  })

  it('la letra del articulado en minúscula sigue sin ser una referencia a otra opción', () => {
    // Es el caso hermano: aquí la palabra pegada a la letra es «letra»/«apartado», no «opciones».
    expect(marca('Lo previsto en la letra b) del artículo 9.1 de la Ley.')).toBe(false)
    expect(marca('Según el apartado c) del artículo 47.1.')).toBe(false)
  })
})
