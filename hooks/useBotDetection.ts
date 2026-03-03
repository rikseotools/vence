// hooks/useBotDetection.ts
// Detección de bots y automatización para usuarios autenticados
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

declare global {
  interface Window {
    _phantom?: unknown
    __nightmare?: unknown
    callPhantom?: unknown
    __puppeteer_evaluation_script__?: unknown
  }
}

/**
 * Hook para detectar bots y automatización en tests
 * Solo se activa para usuarios autenticados
 * NO afecta a crawlers de SEO en páginas públicas
 */
export function useBotDetection(userId: string | null) {
  const [isBot, setIsBot] = useState(false)
  const [botScore, setBotScore] = useState(0)
  const [botEvidence, setBotEvidence] = useState<string[]>([])
  const detectionRan = useRef(false)
  const reportedRef = useRef(false)

  useEffect(() => {
    // Solo ejecutar si hay usuario autenticado y no se ha ejecutado ya
    if (!userId || detectionRan.current) return
    detectionRan.current = true

    const detectAutomation = async () => {
      let score = 0
      const evidence = []

      try {
        // 1. Detectar WebDriver (Selenium, Puppeteer, Playwright)
        if (navigator.webdriver) {
          score += 50
          evidence.push('webdriver_detected')
        }

        // 2. Detectar headless browser
        if (/HeadlessChrome/i.test(navigator.userAgent)) {
          score += 40
          evidence.push('headless_chrome')
        }

        // 3. Detectar Phantom/Nightmare/otros frameworks
        if (window._phantom || window.__nightmare || window.callPhantom) {
          score += 50
          evidence.push('automation_framework')
        }

        // 4. Detectar Puppeteer específicamente
        if (window.__puppeteer_evaluation_script__) {
          score += 50
          evidence.push('puppeteer_detected')
        }

        // 5. Detectar ausencia de plugins (bots típicamente no tienen)
        if (navigator.plugins && navigator.plugins.length === 0) {
          score += 15
          evidence.push('no_plugins')
        }

        // 6. Detectar dimensiones sospechosas
        if (window.outerWidth === 0 || window.outerHeight === 0) {
          score += 30
          evidence.push('zero_dimensions')
        }

        // 7. Detectar inconsistencias de idioma
        if (!navigator.languages || navigator.languages.length === 0) {
          score += 15
          evidence.push('no_languages')
        }

        // 8. Detectar Chrome sin chrome object (headless)
        if (/Chrome/.test(navigator.userAgent) && !(window as any).chrome) {
          score += 25
          evidence.push('chrome_without_chrome_object')
        }

        // 9. Detectar permisos sospechosos
        if (navigator.permissions) {
          try {
            const notificationPermission = await navigator.permissions.query({ name: 'notifications' })
            // Bots típicamente tienen 'denied' sin que el usuario lo haya denegado
            if (notificationPermission.state === 'denied' && !localStorage.getItem('notification_denied_by_user')) {
              score += 10
              evidence.push('suspicious_permissions')
            }
          } catch (e) {
            // Algunos navegadores no soportan esta query
          }
        }

        // 10. Cargar BotD para detección avanzada
        try {
          const { load } = await import('@fingerprintjs/botd')
          const botd = await load()
          const result: any = await botd.detect()

          if (result.bot) {
            score += 60
            evidence.push(`botd:${result.botKind || 'unknown'}`)
          }
        } catch (e: any) {
          console.warn('BotD detection failed:', e.message)
        }

        // 11. Detectar tiempo de carga sospechosamente rápido
        if (performance && performance.timing) {
          const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart
          if (loadTime > 0 && loadTime < 100) {
            score += 20
            evidence.push('suspiciously_fast_load')
          }
        }

        setBotScore(score)
        setBotEvidence(evidence)

        // Score > 40 = probable bot
        if (score > 40) {
          setIsBot(true)
          console.warn('🤖 Bot detection triggered:', { score, evidence })
        }

      } catch (error) {
        console.error('Bot detection error:', error)
      }
    }

    // Ejecutar detección con pequeño delay para no afectar carga inicial
    const timer = setTimeout(detectAutomation, 1000)
    return () => clearTimeout(timer)
  }, [userId])

  // Función para reportar bot al servidor
  const reportBot = useCallback(async (additionalEvidence: { forceReport?: boolean; extra?: string[] } = {}) => {
    if (!userId || reportedRef.current) return
    if (botScore < 40 && !additionalEvidence.forceReport) return

    reportedRef.current = true

    try {
      await fetch('/api/fraud/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          alertType: 'bot_detected',
          botScore,
          evidence: [...botEvidence, ...(additionalEvidence.extra || [])],
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timestamp: new Date().toISOString(),
          url: window.location.pathname
        })
      })
    } catch (e) {
      console.error('Failed to report bot:', e)
    }
  }, [userId, botScore, botEvidence])

  // Auto-reportar si se detecta bot
  useEffect(() => {
    if (isBot && userId && !reportedRef.current) {
      reportBot()
    }
  }, [isBot, userId, reportBot])

  return {
    isBot,
    botScore,
    botEvidence,
    reportBot
  }
}

