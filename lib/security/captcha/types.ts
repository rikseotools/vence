// lib/security/captcha/types.ts
//
// Port (interfaz agnóstica) de la capa de verificación humana / CAPTCHA.
//
// Filosofía (igual que el resto del codebase): "agnóstico by contract".
// Hoy el adapter concreto es Cloudflare Turnstile; mañana puede ser hCaptcha,
// reCAPTCHA o AWS WAF Challenge sin que NINGÚN caller cambie — solo se añade
// un fichero en `providers/` y se cambia una env var.
//
// Quien protege un endpoint NO importa de aquí el proveedor: usa el helper de
// servidor `verifyHumanChallenge` (verify.ts), que resuelve el verifier activo.

export type CaptchaProvider = 'turnstile' | 'hcaptcha' | 'recaptcha' | 'disabled'

/** Contexto opcional de una verificación (todo best-effort). */
export interface CaptchaVerifyContext {
  /** IP del cliente — algunos proveedores la cruzan con el token. */
  remoteIp?: string
  /**
   * Nombre lógico de la acción protegida (`load_questions`, `refund_request`…).
   * Se usa para observabilidad y, si el widget embebió una `action`, para
   * comprobar que el token corresponde a la acción esperada.
   */
  action?: string
  /**
   * Clave de idempotencia. Turnstile permite re-verificar el mismo token una
   * segunda vez pasando `idempotency_key`; útil si el verify se reintenta.
   */
  idempotencyKey?: string
}

/** Resultado tipado y agnóstico de una verificación. */
export interface CaptchaResult {
  success: boolean
  provider: CaptchaProvider
  /** Códigos de error del proveedor (p.ej. Turnstile `invalid-input-response`). */
  errorCodes?: string[]
  /** Timestamp ISO en que se resolvió el reto (si el proveedor lo devuelve). */
  challengeTs?: string
  /** Hostname donde se resolvió el reto (si el proveedor lo devuelve). */
  hostname?: string
  /** `action` embebida en el widget (si la hay). */
  action?: string
  /** Latencia de la llamada de verificación en ms (telemetría). */
  latencyMs?: number
  /**
   * `true` cuando el resultado NO viene de una verificación real sino de un
   * fallback (proveedor caído + política fail-open). El caller puede querer
   * registrarlo distinto. NUNCA `true` en un éxito legítimo.
   */
  degraded?: boolean
}

/**
 * Port. Un adapter de proveedor implementa exactamente esto.
 * `verify` NUNCA debe lanzar: traduce cualquier fallo a `success:false`
 * (o `degraded` si el caller decide fail-open por encima).
 */
export interface CaptchaVerifier {
  readonly provider: CaptchaProvider
  verify(token: string, ctx?: CaptchaVerifyContext): Promise<CaptchaResult>
}
