// utils/answerSaveQueue.ts — Cola offline-first para guardar respuestas en background
// Guarda en localStorage primero, sincroniza con el servidor sin bloquear la UI.
import { logClientError } from '@/lib/logClientError'
import { answerAndSaveRequestSchema } from '@/lib/api/v2/answer-and-save/schemas'

const QUEUE_KEY = 'vence_answer_queue'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

interface QueuedAnswer {
  id: string
  payload: Record<string, unknown>
  retries: number
  createdAt: number
  lastAttempt: number | null
}

interface QueueState {
  answers: QueuedAnswer[]
}

// ============================================
// PERSISTENT QUEUE (localStorage-backed)
// ============================================

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
      console.warn(`⚠️ [answerSaveQueue] localStorage lleno, descartando ${dropped > 0 ? dropped : 0} respuestas antiguas`)
      state.answers = state.answers.slice(-10)
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(state)) } catch {
        console.error('❌ [answerSaveQueue] No se pudo guardar ni con 10 respuestas.')
      }
    }
  }
}

function extractUserId(answer: QueuedAnswer): string | undefined {
  return typeof answer.payload.userId === 'string' ? answer.payload.userId : undefined
}

// ============================================
// SYNC: enviar una respuesta al servidor
// ============================================

async function syncOne(answer: QueuedAnswer, accessToken: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch('/api/v2/answer-and-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(answer.payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // ❌ PUNTO DE FALLO 1: 401 = token inválido/expirado
    if (response.status === 401) {
      console.error(`❌ [answerSaveQueue] 401 Unauthorized — token obtenido pero rechazado por el servidor`)
      logClientError('/api/v2/answer-and-save', new Error(`401 Unauthorized: token rechazado por servidor. Retry #${answer.retries}`), {
        component: 'answerSaveQueue syncOne 401',
        userId: extractUserId(answer),
      })
      return false
    }

    // ❌ PUNTO DE FALLO 2: otro HTTP error
    if (!response.ok) {
      let errorBody = ''
      try { errorBody = (await response.text()).slice(0, 200) } catch {}
      console.error(`❌ [answerSaveQueue] HTTP ${response.status} en retry #${answer.retries}: ${errorBody}`)
      // Loguear SIEMPRE (no solo en último retry) para tener traza completa
      logClientError('/api/v2/answer-and-save', new Error(`HTTP ${response.status} retry #${answer.retries}: ${errorBody}`), {
        component: 'answerSaveQueue syncOne',
        userId: extractUserId(answer),
      })
    }

    return response.ok
  } catch (err) {
    // ❌ PUNTO DE FALLO 3: network error / timeout / abort
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌ [answerSaveQueue] Network error retry #${answer.retries}: ${msg}`)
    logClientError('/api/v2/answer-and-save', err, {
      component: 'answerSaveQueue syncOne network',
      userId: extractUserId(answer),
    })
    return false
  }
}

// ============================================
// PUBLIC API
// ============================================

let flushInProgress = false
let listeners: Array<(pending: number) => void> = []
let authFailCount = 0

function notifyListeners(): void {
  const count = getPendingCount()
  listeners.forEach(fn => fn(count))
}

/**
 * Obtener token de auth actual.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const { getSupabaseClient } = await import('@/lib/supabase')
    const supabase = getSupabaseClient()

    // ❌ PUNTO DE FALLO 4: refreshSession falla
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      console.warn(`⚠️ [answerSaveQueue] refreshSession error: ${refreshError.message}`)
    }
    if (refreshData?.session?.access_token) {
      authFailCount = 0
      return refreshData.session.access_token
    }

    // ❌ PUNTO DE FALLO 5: getSession también falla
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      console.warn(`⚠️ [answerSaveQueue] getSession error: ${sessionError.message}`)
    }
    if (session?.access_token) {
      authFailCount = 0
      return session.access_token
    }

    // Ambos fallaron → sin token
    authFailCount++
    const pending = getPendingCount()
    console.error(`❌ [answerSaveQueue] Sin token de auth (intento #${authFailCount}, ${pending} pendientes). refreshError=${refreshError?.message ?? 'none'}, sessionError=${sessionError?.message ?? 'none'}`)

    if (authFailCount >= 2 && pending > 0) {
      logClientError('/api/v2/answer-and-save', new Error(`Auth null x${authFailCount}. ${pending} pendientes. refresh=${refreshError?.message ?? 'empty'} session=${sessionError?.message ?? 'empty'}`), {
        component: 'answerSaveQueue auth',
      })
    }
    return null
  } catch (err) {
    // ❌ PUNTO DE FALLO 6: excepción inesperada en auth
    authFailCount++
    console.error('❌ [answerSaveQueue] Excepción en getAccessToken:', err)
    logClientError('/api/v2/answer-and-save', err, {
      component: 'answerSaveQueue getAccessToken exception',
    })
    return null
  }
}

/**
 * Añadir una respuesta a la cola y sincronizar inmediatamente.
 */
