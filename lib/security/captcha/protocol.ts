// lib/security/captcha/protocol.ts
//
// Parte CLIENT-SAFE del protocolo "challenge required": constantes y type-guards
// que NO dependen de `next/server`. Así el bundle de cliente (fetchWithChallenge,
// widget) puede importarlas sin arrastrar APIs de servidor.
//
// La construcción de la respuesta 403 (NextResponse) y la extracción del token
// del request viven en `challenge.ts` (solo servidor).

/** Cabecera donde viaja el token resuelto por el widget. */
export const CAPTCHA_TOKEN_HEADER = 'x-captcha-token'

/** Cuerpo JSON de una respuesta 403 que pide resolver un reto. */
export interface ChallengeRequiredBody {
  challengeRequired: true
  provider: string
  siteKey: string | null
  action?: string
}

/** Type-guard cliente: ¿este JSON es un "challenge required"? */
export function isChallengeRequiredResponse(
  data: unknown,
): data is ChallengeRequiredBody {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { challengeRequired?: unknown }).challengeRequired === true
  )
}
