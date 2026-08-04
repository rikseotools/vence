/**
 * Núcleo de traducción de letras al repasar un test barajado (T-472).
 *
 * El caso que da origen a todo (impugnación `8e9142c0`, MariSol): pregunta con la clave
 * en la `A` de la BD («…conferidos al responsable»), servida con `option_order=[2,0,1,3]`
 * → el usuario la vio en la posición `B`. El repaso le señalaba la `A` MOSTRADA, que era
 * «…conferidos al encargado». Ese es el primer test de este fichero.
 */

import {
  LETRA_DESCONOCIDA,
  resolverCoordenadasRepaso,
} from '@/lib/shuffle/reviewCoords'

const OPCIONES_BD = [
  'En el ejercicio de poderes públicos conferidos al responsable.', // A — la clave
  'Exclusivamente cuando se deba velar por la seguridad nacional.',
  'En el ejercicio de poderes públicos conferidos al encargado.',
  'Cuando se deba velar por la seguridad nacional, entre otras prerrogativas del estado.',
]

/** Cómo se le mostraron las opciones con un `order` dado (lo que guarda el contexto). */
function mostradas(order: number[]): string[] {
  return order.map((original) => OPCIONES_BD[original])
}

describe('resolverCoordenadasRepaso', () => {
  describe('el caso real que lo motiva', () => {
    const order = [2, 0, 1, 3] // A→encargado, B→responsable, C→seg. nacional, D→…

    it('señala la opción que el usuario vio, no la letra de la BD', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: order,
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: 'A', // eligió la clave (guardada en coords de BD)
        correctAnswer: 'A',
      })

      expect(r.correctAnswer).toBe('B')
      expect(r.userAnswer).toBe('B')
      expect(r.remapeado).toBe(true)
      expect(r.anomalia).toBeNull()
    })

    it('la letra devuelta apunta al TEXTO correcto de la pregunta', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: order,
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: null,
        correctAnswer: 'A',
      })

      const pintadas = mostradas(order)
      const idx = ['A', 'B', 'C', 'D'].indexOf(r.correctAnswer) // lo que hace la UI
      expect(pintadas[idx]).toBe(OPCIONES_BD[0])
      expect(pintadas[idx]).toContain('responsable')
      expect(pintadas[idx]).not.toContain('encargado')
    })

    it('sin traducir, la UI señalaría el "encargado" (regresión que no debe volver)', () => {
      const pintadas = mostradas(order)
      expect(pintadas[['A', 'B', 'C', 'D'].indexOf('A')]).toContain('encargado')
    })
  })

  describe('identidad — cuándo NO se traduce', () => {
    it('sin option_order (histórico / test no barajado)', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: null,
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: 'C',
        correctAnswer: 'A',
      })
      expect(r).toMatchObject({ userAnswer: 'C', correctAnswer: 'A', remapeado: false, anomalia: null })
    })

    it('con option_order undefined', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: undefined,
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: 'B',
        correctAnswer: 'D',
      })
      expect(r.correctAnswer).toBe('D')
      expect(r.remapeado).toBe(false)
    })

    it('cuando las opciones vienen de la BD (fallback), aunque haya option_order', () => {
      // Fila sin contexto guardado: `getTestReview` rellena desde `questions`, que está
      // en orden natural → las letras de BD ya casan. Traducir aquí ROMPERÍA una fila sana.
      const r = resolverCoordenadasRepaso({
        optionOrder: [2, 0, 1, 3],
        opcionesMostradas: 4,
        opcionesSonLasVistas: false,
        userAnswer: 'A',
        correctAnswer: 'A',
      })
      expect(r).toMatchObject({ userAnswer: 'A', correctAnswer: 'A', remapeado: false, anomalia: null })
    })

    it('con la permutación identidad, las letras no se mueven', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: [0, 1, 2, 3],
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: 'C',
        correctAnswer: 'A',
      })
      expect(r).toMatchObject({ userAnswer: 'C', correctAnswer: 'A', remapeado: false, anomalia: null })
    })
  })

  describe('subconjuntos (se sirven 3 de 4 opciones — T-267)', () => {
    // 38 filas reales en RDS el 01/08. Los índices apuntan al banco (0-3) aunque
    // solo se muestren 3 opciones: validar contra 3 las rechazaría todas.
    const order = [3, 0, 2] // A→D(BD), B→A(BD), C→C(BD)

    it('traduce la clave dentro del subconjunto servido', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: order,
        opcionesMostradas: 3,
        opcionesSonLasVistas: true,
        userAnswer: 'D',
        correctAnswer: 'A',
      })
      expect(r.correctAnswer).toBe('B')
      expect(r.userAnswer).toBe('A')
      expect(r.anomalia).toBeNull()
    })

    it('una letra que no se llegó a mostrar no se señala: devuelve "?"', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: order, // la opción B de la BD (índice 1) no se sirvió
        opcionesMostradas: 3,
        opcionesSonLasVistas: true,
        userAnswer: 'B',
        correctAnswer: 'A',
      })
      expect(r.userAnswer).toBe(LETRA_DESCONOCIDA)
      expect(r.correctAnswer).toBe('B')
      expect(r.anomalia).toBe('letra_fuera_del_orden')
    })
  })

  describe('respuestas en blanco', () => {
    it('el blanco sigue siendo blanco (null), y la clave sí se traduce', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: [2, 0, 1, 3],
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: null,
        correctAnswer: 'A',
      })
      expect(r.userAnswer).toBeNull()
      expect(r.correctAnswer).toBe('B')
    })

    it('cadena vacía se trata como blanco, no como letra inválida', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: [2, 0, 1, 3],
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: '   ',
        correctAnswer: 'A',
      })
      expect(r.userAnswer).toBeNull()
      expect(r.anomalia).toBeNull()
    })
  })

  describe('datos corruptos — nunca se adivina', () => {
    const casos: Array<[string, unknown]> = [
      ['no es un array', 'A,B,C,D'],
      ['longitud distinta a lo mostrado', [1, 0]],
      ['con repetidos', [0, 0, 1, 2]],
      ['con un índice fuera del banco (A-E)', [0, 1, 2, 9]],
      ['con un negativo', [0, 1, -1, 3]],
      ['con decimales', [0, 1.5, 2, 3]],
    ]

    it.each(casos)('%s → identidad + anomalía, sin explotar', (_titulo, orden) => {
      const r = resolverCoordenadasRepaso({
        optionOrder: orden,
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: 'C',
        correctAnswer: 'A',
      })
      expect(r).toMatchObject({ userAnswer: 'C', correctAnswer: 'A', remapeado: false })
      expect(r.anomalia).toBe('orden_invalido')
    })

    it('una letra que no existe (correct_answer vacío del histórico) no rompe', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: [2, 0, 1, 3],
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: 'Z',
        correctAnswer: '',
      })
      expect(r.correctAnswer).toBe(LETRA_DESCONOCIDA)
      expect(r.userAnswer).toBe(LETRA_DESCONOCIDA)
      expect(r.anomalia).toBe('letra_fuera_del_orden')
    })

    it('minúsculas: se aceptan igual (el histórico las tiene)', () => {
      const r = resolverCoordenadasRepaso({
        optionOrder: [2, 0, 1, 3],
        opcionesMostradas: 4,
        opcionesSonLasVistas: true,
        userAnswer: 'a',
        correctAnswer: 'a',
      })
      expect(r.correctAnswer).toBe('B')
      expect(r.userAnswer).toBe('B')
    })
  })

  describe('invariante: la letra traducida SIEMPRE apunta al mismo texto', () => {
    // Se comprueba sobre las 24 permutaciones de 4 opciones: para cualquier orden, la
    // letra devuelta señala la opción que la BD tiene por correcta. Es la propiedad de
    // la que depende toda la pantalla de repaso.
    const permutaciones: number[][] = []
    for (const a of [0, 1, 2, 3])
      for (const b of [0, 1, 2, 3])
        for (const c of [0, 1, 2, 3])
          for (const d of [0, 1, 2, 3]) {
            const p = [a, b, c, d]
            if (new Set(p).size === 4) permutaciones.push(p)
          }

    it('las 24 permutaciones × las 4 claves posibles', () => {
      expect(permutaciones).toHaveLength(24)
      for (const order of permutaciones) {
        for (let clave = 0; clave < 4; clave++) {
          const letraBd = ['A', 'B', 'C', 'D'][clave]
          const r = resolverCoordenadasRepaso({
            optionOrder: order,
            opcionesMostradas: 4,
            opcionesSonLasVistas: true,
            userAnswer: letraBd,
            correctAnswer: letraBd,
          })
          const pintadas = mostradas(order)
          const idx = ['A', 'B', 'C', 'D'].indexOf(r.correctAnswer)
          expect(pintadas[idx]).toBe(OPCIONES_BD[clave])
          expect(r.userAnswer).toBe(r.correctAnswer)
        }
      }
    })
  })
})

