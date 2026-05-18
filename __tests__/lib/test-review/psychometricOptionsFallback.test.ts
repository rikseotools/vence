/**
 * Test de regresión: getTestReview() debe cargar las opciones de las preguntas
 * psicotécnicas desde la BD cuando el fullQuestionContext no las tiene.
 *
 * Bug del 17/05/2026 (reportado por Nila, jinayda32@gmail.com, feedback
 * c9fd4693). Captura mostraba preguntas psicotécnicas en /revisar/[testId]
 * con enunciado + "Impugnar pregunta" + "Tiempo: 0s" pero SIN OPCIONES A/B/C/D
 * entre medias.
 *
 * Causa raíz en deploy `ae7caf9a` (que tenía Nila en caché):
 *
 *   const fallback = a.questionId ? questionDataMap.get(a.questionId) : undefined
 *
 * Solo cargaba el fallback para preguntas LEGISLATIVAS. Para psicotécnicas
 * (que tienen `psychometricQuestionId` y `questionId=null`), `fallback` era
 * undefined. La línea siguiente:
 *
 *   options: contextOptions || fallback?.options || []
 *
 * dejaba `options = []` cuando el snapshot `fullQuestionContext.options`
 * no estaba poblado, lo cual era frecuente en simulacros oficiales. Resultado:
 * el bloque expandido renderizaba sin opciones entre el enunciado y el botón
 * "Impugnar pregunta".
 *
 * Fix aplicado en commit `d080184a` (17/05/2026): añadir un
 * `psychometricDataMap` y elegir el fallback en función de isPsychometric.
 *
 * Este test grep-based verifica que el código sigue:
 * 1. Importando `psychometricQuestions` del schema
 * 2. Construyendo `psychometricDataMap` con sus opciones
 * 3. Eligiendo el fallback correcto vía `isPsychometric ? ... : ...`
 * 4. Que las opciones se filtran de null/empty (las legislativas también)
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

describe('getTestReview — fallback de opciones para psicotécnicas (regresión bug Nila)', () => {
  const src = read('lib/api/test-review/queries.ts')

  it('importa psychometricQuestions del schema', () => {
    expect(src).toMatch(/from\s+'@\/db\/schema'/)
    expect(src).toMatch(/psychometricQuestions/)
  })

  it('construye psychometricDataMap (con campo options) para todas las psy del test', () => {
    expect(src).toMatch(
      /const\s+psychometricDataMap\s*=\s*new\s+Map<string,\s*{[\s\S]{0,300}options:\s*string\[\]/,
    )
  })

  it('hace SELECT de optionA-E en psychometric_questions para construir el map', () => {
    expect(src).toMatch(/psychometricQuestions\.optionA/)
    expect(src).toMatch(/psychometricQuestions\.optionB/)
    expect(src).toMatch(/psychometricQuestions\.optionC/)
    expect(src).toMatch(/psychometricQuestions\.optionD/)
  })

  it('puebla el map con options filtradas de null/empty', () => {
    // Patrón: options: [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE].filter(...)
    expect(src).toMatch(
      /psychometricDataMap\.set\([\s\S]{0,300}options:\s*\[q\.optionA,\s*q\.optionB,\s*q\.optionC,\s*q\.optionD,\s*q\.optionE\]\.filter/,
    )
  })

  it('selecciona el fallback correcto en función de isPsychometric (NO solo a.questionId)', () => {
    // La regresión sería volver a: `const fallback = a.questionId ? questionDataMap.get(a.questionId) : undefined`
    // Lo correcto es elegir psychometricDataMap cuando isPsychometric.
    expect(src).toMatch(
      /const\s+fallback\s*=\s*isPsychometric[\s\S]{0,300}psychometricDataMap\.get[\s\S]{0,300}questionDataMap\.get/,
    )
  })

  it('NO contiene el patrón viejo `const fallback = a.questionId ? ... : undefined`', () => {
    // Esa era la línea bug. Si aparece, alguien la restauró.
    expect(src).not.toMatch(
      /const\s+fallback\s*=\s*a\.questionId\s*\?\s*questionDataMap\.get\(a\.questionId\)\s*:\s*undefined/,
    )
  })

  it('el campo options del response usa el fallback (contextOptions || fallback?.options || [])', () => {
    expect(src).toMatch(/options:\s*contextOptions\s*\|\|\s*fallback\?\.options\s*\|\|\s*\[\]/)
  })
})
