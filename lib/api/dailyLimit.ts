// lib/api/dailyLimit.ts — Server-side enforcement of daily question limits
// Uses graduated limits: new users get 25/day, veterans who repeatedly hit the limit get less.
// The client hook (useDailyQuestionLimit) shows the UI modal,
// but this module is the actual gate that prevents bypassing via direct API calls.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { NextRequest } from 'next/server'
import { getDynamicLimit, invalidateLimitCache, GRADUATED_LIMIT_CONFIG } from './daily-limit'
import type { DailyLimitStatus } from './daily-limit'
// Fase 1.5 outbox sprint (28/05/2026): cache Redis cross-lambda para
// las 2 RPCs daily-limit. Ver docs/roadmap/sprint-outbox-test-questions.md
import { getOrSet, invalidate as redisInvalidate } from '@/lib/cache/redis'

/**
 * ¿Esta respuesta debe consumir cupo del plan gratuito?
 *
 * PURA a propósito: es la regla de negocio del cobro de cupo y se comparte con el
 * backend NestJS (copia en `backend/src/daily-limit/daily-limit.service.ts`, con
 * guardarraíl de paridad en `__tests__/guardrails/dailyQuotaServerSide.test.ts`).
 *
 * REGLA: cobra el SERVIDOR y solo cuando la respuesta se ha PERSISTIDO por primera vez.
 *  - `saved_new`      → la fila entró en `test_questions` → consume 1.
 *  - `already_saved`  → reintento de la cola / doble clic; la fila ya estaba (constraint
 *                       único) → NO consume. Aquí vive la idempotencia, sin tabla extra.
 *  - `save_failed`    → no hay registro → no se cobra al usuario algo que no tiene.
 *  - premium          → nunca consume (la función SQL también lo corta; esto lo explicita).
 *
 * POR QUÉ (incidente 29/07/2026, caso Sergio): el contador lo incrementaba SOLO el
 * cliente (`useDailyQuestionLimit.recordAnswer` → `/api/v2/daily-question/increment`),
 * desacoplado del guardado, sin idempotencia y sin saber si la respuesta llegó a
 * persistirse. Medido en 14 días: 41 usuarios free agotaron el tope de 25 habiendo
 * respondido una media de 13 preguntas. `incrementDailyCount` existía pero no la
 * llamaba nadie.
 */
export type AnswerSaveAction = 'saved_new' | 'already_saved' | 'save_failed'

export function debeConsumirCupo(
  saveAction: string | null | undefined,
  isPremium: boolean,
): boolean {
  if (isPremium) return false
  return saveAction === 'saved_new'
}

/**
 * ¿Rellenar esta fila ESTRENA una respuesta (y por tanto cobra cupo)?
 *
 * Hay dos familias de examen que **pre-crean sus filas** en `test_questions` al abrirse,
 * con `user_answer` vacío. Ahí el guardado es un UPDATE, así que «existe la fila» NO
 * significa «ya respondió»: significa que el examen está abierto. La respuesta se estrena
 * cuando esa casilla en blanco se rellena; **rectificar** una respuesta ya dada, no.
 *
 * Vive aquí, junto a `debeConsumirCupo`, porque es la MISMA decisión vista un paso antes,
 * y porque ya estaba escrita a mano en dos sitios (T-450, 02/08/2026): el examen normal
 * (`lib/api/exam/queries.ts`) y —sin escribirla, que es el defecto— el examen oficial
 * (`lib/api/official-exams/queries.ts`), donde 100 usuarios free respondieron 4.975
 * preguntas en 7 días sin que el contador se moviera. Una tercera copia habría sido la
 * tercera forma de equivocarse.
 */
export function estrenaRespuesta(userAnswerPrevio: string | null | undefined): boolean {
  return userAnswerPrevio == null || userAnswerPrevio.trim() === ''
}

