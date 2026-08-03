// __tests__/lib/health/psicotecnicoExplicacionSinRespuesta.test.js
//
// Los casos NO son inventados: son las preguntas reales que salieron al calibrar el detector
// sobre las 3.647 psicotécnicas activas con respuesta numérica (T-500, 03/08/2026). Los cuatro
// primeros «no-casos» son justo los falsos positivos que tenía la primera versión, y por los que
// existen las exenciones — sin ellos, uno de cada tres hallazgos era un defecto del comparador.

const {
  numeros,
  rangoDe,
  analizarExplicacion,
} = require('../../../lib/health/psicotecnicoExplicacionSinRespuesta.cjs')

describe('numeros — leer cifras como las escribe la gente', () => {
  test('decimal con coma y con punto', () => {
    expect(numeros('sale 83,72 €')).toEqual([83.72])
    expect(numeros('sale 83.72 €')).toEqual([83.72])
  })

  test('decimal con APÓSTROFO, que es como se escribe en media España', () => {
    expect(numeros("la serie acaba en 5'5")).toEqual([5.5])
    expect(numeros('la serie acaba en 5’5')).toEqual([5.5])
  })

  test('separador de miles con punto', () => {
    expect(numeros('X = 2.400 unidades')).toEqual([2400])
    expect(numeros('un total de 159.000 euros')).toEqual([159000])
  })

  test('varias cifras seguidas en el mismo texto', () => {
    expect(numeros('20, 120')).toEqual([20, 120])
  })

  test('texto sin cifras no inventa ninguna', () => {
    expect(numeros('Se trata de sustituir los números por letras.')).toEqual([])
    expect(numeros(null)).toEqual([])
  })
})

describe('rangoDe — la clave que es un intervalo', () => {
  test('reconoce «Entre 2.001 y 2.500»', () => {
    expect(rangoDe('Entre 2.001 y 2.500')).toEqual({ min: 2001, max: 2500 })
  })

  test('una clave con una sola cifra no es un rango', () => {
    expect(rangoDe('2.400 unidades')).toBeNull()
    expect(rangoDe('15.')).toBeNull()
  })
})

describe('analizarExplicacion — lo que SÍ es defecto', () => {
  test('nota de revisión interna publicada como explicación (banda grave)', () => {
    // Caso real 2b22884a: la "explicación" enumera errores de un desglose por filas.
    const r = analizarExplicacion({
      correcta: '31',
      explicacion: 'Errores en desglose por filas: fila 4 lista 960 como par (9 es impar) y excluye 417; fila 6 incluye 942 (9 impar).',
    })
    expect(r.cierra).toBe(false)
    expect(r.severidad).toBe('error')
    expect(r.motivo).toMatch(/nota de revisión interna/)
  })

  test('enuncia el método y se corta antes de resolver (banda grave)', () => {
    // Caso real 451cc1c7.
    const r = analizarExplicacion({
      correcta: '31',
      explicacion: 'Al ser los dos números impares, se aplica la **fórmula de iguales excluidos**:',
    })
    expect(r.cierra).toBe(false)
    expect(r.severidad).toBe('error')
  })

  test('nunca menciona la cifra de su propia respuesta (banda de revisión)', () => {
    // Caso real a12b77e6: da los saltos de la serie pero no dice el resultado.
    const r = analizarExplicacion({
      correcta: '15',
      explicacion: 'Serie consistente en +1, +2, +3, +4 … y así sucesivamente hasta completar la progresión pedida.',
    })
    expect(r.cierra).toBe(false)
    expect(r.severidad).toBe('warn')
  })

  test('cierra afirmando la cifra de OTRA opción (banda grave)', () => {
    const r = analizarExplicacion({
      correcta: '83,72 €',
      opciones: ['102,65 €', '93,14 €', '83,72 €', '75,20 €'],
      explicacion: 'Cada deportista paga según su porcentaje de uso. El del 29 % paga el resto, así que el resultado del reparto es 102,65',
    })
    expect(r.cierra).toBe(false)
    expect(r.severidad).toBe('error')
    expect(r.motivo).toMatch(/otra opción/)
  })
})

