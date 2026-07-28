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