interface DailyLimitResult {
  allowed: boolean
  questionsToday: number
  questionsRemaining: number
  dailyLimit: number
  isPremium: boolean
  isGraduated: boolean
  tierLabel: string | null
  // true cuando el resultado proviene de un FALLBACK por error/timeout de la BD
  // (no de una lectura real). Los callers deben tratarlo como "no sé" y NO
  // aplicar límites secundarios (device-daily-limit) sobre él — fail-open. Un
  // blip de BD nunca debe bloquear a un usuario (free o premium). Ver
  // project_exam_mode_answers_not_persisting + ARCHITECTURE_ROADMAP TRAMPA 2.
  degraded?: boolean
}

// AGNÓSTICO (Fase C1): server-only (solo lo importan app/api/*). Las RPCs plpgsql
// se invocan vía Drizzle (getAdminDb, bypass RLS = equivalente al service role) en
// vez de supabase.rpc — portable a RDS/Neon (PostgREST no existe allí).
function rowsOf(res: unknown): any[] {
  return (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as any[]
}

// ============================================
// CACHE in-memory PREMIUM-ONLY (TTL 60s)
// ============================================
// Solo cachea getDailyLimitStatus cuando isPremium=true (no tienen límite,
// cero riesgo de bypass). Free users SIEMPRE consultan BD para mantener
// anti-fraud preciso. Cache in-memory por lambda (no shared) — no toca
// Vercel Data Cache.
//
// Edge case: si user pierde premium (downgrade Stripe), cache devuelve
// isPremium=true durante hasta 60s. Aceptable porque downgrade post-checkout
// es muy raro y la ventana es corta.
const dailyLimitPremiumCache = new Map<string, { data: DailyLimitResult; t: number }>()
const DAILY_LIMIT_CACHE_TTL_MS = 60_000

/**
 * Extract the authenticated userId from the Bearer token.
 * Returns null if no token or invalid — never throws.
 *
 * Refactor 2026-05-11: delegado a verifyAuthOptional (Fase 0.7).
 * Hereda los modos off/shadow/on del wrapper.
 */
export async function getUserIdFromToken(request: NextRequest): Promise<string | null> {
  const { verifyAuthOptional } = await import('@/lib/api/auth/verifyAuth')
  const auth = await verifyAuthOptional(request, '/lib/api/dailyLimit')
  return auth?.userId ?? null
}

/**
 * Check and increment the daily question counter for a user.
 * Uses graduated limits based on registration age and limit hit history.
 *
 * If userId is null (anonymous), always allows (rate limiting handles anonymous abuse).
 */
export async function checkAndIncrementDailyLimit(
  userId: string | null | undefined,
): Promise<DailyLimitResult> {
  const defaultLimit = GRADUATED_LIMIT_CONFIG.defaultLimit

  if (!userId) {
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
  }

  try {
    // Get the personalized limit for this user
    const dynamicLimit = await getDynamicLimit(userId)

    const incRes = await getAdminDb().execute(sql`
      SELECT * FROM increment_daily_questions(${userId}::uuid, ${dynamicLimit.dailyLimit})
    `)
    const result = rowsOf(incRes)[0]

    if (!result) {
      return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
    }

    // Log graduated limits for observability
    if (dynamicLimit.isGraduated) {
      console.log(`📉 [DailyLimit] Graduated limit applied: user=${userId.slice(0, 8)} tier=${dynamicLimit.tierLabel} limit=${dynamicLimit.dailyLimit} today=${result.questions_today} age=${dynamicLimit.registrationAgeDays}d hits=${dynamicLimit.totalLimitHits}`)
    }

    // Log when a graduated user hits their reduced limit
    if (dynamicLimit.isGraduated && !result.can_answer) {
      console.log(`🚫 [DailyLimit] Graduated user blocked: user=${userId.slice(0, 8)} tier=${dynamicLimit.tierLabel} limit=${dynamicLimit.dailyLimit}`)
    }

    return {
      allowed: result.can_answer,
      questionsToday: result.questions_today,
      questionsRemaining: result.questions_remaining,
      dailyLimit: dynamicLimit.dailyLimit,
      isPremium: result.is_premium,
      isGraduated: dynamicLimit.isGraduated,
      tierLabel: dynamicLimit.tierLabel,
    }
  } catch (err) {
    console.error('❌ [DailyLimit] Unexpected error:', err)
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
  }
}

/**
 * Check if a device (across all its free accounts) has exceeded the daily limit.
 * Uses the DEFAULT limit (25) for device-level checks — graduation is per-user.
 * Returns null if no deviceId or check fails (fail open).
 *
 * Fase 1.5 outbox (28/05/2026): cache Redis TTL 30s. Más corto que las otras
 * 2 porque el conteo de respuestas/día de un device cambia con cada answer.
 * Aceptable: si user hace 25q en 30s y excede, BD bloqueará en el próximo
 * miss (30s después).
 */
export async function checkDeviceDailyUsage(
  deviceId: string | null | undefined,
  fingerprint?: string | null,
): Promise<{ allowed: boolean; deviceTotal: number } | null> {
  // Con huella v2 basta: es la que sobrevive a borrar `localStorage`, que es justo el gesto que
  // hacía inútil el `device_id`. Sin ninguna de las dos no se opina (fail-open).
  const fpV2 = typeof fingerprint === 'string' && fingerprint.startsWith('fp2_') ? fingerprint : null
  if (!deviceId && !fpV2) return null

  return getOrSet<{ allowed: boolean; deviceTotal: number } | null>(
    `device_daily:${deviceId ?? '-'}:${fpV2 ?? '-'}`,
    30,
    async () => {
      try {
        // v2 agrupa por device_id UNIÓN huella v2 — nunca cuenta menos que la anterior
        // (verificado sobre 200 dispositivos reales: 0 regresiones).
        const devRes = await getAdminDb().execute(
          sql`SELECT get_device_daily_usage_v2(${deviceId ?? null}, ${fpV2}) AS total`,
        )
        const total = Number(rowsOf(devRes)[0]?.total) || 0

        return {
          allowed: total < GRADUATED_LIMIT_CONFIG.defaultLimit,
          deviceTotal: total,
        }
      } catch {
        return null
      }
    },
  )
}

/**
 * Increment the daily counter AFTER a successful save.
 * Call this only when the answer was actually persisted — never before.
 * Fail-silent: if increment fails, the user just gets a free question.
 *
 * Fase 1.5 outbox (28/05/2026): tras incrementar, invalidamos las 2 caches
 * (L1 in-memory premium + L2 Redis cross-lambda) para que el próximo
 * `getDailyLimitStatus` lea de BD el nuevo conteo. Si no invalidamos,
 * un user free podría seguir viendo `questionsToday=N` durante hasta
 * TTL_CACHE segundos tras hacer la pregunta N+1 → bypass del límite.
 */
export async function incrementDailyCount(
  userId: string | null | undefined,
  amount = 1,
): Promise<void> {
  if (!userId) return
  // Cobrar 0 (o menos) no es un error: el examen en el que no se respondió nada nuevo
  // llega hasta aquí y lo correcto es no tocar el contador ni gastar una consulta.
  const cantidad = Math.max(0, Math.trunc(amount))
  if (cantidad === 0) return

  try {
    const dynamicLimit = await getDynamicLimit(userId)

    // `amount` existe por el modo EXAMEN (T-450), que persiste sus respuestas EN BLOQUE:
    // cobrarlas de una en una serían ~50 idas y vueltas en un camino que el usuario está
    // esperando. La función SATURA en el tope —`questions_answered` es cupo consumido, no
    // cuenta bruta—, así que pasar un importe grande no puede pasarse de 25.
    await getAdminDb().execute(sql`
      SELECT increment_daily_questions(${userId}::uuid, ${dynamicLimit.dailyLimit}, ${cantidad})
    `)

    // Invalidar cache tras incrementar — siguiente lectura forzada a BD.
    await invalidateDailyLimitCache(userId)
  } catch {
    // Fail silent — better to give a free question than block a paying user
  }
}

/**
 * Read-only check (doesn't increment). Use before loading questions, not after answering.
 *
 * Fase 1.5 outbox sprint (28/05/2026): cache L1 in-memory (premium only) +
 * cache L2 Redis cross-lambda (TTL 30s para free, 60s para premium).
 * Para free el TTL es corto porque el conteo cambia con cada answer; si
 * user excede entre miss y miss, BD bloqueará en próximo cache miss.
 * `incrementDailyCount` invalida explícitamente el cache tras cada save.
 */
/**
 * Decisión de límite (pura, testeable sin BD).
 *
 * INVARIANTE (incidente 07/07/2026): premium NUNCA se bloquea, sea cual sea el
 * conteo. La fuente de verdad del premium es `isPremium` (que en getDailyLimitStatus
 * viene de get_daily_question_status → getAdminDb → misma fuente que
 * increment_daily_questions). NO se deriva de `dailyLimit`/getDynamicLimit, que lee
 * de otro pool (getPoolerDb) y puede divergir dejando a un premium bloqueado en un
 * flujo (psicotécnicos) mientras otro (tests normales) lo exime.
 */
export function computeAllowance(
  isPremium: boolean,
  questionsToday: number,
  dailyLimit: number,
): { allowed: boolean; isLimitReached: boolean; questionsRemaining: number; dailyLimit: number; isPremium: boolean } {
  if (isPremium) {
    return { allowed: true, isLimitReached: false, questionsRemaining: 999, dailyLimit: 999, isPremium: true }
  }
  const isLimitReached = questionsToday >= dailyLimit
  return {
    allowed: !isLimitReached,
    isLimitReached,
    questionsRemaining: Math.max(0, dailyLimit - questionsToday),
    dailyLimit,
    isPremium: false,
  }
}

/**
 * Cuántas preguntas debe CREER el cliente que lleva hoy, contando también el dispositivo.
 *
 * PURA a propósito (como `computeAllowance`, justo arriba): es la regla que decide si sale el
 * muro, y tiene que poder probarse sin BD ni red.
 *
 * POR QUÉ EXISTE ([T-418], 01/08/2026): el servidor rechaza el guardado por DOS motivos —el
 * cupo de la CUENTA y el del DISPOSITIVO (todas las cuentas free del aparato sumadas)— pero el
 * cliente solo conocía el primero, porque `/api/v2/daily-question/status` leía únicamente
 * `get_daily_question_status`. Resultado medido en 14 días: **27 usuarios contestaron 1.471
 * veces sin que la UI les parara**, y el servidor tiró cada respuesta con un 403 que no
 * explicaba nada. La respuesta se veía corregida en pantalla, así que parecía guardada.
 *
 * QUÉ HACE: devolver el mayor de los dos conteos. El cliente ya calcula
 * `isLimitReached = questionsToday >= dailyLimit`, así que con esto el muro salta con **el
 * límite que primero ate**, sin inventar un segundo concepto en la UI ni un mensaje nuevo: al
 * usuario le sale el modal de Premium de siempre, como a cualquier free que agota su cupo
 * (decisión de Manuel, 01/08). Y como el muro sale ANTES de contestar, deja de perderse
 * trabajo: no hay respuesta que tirar.
 *
 * DOS INVARIANTES que no se pueden tocar:
 *  · **premium NUNCA se limita**, pase lo que pase con el aparato (mismo invariante que
 *    `computeAllowance`; incidente 07/07/2026).
 *  · **fail-open**: sin dato de dispositivo (`null`, que es lo que devuelve
 *    `checkDeviceDailyUsage` cuando no hay anclas o falla la consulta) se deja el conteo de la
 *    cuenta tal cual. Un fallo de infraestructura no puede levantar un muro que no toca.
 */
export function conteoEfectivoConDispositivo(
  questionsToday: number,
  isPremium: boolean,
  deviceTotal: number | null | undefined,
): number {
  const propio = Number.isFinite(questionsToday) && questionsToday > 0 ? questionsToday : 0
  if (isPremium) return propio
  if (typeof deviceTotal !== 'number' || !Number.isFinite(deviceTotal)) return propio
  return Math.max(propio, deviceTotal)
}

export async function getDailyLimitStatus(
  userId: string | null | undefined,
): Promise<DailyLimitResult> {
  const defaultLimit = GRADUATED_LIMIT_CONFIG.defaultLimit

  if (!userId) {
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
  }

  // Resultado de FALLBACK ante error/timeout de la BD. Si el usuario era premium
  // conocido (caché L1, ignorando TTL: el plan no cambia en un blip), preservamos
  // su premium → no pierde el bypass por un timeout. Si no lo sabemos, fail-open
  // marcado `degraded` para que los callers NO le apliquen el device-daily-limit.
  const degradedFallback = (): DailyLimitResult => {
    const cp = dailyLimitPremiumCache.get(userId)
    if (cp && cp.data.isPremium) return cp.data
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null, degraded: true }
  }

  // L1 in-memory premium-only (mantiene fast-path lambda local)
  const cached = dailyLimitPremiumCache.get(userId)
  if (cached && cached.data.isPremium && Date.now() - cached.t < DAILY_LIMIT_CACHE_TTL_MS) {
    return cached.data
  }

  // L2 Redis cross-lambda. TTL 30s para free (conservador), pero la lógica
  // interna sube a 60s si detecta isPremium (no hay límite que enforce).
  //
  // CLAVE PROPIA `daily_limit_status:` — NO reutilizar `daily_limit:${userId}`.
  // Incidente 07/07/2026: esa clave la escribe /api/daily-limit con un wrapper
  // `{data, ts}` (CachedDailyLimit) y el backend con otro formato. getOrSet leía
  // ese wrapper y devolvía `{data, ts}` como si fuera el DailyLimitResult →
  // `dailyLimit.allowed` = undefined → los endpoints de respuesta (psico/examen)
  // daban 403 a premium con body de 3 campos. Namespace separado = sin colisión.
  return getOrSet<DailyLimitResult>(`daily_limit_status:${userId}`, 30, async () => {
    try {
      const dynamicLimit = await getDynamicLimit(userId)

      const stRes = await getAdminDb().execute(sql`SELECT * FROM get_daily_question_status(${userId}::uuid)`)
      const result = rowsOf(stRes)[0]

      if (!result) {
        return degradedFallback()
      }

      const questionsToday = result.questions_today || 0
      const allowance = computeAllowance(result.is_premium === true, questionsToday, dynamicLimit.dailyLimit)

      const returnValue: DailyLimitResult = {
        allowed: allowance.allowed,
        questionsToday,
        questionsRemaining: allowance.questionsRemaining,
        dailyLimit: allowance.dailyLimit,
        isPremium: allowance.isPremium,
        isGraduated: dynamicLimit.isGraduated,
        tierLabel: dynamicLimit.tierLabel,
      }

      // L1 update (premium): mantenemos el fast-path lambda local
      if (returnValue.isPremium) {
        dailyLimitPremiumCache.set(userId, { data: returnValue, t: Date.now() })
      }

      return returnValue
    } catch (err) {
      console.error('❌ [DailyLimit] Unexpected error:', err)
      return degradedFallback()
    }
  }, {
    // Defensa en profundidad: si la caché devuelve algo que NO es un
    // DailyLimitResult (colisión de clave, esquema viejo), tratarlo como miss y
    // recomputar — nunca propagar un objeto sin `.allowed` que bloquearía a un
    // premium. Ver incidente 07/07/2026.
    validate: (v) => !!v && typeof (v as DailyLimitResult).allowed === 'boolean',
  })
}

/**
 * Invalida cache daily_limit (L1 premium + L2 Redis) tras cambio relevante
 * (increment, downgrade Stripe, etc.). Llamar tras cada save exitoso.
 */
export async function invalidateDailyLimitCache(userId: string): Promise<void> {
  dailyLimitPremiumCache.delete(userId)
  await redisInvalidate(`daily_limit:${userId}`)
}

/**
 * Invalida el cache premium para un user (usar tras downgrade Stripe).
 * NO necesario para flujos normales — el TTL 60s lo cubre. Llamar solo si
 * quieres invalidación inmediata (ej. webhook Stripe subscription.deleted).
 */
export function invalidateDailyLimitPremiumCache(userId: string): void {
  dailyLimitPremiumCache.delete(userId)
}

// Re-export for convenience
export { invalidateLimitCache } from './daily-limit'
