// Tests de la política de alertas de bot (lib/security/botAlertPolicy.ts) — T-185.
//
// Cada caso está anclado a una alerta REAL de `fraud_alerts`, revisada a mano el
// 27 y el 28/07/2026. De las 5 revisadas a fondo, las 5 eran falsos positivos.

import {
  decideBotAlert,
  medianSecondsFrom,
  BOT_ALERT_MIN_SCORE,
  BEHAVIOUR_LIMITS,
} from '@/lib/security/botAlertPolicy'

describe('decideBotAlert — bot_detected (huella de automatización)', () => {
  // 261 alertas con esta evidencia exacta, todas a score 60. Es el falso positivo
  // que el propio código documenta desde el 15/04 (Chrome legítimo activando
  // `headless_chrome`; `no_plugins` es lo normal en Android).
  it('NO alerta con el patrón Android/BotD de score 60 (261 alertas históricas)', () => {
    const d = decideBotAlert({ alertType: 'bot_detected', score: 60 })
    expect(d.createAlert).toBe(false)
    expect(d.forceChallenge).toBe(false)
    expect(d.reason).toContain('bajo_umbral')
  })

  it('NO alerta por debajo del umbral en el que actuaríamos', () => {
    for (const score of [45, 50, 60, 75, 89]) {
      expect(decideBotAlert({ alertType: 'bot_detected', score }).createAlert).toBe(false)
    }
  })

  it('SÍ alerta cuando la huella es firme (score >= 90)', () => {
    const d = decideBotAlert({ alertType: 'bot_detected', score: BOT_ALERT_MIN_SCORE })
    expect(d.createAlert).toBe(true)
    expect(d.forceChallenge).toBe(true)
    expect(d.severity).toBe('high')
  })

  it('escala a critical con score muy alto', () => {
    expect(decideBotAlert({ alertType: 'bot_detected', score: 130 }).severity).toBe('critical')
  })
})

describe('decideBotAlert — suspicious_behavior (comportamiento)', () => {
  // El caso isidoracarrenosanabrias@: el cliente declaró correctRate 0 cuando la
  // BD decía 28%. Sin datos de servidor no se opina.
  it('NO alerta sin datos de servidor (no se cree al cliente)', () => {
    const d = decideBotAlert({ alertType: 'suspicious_behavior', score: 120 })
    expect(d.createAlert).toBe(false)
    expect(d.reason).toBe('sin_datos_de_servidor')
  })

  // Los casos reales tenían medianas de 20-31 SEGUNDOS por pregunta.
  it('NO alerta a quien tarda 28 s por pregunta, por mucho que falle', () => {
    const d = decideBotAlert({
      alertType: 'suspicious_behavior', score: 120,
      server: { answers: 25, medianSeconds: 28, accuracy: 0 },
    })
    expect(d.createAlert).toBe(false)
    expect(d.reason).toContain('demasiado_lenta_para_bot')
  })

  it('NO alerta a quien acierta mucho aunque vaya rápido', () => {
    const d = decideBotAlert({
      alertType: 'suspicious_behavior', score: 120,
      server: { answers: 200, medianSeconds: 1, accuracy: 0.9 },
    })
    expect(d.createAlert).toBe(false)
    expect(d.reason).toBe('acierto_demasiado_alto')
  })

  it('NO alerta con pocas respuestas (no hay materia)', () => {
    const d = decideBotAlert({
      alertType: 'suspicious_behavior', score: 120,
      server: { answers: 5, medianSeconds: 1, accuracy: 0 },
    })
    expect(d.createAlert).toBe(false)
    expect(d.reason).toBe('pocas_respuestas')
  })

  // Lo que SÍ es un bot: rápido, falla como el azar, y con volumen.
  it('SÍ alerta con rapidez + acierto de azar + volumen, confirmado en servidor', () => {
    const d = decideBotAlert({
      alertType: 'suspicious_behavior', score: 120,
      server: { answers: 300, medianSeconds: 1, accuracy: 0.24 },
    })
    expect(d.createAlert).toBe(true)
    expect(d.forceChallenge).toBe(true)
    expect(d.severity).toBe('high')
  })
})

describe('respeto al veredicto humano', () => {
  // followsymlinks@ acumulaba 9 alertas y amaiacubocossio@ 12, del mismo patrón
  // ya descartado. El detector reincidía sobre usuarias legítimas.
  it('NO vuelve a alertar de un sujeto absuelto hace poco', () => {
    const d = decideBotAlert({ alertType: 'bot_detected', score: 150, recentlyDismissed: true })
    expect(d.createAlert).toBe(false)
    expect(d.forceChallenge).toBe(false)
    expect(d.reason).toBe('absuelto_recientemente')
  })

  it('el veredicto humano manda también sobre el comportamiento', () => {
    const d = decideBotAlert({
      alertType: 'suspicious_behavior', score: 200, recentlyDismissed: true,
      server: { answers: 500, medianSeconds: 0, accuracy: 0 },
    })
    expect(d.createAlert).toBe(false)
  })
})

describe('medianSecondsFrom — la instrumentación manda basura', () => {
  // Caso real: un recentTimes con -273399 ms.
  it('descarta tiempos negativos', () => {
    expect(medianSecondsFrom([-273399, 2000, 2000, 2000])).toBe(2)
  })

  it('descarta valores absurdamente grandes', () => {
    expect(medianSecondsFrom([1000, 1000, 999999999])).toBe(1)
  })

  it('devuelve null si no queda nada usable', () => {
    expect(medianSecondsFrom([-1, -2, NaN])).toBeNull()
    expect(medianSecondsFrom('no es un array')).toBeNull()
    expect(medianSecondsFrom(null)).toBeNull()
  })

  it('calcula la mediana, no la media (un outlier no la mueve)', () => {
    // media = 6s por el outlier; mediana = 1s.
    expect(medianSecondsFrom([1000, 1000, 1000, 1000, 26000])).toBe(1)
  })

  it('con nº par de valores promedia los centrales', () => {
    expect(medianSecondsFrom([1000, 3000])).toBe(2)
  })
})

describe('robustez (corre en un endpoint público)', () => {
  it.each([
    [{ alertType: 'bot_detected', score: NaN }],
    [{ alertType: 'bot_detected', score: undefined as never }],
    [{ alertType: 'otra_cosa', score: 999 }],
  ])('no lanza con %p', (input) => {
    expect(() => decideBotAlert(input as never)).not.toThrow()
  })

  it('los umbrales de comportamiento describen un BOT, no una persona lenta', () => {
    expect(BEHAVIOUR_LIMITS.maxMedianSeconds).toBeLessThanOrEqual(3)
    expect(BEHAVIOUR_LIMITS.maxAccuracy).toBeLessThan(0.5)
  })
})