// ── LA RESPUESTA EN BLANCO NO ES UNA ANOMALÍA (04/08/2026) ───────────────────────────────────
// Los 13 `shuffle_option_order_invalid` que había en producción eran LOS 13 en blanco:
// `user_answer='BLANK'`, permutación correcta y fila bien puntuada. Ni un caso de barajado roto.
// El daño no está en la fila —se sirve igual— sino en la señal: [T-235] decide si el piloto de
// barajado se amplía o se apaga vigilando que este evento siga a CERO, y un contador que suma
// blancos no puede responder a esa pregunta.
describe('respuesta dejada en blanco', () => {
  const enBlanco = {
    optionOrder: [3, 1, 0, 2],
    opcionesMostradas: 4,
    opcionesSonLasVistas: true,
    userAnswer: 'BLANK',
    correctAnswer: 'A',
  }

  it('no levanta anomalía', () => {
    expect(resolverCoordenadasRepaso(enBlanco).anomalia).toBe(null)
  })

  it('se deja pasar tal cual, sin traducir', () => {
    // Traducirla daría '?', y cambiar el valor rompería la pantalla de los tests SIN barajar,
    // que son la mayoría y hoy reciben 'BLANK'.
    expect(resolverCoordenadasRepaso(enBlanco).userAnswer).toBe('BLANK')
  })

  it('la CORRECTA sí se traduce, que es para lo que existe este módulo', () => {
    // orden [3,1,0,2] → la original A (posición 0) se mostró en la 3ª casilla = C.
    expect(resolverCoordenadasRepaso(enBlanco).correctAnswer).toBe('C')
  })

  // Sin esto, la exención podría tragarse una anomalía DE VERDAD del mismo test.
  it('una letra que sigue fuera del orden SÍ levanta anomalía', () => {
    const r = resolverCoordenadasRepaso({ ...enBlanco, userAnswer: 'E' })
    expect(r.anomalia).toBe('letra_fuera_del_orden')
  })
})