describe('analizarExplicacion — los NO-casos, que son los que sostienen la precisión', () => {
  test('la clave trae DOS cifras (una serie) y la explicación cita una', () => {
    // Caso real 0120302b: clave «20,120»; la explicación resuelve la subserie del 120.
    const r = analizarExplicacion({
      correcta: '20,120',
      explicacion: 'Serie intercalada con dos subseries. Subserie A: 6, 24 … se multiplica ×5 → 24×5 = **120**.',
    })
    expect(r.cierra).toBe(true)
  })

  test('la clave es un RANGO y la explicación llega a un valor de dentro', () => {
    // Caso real 613d158d: clave «Entre 2.001 y 2.500», la explicación calcula 2.400.
    const r = analizarExplicacion({
      correcta: 'Entre 2.001 y 2.500',
      explicacion: 'REGLA DE TRES: 2,50 → 200 unidades; 30 € → X. X = 30·200/2,50 = 2.400 unidades.',
    })
    expect(r.cierra).toBe(true)
    expect(r.exenta).toBe('clave_por_rango')
  })

  test('el decimal con apóstrofo de la explicación cuenta como la cifra de la clave', () => {
    // Caso real ee21ee4a: clave «5,5» y la explicación escribe 5'5.
    const r = analizarExplicacion({
      correcta: '5,5',
      explicacion: "Dos series: una se divide entre dos y la otra se multiplica por dos, así que el tercero es **5'5**.",
    })
    expect(r.cierra).toBe(true)
  })

  test('una respuesta NO numérica no se juzga con este criterio', () => {
    const r = analizarExplicacion({
      correcta: 'Verdadero',
      explicacion: 'La afirmación se sostiene porque el enunciado la reproduce.',
    })
    expect(r.cierra).toBe(true)
    expect(r.exenta).toBe('clave_no_numerica')
  })

  test('explicación completa que cita su cifra: nada que decir', () => {
    const r = analizarExplicacion({
      correcta: '83,72 €',
      explicacion: 'Si el 43 % son 300 €, cada 1 % son 6,98 € y el 12 % sale 83,72 €.',
    })
    expect(r.cierra).toBe(true)
    expect(r.severidad).toBeNull()
  })
})

describe('los dos falsos positivos que aparecieron al correrlo contra el banco (03/08)', () => {
  test('REDONDEO: la explicación calcula 111,35 semanas y la opción dice 111', () => {
    // Caso real 5c14bfac: 159.000 h ÷ 1.428 h/semana = 111,35 → la respuesta son 111 semanas.
    const r = analizarExplicacion({
      correcta: '111',
      explicacion: '42 × 34 = 1.428 h por semana. Tres motores: 53.000 × 3 = 159.000 h. 159.000 : 1428 = **111,35 semanas**.',
    })
    expect(r.cierra).toBe(true)
    expect(r.exenta).toBe('redondeo')
  })

  test('CLAVE QUE ENUMERA ENUNCIADOS: sus cifras son etiquetas, no un valor a calcular', () => {
    // Caso real 908999f0: clave «Sólo 2, 3 y 5» sobre afirmaciones de un problema de lógica.
    const r = analizarExplicacion({
      correcta: 'Sólo 2, 3 y 5',
      explicacion: 'De mayor a menor edad: Pepe; Lolo y Juancho con la misma edad; Roxi. Se desconoce la edad de Ruty.',
    })
    expect(r.cierra).toBe(true)
    expect(r.exenta).toBe('clave_enumera_enunciados')
  })

  test('pero un valor calculado que la explicación NO alcanza sigue marcándose', () => {
    const r = analizarExplicacion({ correcta: '35', explicacion: 'No entran todos los elementos. No importa el orden. No se repiten los elementos.' })
    expect(r.cierra).toBe(false)
  })
})
