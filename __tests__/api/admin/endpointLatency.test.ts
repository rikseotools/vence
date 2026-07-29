/**
 * @jest-environment node
 */
// Unitarios del núcleo PURO que clasifica la latencia por endpoint y ventana corta (T-254).
// Importa el módulo REAL de producción, nunca una copia.
//
// El caso de origen (28/07/2026): `/api/v2/answer-and-save` estuvo a p95 25.035 ms durante 15
// minutos —34 timeouts sobre 11 usuarios— y el panel se quedó verde. Los números que aparecen en
// estos tests son los MEDIDOS en producción, no inventados: si alguien afloja el diseño, el test
// vuelve a contar el incidente real.

import {
  classifyEndpointLatency,
  worstBucketPerEndpoint,
  overallEndpointLatencyStatus,
  degradedEndpoints,
  sustainedDegradations,
  LATENCY_MIN_SAMPLES,
  LATENCY_P95_THRESHOLDS,
} from '@/lib/api/admin/endpoint-latency'

const cubo = (endpoint: string, p95Ms: number, samples = 27, bucketStart = '2026-07-28T09:30:00Z') =>
  ({ endpoint, p95Ms, samples, bucketStart })

describe('classifyEndpointLatency — el incidente real del 28/07', () => {
  it('CAZA answer-and-save a 25.035 ms (lo que el panel dio por verde)', () => {
    const v = classifyEndpointLatency(cubo('/api/v2/answer-and-save', 25_035, 27))
    expect(v.status).toBe('red')
    expect(v.category).toBe('user_facing')
  })

  it('los otros dos que cayeron a la vez también salen en rojo', () => {
    // Medido en la misma ventana: no fue un endpoint, fue un recurso compartido.
    expect(classifyEndpointLatency(cubo('/api/medals', 5_003, 12)).status).toBe('red')
    expect(classifyEndpointLatency(cubo('/api/v2/test-config/articles', 4_189, 12)).status).toBe('amber')
  })

  it('el tráfico sano de esa MISMA ventana sigue verde (no es un detector que lo pinta todo)', () => {
    for (const [ep, p95] of [
      ['/api/v2/disputes/notifications', 94],
      ['/api/questions/filtered', 102],
      ['/api/v2/user-stats', 108],
      ['/api/v2/topic-progress/theme-stats', 188],
    ] as const) {
      expect(classifyEndpointLatency(cubo(ep, p95)).status).toBe('green')
    }
  })
})

describe('classifyEndpointLatency — admin vs user_facing', () => {
  it('el panel admin NO entra en ámbar por sus agregaciones normales (~1.300 ms)', () => {
    // Con el umbral user_facing estas tres estarían en ámbar permanente, y una alarma siempre
    // encendida no es una alarma.
    for (const ep of [
      '/api/admin/pending-counts',
      '/api/v2/admin/pending-feedback-counts',
      '/api/v2/admin/unread-sales',
    ]) {
      const v = classifyEndpointLatency(cubo(ep, 1_365, 90))
      expect(v.category).toBe('admin')
      expect(v.status).toBe('green')
    }
  })

  it('pero el admin TAMPOCO es barra libre: a 15 s se pone rojo igual', () => {
    expect(classifyEndpointLatency(cubo('/api/admin/pending-counts', 16_000, 90)).status).toBe('red')
  })

  it('un endpoint desconocido se vigila con el umbral ESTRICTO (defensa por defecto)', () => {
    const v = classifyEndpointLatency(cubo('/api/algo-que-nadie-ha-clasificado', 3_000))
    expect(v.category).toBe('user_facing')
    expect(v.status).toBe('amber')
  })
})

describe('classifyEndpointLatency — muestras insuficientes', () => {
  it('con pocas muestras dice `unknown`, NO verde (nada de verde-falso)', () => {
    const v = classifyEndpointLatency(cubo('/api/v2/answer-and-save', 25_035, LATENCY_MIN_SAMPLES - 1))
    expect(v.status).toBe('unknown')
  })

  it('justo en el suelo de muestras ya opina', () => {
    const v = classifyEndpointLatency(cubo('/api/v2/answer-and-save', 25_035, LATENCY_MIN_SAMPLES))
    expect(v.status).toBe('red')
  })

  it('un p95 que no es un número no se interpreta como 0', () => {
    expect(classifyEndpointLatency(cubo('/api/x', NaN, 50)).status).toBe('unknown')
  })
})

