// utils/psychometricSaveQueue.ts — Cola offline para guardar respuestas psicotécnicas
// Mismo patrón que answerSaveQueue pero usa /api/answer/psychometric

import { logClientError } from '@/lib/logClientError'
import { emitClientEvent } from '@/lib/observability/client'

const QUEUE_KEY = 'vence_psychometric_queue'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

interface QueuedAnswer {
  id: string
  payload: {
    questionId: string
    userAnswer: number
    sessionId?: string | null
    userId?: string | null
    questionOrder?: number | null
    timeSpentSeconds?: number | null
    questionSubtype?: string | null
    totalQuestions?: number | null
  }
  retries: number
  createdAt: number
  lastAttempt: number | null
}

interface QueueState {
  answers: QueuedAnswer[]
}

function loadQueue(): QueueState {
  if (typeof window === 'undefined') return { answers: [] }
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return { answers: [] }
    return JSON.parse(raw) as QueueState
  } catch {
    return { answers: [] }
  }
}

function saveQueue(state: QueueState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(state))
  } catch {
    const dropped = state.answers.length - 10
    if (state.answers.length > 1) {
      console.warn(`⚠️ [psychometricSaveQueue] localStorage lleno, descartando ${dropped > 0 ? dropped : 0} respuestas antiguas`)
      state.answers = state.answers.slice(-10)
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(state)) } catch {
        console.error('❌ [psychometricSaveQueue] No se pudo guardar ni con 10 respuestas.')
      }
    }
  }
}

async function getAccessToken(): Promise<string | null> {
  try {
    // Vía puerto agnóstico (lib/auth)
    const { auth } = await import('@/lib/auth')
    const refreshed = await auth.refreshSession()
    if (refreshed?.accessToken) return refreshed.accessToken
    const session = await auth.getSession()
    return session?.accessToken || null
  } catch {
    return null
  }
}

async function syncOne(answer: QueuedAnswer, accessToken: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch('/api/answer/psychometric', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(answer.payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    if (response.ok) return true

    // No-OK: leer el body para diagnóstico. AGUJERO CERRADO 07/07/2026: antes esta
    // cola se tragaba el 403 sin loguearlo (a diferencia de answerSaveQueue) → un
    // premium bloqueado por límite quedaba INVISIBLE en observabilidad; costó horas
    // diagnosticarlo. Ahora se loguea con el body (sin questionsToday/dailyLimit el
    // endpoint no los devolvía → señal de que el 403 no venía del gate esperado).
    const errorBody = await response.text().catch(() => '')
    if (response.status === 401) return false // token caducado → se reintenta
    // 403 de LÍMITE (dispositivos/diario) = respuesta esperada (el usuario ve un
    // modal): visibilidad como `usage_limit_hit` (info), NO como error → no dispara
    // RULE_CLIENT_ERROR_SPIKE. Un 403 SIN señal de límite cae al logClientError de
    // abajo (señal real, como avisaba el comentario histórico de esta cola).
    if (response.status === 403 && /(l[íi]mite|dispositivo|alcanzado|dailyLimit|deviceLimit)/i.test(errorBody)) {
      emitClientEvent({
        severity: 'info',
        eventType: 'usage_limit_hit',
        endpoint: '/api/answer/psychometric',
        errorMessage: `403: ${errorBody.slice(0, 200)}`,
        metadata: { component: 'psychometricSaveQueue syncOne 403' },
      })
      return false
    }
    logClientError(
      '/api/answer/psychometric',
      new Error(`${response.status} ${response.statusText} retry #${answer.retries}: ${errorBody.slice(0, 200)}`),
      { component: `psychometricSaveQueue syncOne ${response.status}` },
    )
    return false
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // "browsing context is going away" / abort = pestaña cerrada, no es error real.
    if (!/going away|aborted|AbortError/i.test(msg)) {
      logClientError('/api/answer/psychometric', err instanceof Error ? err : new Error(msg), {
        component: 'psychometricSaveQueue syncOne network',
      })
    }
    return false
  }
}

let flushInProgress = false
let listeners: Array<(pending: number) => void> = []

function notifyListeners(): void {
  const count = getPendingCount()
  listeners.forEach(fn => fn(count))
}

export function enqueuePsychometricAnswer(payload: QueuedAnswer['payload']): void {
  const state = loadQueue()
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${payload.questionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  state.answers.push({
    id,
    payload,
    retries: 0,
    createdAt: Date.now(),
    lastAttempt: null,
  })

  saveQueue(state)
  notifyListeners()
  flush().catch(() => {})
}

export async function flush(): Promise<void> {
  if (flushInProgress) return
  flushInProgress = true

  try {
    const token = await getAccessToken()
    if (!token) { flushInProgress = false; return }

    const state = loadQueue()
    const remaining: QueuedAnswer[] = []

    for (const answer of state.answers) {
      if (Date.now() - answer.createdAt > 24 * 60 * 60 * 1000) continue
      if (answer.retries >= MAX_RETRIES) continue

      if (answer.lastAttempt) {
        const delay = BASE_DELAY_MS * Math.pow(2, answer.retries)
        if (Date.now() - answer.lastAttempt < delay) {
          remaining.push(answer)
          continue
        }
      }

      const success = await syncOne(answer, token)
      if (success) continue

      answer.retries++
      answer.lastAttempt = Date.now()
      remaining.push(answer)
    }

    saveQueue({ answers: remaining })
    notifyListeners()
  } finally {
    flushInProgress = false
  }
}

export function getPendingCount(): number {
  return loadQueue().answers.length
}

export function onPendingChange(fn: (count: number) => void): () => void {
  listeners.push(fn)
  return () => { listeners = listeners.filter(l => l !== fn) }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flush().catch(() => {}) })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush().catch(() => {})
  })
}
