// test-config.types.ts — Tipos del módulo test-config.
// Copiados desde:
//   - frontend lib/api/test-config/schemas.ts
//   - frontend lib/api/filtered-questions/schemas.ts (SectionFilter)
// Los wrappers Zod no se importan aquí — el backend recibe input ya validado
// por el DTO/Pipe de NestJS en la capa controller. Aquí solo declaramos los
// shapes que las queries Drizzle consumen y devuelven.

// ============================================
// FILTRO DE SECCIONES (subset usado por test-config)
// ============================================

export interface SectionFilter {
  title: string;
  articleRange?: {
    start: number;
    end: number;
  };
  sectionNumber?: string;
  sectionType?: string;
}

// ============================================
// ARTÍCULOS POR LEY
// ============================================

export interface GetArticlesRequest {
  lawShortName: string;
  /** null/undefined = configurador standalone (sin filtro por tema). */
  topicNumber?: number | null;
  positionType: string;
  includeOfficialCount: boolean;
}

export interface ArticleItem {
  article_number: number | string;
  title: string | null;
  question_count: number;
  official_question_count?: number;
}

export interface GetArticlesResponse {
  success: boolean;
  articles?: ArticleItem[];
  error?: string;
}

// ============================================
// ESTIMACIÓN DE PREGUNTAS DISPONIBLES
// ============================================

export type DifficultyMode =
  | 'random'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'extreme'
  | 'adaptive';

export interface EstimateQuestionsRequest {
  topicNumber?: number | null;
  positionType: string;
  selectedLaws: string[];
  selectedArticlesByLaw: Record<string, (number | string)[]>;
  selectedSectionFilters: SectionFilter[];
  onlyOfficialQuestions: boolean;
  difficultyMode: DifficultyMode;
  focusEssentialArticles: boolean;
}

export interface EstimateQuestionsResponse {
  success: boolean;
  count?: number;
  byLaw?: Record<string, number>;
  error?: string;
}

// ============================================
// ARTÍCULOS IMPRESCINDIBLES
// ============================================

export interface GetEssentialArticlesRequest {
  topicNumber: number;
  positionType: string;
}

export interface EssentialArticleItem {
  number: number | string;
  law: string;
  questionsCount: number;
}

export interface GetEssentialArticlesResponse {
  success: boolean;
  essentialCount?: number;
  essentialArticles?: EssentialArticleItem[];
  totalQuestions?: number;
  byDifficulty?: Record<string, number>;
  error?: string;
}

// ============================================
// SECCIONES (TÍTULOS/CAPÍTULOS) CON SCOPE DE TEMA
// ============================================

export interface GetScopedSectionsRequest {
  lawShortName: string;
  topicNumber: number;
  positionType: string;
}

export interface SectionScopeMeta {
  articlesInScope: string[];
  articleCountInScope: number;
}

export interface ScopedLawSection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  articleRange: { start: number; end: number } | null;
  sectionNumber: string | null;
  sectionType: string | null;
  orderPosition: number;
  scopeMeta: SectionScopeMeta;
}

export interface GetScopedSectionsResponse {
  success: boolean;
  sections?: ScopedLawSection[];
  totalInScope?: number;
  error?: string;
}
