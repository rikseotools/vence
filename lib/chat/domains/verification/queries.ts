// lib/chat/domains/verification/queries.ts
// Queries para obtener datos de verificación

import { createClient } from '@supabase/supabase-js'
import { logger } from '../../shared/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface LinkedArticle {
  id: string
  articleNumber: string
  title: string | null
  content: string | null
  lawShortName: string
  lawName: string
}

export interface QuestionFullData {
  id: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: number
  explanation: string | null
  primaryArticleId: string | null
  linkedArticle: LinkedArticle | null
  lawShortName: string | null
}

/**
 * Obtiene el artículo vinculado a una pregunta
 */
export async function getLinkedArticle(questionId: string): Promise<LinkedArticle | null> {
  if (!questionId) return null

  try {
    // Primero obtener el primary_article_id de la pregunta
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('primary_article_id')
      .eq('id', questionId)
      .single()

    if (questionError || !question?.primary_article_id) {
      logger.debug(`No linked article for question ${questionId}`, { domain: 'verification' })
      return null
    }

    // Obtener el artículo con su ley
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select(`
        id,
        article_number,
        title,
        content,
        law:laws!inner(short_name, name)
      `)
      .eq('id', question.primary_article_id)
      .single()

    if (articleError || !article) {
      logger.warn(`Article ${question.primary_article_id} not found`, { domain: 'verification' })
      return null
    }

    const law = article.law as { short_name: string; name: string }

    return {
      id: article.id,
      articleNumber: article.article_number,
      title: article.title,
      content: article.content,
      lawShortName: law.short_name,
      lawName: law.name,
    }
  } catch (error) {
    logger.error('Error getting linked article', error, { domain: 'verification' })
    return null
  }
}

/**
 * Obtiene todos los datos de una pregunta incluyendo el artículo vinculado
 */
export async function getQuestionFullData(questionId: string): Promise<QuestionFullData | null> {
  if (!questionId) return null

  try {
    const { data: question, error } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation,
        primary_article_id,
        law:laws(short_name)
      `)
      .eq('id', questionId)
      .single()

    if (error || !question) {
      logger.warn(`Question ${questionId} not found`, { domain: 'verification' })
      return null
    }

    // Obtener artículo vinculado si existe
    let linkedArticle: LinkedArticle | null = null
    if (question.primary_article_id) {
      linkedArticle = await getLinkedArticle(questionId)
    }

    const law = question.law as { short_name: string } | null

    return {
      id: question.id,
      questionText: question.question_text,
      optionA: question.option_a,
      optionB: question.option_b,
      optionC: question.option_c,
      optionD: question.option_d,
      correctOption: question.correct_option,
      explanation: question.explanation,
      primaryArticleId: question.primary_article_id,
      linkedArticle,
      lawShortName: law?.short_name || null,
    }
  } catch (error) {
    logger.error('Error getting question full data', error, { domain: 'verification' })
    return null
  }
}
