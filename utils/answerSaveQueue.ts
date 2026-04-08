// utils/answerSaveQueue.ts — Cola offline-first para guardar respuestas en background
// Guarda en localStorage primero, sincroniza con el servidor sin bloquear la UI.
// NUNCA descarta respuestas por auth — las mantiene hasta que se envíen con éxito.
import { logClientError } from '@/lib/logClientError'
import { answerAndSaveRequestSchema } from '@/lib/api/v2/answer-and-save/schemas'

const QUEUE_KEY = 'vence_answer_queue'
const MAX_RETRIES = 5 // Subido de 3 a 5 para dar más oportunidades
const BASE_DELAY_MS = 2000
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 días (antes 24h) — alineado con JWT expiry

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

    if (response.status === 401) {
      console.error(`❌ [answerSaveQueue] 401 Unauthorized — token rechazado`)
      logClientError('/api/v2/answer-and-save', new Error(`401 Unauthorized retry #${answer.retries}`), {
        component: 'answerSaveQueue syncOne 401',
        userId: extractUserId(answer),
      })
      return false
    }

    if (!response.ok) {
      let errorBody = ''
      try { errorBody = (await response.text()).slice(0, 200) } catch {}
      console.error(`❌ [answerSaveQueue] HTTP ${response.status} retry #${answer.retries}: ${errorBody}`)
      logClientError('/api/v2/answer-and-save', new Error(`HTTP ${response.status} retry #${answer.retries}: ${errorBody}`), {
        component: 'answerSaveQueue syncOne',
        userId: extractUserId(answer),
      })
    }

    return response.ok
  } catch (err) {
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

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      console.warn(`⚠️ [answerSaveQueue] refreshSession error: ${refreshError.message}`)
    }
    if (refreshData?.session?.access_token) {
      authFailCount = 0
      return refreshData.session.access_token
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      console.warn(`⚠️ [answerSaveQueue] getSession error: ${sessionError.message}`)
    }
    if (session?.access_token) {
      authFailCount = 0
      return session.access_token
    }

    authFailCount++
    const pending = getPendingCount()
    console.error(`❌ [answerSaveQueue] Sin token (intento #${authFailCount}, ${pending} pendientes)`)

    if (authFailCount >= 2 && pending > 0) {
      logClientError('/api/v2/answer-and-save', new Error(`Auth null x${authFailCount}. ${pending} pendientes. refresh=${refreshError?.message ?? 'empty'} session=${sessionError?.message ?? 'empty'}`), {
        component: 'answerSaveQueue auth',
      })
    }
    return null
  } catch (err) {
    // "browsing context is going away" = usuario cerró pestaña (Safari/WebKit).
    // La respuesta está segura en localStorage, no es un error real.
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('browsing context is going away')) {
      return null
    }
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
 * MEJORA #1: nunca descarta por auth — si no hay token, las respuestas
 * se quedan en localStorage hasta que el auth se restaure.
 */
export async function flush(): Promise<void> {
  if (flushInProgress) return
  flushInProgress = true

  try {
    const token = await getAccessToken()
    if (!token) {
      const pending = getPendingCount()
      if (pending > 0) {
        console.warn(`⚠️ [answerSaveQueue] flush pausado: sin token, ${pending} respuestas seguras en localStorage`)
      }
      flushInProgress = false
      notifyListeners()
      return
    }

    const state = loadQueue()
    // Track IDs that were sent successfully or expired, so we can remove them
    // without overwriting answers added to localStorage during the flush
    const processedIds = new Set<string>()

    for (const answer of state.answers) {
      if (Date.now() - answer.createdAt > MAX_AGE_MS) {
        console.warn(`⚠️ [answerSaveQueue] Descartando respuesta >7d antigua`)
        logClientError('/api/v2/answer-and-save', new Error(`Respuesta descartada por antigüedad >7d. Creada: ${new Date(answer.createdAt).toISOString()}`), {
          component: 'answerSaveQueue flush expired',
          userId: extractUserId(answer),
        })
        processedIds.add(answer.id)
        continue
      }

      if (answer.retries >= MAX_RETRIES) {
        const timeSinceLastAttempt = answer.lastAttempt ? Date.now() - answer.lastAttempt : Infinity
        if (timeSinceLastAttempt > 60000) {
          answer.retries = 0
          answer.lastAttempt = null
        } else {
          continue // skip, leave in queue
        }
      }

      if (answer.lastAttempt) {
        const delay = BASE_DELAY_MS * Math.pow(2, answer.retries)
        if (Date.now() - answer.lastAttempt < delay) {
          continue // skip, leave in queue
        }
      }

      const success = await syncOne(answer, token)
      if (success) {
        processedIds.add(answer.id)
        continue
      }

      answer.retries++
      answer.lastAttempt = Date.now()
      // Update this answer in-place in localStorage so retry state persists
      // (will be preserved in the merge below)
    }

    // MERGE: re-read localStorage to pick up answers added during the flush,
    // then remove only the ones we successfully processed.
    const freshState = loadQueue()
    const merged = freshState.answers.filter(a => !processedIds.has(a.id))
    // Apply retry state updates to answers that failed
    for (const updated of state.answers) {
      if (!processedIds.has(updated.id) && updated.lastAttempt) {
        const idx = merged.findIndex(a => a.id === updated.id)
        if (idx !== -1) {
          merged[idx].retries = updated.retries
          merged[idx].lastAttempt = updated.lastAttempt
        }
      }
    }
    saveQueue({ answers: merged })
    notifyListeners()

    // If there are still pending answers (added during flush), schedule another flush
    if (merged.length > 0) {
      setTimeout(() => flush().catch(() => {}), 500)
    }
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

/**
 * MEJORA #2: verificar auth ANTES de empezar un test.
 * Devuelve true si hay token válido, false si auth está roto.
 */
export async function verifyAuthReady(): Promise<boolean> {
  const token = await getAccessToken()
  return token !== null
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

  // MEJORA #3: escuchar cambios de auth para flush automático
  // Cuando el usuario se re-autentica, flushear cola pendiente
  import('@/lib/supabase').then(({ getSupabaseClient }) => {
    try {
      const supabase = getSupabaseClient()
      supabase.auth.onAuthStateChange((event: string) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          authFailCount = 0
          const pending = getPendingCount()
          if (pending > 0) {
            console.log(`🔄 [answerSaveQueue] Auth restaurado (${event}), flushing ${pending} pendientes`)
            flush().catch(() => {})
          }
        }
      })
    } catch {}
  }).catch(() => {})
}
