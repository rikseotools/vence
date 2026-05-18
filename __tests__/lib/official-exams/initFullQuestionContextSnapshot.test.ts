/**
 * Test de regresión: initOfficialExam() debe poblar full_question_context
 * con un snapshot completo de la pregunta (options, image_url, content_data,
 * explanation, question_text).
 *
 * Bug del 17/05/2026 (reportado por Nila): preguntas psicotécnicas en
 * /revisar/[testId] salían sin opciones porque el INSERT en test_questions
 * dejaba full_question_context en su default `{}`. La query de review
 * intentaba leerlas del snapshot y, al no encontrarlas, caía al "fallback"
 * desde la tabla viva. Si la pregunta había cambiado o se desactivado entre
 * el examen y la revisión, el fallback también fallaba → options = [].
 *
 * Fix: snapshot al iniciar el simulacro. La review queda inmune a cambios
 * posteriores en `questions` / `psychometric_questions`.
 *
 * Este test grep verifica que initOfficialExam:
 * 1. Selecciona optionA-E + imageUrl + contentData + explanation + questionText
 *    de AMBAS tablas (questions y psychometric_questions).
 * 2. Construye un map por tipo (legislativeContextMap, psychometricContextMap).
 * 3. Filtra options de null/empty (igual que la review).
 * 4. Pasa el contexto al INSERT de test_questions via `fullQuestionContext`.
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

describe('initOfficialExam — snapshot full_question_context (regresión bug Nila)', () => {
  const src = read('lib/api/official-exams/queries.ts')

  // Solo nos interesa lo que pasa dentro de initOfficialExam, no del resto.
  const initStart = src.indexOf('export async function initOfficialExam')
  const initEnd = src.indexOf('export async function', initStart + 1)
  expect(initStart).toBeGreaterThan(-1)
  const initSrc = src.slice(initStart, initEnd > 0 ? initEnd : undefined)

  it('selecciona optionA-E + imageUrl + contentData + explanation + questionText de questions (legislativas)', () => {
    expect(initSrc).toMatch(/optionA:\s*questions\.optionA/)
    expect(initSrc).toMatch(/optionD:\s*questions\.optionD/)
    expect(initSrc).toMatch(/optionE:\s*questions\.optionE/)
    expect(initSrc).toMatch(/imageUrl:\s*questions\.imageUrl/)
    expect(initSrc).toMatch(/contentData:\s*questions\.contentData/)
    expect(initSrc).toMatch(/explanation:\s*questions\.explanation/)
    expect(initSrc).toMatch(/questionText:\s*questions\.questionText/)
  })

  it('selecciona optionA-E + imageUrl + contentData + explanation + questionText de psychometric_questions', () => {
    expect(initSrc).toMatch(/optionA:\s*psychometricQuestions\.optionA/)
    expect(initSrc).toMatch(/optionD:\s*psychometricQuestions\.optionD/)
    expect(initSrc).toMatch(/optionE:\s*psychometricQuestions\.optionE/)
    expect(initSrc).toMatch(/imageUrl:\s*psychometricQuestions\.imageUrl/)
    expect(initSrc).toMatch(/contentData:\s*psychometricQuestions\.contentData/)
    expect(initSrc).toMatch(/explanation:\s*psychometricQuestions\.explanation/)
    expect(initSrc).toMatch(/questionText:\s*psychometricQuestions\.questionText/)
  })

  it('construye legislativeContextMap y psychometricContextMap por separado', () => {
    expect(initSrc).toMatch(/legislativeContextMap\s*=\s*new\s+Map<string,\s*QuestionContext>/)
    expect(initSrc).toMatch(/psychometricContextMap\s*=\s*new\s+Map<string,\s*QuestionContext>/)
  })

  it('puebla los maps con options filtradas de null/empty (igual que la review)', () => {
    expect(initSrc).toMatch(
      /legislativeContextMap\.set\([\s\S]{0,400}options:\s*\[q\.optionA,\s*q\.optionB,\s*q\.optionC,\s*q\.optionD,\s*q\.optionE\]\.filter/,
    )
    expect(initSrc).toMatch(
      /psychometricContextMap\.set\([\s\S]{0,400}options:\s*\[q\.optionA,\s*q\.optionB,\s*q\.optionC,\s*q\.optionD,\s*q\.optionE\]\.filter/,
    )
  })

  it('el INSERT de test_questions incluye fullQuestionContext con el snapshot', () => {
    // El insert se construye en testQuestionsData. Buscamos que cada record
    // lleve fullQuestionContext con el contexto resuelto en función del tipo.
    expect(initSrc).toMatch(
      /testQuestionsData\s*=\s*questionsData\.map\([\s\S]{0,2000}fullQuestionContext:\s*ctx\s*\?\?\s*\{\}/,
    )
  })

  it('el contexto se elige en función de isLegislative (no se cruzan tipos)', () => {
    expect(initSrc).toMatch(
      /const\s+ctx\s*=\s*isLegislative[\s\S]{0,200}legislativeContextMap\.get[\s\S]{0,200}psychometricContextMap\.get/,
    )
  })
})