describe('worstBucketPerEndpoint — por qué la ventana corta es imprescindible', () => {
  it('un incendio de 3 cubos NO se diluye entre las horas buenas del día', () => {
    // Reproduce la forma del día real: 285 minutos sanos y 15 en llamas. Con el agregado de 24 h
    // este endpoint salía a 362 ms → verde. Aquí tiene que salir rojo.
    const sanos = Array.from({ length: 57 }, (_, i) =>
      cubo('/api/v2/answer-and-save', 300, 30, `2026-07-28T0${i % 9}:00:00Z`))
    const enLlamas = [
      cubo('/api/v2/answer-and-save', 2_603, 27, '2026-07-28T09:30:00Z'),
      cubo('/api/v2/answer-and-save', 20_083, 27, '2026-07-28T09:35:00Z'),
      cubo('/api/v2/answer-and-save', 25_035, 26, '2026-07-28T09:40:00Z'),
    ]
    const [peor] = worstBucketPerEndpoint([...sanos, ...enLlamas])
    expect(peor.status).toBe('red')
    expect(peor.p95Ms).toBe(25_035)
    expect(peor.bucketStart).toBe('2026-07-28T09:40:00Z')
  })

  it('se queda con UNA fila por endpoint y las ordena por gravedad', () => {
    const r = worstBucketPerEndpoint([
      cubo('/api/sano', 100),
      cubo('/api/sano', 120),
      cubo('/api/lento', 3_000),
      cubo('/api/muy-lento', 9_000),
    ])
    expect(r.map(v => v.endpoint)).toEqual(['/api/muy-lento', '/api/lento', '/api/sano'])
    expect(r).toHaveLength(3)
  })

  it('un cubo SIN muestras no puede tapar a uno rojo del mismo endpoint', () => {
    // `unknown` es peor que verde a efectos de mirar, pero nunca debe desplazar a un rojo real.
    const [peor] = worstBucketPerEndpoint([
      cubo('/api/v2/answer-and-save', 25_035, 30),
      cubo('/api/v2/answer-and-save', 99_999, 2),
    ])
    expect(peor.status).toBe('red')
    expect(peor.p95Ms).toBe(25_035)
  })
})

describe('overallEndpointLatencyStatus — el peor manda, no el promedio', () => {
  it('40 endpoints verdes NO compensan el que guarda la respuesta del test', () => {
    const verdes = Array.from({ length: 40 }, (_, i) => cubo(`/api/ok-${i}`, 90))
    const todos = worstBucketPerEndpoint([...verdes, cubo('/api/v2/answer-and-save', 25_035)])
    expect(overallEndpointLatencyStatus(todos)).toBe('red')
    // Y esta es exactamente la comparación que motiva la tarea: promediar da verde.
    const media = [...verdes, cubo('/api/v2/answer-and-save', 25_035)]
      .reduce((a, b) => a + b.p95Ms, 0) / 41
    expect(media).toBeLessThan(LATENCY_P95_THRESHOLDS.user_facing.amber)
  })

  it('sin ninguna medición con datos → unknown, no verde', () => {
    expect(overallEndpointLatencyStatus([])).toBe('unknown')
    expect(overallEndpointLatencyStatus(worstBucketPerEndpoint([cubo('/api/x', 100, 2)]))).toBe('unknown')
  })

  it('un `unknown` de poco tráfico conviviendo con verdes NO degrada el panel', () => {
    const r = worstBucketPerEndpoint([cubo('/api/ok', 90, 50), cubo('/api/raro', 400, 2)])
    expect(overallEndpointLatencyStatus(r)).toBe('green')
  })

  it('el día tranquilo da VERDE (el indicador no nace encendido)', () => {
    const r = worstBucketPerEndpoint([
      cubo('/api/v2/answer-and-save', 362, 120),
      cubo('/api/questions/filtered', 369, 40),
      cubo('/api/admin/pending-counts', 1_365, 90),
    ])
    expect(overallEndpointLatencyStatus(r)).toBe('green')
    expect(degradedEndpoints(r)).toEqual([])
  })
})

