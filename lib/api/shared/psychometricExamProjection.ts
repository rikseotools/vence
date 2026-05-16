// lib/api/shared/psychometricExamProjection.ts
//
// Single source of truth para PROYECTAR (SELECT + mapper) preguntas psicotécnicas
// dentro del flujo de simulacro/examen oficial.
//
// **Motivación (incidente Mayte, 16/05/2026)**: el mismo SELECT estaba duplicado
// en 5 archivos distintos. Al añadir un campo (image_url) hubo que tocar todos
// los sitios — uno se nos escapó (getOfficialExamFailedQuestions) y el bug se
// manifestaba solo en la review de tests pasados. Centralizar hace IMPOSIBLE
// olvidar campos al introducir un flujo nuevo.
//
// **Cómo usar**:
//   const rows = await db.select(psychometricExamColumns)
//     .from(psychometricQuestions).where(...)
//   const formatted = rows.map(toOfficialExamPsychometric)
//
// Si necesitas un campo nuevo en TODOS los flujos de examen, añádelo a:
//   1. `psychometricExamColumns` (el SELECT)
//   2. `PsychometricExamRow` (el tipo)
//   3. `toOfficialExamPsychometric()` (el mapper)
// y todos los consumidores lo obtienen automáticamente.

import { psychometricQuestions } from '@/db/schema'
import type { OfficialExamQuestion } from '../official-exams/schemas'

/**
 * Columnas a SELECT cuando se proyecta una psicotécnica para examen/simulacro.
 * Pasar como argumento a `db.select(psychometricExamColumns)`.
 */
export const psychometricExamColumns = {
  id: psychometricQuestions.id,
  questionText: psychometricQuestions.questionText,
  optionA: psychometricQuestions.optionA,
  optionB: psychometricQuestions.optionB,
  optionC: psychometricQuestions.optionC,
  optionD: psychometricQuestions.optionD,
  optionE: psychometricQuestions.optionE,
  explanation: psychometricQuestions.explanation,
  difficulty: psychometricQuestions.difficulty,
  examSource: psychometricQuestions.examSource,
  questionSubtype: psychometricQuestions.questionSubtype,
  contentData: psychometricQuestions.contentData,
  timeLimitSeconds: psychometricQuestions.timeLimitSeconds,
  // CRÍTICO: data_tables/pie_chart/etc. migradas de Madrid guardan la tabla
  // como imagen aquí en vez de en content_data estructurado. Sin esta columna
  // el render se ve vacío (bug Mayte 16/05/2026).
  imageUrl: psychometricQuestions.imageUrl,
} as const

/**
 * Forma del row devuelto por `db.select(psychometricExamColumns)`.
 * Drizzle inferiría este tipo automáticamente, pero declararlo explícitamente
 * permite pasar el row a `toOfficialExamPsychometric()` sin acoplar a Drizzle
 * (útil en tests con mocks).
 */
export type PsychometricExamRow = {
  id: string
  questionText: string
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
  optionE: string | null
  explanation: string | null
  difficulty: string | null
  examSource: string | null
  questionSubtype: string | null
  contentData: unknown
  timeLimitSeconds: number | null
  imageUrl: string | null
}

/**
 * Mapper a `OfficialExamQuestion` (la forma que consumen el simulacro,
 * /api/v2/official-exams/questions y el cliente OfficialExamLayout).
 *
 * Defaults:
 *   - options ↦ '' si null (compatibilidad con render legacy de psicotécnicas
 *     que rellenaba con string vacío en vez de null)
 *   - isReserva ↦ derivado de examSource ('Reserva' en el texto)
 *   - articleNumber/lawName/examCase* ↦ null (campos solo para legislativas)
 */
export function toOfficialExamPsychometric(row: PsychometricExamRow): OfficialExamQuestion {
  return {
    id: row.id,
    questionText: row.questionText,
    optionA: row.optionA || '',
    optionB: row.optionB || '',
    optionC: row.optionC || '',
    optionD: row.optionD || '',
    optionE: row.optionE || '',
    explanation: row.explanation,
    difficulty: row.difficulty,
    questionType: 'psychometric' as const,
    questionSubtype: row.questionSubtype,
    examSource: row.examSource,
    isReserva: row.examSource?.includes('Reserva') || false,
    contentData: row.contentData as Record<string, unknown> | null,
    timeLimitSeconds: row.timeLimitSeconds,
    imageUrl: row.imageUrl,
    articleNumber: null,
    lawName: null,
    examCaseId: null,
    examCaseText: null,
    examCaseTitle: null,
  }
}

/**
 * Mapper a la forma de "resume" (resumedOfficialExamQuestionSchema).
 * Espera además questionOrder y savedAnswer del registro de test_questions.
 */
export function toResumedPsychometric(
  row: PsychometricExamRow,
  extras: { questionOrder: number; savedAnswer: string | null },
) {
  return {
    id: row.id,
    questionOrder: extras.questionOrder,
    questionText: row.questionText,
    optionA: row.optionA || '',
    optionB: row.optionB || '',
    optionC: row.optionC || '',
    optionD: row.optionD || '',
    optionE: row.optionE || '',
    explanation: row.explanation,
    difficulty: row.difficulty,
    questionType: 'psychometric' as const,
    questionSubtype: row.questionSubtype,
    contentData: row.contentData as Record<string, unknown> | null,
    imageUrl: row.imageUrl,
    isReserva: row.examSource?.includes('Reserva') || false,
    articleNumber: null,
    lawName: null,
    savedAnswer: extras.savedAnswer,
  }
}