export function enqueueAnswer(payload: Record<string, unknown>): void {
  const validation = answerAndSaveRequestSchema.safeParse(payload)
  if (!validation.success) {
    logClientError('/api/v2/answer-and-save', new Error('Payload inválido: ' + JSON.stringify(validation.error.issues)), {
      component: 'answerSaveQueue enqueue',
      userId: typeof payload.userId === 'string' ? payload.userId : undefined,
    })
    return
  }

  const state = loadQueue()
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${payload.questionId || 'unknown'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  state.answers.push({
    id,
    payload: validation.data as Record<string, unknown>,
    retries: 0,
    createdAt: Date.now(),
    lastAttempt: null,
  })

  saveQueue(state)
  notifyListeners()

  flush().catch(err => {
    logClientError('/api/v2/answer-and-save', err, {
      component: 'answerSaveQueue flush catch',
      userId: typeof payload.userId === 'string' ? payload.userId : undefined,
    })
  })
}

/**
 * Sincronizar todas las respuestas pendientes con el servidor.
 */
export async function flush(): Promise<void> {
  if (flushInProgress) return
  flushInProgress = true

  try {
    const token = await getAccessToken()
    if (!token) {
      const pending = getPendingCount()
      if (pending > 0) {
        console.warn(`⚠️ [answerSaveQueue] flush abortado: sin token, ${pending} pendientes en localStorage`)
      }
      flushInProgress = false
      notifyListeners()
      return
    }

    const state = loadQueue()
    const remaining: QueuedAnswer[] = []

    for (const answer of state.answers) {
      // ❌ PUNTO DE FALLO 7: descarte por antigüedad (>24h)
      if (Date.now() - answer.createdAt > 24 * 60 * 60 * 1000) {
        console.warn(`⚠️ [answerSaveQueue] Descartando respuesta >24h antigua (creada ${new Date(answer.createdAt).toISOString()})`)
        logClientError('/api/v2/answer-and-save', new Error(`Respuesta descartada por antigüedad >24h. Creada: ${new Date(answer.createdAt).toISOString()}`), {
          component: 'answerSaveQueue flush expired',
          userId: extractUserId(answer),
        })
        continue
      }

      // ❌ PUNTO DE FALLO 8: descarte por max retries
      if (answer.retries >= MAX_RETRIES) {
        console.error(`❌ [answerSaveQueue] Descartando respuesta tras ${answer.retries} reintentos fallidos`)
        logClientError('/api/v2/answer-and-save', new Error(`Respuesta descartada tras ${MAX_RETRIES} reintentos. Última: ${answer.lastAttempt ? new Date(answer.lastAttempt).toISOString() : 'nunca'}`), {
          component: 'answerSaveQueue flush maxRetries',
          userId: extractUserId(answer),
        })
        continue
      }

      // Backoff exponencial
      if (answer.lastAttempt) {
        const delay = BASE_DELAY_MS * Math.pow(2, answer.retries)
        if (Date.now() - answer.lastAttempt < delay) {
          remaining.push(answer)
          continue
        }
      }

      const success = await syncOne(answer, token)
      if (success) {
        continue
      }

      // Falló — incrementar retries
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

/**
 * Número de respuestas pendientes de sincronizar.
 */
export function getPendingCount(): number {
  return loadQueue().answers.length
}

/**
 * Suscribirse a cambios en el número de pendientes.
 */
export function onPendingChange(fn: (count: number) => void): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter(l => l !== fn)
  }
}

/**
 * Indica si el flush ha fallado por auth repetidamente.
 */
export function hasAuthFailure(): boolean {
  return authFailCount >= 2 && getPendingCount() > 0
}

// ============================================
// AUTO-SYNC: listeners de conectividad
// ============================================

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flush().catch(() => {})
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      flush().catch(() => {})
    }
  })
}