describe('sustainedDegradations — la firma que dispara la ALERTA', () => {
  // Los cubos REALES del incidente del 28/07, tal cual salieron de observable_events.
  const INCIDENTE_28_07 = [
    { endpoint: '/api/v2/answer-and-save', bucketStart: '2026-07-28T09:20:00.000Z', samples: 11, p95Ms: 385 },
    { endpoint: '/api/v2/answer-and-save', bucketStart: '2026-07-28T09:25:00.000Z', samples: 15, p95Ms: 285 },
    { endpoint: '/api/v2/answer-and-save', bucketStart: '2026-07-28T09:30:00.000Z', samples: 34, p95Ms: 25_145 },
    { endpoint: '/api/v2/answer-and-save', bucketStart: '2026-07-28T09:35:00.000Z', samples: 29, p95Ms: 4_732 },
    { endpoint: '/api/v2/answer-and-save', bucketStart: '2026-07-28T09:40:00.000Z', samples: 17, p95Ms: 3_272 },
    { endpoint: '/api/v2/answer-and-save', bucketStart: '2026-07-28T09:45:00.000Z', samples: 6, p95Ms: 24_006 },
    { endpoint: '/api/v2/answer-and-save', bucketStart: '2026-07-28T09:50:00.000Z', samples: 11, p95Ms: 76 },
  ]

  it('CAZA el incidente que motivó la tarea (rojo + 2 ámbar seguidos)', () => {
    const r = sustainedDegradations(INCIDENTE_28_07)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      endpoint: '/api/v2/answer-and-save',
      desde: '2026-07-28T09:30:00.000Z',
      buckets: 3,
      minutos: 15,
      peorP95Ms: 25_145,
    })
  })

  it('las dos firmas descartadas lo PIERDEN — por eso no se eligieron', () => {
    const verdicts = INCIDENTE_28_07.map(b => classifyEndpointLatency(b))
    // (a) «≥2 cubos ROJOS seguidos»: solo uno pasó de 5.000 ms.
    expect(verdicts.filter(v => v.status === 'red')).toHaveLength(1)
    // (b) «≥2 endpoints en rojo a la vez»: los otros dos tocados no llegaban al suelo de muestras.
    expect(classifyEndpointLatency({
      endpoint: '/api/medals', bucketStart: '2026-07-28T09:30:00.000Z', samples: 5, p95Ms: 5_003,
    }).status).toBe('unknown')
  })

  it('un ámbar SUELTO no alerta (el panel lo ve; el correo no se gasta en eso)', () => {
    expect(sustainedDegradations([
      { endpoint: '/api/x', bucketStart: '2026-07-28T10:00:00.000Z', samples: 30, p95Ms: 2_500 },
    ])).toEqual([])
  })

  it('dos ámbar seguidos SIN ningún rojo tampoco alertan', () => {
    expect(sustainedDegradations([
      { endpoint: '/api/x', bucketStart: '2026-07-28T10:00:00.000Z', samples: 30, p95Ms: 2_500 },
      { endpoint: '/api/x', bucketStart: '2026-07-28T10:05:00.000Z', samples: 30, p95Ms: 2_600 },
    ])).toEqual([])
  })

  it('dos cubos malos NO consecutivos no son una racha', () => {
    expect(sustainedDegradations([
      { endpoint: '/api/x', bucketStart: '2026-07-28T10:00:00.000Z', samples: 30, p95Ms: 9_000 },
      { endpoint: '/api/x', bucketStart: '2026-07-28T10:30:00.000Z', samples: 30, p95Ms: 9_000 },
    ])).toEqual([])
  })

  it('el panel admin lento NO despierta a nadie', () => {
    expect(sustainedDegradations([
      { endpoint: '/api/admin/pending-counts', bucketStart: '2026-07-28T10:00:00.000Z', samples: 30, p95Ms: 20_000 },
      { endpoint: '/api/admin/pending-counts', bucketStart: '2026-07-28T10:05:00.000Z', samples: 30, p95Ms: 20_000 },
    ])).toEqual([])
  })

  it('separa rachas distintas del mismo endpoint y ordena por gravedad', () => {
    const r = sustainedDegradations([
      { endpoint: '/api/a', bucketStart: '2026-07-28T10:00:00.000Z', samples: 30, p95Ms: 6_000 },
      { endpoint: '/api/a', bucketStart: '2026-07-28T10:05:00.000Z', samples: 30, p95Ms: 2_100 },
      { endpoint: '/api/a', bucketStart: '2026-07-28T14:00:00.000Z', samples: 30, p95Ms: 30_000 },
      { endpoint: '/api/a', bucketStart: '2026-07-28T14:05:00.000Z', samples: 30, p95Ms: 2_100 },
    ])
    expect(r).toHaveLength(2)
    expect(r[0].peorP95Ms).toBe(30_000)
    expect(r[1].peorP95Ms).toBe(6_000)
  })

  it('tolera la lista vacía', () => {
    expect(sustainedDegradations([])).toEqual([])
  })
})
