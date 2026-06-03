// lib/security/captcha/factory.ts
//
// Factory + memoización del verifier activo. En fichero propio (no en index)
// para que `verify.ts` lo importe sin crear un ciclo con el barrel `index.ts`.

import { getCaptchaConfig } from './config'
import { createTurnstileVerifier } from './providers/turnstile'
import type { CaptchaVerifier } from './types'

let _verifier: CaptchaVerifier | null = null
let _verifierKey = '' // invalida el memo si cambia provider/secret (runtime/tests)

/**
 * Devuelve el verifier activo, o `null` si la capa está desactivada (flag off
 * o sin claves). Memoiza por (provider+secret) para no recrear el adapter.
 */
export function getCaptchaVerifier(): CaptchaVerifier | null {
  const cfg = getCaptchaConfig()
  if (!cfg.enabled || !cfg.secretKey) return null

  const key = `${cfg.provider}:${cfg.secretKey.slice(0, 8)}`
  if (_verifier && _verifierKey === key) return _verifier

  switch (cfg.provider) {
    case 'turnstile':
      _verifier = createTurnstileVerifier({
        secretKey: cfg.secretKey,
        timeoutMs: cfg.verifyTimeoutMs,
      })
      break
    // Futuro: case 'hcaptcha' / 'recaptcha' → su createXVerifier(...)
    default:
      _verifier = null
  }
  _verifierKey = key
  return _verifier
}

/** Test-only: resetea el memo del verifier. */
export function _resetVerifierForTests(): void {
  _verifier = null
  _verifierKey = ''
}
