// lib/api/chatLimit.ts — Límite de uso DIARIO del chat IA (free + anónimos)
//
// Por qué: el chat gasta el grueso del coste OpenAI en `explicar_respuesta`, que
// estaba EXENTO de límite para free, y los anónimos (userId null) no tenían tope
// ninguno. Este módulo pone topes diarios reutilizando la infra de identidad ya
// existente (dispositivo por huella hardware → IP) y un contador atómico en Redis.
//
// Diseño (espejo de lib/api/dailyLimit.ts):
// - Contador atómico cross-lambda en Redis (incrementCounterWithTtl), clave
//   date-stamped por {bucket}:{scope}:{id}:{YYYYMMDD} → reset automático a medianoche UTC.
// - FAIL-OPEN: si Redis cae, getCounter devuelve 0 → se permite. Un blip nunca bloquea
//   (mismo principio que dailyLimit.ts / deviceLimit.ts).
// - Premium → sin límite (no cuenta).
// - Identidad: logueado → userId; anónimo → deviceId (X-Device-Id, huella hardware que
//   sobrevive a borrar localStorage/incógnito) con fallback a IP.
// - Buckets: free logueado tiene 'explain' y 'free' SEPARADOS; anónimo tiene un único
//   cubo 'anon' combinado.
// - Límites y modo configurables por env (override vía SSM /vence-frontend/* sin redeploy).

import { getCounter, incrementCounterWithTtl } from '@/lib/cache/redis'

export type ChatBucket = 'explain' | 'free' | 'anon'
export type ChatLimitScope = 'user' | 'device' | 'ip'
export type ChatLimitMode = 'off' | 'shadow' | 'on'

export interface ChatLimitResult {
  /** true = puede continuar. En premium o Redis-caído siempre true. */
  allowed: boolean
  used: number
  /** Tope del cubo. Infinity para premium. */
  limit: number
  scope: ChatLimitScope
  bucket: ChatBucket
}

interface ChatLimitParams {
  userId?: string | null
  deviceId?: string | null
  ip: string
  /** Cubo solicitado por el caller (explain/free). Para anónimo se normaliza a 'anon'. */
  bucket: ChatBucket
  isPremium: boolean
}

// ── Config (defaults en código, override por env/SSM) ─────────────────────────

function intEnv(name: string, def: number): number {
  const raw = process.env[name]
  if (!raw) return def
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : def
}

export function getChatLimits(): { anon: number; freeExplain: number; freeChat: number } {
  return {
    anon: intEnv('CHAT_LIMIT_ANON', 5),
    freeExplain: intEnv('CHAT_LIMIT_FREE_EXPLAIN', 10),
    freeChat: intEnv('CHAT_LIMIT_FREE_CHAT', 5),
  }
}

/** off = desactivado; shadow = cuenta y registra el would-block pero NO bloquea;
 * on = aplica el 429. Default 'on'. Permite rollout seguro (shadow 1-2 días). */
export function getChatLimitMode(): ChatLimitMode {
  const v = (process.env.CHAT_LIMITS_MODE || 'on').toLowerCase()
  if (v === 'off') return 'off'
  if (v === 'shadow') return 'shadow'
  return 'on'
}

// ── Identidad + clave ─────────────────────────────────────────────────────────

interface ResolvedIdentity {
  scope: ChatLimitScope
  id: string
  limit: number
  bucket: ChatBucket
}

function resolveIdentity(params: ChatLimitParams): ResolvedIdentity {
  const limits = getChatLimits()
  const { userId, deviceId, ip, bucket } = params
  const loggedIn = !!userId && userId !== 'anonymous'

  if (!loggedIn) {
    // Anónimo: cubo único 'anon' (explain + free combinados), por dispositivo→IP.
    if (deviceId) return { scope: 'device', id: deviceId, limit: limits.anon, bucket: 'anon' }
    return { scope: 'ip', id: ip || 'unknown', limit: limits.anon, bucket: 'anon' }
  }

  // Free logueado: cubos separados.
  const limit = bucket === 'explain' ? limits.freeExplain : limits.freeChat
  return { scope: 'user', id: userId as string, limit, bucket: bucket === 'explain' ? 'explain' : 'free' }
}

function utcDayStamp(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function secondsUntilUtcMidnight(): number {
  const now = new Date()
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  const secs = Math.ceil((next - now.getTime()) / 1000)
  // Buffer de 5 min para evitar que el TTL expire justo antes del cambio de date-stamp.
  return Math.max(60, secs) + 300
}

function counterKey(id: ResolvedIdentity): string {
  return `chatlimit:${id.bucket}:${id.scope}:${id.id}:${utcDayStamp()}`
}

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Lee (NO incrementa) el contador del cubo para esta identidad. Gate antes de generar.
 * Premium → siempre allowed. Redis caído → used=0 → allowed (fail-open).
 */
export async function getChatLimitStatus(params: ChatLimitParams): Promise<ChatLimitResult> {
  if (params.isPremium) {
    return { allowed: true, used: 0, limit: Infinity, scope: 'user', bucket: params.bucket }
  }
  const identity = resolveIdentity(params)
  const used = await getCounter(counterKey(identity))
  return {
    allowed: used < identity.limit,
    used,
    limit: identity.limit,
    scope: identity.scope,
    bucket: identity.bucket,
  }
}

/**
 * Incremento atómico con TTL = fin de día UTC. Llamar SOLO tras una respuesta
 * exitosa (no consumir cuota en error). No-op para premium o si Redis cae.
 */
export async function incrementChatUsage(params: ChatLimitParams): Promise<void> {
  if (params.isPremium) return
  const identity = resolveIdentity(params)
  await incrementCounterWithTtl(counterKey(identity), secondsUntilUtcMidnight(), 1)
}
