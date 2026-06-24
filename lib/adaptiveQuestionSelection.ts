// =====================================================
// SISTEMA DE SELECCIÓN ADAPTATIVA DE PREGUNTAS PSICOTÉCNICAS
// =====================================================
// Complementa el sistema de dificultad adaptativa con selección inteligente.
//
// AGNÓSTICO (Fase C1): toda la lógica de BD (rpc de dificultad + historial de
// respuestas) vive ahora en POST /api/v2/psychometric/adaptive-select (user_id del
// token). Esta función es un wrapper delgado: envía los IDs disponibles + el
// rendimiento, recibe los IDs ordenados y los re-mapea a los objetos locales.
import { getAuthHeaders } from '@/lib/api/authHeaders'

interface PsychometricQuestionBase {
  id: string
  difficulty?: string
  [key: string]: unknown
}

interface CurrentPerformance {
  questionsAnswered: number
  correctAnswers: number
  incorrectStreak: number
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export async function selectAdaptiveQuestions(
  sessionId: string,
  availableQuestions: PsychometricQuestionBase[],
  currentPerformance: CurrentPerformance | null
): Promise<PsychometricQuestionBase[]> {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch('/api/v2/psychometric/adaptive-select', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        currentPerformance,
        questions: availableQuestions.map((q) => ({ id: q.id, difficulty: q.difficulty })),
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const json = await res.json()
    const orderedIds: string[] = Array.isArray(json?.orderedIds) ? json.orderedIds : []
    const byId = new Map(availableQuestions.map((q) => [q.id, q]))

    // Re-mapear a los objetos locales preservando el orden del servidor. Si el filtro
    // adaptativo devolvió un subconjunto (menos preguntas), se respeta (fiel al original).
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((q): q is PsychometricQuestionBase => Boolean(q))

    return ordered.length > 0 ? ordered : shuffleArray(availableQuestions)
  } catch (error) {
    console.error('❌ Error in adaptive question selection:', error)
    return shuffleArray(availableQuestions)
  }
}
