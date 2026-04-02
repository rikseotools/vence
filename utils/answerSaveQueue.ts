// utils/answerSaveQueue.ts — Cola offline-first para guardar respuestas en background
// Guarda en localStorage primero, sincroniza con el servidor sin bloquear la UI.

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
    // localStorage full — drop oldest entries
    if (state.answers.length > 1) {
      state.answers = state.answers.slice(-10)
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(state)) } catch {}
    }
  }
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
      // Sesión expirada — no reintentar, se sincronizará cuando el usuario vuelva a autenticarse
      return false
    }

    return response.ok
  } catch {
    return false
  }
}

// ============================================
// PUBLIC API
// ============================================

let flushInProgress = false
let listeners: Array<(pending: number) => void> = []

function notifyListeners(): void {
  const count = getPendingCount()
  listeners.forEach(fn => fn(count))
}

/**
 * Obtener token de auth actual.
 * Importa dinámicamente para evitar dependencias circulares.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const { getSupabaseClient } = await import('@/lib/supabase')
    const supabase = getSupabaseClient()

    const { data: refreshData } = await supabase.auth.refreshSession()
    if (refreshData?.session?.access_token) return refreshData.session.access_token

    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch {
    return null
  }
}

/**
 * Añadir una respuesta a la cola y sincronizar inmediatamente.
 */
export function enqueueAnswer(payload: Record<string, unknown>): void {
  const state = loadQueue()
  const id = `${payload.questionId || 'unknown'}-${Date.now()}`

  state.answers.push({
    id,
    payload,
    retries: 0,
    createdAt: Date.now(),
    lastAttempt: null,
  })

  saveQueue(state)
  notifyListeners()

  // Intentar sincronizar inmediatamente (fire-and-forget)
  flush().catch(() => {})
}

/**
 * Sincronizar todas las respuestas pendientes con el servidor.
 * Procesa una a una para evitar sobrecargar.
 */
export async function flush(): Promise<void> {
  if (flushInProgress) return
  flushInProgress = true

  try {
    const token = await getAccessToken()
    if (!token) {
      flushInProgress = false
      return
    }

    const state = loadQueue()
    const remaining: QueuedAnswer[] = []

    for (const answer of state.answers) {
      // Descartar si es muy antiguo (> 24h)
      if (Date.now() - answer.createdAt > 24 * 60 * 60 * 1000) continue

      // Descartar si superó máximo de reintentos
      if (answer.retries >= MAX_RETRIES) continue

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
        // Guardado exitosamente — no la añadimos a remaining
        continue
      }

      // Falló — incrementar retries y guardar para después
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
 * Devuelve función para desuscribirse.
 */
export function onPendingChange(fn: (count: number) => void): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter(l => l !== fn)
  }
}

// ============================================
// AUTO-SYNC: listeners de conectividad
// ============================================

if (typeof window !== 'undefined') {
  // Reintentar cuando vuelve la conexión
  window.addEventListener('online', () => {
    flush().catch(() => {})
  })

  // Reintentar cuando la pestaña vuelve a ser visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      flush().catch(() => {})
    }
  })
}
