// lib/api/rateLimit.ts — In-memory rate limiter por IP (sliding window)
// Zero dependencies, zero latency, zero cost.
// Se resetea en cold start de Vercel (aceptable para burst protection).

interface RateLimitEntry {
  timestamps: number[]
}

const stores = new Map<string, Map<string, RateLimitEntry>>()

// Cleanup automático cada 5 minutos para evitar memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    stores.forEach((store) => {
      store.forEach((entry, ip) => {
        // Eliminar entradas sin actividad en los últimos 10 minutos
        entry.timestamps = entry.timestamps.filter(t => now - t < 10 * 60 * 1000)
        if (entry.timestamps.length === 0) {
          store.delete(ip)
        }
      })
    })
  }, CLEANUP_INTERVAL)
}

interface RateLimitConfig {
  /** Nombre del rate limiter (para logs y admin) */
  name: string
  /** Máximo de requests en la ventana */
  maxRequests: number
  /** Ventana en milisegundos */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number
}

/**
 * Verifica si una IP puede hacer un request.
 * Sliding window: cuenta requests en los últimos windowMs milisegundos.
 */
export function checkRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  ensureCleanup()

  if (!stores.has(config.name)) {
    stores.set(config.name, new Map())
  }
  const store = stores.get(config.name)!

  const now = Date.now()
  const windowStart = now - config.windowMs

  if (!store.has(ip)) {
    store.set(ip, { timestamps: [] })
  }

  const entry = store.get(ip)!

  // Limpiar timestamps fuera de la ventana
  entry.timestamps = entry.timestamps.filter(t => t > windowStart)

  if (entry.timestamps.length >= config.maxRequests) {
    // Bloqueado
    const oldestInWindow = entry.timestamps[0]
    const resetMs = oldestInWindow + config.windowMs - now

    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(resetMs, 0),
    }
  }

  // Permitido — registrar timestamp
  entry.timestamps.push(now)

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetMs: 0,
  }
}

// ============================================
// CONFIGURACIONES PRE-DEFINIDAS
// ============================================

/** /api/questions/filtered — 10 requests por minuto */
export const RATE_LIMIT_QUESTIONS: RateLimitConfig = {
  name: 'questions-filtered',
  maxRequests: 10,
  windowMs: 60 * 1000,
}

/** /api/answer — 60 requests por minuto */
export const RATE_LIMIT_ANSWER: RateLimitConfig = {
  name: 'answer',
  maxRequests: 60,
  windowMs: 60 * 1000,
}

/** /api/psychometric-test-data/questions — 10 requests por minuto */
export const RATE_LIMIT_PSYCHOMETRIC: RateLimitConfig = {
  name: 'psychometric-questions',
  maxRequests: 10,
  windowMs: 60 * 1000,
}

/** Chat IA — burst guard por IP (30 requests por minuto).
 * Anti-hammering para cualquier identidad (anónimo o logueado). El tope DIARIO
 * real vive en lib/api/chatLimit.ts (Redis, cross-lambda). Esto solo corta
 * ráfagas de bots: 30/min = un mensaje cada 2s sostenido, holgado para un humano. */
export const RATE_LIMIT_CHAT: RateLimitConfig = {
  name: 'chat',
  maxRequests: 30,
  windowMs: 60 * 1000,
}

/** Anonymous answer validation — 30 per IP per day (rolling 24h window).
 * Was 5, but logged-in users with expired Supabase tokens fall here too.
 * With 5, premium users mid-session got 401 → fallback showed wrong answer.
 * 30 allows a full test session to recover via retry while still limiting bots.
 * Real anti-scraping is in RATE_LIMIT_ANSWER (60/min per IP for all users). */
export const RATE_LIMIT_ANON_ANSWER: RateLimitConfig = {
  name: 'anon-answer',
  maxRequests: 30,
  windowMs: 24 * 60 * 60 * 1000,
}

// ============================================
// HELPER para extraer IP del request
// ============================================

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
