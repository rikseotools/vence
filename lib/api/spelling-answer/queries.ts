// lib/api/spelling-answer/queries.ts - Validación y tracking para preguntas de ortografía
// La respuesta correcta SOLO se revela después de que el usuario responde (anti-scraping)
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getSpellingDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { spellingQuestions, spellingTestSessions, spellingTestAnswers } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import type {
  ValidateSpellingAnswerRequest,
  ValidateSpellingAnswerResponse,
  CreateSpellingSessionRequest,
  CreateSpellingSessionResponse,
  SaveSpellingAnswerRequest,
  CompleteSpellingSessionRequest,
} from './schemas'

interface SpellingOption {
  letter: string
  text: string
  isCorrectlyWritten: boolean
}

// ============================================
// VALIDAR RESPUESTA
// ============================================

export async function validateSpellingAnswer(
  params: ValidateSpellingAnswerRequest
): Promise<ValidateSpellingAnswerResponse> {
  const db = getSpellingDb()

  const result = await db
    .select({
      options: spellingQuestions.options,
      explanation: spellingQuestions.explanation,
    })
    .from(spellingQuestions)
    .where(and(
      eq(spellingQuestions.id, params.questionId),
      eq(spellingQuestions.isActive, true)
    ))
    .limit(1)

  const question = result[0]

  if (!question) {
    console.error('❌ [API/spelling] Pregunta no encontrada:', params.questionId)
    return {
      success: false,
      score: 0,
      isFullyCorrect: false,
      incorrectIndices: [],
      explanation: null,
    }
  }

  const options = question.options as SpellingOption[]

  // Índices de palabras MAL escritas (isCorrectlyWritten = false → hay que marcarlas)
  const incorrectIndices = options
    .map((o, i) => (!o.isCorrectlyWritten ? i : -1))
    .filter((i) => i >= 0)

  const selectedSet = new Set(params.selectedIndices)
  const incorrectSet = new Set(incorrectIndices)

  // Scoring todo-o-nada (como en el examen real GC):
  // Correcto solo si marcó EXACTAMENTE las palabras incorrectas, ni más ni menos.
  const allIncorrectsMarked = incorrectIndices.every((i) => selectedSet.has(i))
  const noFalsePositives = params.selectedIndices.every((i) => incorrectSet.has(i))
  const isFullyCorrect = allIncorrectsMarked && noFalsePositives

  const score = isFullyCorrect ? 1 : 0

  console.log('✅ [API/spelling] Respuesta validada:', {
    questionId: params.questionId,
    selected: params.selectedIndices,
    incorrectIndices,
    isFullyCorrect,
  })

  return {
    success: true,
    score,
    isFullyCorrect,
    incorrectIndices,
    explanation: question.explanation,
  }
}

// ============================================
// CREAR SESIÓN DE TEST
// ============================================

export async function createSpellingSession(
  params: CreateSpellingSessionRequest
): Promise<CreateSpellingSessionResponse> {
  const db = getSpellingDb()

  const [session] = await db
    .insert(spellingTestSessions)
    .values({
      userId: params.userId,
      category: params.category || null,
      totalQuestions: params.totalQuestions,
    })
    .returning({ id: spellingTestSessions.id })

  return { success: true, sessionId: session.id }
}

// ============================================
// GUARDAR RESPUESTA INDIVIDUAL
// ============================================

export async function saveSpellingAnswer(params: SaveSpellingAnswerRequest): Promise<void> {
  const db = getSpellingDb()

  await db.insert(spellingTestAnswers).values({
    sessionId: params.sessionId,
    userId: params.userId,
    questionId: params.questionId,
    questionOrder: params.questionOrder,
    selectedIndices: params.selectedIndices,
    incorrectIndices: params.incorrectIndices,
    isCorrect: params.isCorrect,
    timeSpentSeconds: params.timeSpentSeconds || null,
  })

  // Actualizar contadores de la sesión
  await db
    .update(spellingTestSessions)
    .set({
      questionsAnswered: sql`questions_answered + 1`,
      correctAnswers: params.isCorrect
        ? sql`correct_answers + 1`
        : spellingTestSessions.correctAnswers,
    })
    .where(eq(spellingTestSessions.id, params.sessionId))
}

// ============================================
// COMPLETAR SESIÓN
// ============================================

export async function completeSpellingSession(params: CompleteSpellingSessionRequest): Promise<void> {
  const db = getSpellingDb()

  await db
    .update(spellingTestSessions)
    .set({
      isCompleted: true,
      completedAt: new Date().toISOString(),
      correctAnswers: params.correctAnswers,
      questionsAnswered: params.totalAnswered,
    })
    .where(and(
      eq(spellingTestSessions.id, params.sessionId),
      eq(spellingTestSessions.userId, params.userId)
    ))
}
