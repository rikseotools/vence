// components/v2/types.ts
// Tipos para TestLayoutV2 y componentes relacionados

import type { TestLayoutQuestion, TestConfig } from '@/lib/api/tests'

// Re-exportar tipos necesarios
export type { TestLayoutQuestion, TestConfig }

// ============================================
// PROPS DEL COMPONENTE
// ============================================

export interface TestLayoutV2Props {
  /** Número de tema (0 para tests sin tema específico) */
  tema: number
  /** Identificador del tipo de test */
  testNumber: string
  /** Configuración visual del test */
  config: TestConfig
  /** Array de preguntas a mostrar */
  questions: TestLayoutQuestion[]
  /** Contenido hijo opcional */
  children?: React.ReactNode
}

// ============================================
// ESTADO DEL TEST
// ============================================

export interface AnsweredQuestion {
  question: number
  selectedAnswer: number
  correct: boolean
  timestamp: string
}

export interface DetailedAnswer {
  questionIndex: number
  questionOrder: number
  selectedAnswer: number
  correctAnswer: number
  isCorrect: boolean
  timeSpent: number
  timestamp: string
  questionData: {
    id: string | null
    question: string
    options: string[]
    correct: number
    article?: {
      id?: string | null
      number?: string | null
      law_short_name?: string | null
    } | null
    metadata?: Record<string, unknown> | null
  } | null
  confidence: string | null
  interactions: number
}

export interface TestSession {
  id: string
  userId: string
  startedAt: string
  totalQuestions: number
}

export interface UserSession {
  id: string
  deviceInfo: DeviceInfo
}

export interface DeviceInfo {
  userAgent: string
  platform: string
  language: string
  screenWidth: number
  screenHeight: number
  timezone: string
}

// ============================================
// ESTADO INTERNO DEL COMPONENTE
// ============================================

export interface TestLayoutState {
  // Estado básico del test
  currentQuestion: number
  selectedAnswer: number | null
  showResult: boolean
  verifiedCorrectAnswer: number | null
  score: number
  answeredQuestions: AnsweredQuestion[]
  startTime: number

  // Modo adaptativo
  isAdaptiveMode: boolean
  adaptiveMode: boolean
  activeQuestions: TestLayoutQuestion[]
  questionPool: TestLayoutQuestion[]
  currentDifficulty: 'easy' | 'medium' | 'hard'
  lastAdaptedQuestion: number

  // Tracking
  questionStartTime: number
  firstInteractionTime: number | null
  interactionCount: number
  confidenceLevel: string | null
  detailedAnswers: DetailedAnswer[]

  // Sesión
  currentTestSession: TestSession | null
  userSession: UserSession | null
  saveStatus: 'saving' | 'saved' | 'error' | null

  // UI
  isExplicitlyCompleted: boolean
  showSuccessMessage: boolean
  successMessage: string
  showShareQuestion: boolean
  autoScrollEnabled: boolean
  showScrollFeedback: boolean

  // Hot articles
  hotArticleInfo: HotArticleInfo | null
  showHotAlert: boolean

  // Anti-duplicados
  processingAnswer: boolean
  lastProcessedAnswer: string | null
}

export interface HotArticleInfo {
  articleId: string
  frequency: number
  lastSeen: string
}

// ============================================
// RESPUESTAS DE API
// ============================================

export interface ValidateAnswerResult {
  isCorrect: boolean
  correctAnswer: number
  explanation: string | null
  articleNumber?: string | null
  lawShortName?: string | null
  usedFallback: boolean
}

export interface SaveAnswerResult {
  success: boolean
  error?: string
}

// ============================================
// EVENTOS Y ACCIONES
// ============================================

export type TestAction =
  | { type: 'SELECT_ANSWER'; payload: number }
  | { type: 'SUBMIT_ANSWER'; payload: ValidateAnswerResult }
  | { type: 'NEXT_QUESTION' }
  | { type: 'COMPLETE_TEST' }
  | { type: 'RESET_TEST' }
  | { type: 'SET_ADAPTIVE_MODE'; payload: boolean }
  | { type: 'ADAPT_DIFFICULTY'; payload: 'easier' | 'harder' }

