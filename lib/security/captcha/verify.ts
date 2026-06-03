// lib/security/captcha/verify.ts
//
// Helper de servidor de ALTO NIVEL — el único que usan los endpoints.
// Encapsula: capa desactivada → no-op; extraer token; verificar con el
// proveedor activo; emitir observabilidad; aplicar política fail-open/closed.
//
// Uso en un endpoint protegido (tras decidir con la policy que toca retar):
//
//   const outcome = await verifyHumanChallenge(req, { action: 'load_questions' })
//   if (!outcome.ok) return challengeRequiredResponse('load_questions')
//   // ...continúa sirviendo

import { emitFireAndForget } from '@/lib/observability/emit'
import { getCaptchaConfig } from './config'
import { extractCaptchaToken } from './challenge'
import { getCaptchaVerifier } from './factory'
import type { CaptchaResult } from './types'

export interface VerifyHumanOptions {
  /** Nombre lógico de la acción (telemetría + match de action del widget). */
  action: string
  /**
   * Sobrescribe el fail-open por defecto para esta acción concreta.
   * `false` = fail-closed (si el proveedor falla, NO dejar pasar). Úsalo en
   * acciones de alto valor (reembolsos, borrado de cuenta).
   */
  failOpen?: boolean
  /** IP del cliente, para cruzarla con el token. */
  remoteIp?: string
  /** Endpoint para la traza de observabilidad. */
  endpoint?: string
  /** userId para correlación en observabilidad (no afecta a la verificación). */
  userId?: string
}

export interface VerifyHumanOutcome {
  /** ¿Puede continuar el endpoint? */
  ok: boolean
  /** Si !ok: ¿es porque falta/ falló el reto (→ pedir challenge al cliente)? */
  challengeRequired: boolean
  /** Resultado crudo del proveedor (si hubo verificación). */
  result?: CaptchaResult
}

/**
 * Verifica el reto humano de una petición.
 *
 * Semántica:
 * - Capa desactivada (flag off / sin claves) → `{ ok:true }` (no-op, pasa).
 * - Sin token → `{ ok:false, challengeRequired:true }` (pide reto).
 * - Token válido → `{ ok:true }`.
 * - Token inválido → `{ ok:false, challengeRequired:true }` (re-reta).
 * - Error del proveedor (red/timeout) → fail-open ? `{ ok:true(degraded) }`
 *   : `{ ok:false, challengeRequired:true }`.
 *
 * NUNCA lanza.
 */
export async function verifyHumanChallenge(
  req: { headers: { get(name: string): string | null } },
  opts: VerifyHumanOptions,
): Promise<VerifyHumanOutcome> {
  const cfg = getCaptchaConfig()
  const verifier = getCaptchaVerifier()

  // Capa apagada → no-op. El gate superior no debería ni llamarnos, pero
  // somos defensivos: nunca bloquear si el captcha no está operativo.
  if (!cfg.enabled || !verifier) {
    return { ok: true, challengeRequired: false }
  }

  const token = extractCaptchaToken(req)
  if (!token) {
    emit('captcha_issued', 'info', opts)
    return { ok: false, challengeRequired: true }
  }

  const result = await verifier.verify(token, {
    action: opts.action,
    remoteIp: opts.remoteIp,
  })

  if (result.success) {
    emit('captcha_passed', 'info', opts, result)
    return { ok: true, challengeRequired: false, result }
  }

  // Distinguir "el usuario falló el reto" de "el proveedor no respondió".
  const providerError = (result.errorCodes ?? []).some((c) =>
    ['verify-timeout', 'verify-network-error'].includes(c) || c.startsWith('http-'),
  )
  const failOpen = opts.failOpen ?? cfg.failOpen

  if (providerError && failOpen) {
    emit('captcha_failed', 'warn', opts, { ...result, degraded: true })
    return {
      ok: true,
      challengeRequired: false,
      result: { ...result, degraded: true },
    }
  }

  emit('captcha_failed', providerError ? 'error' : 'warn', opts, result)
  return { ok: false, challengeRequired: true, result }
}

/** Telemetría fire-and-forget hacia observable_events. */
function emit(
  eventType: 'captcha_issued' | 'captcha_passed' | 'captcha_failed',
  severity: 'info' | 'warn' | 'error',
  opts: VerifyHumanOptions,
  result?: CaptchaResult,
): void {
  emitFireAndForget({
    source: 'vercel',
    severity,
    eventType,
    endpoint: opts.endpoint,
    userId: opts.userId,
    durationMs: result?.latencyMs,
    metadata: {
      action: opts.action,
      provider: result?.provider,
      errorCodes: result?.errorCodes,
      degraded: result?.degraded,
    },
  })
}
