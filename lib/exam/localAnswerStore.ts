// lib/exam/localAnswerStore.ts — Persistencia LOCAL durable de respuestas de examen.
//
// Por qué existe (caso Marta, 21/07/2026): el modo examen mantiene las respuestas en
// estado React y las guarda best-effort en /api/exam/answer (para poder reanudar). En una
// conexión inestable esos guardados fallaban EN SILENCIO y, si el usuario cerraba la
// pestaña o no llegaba al submit final, se perdía TODO — sin aviso. A diferencia del modo
// práctica, que sí tiene cola durable (utils/answerSaveQueue), el examen no tenía red.
//
// Este store espeja las respuestas del examen en localStorage para que SOBREVIVAN a
// reload / cierre de pestaña / red caída, y se puedan rehidratar al reanudar. Es un espejo
// del patrón probado de answerSaveQueue pero DELIBERADAMENTE aislado: no toca el endpoint
// ni el schema de práctica (camino crítico cubierto por canary_answer_save), solo persiste
// el mapa questionIndex→opción por testId. Puro y SSR-safe (no rompe en el servidor).

/** questionIndex (0-based) → opción marcada ('a' | 'b' | 'c' | 'd'). */
export type ExamAnswers = Record<number, string>

interface StoredExam {
  /** Versión del formato — permite invalidar si cambia el shape en el futuro. */
  v: 1
  answers: ExamAnswers
  updatedAt: number
}

const PREFIX = 'exam_answers:'
const CURRENT_VERSION = 1 as const
// 7 días, alineado con la ventana de reanudación (JWT/resume). Un examen local más viejo
// que esto se ignora al rehidratar (probablemente ya cerrado o caducado en servidor).
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function keyFor(testId: string): string {
  return `${PREFIX}${testId}`
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/** Espeja el mapa completo de respuestas del examen. Best-effort: nunca lanza. */
export function saveLocalExamAnswers(
  testId: string,
  answers: ExamAnswers,
  now: number = Date.now(),
): void {
  if (!hasStorage() || !testId) return
  try {
    const payload: StoredExam = { v: CURRENT_VERSION, answers: answers || {}, updatedAt: now }
    window.localStorage.setItem(keyFor(testId), JSON.stringify(payload))
  } catch {
    // localStorage lleno / modo privado / cuota: la pérdida del espejo no debe romper el
    // examen (el estado React sigue vivo). No reintentamos ni desalojamos otras claves.
  }
}

/**
 * Devuelve las respuestas espejadas localmente para ese examen, o null si no hay,
 * están corruptas, tienen otra versión, o son más viejas que MAX_AGE_MS.
 */
export function loadLocalExamAnswers(
  testId: string,
  now: number = Date.now(),
): ExamAnswers | null {
  if (!hasStorage() || !testId) return null
  try {
    const raw = window.localStorage.getItem(keyFor(testId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredExam>
    if (!parsed || parsed.v !== CURRENT_VERSION || typeof parsed.answers !== 'object' || parsed.answers === null) {
      return null
    }
    if (typeof parsed.updatedAt === 'number' && now - parsed.updatedAt > MAX_AGE_MS) {
      return null
    }
    // Sanea: solo claves numéricas → string no vacío.
    const clean: ExamAnswers = {}
    for (const [k, val] of Object.entries(parsed.answers)) {
      const idx = Number(k)
      if (Number.isInteger(idx) && idx >= 0 && typeof val === 'string' && val.length > 0) {
        clean[idx] = val
      }
    }
    return Object.keys(clean).length > 0 ? clean : null
  } catch {
    return null
  }
}

/** Borra el espejo local (tras completar el examen con éxito). Best-effort. */
export function clearLocalExamAnswers(testId: string): void {
  if (!hasStorage() || !testId) return
  try {
    window.localStorage.removeItem(keyFor(testId))
  } catch {
    // no-op
  }
}

/**
 * Fusiona respuestas de servidor con las locales para rehidratar el estado al reanudar.
 * LOCAL gana en conflicto: el espejo local refleja lo que el usuario marcó REALMENTE en
 * este dispositivo (incluidas las que no llegaron al servidor), así que es un superconjunto
 * del servidor en el mismo dispositivo. En otro dispositivo el local está vacío → queda el
 * del servidor. Nunca descarta una respuesta existente; solo rellena y prefiere la local.
 */
export function mergeExamAnswers(server: ExamAnswers | null, local: ExamAnswers | null): ExamAnswers {
  return { ...(server || {}), ...(local || {}) }
}
