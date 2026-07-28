/**
 * Reloj y navegación del modo examen (feedback de Manolo, 28/07/2026).
 *
 * Estas reglas se ejecutan mientras alguien está haciendo un examen: un fallo aquí no se ve en
 * ninguna métrica, lo sufre el usuario en mitad de la prueba. De ahí que la lógica sea pura y
 * esté cubierta caso a caso, incluidos los bordes feos (objetivo corrupto en localStorage,
 * pasarse del tiempo, ninguna en blanco, dar la vuelta a la lista).
 */
import {
  formatearTiempo,
  objetivoPorDefectoSeg,
  clampObjetivoMinutos,
  tiempoRestanteSeg,
  estadoReloj,
  siguienteEnBlanco,
  anteriorEnBlanco,
  indiceMasCentrado,
  cuantasEnBlanco,
  OBJETIVO_MIN_MINUTOS,
  OBJETIVO_MAX_MINUTOS,
} from '@/lib/exam/reloj'

describe('formato del tiempo', () => {
  it('usa m:ss y pasa a h:mm:ss al superar la hora', () => {
    expect(formatearTiempo(0)).toBe('0:00')
    expect(formatearTiempo(9)).toBe('0:09')
    expect(formatearTiempo(65)).toBe('1:05')
    expect(formatearTiempo(3599)).toBe('59:59')
    expect(formatearTiempo(3600)).toBe('1:00:00')
    expect(formatearTiempo(3725)).toBe('1:02:05')
  })

  it('no rompe con basura ni con negativos', () => {
    expect(formatearTiempo(-30)).toBe('0:00')
    expect(formatearTiempo(NaN as unknown as number)).toBe('0:00')
  })
})

describe('objetivo de tiempo (es DEL USUARIO, no el del examen oficial)', () => {
  it('por defecto, un minuto por pregunta', () => {
    expect(objetivoPorDefectoSeg(50)).toBe(50 * 60)
    expect(objetivoPorDefectoSeg(10)).toBe(600)
  })

  it('un examen sin preguntas no genera un objetivo de 0 (cuenta atrás inútil)', () => {
    expect(objetivoPorDefectoSeg(0)).toBe(60)
  })

  it('encaja valores fuera de rango y aguanta un localStorage corrupto', () => {
    const pd = 50
    expect(clampObjetivoMinutos(30, pd)).toBe(30)
    expect(clampObjetivoMinutos(0, pd)).toBe(OBJETIVO_MIN_MINUTOS)
    expect(clampObjetivoMinutos(-5, pd)).toBe(OBJETIVO_MIN_MINUTOS)
    expect(clampObjetivoMinutos(99999, pd)).toBe(OBJETIVO_MAX_MINUTOS)
    expect(clampObjetivoMinutos('cuarenta', pd)).toBe(pd) // basura → el defecto, no NaN
    expect(clampObjetivoMinutos(null, pd)).toBe(pd)
    expect(clampObjetivoMinutos(undefined, pd)).toBe(pd)
    expect(clampObjetivoMinutos(12.6, pd)).toBe(13)
  })
})

describe('cuenta atrás', () => {
  it('descuenta lo transcurrido', () => {
    expect(tiempoRestanteSeg(3000, 0)).toBe(3000)
    expect(tiempoRestanteSeg(3000, 1200)).toBe(1800)
  })

  it('pasarse del objetivo da NEGATIVO, no cero', () => {
    // Esconderlo en 0 quitaría justo el dato que busca quien entrena ritmo.
    expect(tiempoRestanteSeg(600, 900)).toBe(-300)
  })

  it('avisa en el último tramo y marca agotado al pasarse', () => {
    expect(estadoReloj(3000, 0)).toBe('normal')
    expect(estadoReloj(3000, 2600)).toBe('normal') // quedan 400 s, umbral 300
    expect(estadoReloj(3000, 2750)).toBe('aviso') // quedan 250 s
    expect(estadoReloj(3000, 3000)).toBe('agotado')
    expect(estadoReloj(3000, 3600)).toBe('agotado')
  })

  it('en exámenes cortos el aviso sigue siendo útil (mínimo un minuto)', () => {
    // Con el 10% puro, un objetivo de 5 min avisaría a falta de 30 s: inútil.
    expect(estadoReloj(300, 250)).toBe('aviso') // quedan 50 s → dentro del mínimo de 60
    expect(estadoReloj(300, 200)).toBe('normal') // quedan 100 s
  })
})

