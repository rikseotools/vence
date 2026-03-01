// lib/api/psychometric-test-data/queries.ts
// Queries Drizzle server-side para categorías y preguntas psicotécnicas

import { getDb } from '@/db/client'
import {
  psychometricCategories,
  psychometricSections,
  psychometricQuestions,
} from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import type {
  GetPsychometricCategoriesResponse,
  GetPsychometricQuestionsResponse,
  PsychometricCategory,
} from './schemas'

// Cache simple en memoria (60 segundos para categorías, cambian poco)
let _categoriesCache: { data: GetPsychometricCategoriesResponse; timestamp: number } | null = null
const CATEGORIES_CACHE_TTL = 60 * 1000

/**
 * Obtiene todas las categorías activas con sus secciones y conteos de preguntas.
 * Resultado ordenado por display_order.
 */
export async function getPsychometricCategories(): Promise<GetPsychometricCategoriesResponse> {
  try {
    // Check cache
    if (_categoriesCache && Date.now() - _categoriesCache.timestamp < CATEGORIES_CACHE_TTL) {
      return _categoriesCache.data
    }

    const db = getDb()

    // 1. Get active categories ordered by display_order
    const cats = await db
      .select({
        id: psychometricCategories.id,
        key: psychometricCategories.categoryKey,
        name: psychometricCategories.displayName,
        displayOrder: psychometricCategories.displayOrder,
      })
      .from(psychometricCategories)
      .where(eq(psychometricCategories.isActive, true))
      .orderBy(psychometricCategories.displayOrder)

    // 2. Get all active sections
    const secs = await db
      .select({
        id: psychometricSections.id,
        categoryId: psychometricSections.categoryId,
        key: psychometricSections.sectionKey,
        name: psychometricSections.displayName,
        displayOrder: psychometricSections.displayOrder,
      })
      .from(psychometricSections)
      .where(eq(psychometricSections.isActive, true))
      .orderBy(psychometricSections.displayOrder)

    // 3. Count questions per section (active questions only)
    const sectionCounts = await db
      .select({
        sectionId: psychometricQuestions.sectionId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(psychometricQuestions)
      .where(eq(psychometricQuestions.isActive, true))
      .groupBy(psychometricQuestions.sectionId)

    // Build a sectionId -> count map
    const countMap = new Map<string, number>()
    for (const sc of sectionCounts) {
      if (sc.sectionId) {
        countMap.set(sc.sectionId, Number(sc.count))
      }
    }

    // 4. Also count questions per category (for questions that might not have a section)
    const categoryCounts = await db
      .select({
        categoryId: psychometricQuestions.categoryId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(psychometricQuestions)
      .where(eq(psychometricQuestions.isActive, true))
      .groupBy(psychometricQuestions.categoryId)

    const categoryCountMap = new Map<string, number>()
    for (const cc of categoryCounts) {
      categoryCountMap.set(cc.categoryId, Number(cc.count))
    }

    // 5. Assemble response
    const categories: PsychometricCategory[] = cats.map(cat => {
      const catSections = secs
        .filter(s => s.categoryId === cat.id)
        .map(s => ({
          key: s.key,
          name: s.name,
          count: countMap.get(s.id) || 0,
        }))

      return {
        key: cat.key,
        name: cat.name,
        questionCount: categoryCountMap.get(cat.id) || 0,
        sections: catSections,
      }
    })

    const response: GetPsychometricCategoriesResponse = {
      success: true,
      categories,
    }

    _categoriesCache = { data: response, timestamp: Date.now() }

    return response
  } catch (error) {
    console.error('Error obteniendo categorías psicotécnicas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Obtiene preguntas psicotécnicas filtradas por categoryKey, mezcladas aleatoriamente.
 * NUNCA incluye correctOption (seguridad anti-scraping).
 */
export async function getPsychometricQuestions(
  categoryKeys: string[],
  numQuestions: number
): Promise<GetPsychometricQuestionsResponse> {
  try {
    const db = getDb()

    // 1. Resolve categoryKeys to IDs
    const cats = await db
      .select({
        id: psychometricCategories.id,
        key: psychometricCategories.categoryKey,
      })
      .from(psychometricCategories)
      .where(
        and(
          eq(psychometricCategories.isActive, true),
          inArray(psychometricCategories.categoryKey, categoryKeys)
        )
      )

    const categoryIds = cats.map(c => c.id)

    if (categoryIds.length === 0) {
      return {
        success: true,
        questions: [],
        totalAvailable: 0,
      }
    }

    // 2. Fetch questions — explicit columns, NO correctOption
    const allQuestions = await db
      .select({
        id: psychometricQuestions.id,
        categoryId: psychometricQuestions.categoryId,
        sectionId: psychometricQuestions.sectionId,
        questionSubtype: psychometricQuestions.questionSubtype,
        questionText: psychometricQuestions.questionText,
        optionA: psychometricQuestions.optionA,
        optionB: psychometricQuestions.optionB,
        optionC: psychometricQuestions.optionC,
        optionD: psychometricQuestions.optionD,
        // correctOption: OMITIDO — seguridad anti-scraping
        contentData: psychometricQuestions.contentData,
        difficulty: psychometricQuestions.difficulty,
        timeLimitSeconds: psychometricQuestions.timeLimitSeconds,
        cognitiveSkills: psychometricQuestions.cognitiveSkills,
        isOfficialExam: psychometricQuestions.isOfficialExam,
        examSource: psychometricQuestions.examSource,
      })
      .from(psychometricQuestions)
      .where(
        and(
          eq(psychometricQuestions.isActive, true),
          inArray(psychometricQuestions.categoryId, categoryIds)
        )
      )

    const totalAvailable = allQuestions.length

    // 3. Shuffle and take numQuestions (Fisher-Yates)
    const shuffled = [...allQuestions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const selected = shuffled.slice(0, numQuestions)

    console.log(
      `✅ [API/psychometric-test-data] Loaded ${selected.length}/${totalAvailable} questions for categories: ${categoryKeys.join(', ')}`
    )

    return {
      success: true,
      questions: selected,
      totalAvailable,
    }
  } catch (error) {
    console.error('Error obteniendo preguntas psicotécnicas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Invalida el cache de categorías psicotécnicas
 */
export function invalidatePsychometricCategoriesCache(): void {
  _categoriesCache = null
}
