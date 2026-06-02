/**
 * Invariante de registros del modo «Examen Oficial».
 *
 * Toda oposición de `OPOSICIONES` que declare `officialExams` debe estar
 * registrada en TODOS los sitios que el flujo de examen consulta. Si falta en
 * alguno, la tarjeta aparece pero el examen falla con `400 "Parámetros
 * inválidos"` en un paso distinto (cargar / init / corregir / fallos /
 * revisar) o el conteo/validador de import se rompe en silencio.
 *
 * Este test existe porque la allowlist de oposiciones está DUPLICADA en varios
 * sitios hardcoded (hay TODOs de derivarla de `oposiciones.ts`). Al añadir
 * Aux Admin Ayto Zaragoza (OEP 2024) se olvidaron varios → 400 en cadena +
 * toggle de oficiales oculto. Este invariante caza ese olvido al instante.
 *
 * Ver `docs/maintenance/importar-examen-oficial-completo.md` §15.9.
 */

import { OPOSICIONES } from '@/lib/config/oposiciones'
import { oposicionToExamPosition } from '@/lib/api/official-exams/queries'
import { isExamPositionRegistered } from '@/lib/config/exam-positions'
import {
  getOfficialExamQuestionsRequestSchema,
  saveOfficialExamResultsRequestSchema,
  initOfficialExamRequestSchema,
  getOfficialExamFailedQuestionsRequestSchema,
  getOfficialExamReviewRequestSchema,
} from '@/lib/api/official-exams/schemas'

// Los 5 request-schemas que validan `oposicion` contra un z.enum hardcoded.
const SCHEMAS_WITH_OPOSICION_ENUM = {
  'getOfficialExamQuestions (/questions)': getOfficialExamQuestionsRequestSchema,
  'saveOfficialExamResults (/save-results)': saveOfficialExamResultsRequestSchema,
  'initOfficialExam (/init)': initOfficialExamRequestSchema,
  'getOfficialExamFailedQuestions (/failed-questions)': getOfficialExamFailedQuestionsRequestSchema,
  'getOfficialExamReview (/review)': getOfficialExamReviewRequestSchema,
} as const

// Extrae los valores permitidos del z.enum `oposicion` de un object-schema,
// sea cual sea la versión de zod (.options o ._def.values).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function enumValues(objectSchema: any): string[] {
  const field = objectSchema.shape.oposicion
  return field.options ?? field._def?.values ?? []
}

// Oposiciones que tienen modo «Examen Oficial» (al menos una convocatoria).
const OPOS_CON_EXAMEN = OPOSICIONES.filter(
  (o) => Array.isArray(o.officialExams) && o.officialExams.length > 0,
)

describe('Registros del modo Examen Oficial (invariante)', () => {
  test('hay al menos una oposición con officialExams (sanity)', () => {
    expect(OPOS_CON_EXAMEN.length).toBeGreaterThan(0)
  })

  describe.each(OPOS_CON_EXAMEN.map((o) => [o.slug, o] as const))(
    '%s',
    (slug, opo) => {
      test.each(Object.keys(SCHEMAS_WITH_OPOSICION_ENUM))(
        'aceptada por el enum de %s',
        (schemaName) => {
          const schema = SCHEMAS_WITH_OPOSICION_ENUM[
            schemaName as keyof typeof SCHEMAS_WITH_OPOSICION_ENUM
          ]
          expect(enumValues(schema)).toContain(slug)
        },
      )

      test('está en oposicionToExamPosition (slug → exam_position)', () => {
        expect(Object.keys(oposicionToExamPosition)).toContain(slug)
      })

      test('su positionType está registrado en EXAM_POSITION_MAP', () => {
        expect(isExamPositionRegistered(opo.positionType)).toBe(true)
      })
    },
  )
})