describe('saltar a las preguntas en blanco', () => {
  // Caso de Manolo: 50 preguntas, respondió 43, las 7 en blanco quedaron detrás.
  const respuestas: Record<number, string | undefined> = { 0: 'a', 1: 'b', 2: undefined, 3: 'c', 4: undefined }

  it('encuentra la siguiente en blanco hacia delante', () => {
    expect(siguienteEnBlanco(respuestas, 5, 0)).toBe(2)
    expect(siguienteEnBlanco(respuestas, 5, 2)).toBe(4)
  })

  it('DA LA VUELTA: es el caso real, pulsarlo al final de la primera pasada', () => {
    // Sin vuelta, el botón no haría nada justo cuando se necesita.
    expect(siguienteEnBlanco(respuestas, 5, 4)).toBe(2)
    expect(siguienteEnBlanco(respuestas, 5, 3)).toBe(4)
  })

  it('devuelve null cuando no queda ninguna en blanco', () => {
    expect(siguienteEnBlanco({ 0: 'a', 1: 'b' }, 2, 0)).toBeNull()
    expect(siguienteEnBlanco({}, 0, 0)).toBeNull()
  })

  it('una respuesta vacía o de espacios cuenta como EN BLANCO', () => {
    expect(siguienteEnBlanco({ 0: 'a', 1: '', 2: '   ' }, 3, 0)).toBe(1)
    expect(siguienteEnBlanco({ 0: 'a', 1: '', 2: '   ' }, 3, 1)).toBe(2)
  })

  it('también busca hacia ATRÁS: pasarse no obliga a dar la vuelta entera', () => {
    expect(anteriorEnBlanco(respuestas, 5, 4)).toBe(2)
    expect(anteriorEnBlanco(respuestas, 5, 3)).toBe(2)
  })

  it('hacia atrás DA LA VUELTA por el final', () => {
    expect(anteriorEnBlanco(respuestas, 5, 2)).toBe(4)
    expect(anteriorEnBlanco(respuestas, 5, 0)).toBe(4)
  })

  it('ida y vuelta son simétricas: ‹ deshace lo que hizo ›', () => {
    const siguiente = siguienteEnBlanco(respuestas, 5, 0) // 2
    expect(siguiente).toBe(2)
    const otra = siguienteEnBlanco(respuestas, 5, siguiente as number) // 4
    expect(anteriorEnBlanco(respuestas, 5, otra as number)).toBe(siguiente)
  })

  it('hacia atrás devuelve null cuando no queda ninguna en blanco', () => {
    expect(anteriorEnBlanco({ 0: 'a', 1: 'b' }, 2, 1)).toBeNull()
    expect(anteriorEnBlanco({}, 0, 0)).toBeNull()
  })

  it('con UNA sola en blanco, ambos sentidos llevan a la misma', () => {
    const casi: Record<number, string | undefined> = { 0: 'a', 1: undefined, 2: 'c' }
    expect(siguienteEnBlanco(casi, 3, 0)).toBe(1)
    expect(anteriorEnBlanco(casi, 3, 0)).toBe(1)
    // Y estando ya en ella, sigue siendo la única a la que ir (da la vuelta y vuelve a sí misma).
    expect(siguienteEnBlanco(casi, 3, 1)).toBe(1)
    expect(anteriorEnBlanco(casi, 3, 1)).toBe(1)
  })

  it('funciona igual con un array (no solo con el mapa por índice)', () => {
    expect(siguienteEnBlanco(['a', undefined, 'c'], 3, 0)).toBe(1)
  })

  it('cuenta las que faltan para el contador de la barra', () => {
    expect(cuantasEnBlanco(respuestas, 5)).toBe(2)
    expect(cuantasEnBlanco({ 0: 'a' }, 50)).toBe(49)
    expect(cuantasEnBlanco({}, 0)).toBe(0)
  })

  it('un índice de partida absurdo no cuelga la búsqueda', () => {
    expect(siguienteEnBlanco(respuestas, 5, -99)).toBe(2)
    expect(siguienteEnBlanco(respuestas, 5, NaN as unknown as number)).toBe(2)
    expect(siguienteEnBlanco(respuestas, 5, 999)).toBe(2)
  })
})

describe('indiceMasCentrado (el cursor sigue a lo que el usuario mira)', () => {
  const alto = 800

  it('elige la pregunta cuyo centro está más cerca del centro de la pantalla', () => {
    const medidas = [
      { index: 0, top: -600, height: 400 },
      { index: 1, top: 200, height: 400 }, // centro 400 = centro de pantalla
      { index: 2, top: 700, height: 400 },
    ]
    expect(indiceMasCentrado(medidas, alto)).toBe(1)
  })

  it('en lo alto del examen el cursor es la primera, no -1 (el fallo que cazó la simulación)', () => {
    // Con -1 como cursor, el primer "›" mandaba de vuelta a la pregunta 1.
    const medidas = [
      { index: 0, top: 100, height: 400 },
      { index: 1, top: 520, height: 400 },
    ]
    expect(indiceMasCentrado(medidas, alto)).toBe(0)
  })

  it('sin preguntas medibles devuelve null (el llamador conserva su cursor)', () => {
    expect(indiceMasCentrado([], alto)).toBeNull()
    expect(indiceMasCentrado([{ index: 0, top: NaN, height: 10 }], alto)).toBeNull()
  })

  it('sin alto de ventana no inventa un cursor', () => {
    expect(indiceMasCentrado([{ index: 3, top: 0, height: 10 }], 0)).toBeNull()
  })

  it('el salto encadenado avanza usando el cursor que deja el desplazamiento', () => {
    // Simula el bucle real: miras la 2 (centrada), pulsas ›, y el cursor pasa a ser el destino.
    const respuestas: Record<number, string | undefined> = { 0: 'a', 1: 'b' }
    const cursor = indiceMasCentrado([{ index: 1, top: 200, height: 400 }], alto)
    expect(cursor).toBe(1)
    const destino = siguienteEnBlanco(respuestas, 5, cursor as number)
    expect(destino).toBe(2)
    expect(siguienteEnBlanco(respuestas, 5, destino as number)).toBe(3)
  })
})
