// lib/security/challengePolicy/forceChallenge.ts
//
// Capa C-fácil: reto INMEDIATO por señal de bot, independiente del volumen.
//
// La detección BotD (cliente, `useBotDetection` → `/api/fraud/report`) marca
// huellas de automatización (webdriver, headless, Puppeteer…). Cuando el score es
// alto, marcamos el sujeto (usuario / dispositivo) en Redis con TTL; el gate de
// `/api/questions/filtered` consulta ese flag y reta de inmediato, sin esperar a
// que acumule volumen. No es spoofable: el scraper no puede borrar su propia marca.
//
// Señal de ALTA precisión (un navegador automatizado no es un estudiante) → bajo
// riesgo de falso positivo, y aun así el reto es Turnstile (soft).

import { setCached, getCached } from '@/lib/cache/redis'
import type { GateSubject } from './questionsServed'

/** TTL del flag de "retar siempre" tras una detección de bot. 24h por defecto. */
function forceTtl(): number {
  const n = Number(process.env.CAPTCHA_FORCE_CHALLENGE_TTL_S)
  return Number.isFinite(n) && n > 0 ? n : 24 * 60 * 60
}

function forceKey(subjectKey: string): string {
  return `captcha:force:${subjectKey}`
}

/**
 * Marca uno o más sujetos (p.ej. `userId`, `device:<id>`) para reto forzado.
 * Lo llama `/api/fraud/report` cuando el bot-score es alto. Best-effort.
 */
export async function markForcedChallenge(subjectKeys: string[]): Promise<void> {
  const ttl = forceTtl()
  await Promise.all(
    subjectKeys.filter(Boolean).map((k) => setCached(forceKey(k), 1, ttl)),
  )
}

/**
 * ¿Algún sujeto de esta carga está marcado para reto forzado (bot detectado)?
 * Lecturas en paralelo. Fail-open: Redis caído → no fuerza.
 */
export async function anyForcedChallenge(subjects: GateSubject[]): Promise<boolean> {
  if (!subjects.length) return false
  const flags = await Promise.all(
    subjects.map((s) => getCached<number>(forceKey(s.key))),
  )
  return flags.some((v) => v != null)
}
