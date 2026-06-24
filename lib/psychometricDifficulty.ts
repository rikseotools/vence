// =====================================================
// UTILIDADES PARA DIFICULTAD ADAPTATIVA PSICOTÉCNICA
// =====================================================
// Sistema que diferencia dificultad global vs personal
// Solo primeras respuestas afectan dificultad global
import { getAuthHeaders } from '@/lib/api/authHeaders'

type BaseDifficulty = 'easy' | 'medium' | 'hard'

export interface DifficultyInfo {
  questionId: string
  baseDifficulty: BaseDifficulty | string
  globalDifficulty?: number | null
  personalDifficulty?: number | null
  sampleSize?: number
  effectiveDifficulty: number
  recommendation?: string
  difficultyLevel: string
  difficultyColor: string
  isAdaptive: boolean
}

interface DifficultyDisplay {
  displayText: string
  tooltip: string
  showAdaptiveBadge: boolean
  color: string
  icon: string
}


// Construye un DifficultyInfo de fallback a partir de una dificultad base ('easy'|...).
function buildFallbackDifficulty(questionId: string, baseDifficulty: string | null): DifficultyInfo {
  const base = baseDifficulty || 'medium'
  const numericDifficulty = convertBaseDifficultyToNumeric(base)
  return {
    questionId,
    baseDifficulty: base,
    globalDifficulty: null,
    personalDifficulty: null,
    sampleSize: 0,
    effectiveDifficulty: numericDifficulty,
    recommendation: 'fallback',
    difficultyLevel: getDifficultyLevel(numericDifficulty),
    difficultyColor: getDifficultyColor(numericDifficulty),
    isAdaptive: false
  }
}

// AGNÓSTICO (Fase C1): la dificultad efectiva (rpc + fallback) se calcula en
// GET /api/v2/psychometric/difficulty (user_id del token). Esta función solo
// formatea el resultado para el cliente con los helpers puros de presentación.
export async function getDifficultyInfo(questionId: string): Promise<DifficultyInfo> {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/v2/psychometric/difficulty?questionId=${encodeURIComponent(questionId)}`, { headers })
    if (!res.ok) return buildFallbackDifficulty(questionId, null)

    const json = await res.json()
    const data = json?.rpc as {
      base_difficulty: string; global_difficulty: number | null; personal_difficulty: number | null
      sample_size: number; effective_difficulty: number; recommendation: string
    } | null

    if (!data) return buildFallbackDifficulty(questionId, json?.fallbackBaseDifficulty ?? null)

    return {
      questionId,
      baseDifficulty: data.base_difficulty,
      globalDifficulty: data.global_difficulty,
      personalDifficulty: data.personal_difficulty,
      sampleSize: data.sample_size,
      effectiveDifficulty: data.effective_difficulty,
      recommendation: data.recommendation,
      difficultyLevel: getDifficultyLevel(data.effective_difficulty),
      difficultyColor: getDifficultyColor(data.effective_difficulty),
      isAdaptive: data.global_difficulty !== null || data.personal_difficulty !== null
    }
  } catch (err) {
    console.error('❌ Error in getDifficultyInfo:', err)
    return buildFallbackDifficulty(questionId, null)
  }
}

function convertBaseDifficultyToNumeric(baseDifficulty: string): number {
  switch (baseDifficulty) {
    case 'easy': return 25.0
    case 'medium': return 50.0
    case 'hard': return 75.0
    default: return 50.0
  }
}

function getDifficultyLevel(numericDifficulty: number): string {
  if (numericDifficulty < 30) return 'Fácil'
  if (numericDifficulty < 50) return 'Medio-Fácil'
  if (numericDifficulty < 70) return 'Medio'
  if (numericDifficulty < 85) return 'Difícil'
  return 'Muy Difícil'
}

function getDifficultyColor(numericDifficulty: number): string {
  if (numericDifficulty < 30) return 'text-green-600'
  if (numericDifficulty < 50) return 'text-lime-600'
  if (numericDifficulty < 70) return 'text-yellow-600'
  if (numericDifficulty < 85) return 'text-orange-600'
  return 'text-red-600'
}

export function getDifficultyIcon(numericDifficulty: number): string {
  if (numericDifficulty < 30) return '🟢'
  if (numericDifficulty < 50) return '🟡'
  if (numericDifficulty < 70) return '🟠'
  if (numericDifficulty < 85) return '🔴'
  return '⚫'
}

// AGNÓSTICO (Fase C1): primera respuesta del usuario del TOKEN vía
// GET /api/v2/psychometric/first-attempt (sustituye supabase.from de cliente).
export async function isFirstAttempt(questionId: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/v2/psychometric/first-attempt?questionId=${encodeURIComponent(questionId)}`, { headers })
    if (!res.ok) return true // En caso de error, asumir primera vez
    const json = await res.json()
    return json?.isFirstAttempt !== false
  } catch (err) {
    console.error('❌ Error checking first attempt:', err)
    return true // En caso de error, asumir primera vez
  }
}

export function formatDifficultyDisplay(difficultyInfo: DifficultyInfo): DifficultyDisplay {
  const { effectiveDifficulty, isAdaptive, sampleSize, recommendation } = difficultyInfo

  // Validar que effectiveDifficulty sea un número válido
  const validDifficulty = !isNaN(effectiveDifficulty) && isFinite(effectiveDifficulty) ? effectiveDifficulty : 50

  let displayText = `${getDifficultyLevel(validDifficulty)} (${Math.round(validDifficulty)}/100)`

  if (isAdaptive && sampleSize && sampleSize > 0) {
    displayText += ` • Adaptativa (${sampleSize} respuestas)`
  } else {
    displayText += ` • Base`
  }

  let tooltip = ''
  switch (recommendation) {
    case 'increase_difficulty':
      tooltip = 'Esta pregunta parece fácil para ti. El sistema podría sugerir preguntas más difíciles.'
      break
    case 'decrease_difficulty':
      tooltip = 'Esta pregunta parece difícil para ti. El sistema podría sugerir preguntas más fáciles.'
      break
    case 'need_more_data':
      tooltip = 'Se necesitan más respuestas para calcular la dificultad adaptativa.'
      break
    case 'optimal':
      tooltip = 'La dificultad parece apropiada para tu nivel.'
      break
    default:
      tooltip = 'Dificultad basada en la configuración original.'
  }

  return {
    displayText,
    tooltip,
    showAdaptiveBadge: isAdaptive,
    color: getDifficultyColor(validDifficulty),
    icon: getDifficultyIcon(validDifficulty)
  }
}

