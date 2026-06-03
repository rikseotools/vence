// lib/security/captcha/providers/turnstile.ts
//
// Adapter de Cloudflare Turnstile. Implementa el port `CaptchaVerifier`.
// Único punto del codebase que conoce el endpoint y el formato de Cloudflare.

import type {
  CaptchaResult,
  CaptchaVerifier,
  CaptchaVerifyContext,
} from '../types'

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Forma del JSON que devuelve siteverify (campos relevantes). */
interface TurnstileSiteverifyResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

export interface TurnstileVerifierOptions {
  secretKey: string
  timeoutMs?: number
}

/**
 * Crea un verifier Turnstile. `verify` NUNCA lanza: cualquier fallo de red,
 * timeout o respuesta inesperada se traduce a `success:false` con un
 * `error-code` sintético, para que la política de fail-open/closed la decida
 * la capa superior (verify.ts), no el adapter.
 */
export function createTurnstileVerifier(
  opts: TurnstileVerifierOptions,
): CaptchaVerifier {
  const timeoutMs = opts.timeoutMs ?? 3000

  return {
    provider: 'turnstile',
    async verify(
      token: string,
      ctx?: CaptchaVerifyContext,
    ): Promise<CaptchaResult> {
      const started = Date.now()

      if (!token) {
        return {
          success: false,
          provider: 'turnstile',
          errorCodes: ['missing-input-response'],
          latencyMs: 0,
        }
      }

      const body = new URLSearchParams()
      body.set('secret', opts.secretKey)
      body.set('response', token)
      if (ctx?.remoteIp) body.set('remoteip', ctx.remoteIp)
      if (ctx?.idempotencyKey) body.set('idempotency_key', ctx.idempotencyKey)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const res = await fetch(SITEVERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
          // Nunca cachear una verificación de captcha.
          cache: 'no-store',
        })

        if (!res.ok) {
          return {
            success: false,
            provider: 'turnstile',
            errorCodes: [`http-${res.status}`],
            latencyMs: Date.now() - started,
          }
        }

        const data = (await res.json()) as TurnstileSiteverifyResponse

        return {
          success: data.success === true,
          provider: 'turnstile',
          errorCodes: data['error-codes'],
          challengeTs: data.challenge_ts,
          hostname: data.hostname,
          action: data.action,
          latencyMs: Date.now() - started,
        }
      } catch (err) {
        const aborted = err instanceof Error && err.name === 'AbortError'
        return {
          success: false,
          provider: 'turnstile',
          errorCodes: [aborted ? 'verify-timeout' : 'verify-network-error'],
          latencyMs: Date.now() - started,
        }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
