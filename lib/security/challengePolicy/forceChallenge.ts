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
//
// ── LAS CUENTAS SINTÉTICAS NO SE MARCAN, Y SE COMPRUEBA AQUÍ (07/08/2026) ──────────────────
// Nuestros propios canaries navegan con un navegador AUTOMATIZADO y con la cuenta
// `smoke@vence.es`: BotD los reconoce —correctamente— como automatización, así que el sistema
// se marcaba a sí mismo. Medido el 07/08: a las 13:41 un reporte con score 175 puso el flag
// sobre el usuario del smoke, y desde entonces el canary `canary-questions-gate` recibía
// `challenge` con `reason:'bot_flag'` teniendo **1 pregunta servida de 500** — o sea, un
// canary CRÍTICO clavado en rojo por una defensa nuestra reaccionando a otra pieza nuestra.
// Un canary que no puede volver a verde deja de ser una señal: se convierte en ruido que se
// aprende a ignorar, que es peor que no tenerlo.
//
// La exención NO se resuelve en el llamante sino AQUÍ, en el punto de escritura, y leyendo la
// única fuente que ya existe para esto (`user_profiles.is_synthetic`, migración
// 20260720_synthetic_user_central, que ya usa el ranking para no premiar a los canaries). Si
// se dejara en el llamante, el próximo sitio que marque un reto forzado nacería sin ella —
// que es exactamente cómo se pierden las protecciones.
//
// ⚠️ NO confundir con `esCanaryDeConfianza` (lib/api/syntheticTrust.ts): aquel exime del reto
// a una PETICIÓN que demuestra con un secreto ser interna, y por eso el canary del propio gate
// no lo usa (su cometido es comprobar el gate como un usuario normal). Esto otro decide sobre
// la CUENTA, que es un dato del servidor y no viaja en la petición: nadie puede afirmarlo.

import { setCached, getCached } from '@/lib/cache/redis'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type { GateSubject } from './questionsServed'

/** TTL del flag de "retar siempre" tras una detección de bot. 24h por defecto. */
function forceTtl(): number {
  const n = Number(process.env.CAPTCHA_FORCE_CHALLENGE_TTL_S)
  return Number.isFinite(n) && n > 0 ? n : 24 * 60 * 60
}

function forceKey(subjectKey: string): string {
  return `captcha:force:${subjectKey}`
}

export type ResultadoMarcado = {
  marcado: boolean
  /** Por qué NO se marcó. Ausente cuando sí se marcó. */
  motivo?: 'cuenta_sintetica' | 'sin_sujetos'
  sujetos: number
}

/**
 * Decisión PURA: ¿se marca este reto forzado?
 *
 * Separada del I/O para poder ejercitarla sin Redis ni BD. El único caso que exime es la
 * cuenta sintética; ante la duda (`esSintetico` desconocido → `false`) se marca, porque el
 * coste de un falso negativo es dejar el banco abierto a un scraper y el de un falso positivo
 * es un Turnstile.
 */
export function decidirMarcadoForzado(args: {
  subjectKeys: string[]
  esSintetico: boolean
}): ResultadoMarcado {
  const sujetos = args.subjectKeys.filter(Boolean).length
  if (args.esSintetico) return { marcado: false, motivo: 'cuenta_sintetica', sujetos }
  if (!sujetos) return { marcado: false, motivo: 'sin_sujetos', sujetos: 0 }
  return { marcado: true, sujetos }
}

/**
 * ¿Es una cuenta sintética (canary / smoke)? Lee la fuente central.
 *
 * Fail-open a `false` (= se marca): si la BD no contesta no se puede afirmar que sea nuestra,
 * y la defensa anti-scraping no debe caerse porque falle una consulta auxiliar.
 */
export async function esCuentaSintetica(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  try {
    const filas: any = await getAdminDb().execute(
      sql`SELECT is_synthetic FROM user_profiles WHERE id = ${userId}::uuid LIMIT 1`,
    )
    const fila = (Array.isArray(filas) ? filas : filas?.rows || [])[0]
    return fila?.is_synthetic === true
  } catch {
    return false
  }
}

/**
 * Marca uno o más sujetos (p.ej. `userId`, `device:<id>`) para reto forzado.
 * Lo llama `/api/fraud/report` cuando el bot-score es alto. Best-effort.
 *
 * `userId` se pide APARTE de `subjectKeys` porque los sujetos mezclan usuario y dispositivo y
 * la exención se decide por CUENTA. Devuelve qué hizo, para que el llamante lo deje anotado:
 * una exención silenciosa es indistinguible de un marcado que nunca ocurrió.
 */
export async function markForcedChallenge(
  subjectKeys: string[],
  opts?: { userId?: string | null },
): Promise<ResultadoMarcado> {
  const esSintetico = await esCuentaSintetica(opts?.userId)
  const decision = decidirMarcadoForzado({ subjectKeys, esSintetico })
  if (!decision.marcado) return decision

  const ttl = forceTtl()
  await Promise.all(
    subjectKeys.filter(Boolean).map((k) => setCached(forceKey(k), 1, ttl)),
  )
  return decision
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

/** La clave de Redis, expuesta solo para las herramientas de operación (limpiar una marca). */
export function claveRetoForzado(subjectKey: string): string {
  return forceKey(subjectKey)
}
