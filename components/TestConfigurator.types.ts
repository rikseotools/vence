// components/TestConfigurator.types.ts
// Tipos extraídos de TestConfigurator.tsx para migración progresiva a TypeScript
import type { SectionFilter } from '@/lib/api/filtered-questions/schemas'

// ============================================
// PROPS
// ============================================

/** Datos de una ley disponible para el configurador */
export interface LawData {
  law_short_name: string
  law_name?: string
  display_name?: string
  total_articles?: number
  questions_count?: number
  articles_with_questions: number
}

/** Estadísticas recientes del usuario */
export interface UserRecentStats {
  last7Days: number
  last15Days: number
  last30Days: number
  recentlyAnswered: number
  getExcludedCount: (days: number) => number
}

/** Usuario actual (subset de Supabase User) */
export interface CurrentUser {
  id: string
  email?: string
}

export type DifficultyMode = 'random' | 'easy' | 'medium' | 'hard' | 'extreme' | 'adaptive'
export type TestMode = 'practica' | 'examen'
export type FailedQuestionsOrder = 'most_failed' | 'recent_failed' | 'oldest_failed' | 'random'

/** SectionFilter flexible: acepta tanto el schema Zod (start/end) como el formato legacy (from/to + law) */
export interface SectionFilterConfig {
  title: string
  law?: string
  articleRange?: { start?: number; end?: number; from?: number; to?: number }
  sectionNumber?: string
  sectionType?: string
}

/** totalQuestions puede ser un número directo o un objeto { easy: N, medium: N, ... } */
export type TotalQuestions = number | Record<string, number>

export interface TestConfiguratorProps {
  tema?: number | null
  temaDisplayName?: string | null
  totalQuestions?: TotalQuestions
  onStartTest?: (config: TestStartConfig) => void
  userStats?: UserRecentStats | null
  loading?: boolean
  currentUser?: CurrentUser | null
  lawsData?: LawData[]
  preselectedLaw?: string | null
  hideOfficialQuestions?: boolean
  hideEssentialArticles?: boolean
  officialQuestionsCount?: number
  testMode?: TestMode
  positionType?: string
}

// ============================================
// CONFIG DE TEST (pasada a onStartTest)
// ============================================

export interface TestStartConfig {
  tema?: number | null
  numQuestions: number
  difficultyMode: DifficultyMode | string
  onlyOfficialQuestions: boolean
  focusEssentialArticles: boolean
  excludeRecent: boolean
  recentDays: number
  focusWeakAreas: boolean
  adaptiveMode: boolean
  intelligentPrioritization?: boolean
  onlyFailedQuestions: boolean
  failedQuestionIds?: string[]
  failedQuestionsOrder?: FailedQuestionsOrder
  selectedLaws: string[]
  selectedArticlesByLaw: Record<string, (string | number)[]>
  selectedSectionFilters: SectionFilterConfig[]
  timeLimit: number | null
  configSource: string
  configTimestamp: string
  testMode?: TestMode
  positionType?: string
}

// ============================================
// DATOS INTERNOS
// ============================================

/** Artículo disponible para selección (del API v2) */
export interface ArticleItem {
  article_number: number | string
  title: string | null
  question_count: number
  official_question_count?: number
}

/** Artículo imprescindible (del API v2) */
export interface EssentialArticleItem {
  number: number | string
  law: string
  questionsCount: number
}

/** Pregunta fallada del usuario (del API user-failed) */
export interface FailedQuestionItem {
  questionId: string
  questionText: string
  difficulty: string | null
  articleNumber: string | null
  lawShortName: string | null
  failedCount: number
  lastFailed: string
  firstFailed: string
  totalTime?: number
}

/** Container de datos de preguntas falladas */
export interface FailedQuestionsData {
  totalQuestions: number
  totalFailures: number
  questions: FailedQuestionItem[]
}

/** Configuración favorita guardada */
export interface SavedFavorite {
  id: string
  name: string
  description?: string | null
  selectedLaws?: string[]
  selectedArticlesByLaw?: Record<string, (string | number)[]>
  createdAt: string
  updatedAt?: string
}

// ============================================
// RE-EXPORTS para conveniencia
// ============================================

export type { SectionFilter }
