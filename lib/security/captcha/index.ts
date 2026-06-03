// lib/security/captcha/index.ts
//
// Barrel de la capa de captcha. Re-exporta la superficie pública. Los callers
// de alto nivel sólo necesitan `verifyHumanChallenge` + `challengeRequiredResponse`.

export type {
  CaptchaProvider,
  CaptchaResult,
  CaptchaVerifier,
  CaptchaVerifyContext,
} from './types'
export { getCaptchaConfig, getPublicSiteKey, isCaptchaEnabled } from './config'
export { getCaptchaVerifier, _resetVerifierForTests } from './factory'
export {
  CAPTCHA_TOKEN_HEADER,
  challengeRequiredResponse,
  extractCaptchaToken,
  isChallengeRequiredResponse,
} from './challenge'
export type { ChallengeRequiredBody } from './challenge'
export { verifyHumanChallenge } from './verify'
export type { VerifyHumanOptions, VerifyHumanOutcome } from './verify'
