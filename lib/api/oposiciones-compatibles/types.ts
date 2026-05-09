export interface LawOverlap {
  lawId: string
  lawShortName: string
  lawName: string
  coveredArticles: number
  totalArticles: number
  overlapPct: number
  coveredArticleNumbers: string[]
  missingArticleNumbers: string[]
}

export interface OposicionOverlap {
  slug: string
  nombre: string
  shortName: string
  badge: string
  administracion: string
  overlapPct: number
  coveredArticles: number
  totalArticles: number
  lawBreakdown: LawOverlap[]
}

/** Stats personales del usuario para una oposición target */
export interface UserOverlapProgress {
  targetSlug: string
  /** Preguntas respondidas correctamente que pertenecen a artículos del scope target */
  correctAnswers: number
  /** Total de preguntas respondidas (correctas + incorrectas) del scope target */
  totalAnswers: number
  /** Accuracy sobre las preguntas del scope target */
  accuracy: number
  /** Artículos únicos del scope target en los que el usuario ha respondido >= 1 pregunta */
  articlesTouched: number
  /** Total de artículos en el scope target */
  totalArticles: number
  /** Desglose por ley */
  lawProgress: {
    lawId: string
    lawShortName: string
    correctAnswers: number
    totalAnswers: number
    articlesTouched: number
    totalArticles: number
  }[]
}
