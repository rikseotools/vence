/**
 * Test de regresión: tiempo por pregunta en simulacros oficiales.
 *
 * Bug del 17/05/2026 (reportado por Nila, jinayda32@gmail.com):
 * El 100% de las preguntas guardadas vía simulacro oficial tenían
 * time_spent_seconds=0. Causa: tres puntos del flujo no llevaban tiempo:
 *
 *   (a) Cliente `OfficialExamLayout.tsx` no medía tiempo por pregunta.
 *   (b) Schema `questionResultSchema` no incluía la prop.
 *   (c) `initOfficialExam` insertaba 0 y `/complete` NUNCA tocaba la columna.
 *
 * Bug regresivo: 9% hace 30 días → 51% el 16/05. Afecta a métricas globales
 * (averageTime, studySeconds, avgTimePerQuestion).
 *
 * Fix:
 * - Cliente registra timestamp de PRIMERA respuesta por pregunta en un Map.
 * - Función `computeTimeSpentMap` ordena por timestamp y calcula deltas
 *   (con `startTime` como pivot para la primera).
 * - Schema acepta `timeSpentSeconds`.
 * - Insert en `save-results` usa `result.timeSpentSeconds ?? 0`.
 * - UPDATE en `/complete` añade `time_spent_seconds` al VALUES y usa
 *   `GREATEST(u, COALESCE(tq, 0))` para no machacar valores reales en resume.
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

describe('OfficialExamLayout — tracking de tiempo por pregunta', () => {
  const layout = read('components/OfficialExamLayout.tsx')

  it('declara firstAnswerTimesRef para registrar primera respuesta por pregunta', () => {
    expect(layout).toMatch(/firstAnswerTimesRef\s*=\s*React\.useRef<Map<number,\s*number>>/)
  })

  it('handleAnswerSelect registra timestamp solo la PRIMERA vez', () => {
    expect(layout).toMatch(
      /handleAnswerSelect[\s\S]{0,1500}if\s*\(\s*!firstAnswerTimesRef\.current\.has\(questionIndex\)\s*\)\s*{\s*firstAnswerTimesRef\.current\.set\(questionIndex,\s*Date\.now\(\)\)/,
    )
  })

  it('define computeTimeSpentMap que ordena por timestamp', () => {
    expect(layout).toMatch(/function\s+computeTimeSpentMap/)
    expect(layout).toMatch(/computeTimeSpentMap[\s\S]{0,800}sort\(\(a,\s*b\)\s*=>\s*a\[1\]\s*-\s*b\[1\]\)/)
  })

  it('computeTimeSpentMap usa startTime como pivot inicial', () => {
    expect(layout).toMatch(/computeTimeSpentMap[\s\S]{0,800}let\s+prevTs\s*=\s*startTime/)
  })

  it('resultsForComplete (flujo /complete) incluye timeSpentSeconds', () => {
    expect(layout).toMatch(/resultsForComplete[\s\S]{0,500}timeSpentSeconds:\s*timeSpentMap\[index\]/)
  })

  it('resultsForApi (flujo /save-results) incluye timeSpentSeconds', () => {
    expect(layout).toMatch(/resultsForApi[\s\S]{0,800}timeSpentSeconds:\s*timeSpentMap\[index\]/)
  })
})

describe('Schema questionResultSchema — timeSpentSeconds', () => {
  const schemas = read('lib/api/official-exams/schemas.ts')

  it('incluye timeSpentSeconds en questionResultSchema', () => {
    expect(schemas).toMatch(
      /export\s+const\s+questionResultSchema[\s\S]{0,800}timeSpentSeconds:\s*z\.number\(\)\.int\(\)\.min\(0\)/,
    )
  })
})

describe('Insert save-results — usa timeSpentSeconds del result', () => {
  const queries = read('lib/api/official-exams/queries.ts')

  it('NO hardcodea timeSpentSeconds: 0 cuando inserta resultados de save-results', () => {
    // Hay que distinguir del init (donde 0 es correcto). Solo el bloque de
    // saveOfficialExamResults debe leer del result. Buscamos que en el array
    // `testQuestionsData` venga del result, no 0.
    expect(queries).toMatch(
      /testQuestionsData\s*=\s*answeredResults\.map[\s\S]{0,800}timeSpentSeconds:\s*result\.timeSpentSeconds\s*\?\?\s*0/,
    )
  })
})

describe('Route /complete — UPDATE de time_spent_seconds con GREATEST', () => {
  const route = read('app/api/v2/official-exams/complete/route.ts')

  it('VALUES incluye time_spent_seconds como 5º campo', () => {
    expect(route).toMatch(
      /sql`\([\s\S]{0,200}timeSpentSeconds[\s\S]{0,200}::int\)`/,
    )
  })

  it('UPDATE escribe time_spent_seconds con GREATEST para preservar valor previo', () => {
    expect(route).toMatch(
      /time_spent_seconds\s*=\s*GREATEST\(u\.time_spent_seconds,\s*COALESCE\(tq\.time_spent_seconds,\s*0\)\)/,
    )
  })

  it('VALUES alias incluye time_spent_seconds', () => {
    expect(route).toMatch(
      /AS\s+u\(question_order,\s*is_correct,\s*correct_answer,\s*user_answer,\s*time_spent_seconds\)/,
    )
  })
})
