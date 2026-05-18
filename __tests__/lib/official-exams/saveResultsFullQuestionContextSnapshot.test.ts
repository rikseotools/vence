/**
 * Test de regresión: saveOfficialExamResults() (path antiguo) también debe
 * poblar full_question_context con el snapshot.
 *
 * Bug Nila 17/05/2026: ver initFullQuestionContextSnapshot.test.ts para
 * descripción completa. Este path (`/api/v2/official-exams/save-results`)
 * se usa solo cuando el cliente NO tiene sesión existente (init no se
 * llamó) y va directo a guardar resultados completos.
 *
 * Fix: igual que en init, hacer SELECT de questions + psychometric_questions
 * con todos los campos y guardarlo en full_question_context.
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

describe('saveOfficialExamResults — snapshot full_question_context', () => {
  const src = read('lib/api/official-exams/queries.ts')

  const fnStart = src.indexOf('export async function saveOfficialExamResults')
  const fnEnd = src.indexOf('export async function', fnStart + 1)
  expect(fnStart).toBeGreaterThan(-1)
  const fnSrc = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined)

  it('separa los IDs por tipo para el snapshot', () => {
    expect(fnSrc).toMatch(/legIdsForSnapshot[\s\S]{0,150}questionType\s*===\s*'legislative'/)
    expect(fnSrc).toMatch(/psyIdsForSnapshot[\s\S]{0,150}questionType\s*===\s*'psychometric'/)
  })

  it('selecciona optionA-E + imageUrl + contentData + explanation + questionText de questions (legislativas)', () => {
    expect(fnSrc).toMatch(/optionA:\s*questions\.optionA/)
    expect(fnSrc).toMatch(/optionE:\s*questions\.optionE/)
    expect(fnSrc).toMatch(/imageUrl:\s*questions\.imageUrl/)
    expect(fnSrc).toMatch(/contentData:\s*questions\.contentData/)
    expect(fnSrc).toMatch(/explanation:\s*questions\.explanation/)
  })

  it('selecciona optionA-E + imageUrl + contentData + explanation + questionText de psychometric_questions', () => {
    expect(fnSrc).toMatch(/optionA:\s*psychometricQuestions\.optionA/)
    expect(fnSrc).toMatch(/optionE:\s*psychometricQuestions\.optionE/)
    expect(fnSrc).toMatch(/imageUrl:\s*psychometricQuestions\.imageUrl/)
    expect(fnSrc).toMatch(/contentData:\s*psychometricQuestions\.contentData/)
    expect(fnSrc).toMatch(/explanation:\s*psychometricQuestions\.explanation/)
  })

  it('construye legContextMap y psyContextMap (separados por tipo)', () => {
    expect(fnSrc).toMatch(/legContextMap\s*=\s*new\s+Map<string,\s*QuestionContext>/)
    expect(fnSrc).toMatch(/psyContextMap\s*=\s*new\s+Map<string,\s*QuestionContext>/)
  })

  it('puebla los maps con options filtradas de null/empty', () => {
    expect(fnSrc).toMatch(
      /legContextMap\.set\([\s\S]{0,400}options:\s*\[q\.optionA,\s*q\.optionB,\s*q\.optionC,\s*q\.optionD,\s*q\.optionE\]\.filter/,
    )
    expect(fnSrc).toMatch(
      /psyContextMap\.set\([\s\S]{0,400}options:\s*\[q\.optionA,\s*q\.optionB,\s*q\.optionC,\s*q\.optionD,\s*q\.optionE\]\.filter/,
    )
  })

  it('el INSERT de test_questions incluye fullQuestionContext con el snapshot', () => {
    expect(fnSrc).toMatch(
      /testQuestionsData\s*=\s*answeredResults\.map\([\s\S]{0,2000}fullQuestionContext:\s*ctx\s*\?\?\s*\{\}/,
    )
  })

  it('el contexto se elige en función de isLegislative', () => {
    expect(fnSrc).toMatch(
      /const\s+ctx\s*=\s*isLegislative[\s\S]{0,200}legContextMap\.get[\s\S]{0,200}psyContextMap\.get/,
    )
  })
})
