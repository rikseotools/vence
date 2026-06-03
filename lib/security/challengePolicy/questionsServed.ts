// lib/security/challengePolicy/questionsServed.ts
//
// POLICY: ¿cuándo retar a un usuario que está CARGANDO preguntas?
//
// El "cuándo retar" se separa del "cómo verificar" (capa captcha). Esta policy
// vigila la firma del scraping de banco: muchas preguntas SERVIDAS en un día.
// Premium no tiene límite diario de respuestas, así que sin esto un premium
// puede barrer el banco (caso Ana Fernández 02/06/2026).
//
// Contador en Redis (Upstash) date-stamped con TTL → O(1), sin escanear
// `test_questions` en caliente. Fail-open: si Redis cae, NO se reta (no romper
// el estudio normal por un fallo de cache).

import { incrementCounterWithTtl, getCounter } from '@/lib/cache/redis'

/** Preguntas servidas/día por encima de las cuales empezamos a retar. */
function threshold(): number {
  const n = Number(process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD)
  // Empírico (30d): p99 de servidas/2h = 227; un día intenso real rara vez
  // supera ~500. Ana servía miles. 500/día deja tranquilos a los estudiones.
  return Number.isFinite(n) && n > 0 ? n : 500
}

/** TTL del contador: 26h cubre el día natural y se autolimpia. */
const COUNTER_TTL_S = 26 * 60 * 60

function dayKey(userId: string): string {
  // YYYYMMDD en UTC (coherente con el resto de contadores diarios del repo).
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `captcha:served:${userId}:${d}`
}

/**
 * Registra `n` preguntas servidas a un usuario y devuelve el total acumulado
 * hoy. Llamar DESPUÉS de servir (cuando ya sabes cuántas mandas).
 */
export async function recordQuestionsServed(
  userId: string,
  n: number,
): Promise<number> {
  if (!userId || n <= 0) return 0
  return incrementCounterWithTtl(dayKey(userId), COUNTER_TTL_S, n)
}

/**
 * ¿Debe este usuario resolver un reto antes de que le sirvamos más preguntas?
 * True si su acumulado de hoy ya supera el umbral. Lectura barata (GET).
 *
 * Fail-open implícito: si Redis está caído `getCounter` devuelve 0 → no reta.
 */
export async function shouldChallengeForQuestions(
  userId: string,
): Promise<boolean> {
  if (!userId) return false
  const served = await getCounter(dayKey(userId))
  return served >= threshold()
}

/** Solo lectura del acumulado de hoy (debug/admin). */
export async function questionsServedToday(userId: string): Promise<number> {
  if (!userId) return 0
  return getCounter(dayKey(userId))
}
