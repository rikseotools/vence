// lib/api/featureLimits.ts — Límite de uso DIARIO de una FEATURE (free + anónimos)
//
// Primitivo GENÉRICO para gatear cualquier funcionalidad tras premium. Es la
// generalización del patrón probado de lib/api/chatLimit.ts: mismo diseño de
// identidad, contador Redis atómico y fail-open, pero parametrizado por `feature`
// para que añadir un gate nuevo sea 1 llamada. (chatLimit sigue aparte; se podría
// migrar sobre esto en el futuro sin prisa.)
//
// Diseño (espejo de chatLimit.ts / dailyLimit.ts):
// - Contador atómico cross-lambda en Redis (incrementCounterWithTtl), clave
//   date-stamped `featlimit:{feature}:{scope}:{id}:{YYYYMMDD}` → reset automático a
//   medianoche UTC.
// - FAIL-OPEN: si Redis cae, getCounter devuelve 0 → se permite. Un blip nunca
//   bloquea (mismo principio que dailyLimit/chatLimit/deviceLimit).
// - INVARIANTE: premium → sin límite (allowed siempre, no cuenta). isPremium es la
//   única fuente de verdad; nunca se deriva del contador.
// - Identidad: logueado → userId; anónimo → deviceId (X-Device-Id, huella hardware
//   que sobrevive a borrar localStorage/incógnito) con fallback a IP.
// - Límite y modo (off/shadow/on) configurables por env/SSM sin redeploy, por-feature.
//
// Uso:
//   const idy = { userId, deviceId, ip, isPremium }
//   const st = await getFeatureLimitStatus({ feature: 'teoria_search', freeLimit: 5 }, idy)
//   if (!st.allowed) return 429...
//   ...ejecutar la acción...
//   await consumeFeatureLimit({ feature: 'teoria_search', freeLimit: 5 }, idy)

import { getCounter, incrementCounterWithTtl } from '@/lib/cache/redis'

export type FeatureLimitScope = 'user' | 'device' | 'ip'
export type FeatureLimitMode = 'off' | 'shadow' | 'on'

export interface FeatureLimitConfig {
  /** Nombre estable de la feature. Va en la clave Redis y en las envs de override. */
  feature: string
  /** Tope diario para free + anónimos. */
  freeLimit: number
}

export interface FeatureIdentity {
  userId?: string | null
  deviceId?: string | null
  ip: string
  isPremium: boolean
}

export interface FeatureLimitResult {
  /** true = puede continuar. Premium o Redis-caído → siempre true. */
  allowed: boolean
  used: number
  /** Tope aplicado. Infinity para premium. */
  limit: number
  /** max(0, limit - used). Infinity para premium. */
  remaining: number
  isPremium: boolean
  scope: FeatureLimitScope | 'premium'
}

// ── Config (defaults en código, override por env/SSM por-feature) ─────────────

/** Nombre de env en MAYÚSCULAS a partir del feature: teoria_search → TEORIA_SEARCH. */
function envPrefix(feature: string): string {
  return feature.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
}

/** Límite efectivo: env `<FEATURE>_FREE_LIMIT` si es un entero > 0, si no el default. */
export function getFeatureLimit(config: FeatureLimitConfig): number {
  const raw = process.env[`${envPrefix(config.feature)}_FREE_LIMIT`]
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return config.freeLimit
}

/** off = no aplica; shadow = cuenta y registra el would-block pero NO bloquea;
 *  on = aplica el bloqueo. Default 'on'. Override: env `<FEATURE>_LIMIT_MODE`. */
export function getFeatureLimitMode(feature: string): FeatureLimitMode {
  const v = (process.env[`${envPrefix(feature)}_LIMIT_MODE`] || 'on').toLowerCase()
  if (v === 'off') return 'off'
  if (v === 'shadow') return 'shadow'
  return 'on'
}

// ── Identidad + clave ─────────────────────────────────────────────────────────

interface ResolvedIdentity {
  scope: FeatureLimitScope
  id: string
}

function resolveIdentity(idy: FeatureIdentity): ResolvedIdentity {
  const loggedIn = !!idy.userId && idy.userId !== 'anonymous'
  if (loggedIn) return { scope: 'user', id: idy.userId as string }
  if (idy.deviceId) return { scope: 'device', id: idy.deviceId }
  return { scope: 'ip', id: idy.ip || 'unknown' }
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
  // Buffer 5 min para que el TTL no expire justo antes del cambio de date-stamp.
  return Math.max(60, secs) + 300
}

function counterKey(feature: string, id: ResolvedIdentity): string {
  return `featlimit:${feature}:${id.scope}:${id.id}:${utcDayStamp()}`
}

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Lee (NO incrementa) el contador de la feature para esta identidad. Gate antes
 * de ejecutar la acción. Premium → siempre allowed (invariante). Redis caído →
 * used=0 → allowed (fail-open). En modo 'off' → allowed con limit=Infinity.
 */
export async function getFeatureLimitStatus(
  config: FeatureLimitConfig,
  idy: FeatureIdentity,
): Promise<FeatureLimitResult> {
  if (idy.isPremium) {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity, isPremium: true, scope: 'premium' }
  }
  if (getFeatureLimitMode(config.feature) === 'off') {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity, isPremium: false, scope: 'premium' }
  }
  const identity = resolveIdentity(idy)
  const limit = getFeatureLimit(config)
  const used = await getCounter(counterKey(config.feature, identity))
  const wouldBlock = used >= limit
  // shadow: cuenta pero NO bloquea (rollout seguro).
  const allowed = getFeatureLimitMode(config.feature) === 'shadow' ? true : !wouldBlock
  return {
    allowed,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    isPremium: false,
    scope: identity.scope,
  }
}

/**
 * Incremento atómico con TTL = fin de día UTC. Llamar SOLO tras una acción
 * exitosa (no consumir cuota en error). No-op para premium, modo 'off', o Redis
 * caído.
 */
export async function consumeFeatureLimit(
  config: FeatureLimitConfig,
  idy: FeatureIdentity,
): Promise<void> {
  if (idy.isPremium) return
  if (getFeatureLimitMode(config.feature) === 'off') return
  const identity = resolveIdentity(idy)
  await incrementCounterWithTtl(counterKey(config.feature, identity), secondsUntilUtcMidnight(), 1)
}
