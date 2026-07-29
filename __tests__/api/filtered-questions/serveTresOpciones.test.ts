/** @jest-environment node */
// Servir 3 opciones donde el examen tiene 3, en el punto real del serve (T-267).
//
// Los tests del núcleo prueban el algoritmo; este prueba lo que de verdad le llega al
// opositor: cuántas opciones ve, que la correcta está entre ellas, que `correct_option`
// apunta a la posición MOSTRADA y que `option_order` sale para que el servidor pueda
// corregir después. Si algo de esto se rompe, se corrigen mal respuestas acertadas.
import { transformQuestion } from '@/lib/api/filtered-questions/queries'

type Row = Parameters<typeof transformQuestion>[0]

function pregunta(overrides: Partial<Row> = {}): Row {
  return {
    id: '3bdd3565-1111-4222-8333-444444444444',
    questionText: '¿Quién sanciona las leyes?',
    optionA: 'El Congreso',
    optionB: 'El Rey',
    optionC: 'El Senado',
    optionD: 'El Gobierno',
    correctOption: 1, // la B
    explanation: 'El Rey sanciona las leyes.',
    // `full` + explicación sin letras = elegible para barajar/recortar
    shuffleMode: 'full',
    shuffleSafety: 'safe',
    ...overrides,
  } as Row
}

describe('serve con examen de 3 opciones', () => {
  it('sirve 3 opciones cuando la oposición examina con 3', () => {
    const q = transformQuestion(pregunta(), 0, true, 3)
    expect(q.options).toHaveLength(3)
  })

  it('la correcta SIEMPRE está entre las servidas y `correct_option` apunta a su posición', () => {
    for (let correcta = 0; correcta < 4; correcta++) {
      const q = transformQuestion(pregunta({ correctOption: correcta } as Partial<Row>), 0, true, 3)
      expect(q.options).toHaveLength(3)
      const textoCorrecto = ['El Congreso', 'El Rey', 'El Senado', 'El Gobierno'][correcta]
      expect(q.options).toContain(textoCorrecto)
      // `correct_option` viaja en coordenadas MOSTRADAS: es el índice dentro de lo servido.
      expect(q.options[q.correct_option as number]).toBe(textoCorrecto)
    }
  })

  it('devuelve `option_order` con los índices ORIGINALES de lo servido', () => {
    const q = transformQuestion(pregunta(), 0, true, 3)
    const order = (q as unknown as { option_order?: number[] }).option_order
    expect(order).toHaveLength(3)
    expect(new Set(order).size).toBe(3)
    order!.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(4) })
    // El original que ocupa cada posición mostrada tiene que ser justo el texto servido.
    const originales = ['El Congreso', 'El Rey', 'El Senado', 'El Gobierno']
    order!.forEach((orig, pos) => expect(q.options[pos]).toBe(originales[orig]))
  })

  it('NO recorta si la oposición examina con 4 (la inmensa mayoría)', () => {
    expect(transformQuestion(pregunta(), 0, true, 4).options).toHaveLength(4)
    expect(transformQuestion(pregunta(), 0, true, null).options).toHaveLength(4)
  })

  it('NO recorta con el motor apagado — recortar y barajar comparten interruptor', () => {
    const q = transformQuestion(pregunta(), 0, false, 3)
    expect(q.options).toHaveLength(4)
    expect((q as unknown as { option_order?: number[] }).option_order ?? null).toBeNull()
  })

  it('NO recorta una pregunta con "todas las anteriores" (quitar una la vuelve incorrecta)', () => {
    const q = transformQuestion(
      pregunta({ optionD: 'Todas las anteriores son correctas' } as Partial<Row>),
      0,
      true,
      3,
    )
    expect(q.options).toHaveLength(4)
  })

  it('NO recorta una pregunta no elegible (explicación anclada a letras)', () => {
    // Con `shuffle_safety` distinto de safe y sin estructura, ni se baraja ni se recorta:
    // la explicación habla de "la opción C" y quitarla la dejaría hablando de un fantasma.
    const q = transformQuestion(
      pregunta({ shuffleSafety: 'unsafe', explanation: 'La opción C es incorrecta porque…' } as Partial<Row>),
      0,
      true,
      3,
    )
    expect(q.options).toHaveLength(4)
  })

  it('una pregunta que YA tiene 3 opciones se sirve intacta', () => {
    const q = transformQuestion(pregunta({ optionD: '' } as Partial<Row>), 0, true, 3)
    expect(q.options).toHaveLength(3)
  })
})

describe('pregunta oficial suelta vs examen oficial reproducido', () => {
  // DOS COSAS DISTINTAS:
  //  · pregunta que CAYÓ en un examen oficial, servida suelta en un test de práctica →
  //    es material de estudio y sigue el formato de HOY (se baraja y se recorta);
  //  · reproducción del examen oficial pasado entero → no se toca, y ni siquiera pasa por
  //    aquí: el modo examen tiene su propio camino (`/api/exam/*`), sin barajado.
  const oficial = {
    id: '3bdd3565-1111-4222-8333-444444444444',
    questionText: '¿Quién sanciona las leyes?',
    optionA: 'El Congreso', optionB: 'El Rey', optionC: 'El Senado', optionD: 'El Gobierno',
    correctOption: 1, explanation: 'El Rey sanciona las leyes.',
    shuffleMode: 'full', shuffleSafety: 'safe',
    isOfficialExam: true,
  } as unknown as Parameters<typeof transformQuestion>[0]

  it('una pregunta oficial SUELTA sí sigue el formato actual (3 opciones)', () => {
    const q = transformQuestion(oficial, 0, true, 3)
    expect(q.options).toHaveLength(3)
    expect(q.options[q.correct_option as number]).toBe('El Rey')
  })

  it('el motor NO se aplica con el interruptor apagado, que es como se sirve el examen reproducido', () => {
    const q = transformQuestion(oficial, 0, false, 3)
    expect(q.options).toHaveLength(4)
    expect((q as unknown as { option_order?: number[] }).option_order ?? null).toBeNull()
  })
})