// ============================================
// CONSTANTES
// ============================================

export const NON_LEGAL_CONTENT = [
  'Informática Básica',
  'Portal de Internet',
  'La Red Internet',
  'Windows 10',
  'Explorador de Windows',
  'Hojas de cálculo. Excel',
  'Base de datos: Access',
  'Correo electrónico',
  'Procesadores de texto',
  'Administración electrónica y servicios al ciudadano (CSL)',
] as const

export const PENDING_TEST_KEY = 'vence_pending_test' as const

// ============================================
// UTILIDADES DE TIPOS
// ============================================

export function isLegalArticle(lawShortName: string | null | undefined): boolean {
  if (!lawShortName) return false
  return !NON_LEGAL_CONTENT.includes(lawShortName as typeof NON_LEGAL_CONTENT[number])
}

export function formatTemaName(temaNumber: number | null | undefined): string {
  if (!temaNumber) return 'Tema'
  if (temaNumber >= 101) {
    return `Bloque II - Tema ${temaNumber - 100}`
  }
  return `Tema ${temaNumber}`
}

// ============================================
// DYNAMIC TEST AI - TIPOS
// ============================================

export interface DynamicTestAiProps {
  /** Título/tema del test */
  titulo: string
  /** Nivel de dificultad */
  dificultad: 'alta' | 'muy_alta'
  /** URL de retorno (opcional) */
  backUrl?: string
}

export interface DifficultyConfig {
  name: string
  color: string
  icon: string
  description: string
}

export const DIFFICULTY_CONFIGS: Record<string, DifficultyConfig> = {
  alta: {
    name: "Alta",
    color: "from-orange-500 to-red-500",
    icon: "🔥",
    description: "Análisis jurídico e interpretación constitucional"
  },
  muy_alta: {
    name: "Muy Alta",
    color: "from-red-600 to-red-700",
    icon: "🎯",
    description: "Nivel experto en Derecho Constitucional"
  }
}

export interface AIGeneratedQuestion {
  id?: string
  question: string
  options: string[]
  correct: number
  explanation: string
  article?: {
    number: string
    text: string
  } | null
}

export interface AITestData {
  id: string
  questions: AIGeneratedQuestion[]
  titulo: string
  dificultad: string
  createdAt: string
}

export interface AIAnsweredQuestion {
  question: number
  selectedAnswer: number
  correct: boolean
  questionData: AIGeneratedQuestion & { verifiedCorrect: number }
}

// ============================================
// EXAM LAYOUT V2 - TIPOS
// ============================================

export interface ExamLayoutV2Props {
  /** Número de tema */
  tema: number
  /** Número de test */
  testNumber?: number
  /** Configuración del test */
  config: TestConfig
  /** Array de preguntas del examen */
  questions: ExamQuestion[]
  /** ID del test para reanudar (opcional) */
  resumeTestId?: string | null
  /** Respuestas iniciales para reanudar (opcional) */
  initialAnswers?: Record<number, string> | null
  /** Contenido hijo opcional */
  children?: React.ReactNode
  /** Tipo de oposición para generar URLs correctas */
  positionType?: string
}

export interface ExamQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  explanation?: string | null
  difficulty?: string | null
  tema_number?: number | null
  primary_article_id?: string | null
  articles?: {
    id?: string
    article_number?: string
    laws?: {
      short_name?: string
    }
  } | null
}

export interface ExamValidationResult {
  questionId: string
  userAnswer: string | null
  correctAnswer: string
  correctIndex: number
  isCorrect: boolean
  explanation?: string | null
}

export interface ExamValidationResponse {
  success: boolean
  results: ExamValidationResult[]
  summary: {
    totalQuestions: number
    totalAnswered: number
    totalCorrect: number
    totalIncorrect: number
    totalBlank: number
    percentage: number
  }
  error?: string
}

export interface MotivationalMessageData {
  emoji: string
  message: string
  color: string
  bgColor: string
  borderColor: string
}

