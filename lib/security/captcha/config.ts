// lib/security/captcha/config.ts
//
// Configuración central de la capa de captcha. Lee env vars y expone una
// vista tipada. Feature-flag maestro (`CAPTCHA_ENABLED`) para rollback
// instantáneo sin redeploy, en línea con `REDIS_CACHE_ENABLED` del repo.

import type { CaptchaProvider } from './types'

export interface CaptchaConfig {
  /** Maestro: si false, toda la capa es no-op (los gates dejan pasar). */
  enabled: boolean
  provider: CaptchaProvider
  /** Clave pública del widget (también disponible al cliente vía NEXT_PUBLIC). */
  siteKey: string | null
  /** Clave secreta de verificación — SOLO servidor. */
  secretKey: string | null
  /**
   * Por defecto al fallar la VERIFICACIÓN por error del proveedor (red, 5xx):
   * fail-open = dejar pasar (no romper UX si Cloudflare cae). Cada acción puede
   * sobreescribirlo (p.ej. reembolsos → fail-closed).
   */
  failOpen: boolean
  /** Timeout de la llamada de verificación al proveedor (ms). */
  verifyTimeoutMs: number
}

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined || v === '') return def
  return v === 'true' || v === '1'
}

function int(v: string | undefined, def: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : def
}

/**
 * Resuelve la config desde env. La site key se lee de la pública
 * (`NEXT_PUBLIC_*`) para que servidor y cliente vean exactamente la misma.
 *
 * `enabled` exige además que existan las claves del proveedor: sin secret no
 * se puede verificar, así que aunque el flag esté en `true` la capa queda
 * desactivada (fail-safe: nunca "exige captcha pero no puede verificarlo").
 */
export function getCaptchaConfig(): CaptchaConfig {
  const provider = (process.env.CAPTCHA_PROVIDER as CaptchaProvider) || 'turnstile'
  // La SITE KEY de Turnstile es PÚBLICA por diseño: se renderiza en el widget
  // del cliente. No es un secreto; el secreto es CLOUDFLARE_TURNSTILE_SECRET_KEY.
  // eslint-disable-next-line no-restricted-syntax
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY || null
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || null

  const flagOn = bool(process.env.CAPTCHA_ENABLED, false)
  const hasKeys = Boolean(siteKey && secretKey)

  return {
    enabled: flagOn && hasKeys && provider !== 'disabled',
    provider: hasKeys ? provider : 'disabled',
    siteKey,
    secretKey,
    failOpen: bool(process.env.CAPTCHA_FAIL_OPEN, true),
    verifyTimeoutMs: int(process.env.CAPTCHA_VERIFY_TIMEOUT_MS, 3000),
  }
}

/**
 * Site key pública para el cliente. Devuelta también cuando el flag está off,
 * para que el cliente pueda renderizar el widget en previews — pero el gate de
 * servidor es la fuente de verdad (un cliente que se salte el widget igualmente
 * es rechazado por `verifyHumanChallenge`).
 */
export function getPublicSiteKey(): string | null {
  // Pública por diseño (ver getCaptchaConfig). No es un secreto.
  // eslint-disable-next-line no-restricted-syntax
  return process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY || null
}

/** ¿Está la capa activa y operativa (flag on + claves presentes)? */
export function isCaptchaEnabled(): boolean {
  return getCaptchaConfig().enabled
}