/**
 * Hook para análisis de comportamiento durante el test
 * Detecta patrones de SCRAPING (no respuestas correctas - los bots copian, no responden)
 *
 * Patrones de scraper:
 * - Navegación muy rápida entre preguntas (< 500ms = ni leyó la pregunta)
 * - Tiempos mecánicamente consistentes (varianza casi 0)
 * - Alto volumen de preguntas en poco tiempo
 */
interface AnswerTiming {
  time: number
  timestamp: number
  correct?: boolean
}

export function useBehaviorAnalysis(userId: string | null) {
  const [suspicionScore, setSuspicionScore] = useState(0)
  const answerTimesRef = useRef<AnswerTiming[]>([])
  const reportedBehaviorRef = useRef(false)

  const recordAnswer = useCallback((responseTimeMs: number) => {
    answerTimesRef.current.push({ time: responseTimeMs, timestamp: Date.now() })

    let newSuspicion = 0
    const times = answerTimesRef.current

    // 1. Navegación extremadamente rápida (< 500ms) - imposible leer la pregunta
    // Un humano necesita al menos 2-3 segundos para leer y procesar
    if (responseTimeMs < 500) {
      newSuspicion += 40 // Muy sospechoso - ni siquiera leyó
    } else if (responseTimeMs < 1000) {
      newSuspicion += 25 // Sospechoso - muy rápido para leer
    } else if (responseTimeMs < 1500) {
      newSuspicion += 10 // Algo rápido pero posible
    }

    // Análisis con suficientes datos (5+ interacciones)
    if (times.length >= 5) {
      const recentTimes = times.slice(-5).map(t => t.time)
      const avg = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length

      // 2. Varianza muy baja = tiempos mecánicamente idénticos = bot
      // Los humanos tienen variación natural en sus tiempos
      const variance = recentTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / recentTimes.length
      if (variance < 200) {
        // Varianza < 200ms² = tiempos casi idénticos
        newSuspicion += 35
      } else if (variance < 500) {
        newSuspicion += 15
      }

      // 3. Promedio muy bajo = está pasando preguntas sin leer
      if (avg < 1000) {
        newSuspicion += 30 // Promedio < 1s = definitivamente no está leyendo
      } else if (avg < 2000) {
        newSuspicion += 15
      }
    }

    // Análisis de volumen (10+ preguntas)
    if (times.length >= 10) {
      const recent = times.slice(-10)
      const totalTime = recent[recent.length - 1].timestamp - recent[0].timestamp
      const questionsPerMinute = (10 / totalTime) * 60000

      // 4. Más de 20 preguntas por minuto = scraping masivo
      // Un humano realista hace 3-6 preguntas por minuto
      if (questionsPerMinute > 30) {
        newSuspicion += 50 // Scraping agresivo
      } else if (questionsPerMinute > 20) {
        newSuspicion += 30
      } else if (questionsPerMinute > 15) {
        newSuspicion += 15
      }
    }

    setSuspicionScore(prev => {
      const updated = prev + newSuspicion

      // Reportar si supera umbral
      if (updated > 100 && !reportedBehaviorRef.current && userId) {
        reportedBehaviorRef.current = true
        reportSuspiciousBehavior(userId, updated, times)
      }

      return updated
    })

    return newSuspicion
  }, [userId])

  const reset = useCallback(() => {
    answerTimesRef.current = []
    setSuspicionScore(0)
    reportedBehaviorRef.current = false
  }, [])

  return {
    suspicionScore,
    recordAnswer,
    reset,
    answerCount: answerTimesRef.current.length
  }
}

// Función helper para reportar comportamiento sospechoso
async function reportSuspiciousBehavior(userId: string, score: number, answerData: AnswerTiming[]) {
  try {
    const recentAnswers = answerData.slice(-20)
    const avgTime = recentAnswers.reduce((sum, a) => sum + a.time, 0) / recentAnswers.length
    const correctRate = recentAnswers.filter(a => a.correct).length / recentAnswers.length

    await fetch('/api/fraud/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        alertType: 'suspicious_behavior',
        behaviorScore: score,
        evidence: {
          avgResponseTime: Math.round(avgTime),
          correctRate: Math.round(correctRate * 100),
          answerCount: answerData.length,
          recentTimes: recentAnswers.map(a => a.time)
        },
        timestamp: new Date().toISOString(),
        url: window.location.pathname
      })
    })
  } catch (e) {
    console.error('Failed to report suspicious behavior:', e)
  }
}

export default useBotDetection