export function getMotivationalMessage(notaSobre10: number, userName?: string): MotivationalMessageData {
  const nota = notaSobre10
  const nombre = userName || 'allí'

  if (nota === 10) {
    return {
      emoji: '🏆',
      message: `¡PERFECTO, ${nombre}!`,
      color: 'text-yellow-600',
      bgColor: 'from-yellow-50 to-amber-50',
      borderColor: 'border-yellow-300'
    }
  } else if (nota >= 9) {
    return {
      emoji: '🎉',
      message: `¡EXCELENTE, ${nombre}!`,
      color: 'text-green-600',
      bgColor: 'from-green-50 to-emerald-50',
      borderColor: 'border-green-300'
    }
  } else if (nota >= 8) {
    return {
      emoji: '✨',
      message: `¡MUY BIEN, ${nombre}!`,
      color: 'text-green-600',
      bgColor: 'from-green-50 to-teal-50',
      borderColor: 'border-green-200'
    }
  } else if (nota >= 7) {
    return {
      emoji: '👏',
      message: `¡BIEN HECHO, ${nombre}!`,
      color: 'text-blue-600',
      bgColor: 'from-blue-50 to-indigo-50',
      borderColor: 'border-blue-200'
    }
  } else if (nota >= 6) {
    return {
      emoji: '💪',
      message: `¡BUEN INTENTO, ${nombre}!`,
      color: 'text-orange-600',
      bgColor: 'from-orange-50 to-amber-50',
      borderColor: 'border-orange-200'
    }
  } else if (nota >= 5) {
    return {
      emoji: '📚',
      message: `Sigue practicando, ${nombre}`,
      color: 'text-orange-500',
      bgColor: 'from-orange-50 to-yellow-50',
      borderColor: 'border-orange-200'
    }
  } else {
    return {
      emoji: '🎯',
      message: `¡No te rindas, ${nombre}!`,
      color: 'text-gray-600',
      bgColor: 'from-gray-50 to-slate-50',
      borderColor: 'border-gray-300'
    }
  }
}

// ============================================
// PSYCHOMETRIC TEST LAYOUT V2 - TIPOS
// ============================================

export type PsychometricQuestionSubtype =
  | 'pie_chart'
  | 'bar_chart'
  | 'line_chart'
  | 'data_tables'
  | 'mixed_chart'
  | 'error_detection'
  | 'word_analysis'
  | 'sequence_numeric'
  | 'sequence_letter'
  | 'sequence_alphanumeric'
  | 'text_question'
  | 'calculation'
  | 'logic'
  | 'analogy'
  | 'comprehension'
  | 'pattern'
  | 'attention'

export interface PsychometricTestLayoutV2Props {
  /** Categoría del test psicotécnico */
  categoria: string
  /** Configuración del test */
  config?: {
    backUrl?: string
    backText?: string
  }
  /** Array de preguntas psicotécnicas */
  questions: PsychometricQuestion[]
}

export interface PsychometricQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  explanation?: string | null
  question_subtype: PsychometricQuestionSubtype
  category_id?: string
  content_data?: Record<string, unknown> | null
  difficulty?: string | null
}

export interface PsychometricAnsweredQuestion {
  questionId: string
  questionText: string
  userAnswer: number
  correctAnswer: number | null
  isCorrect: boolean
  timeSpent: number
  timestamp: string
  questionOrder: number
}

export interface PsychometricValidationResult {
  success: boolean
  isCorrect: boolean
  correctAnswer: number
  explanation?: string | null
  error?: string
}

export const PSYCHOMETRIC_SUBTYPE_NAMES: Record<string, string> = {
  'sequence_numeric': 'Serie numérica',
  'sequence_letter': 'Serie de letras',
  'sequence_alphanumeric': 'Serie alfanumérica',
  'pie_chart': 'Gráfico circular',
  'bar_chart': 'Gráfico de barras',
  'line_chart': 'Gráfico de líneas',
  'data_tables': 'Tabla de datos',
  'mixed_chart': 'Gráfico mixto',
  'error_detection': 'Detección de errores',
  'word_analysis': 'Análisis de palabras',
  'text_question': 'Pregunta de texto',
  'calculation': 'Cálculo',
  'logic': 'Lógica',
  'analogy': 'Analogía',
  'comprehension': 'Comprensión',
  'pattern': 'Patrón',
  'attention': 'Atención'
}
