// lib/security/challengePolicy/questionsServed.ts
//
// POLICY anti-scraping de VOLUMEN, multi-sujeto (Capa A: + device fingerprint).
//
// El "cuándo retar" se separa del "cómo verificar" (capa captcha). Vigila la firma
// del scraping: muchas preguntas SERVIDAS en un día. Cuenta por VARIOS sujetos a la
// vez y reta si CUALQUIERA supera su umbral — porque cada identificador tapa un
// hueco del otro:
//   - usuario (logueado): fuerte, pero un scraper se crea cuentas.
//   - IP (anónimo): débil/rotable, pero cubre al no-registrado.
//   - DISPOSITIVO (huella): difícil de rotar → caza al que rota IP o cuentas en
//     la misma máquina. Es el ancla más estable disponible sin login.
//
// Reto, no bloqueo (Turnstile Managed, invisible para humanos) → un falso positivo
// en IP/dispositivo compartido es un check transparente, no un corte.
// Contadores en Redis date-stamped con TTL → O(1). Fail-open: Redis caído → no reta.

import { incrementCounterWithTtl, getCounter } from '@/lib/cache/redis'

/** Un sujeto del gate: su clave de contador y el umbral diario que le aplica. */
export interface GateSubject {
  key: string
  threshold: number
}

function envInt(name: string, def: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : def
}

// Umbrales diarios (configurables por env):
function authedThreshold(): number {
  // Empírico (30d): p99 servidas/2h = 227; un día intenso real rara vez >500.
  return envInt('CAPTCHA_QUESTIONS_SERVED_THRESHOLD', 500)
}
function anonThreshold(): number {
  // Sin login, decenas de tests ya es anómalo. Un test normal son 10-50 preguntas.
  return envInt('CAPTCHA_QUESTIONS_SERVED_THRESHOLD_ANON', 300)
}
function deviceThreshold(): number {
  // Agrega TODAS las cuentas/IPs de una misma máquina. Más alto para tolerar un
  // dispositivo compartido legítimo (familia), pero caza al scraper que rota
  // IP/cuentas en un solo equipo.
  return envInt('CAPTCHA_QUESTIONS_SERVED_THRESHOLD_DEVICE', 800)
}

/** TTL del contador: 26h cubre el día natural y se autolimpia. */
const COUNTER_TTL_S = 26 * 60 * 60

function dayKey(subject: string): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `captcha:served:${subject}:${d}`
}

/**
 * Sujetos a vigilar para una carga de preguntas, con su umbral.
 * - Logueado: usuario + dispositivo (NO IP: oficinas/NAT compartidos no deben
 *   retar a un usuario legítimo por su IP).
 * - Anónimo: IP + dispositivo.
 * El dispositivo solo si el cliente envió la huella (`x-device-id`).
 */
export function gateSubjects(
  userId: string | null | undefined,
  deviceId: string | null | undefined,
  ip: string | null | undefined,
): GateSubject[] {
  const subjects: GateSubject[] = []
  if (userId) {
    subjects.push({ key: userId, threshold: authedThreshold() })
  } else {
    subjects.push({ key: `ip:${ip ?? 'unknown'}`, threshold: anonThreshold() })
  }
  if (deviceId) {
    subjects.push({ key: `device:${deviceId}`, threshold: deviceThreshold() })
  }
  return subjects
}

/**
 * ¿Debe retarse esta carga? True si CUALQUIER sujeto ya superó su umbral hoy.
 * Lecturas en paralelo. Fail-open: Redis caído → getCounter 0 → no reta.
 */
export async function shouldChallengeForLoad(
  subjects: GateSubject[],
): Promise<boolean> {
  if (!subjects.length) return false
  const counts = await Promise.all(subjects.map((s) => getCounter(dayKey(s.key))))
  return counts.some((served, i) => served >= subjects[i].threshold)
}

/**
 * Contabiliza `n` preguntas servidas en TODOS los sujetos (usuario/IP + dispositivo).
 * Fire-and-forget desde el caller. Devuelve los totales (para telemetría/debug).
 */
export async function recordServedForSubjects(
  subjects: GateSubject[],
  n: number,
): Promise<number[]> {
  if (n <= 0 || !subjects.length) return []
  return Promise.all(
    subjects.map((s) => incrementCounterWithTtl(dayKey(s.key), COUNTER_TTL_S, n)),
  )
}

/** Solo lectura del acumulado de hoy de un sujeto (debug/admin). */
export async function servedTodayFor(subjectKey: string): Promise<number> {
  if (!subjectKey) return 0
  return getCounter(dayKey(subjectKey))
}
