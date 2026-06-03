// lib/security/challengePolicy/questionsServed.ts
//
// POLICY: ¿cuándo retar a quien está CARGANDO preguntas? (anti-scraping de volumen)
//
// El "cuándo retar" se separa del "cómo verificar" (capa captcha). Vigila la
// firma del scraping: muchas preguntas SERVIDAS en un día. Funciona para CUALQUIER
// "sujeto": un usuario logueado (`userId`) o una IP anónima (`ip:1.2.3.4`).
//
// Por qué importa el anónimo: el endpoint sirve preguntas (con su respuesta, por
// UX) también sin login; sin esto, un anónimo se baja el banco entero en minutos
// (caso Ana Fernández 02/06/2026, y peor aún sin cuenta). El umbral anónimo es
// MÁS BAJO que el de un usuario logueado: un no-registrado que hace decenas de
// tests es sospechoso; uno logueado tiene más recorrido legítimo.
//
// Contador en Redis (Upstash) date-stamped con TTL → O(1), sin escanear
// `test_questions`. Fail-open: si Redis cae, NO se reta (no romper el estudio).

import { incrementCounterWithTtl, getCounter } from '@/lib/cache/redis'

/** Umbral diario para usuarios LOGUEADOS. */
function authedThreshold(): number {
  const n = Number(process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD)
  // Empírico (30d): p99 servidas/2h = 227; un día intenso real rara vez >500.
  return Number.isFinite(n) && n > 0 ? n : 500
}

/** Umbral diario para ANÓNIMOS (por IP). Más bajo: sin login, decenas de tests
 *  ya es anómalo. Un test normal son 10-50 preguntas → ~6-12 tests/día margen. */
function anonThreshold(): number {
  const n = Number(process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD_ANON)
  return Number.isFinite(n) && n > 0 ? n : 300
}

/** TTL del contador: 26h cubre el día natural y se autolimpia. */
const COUNTER_TTL_S = 26 * 60 * 60

/**
 * Sujeto del contador. Para anónimos se prefija `ip:` para no colisionar nunca
 * con un userId (UUID) y poder distinguir ambos espacios.
 */
export function subjectFor(userId: string | null | undefined, ip: string | null): string {
  if (userId) return userId
  return `ip:${ip ?? 'unknown'}`
}

/** ¿Es un sujeto anónimo (por IP)? Determina qué umbral aplica. */
function isAnon(subject: string): boolean {
  return subject.startsWith('ip:')
}

function dayKey(subject: string): string {
  // YYYYMMDD en UTC (coherente con el resto de contadores diarios del repo).
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `captcha:served:${subject}:${d}`
}

/**
 * Registra `n` preguntas servidas a un sujeto y devuelve el total acumulado hoy.
 * Llamar DESPUÉS de servir. `subject` = userId (logueado) o `ip:<ip>` (anónimo);
 * usar `subjectFor()` para construirlo.
 */
export async function recordQuestionsServed(
  subject: string,
  n: number,
): Promise<number> {
  if (!subject || n <= 0) return 0
  return incrementCounterWithTtl(dayKey(subject), COUNTER_TTL_S, n)
}

/**
 * ¿Debe este sujeto resolver un reto antes de que le sirvamos más preguntas?
 * True si su acumulado de hoy ya supera el umbral (anónimo o logueado).
 * Fail-open implícito: si Redis cae, `getCounter` → 0 → no reta.
 */
export async function shouldChallengeForQuestions(
  subject: string,
): Promise<boolean> {
  if (!subject) return false
  const served = await getCounter(dayKey(subject))
  const limit = isAnon(subject) ? anonThreshold() : authedThreshold()
  return served >= limit
}

/** Solo lectura del acumulado de hoy de un sujeto (debug/admin). */
export async function questionsServedToday(subject: string): Promise<number> {
  if (!subject) return 0
  return getCounter(dayKey(subject))
}
