/** @jest-environment node */
// __tests__/integration/essentialArticlesAvailability.test.ts
//
// Regresión del caso Pilar (2026-06-22). checkQuestionAvailability() alimenta el
// botón "Generar" del Test Aleatorio (RandomTestClient). ANTES ignoraba
// focusEssentialArticles → para Administrativo CARM (C1, sin examen oficial
// propio) devolvía el pool completo (>0) → botón habilitado → la generación
// aplicaba el filtro estricto → 0 preguntas → pantalla "no puede generarlo".
//
// Tras el fix, con focus_essential la availability devuelve 0 para una oposición
// sin oficiales propios (botón deshabilitado, sin pantalla de error), y sigue
// devolviendo el pool normal sin el filtro.
//
// CI-safe: se salta si no hay DATABASE_URL.

import dotenv from 'dotenv'
import { checkQuestionAvailability } from '@/lib/api/random-test/queries'
import type { CheckAvailabilityRequest } from '@/lib/api/random-test/schemas'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

// Administrativo CARM (C1): Bloque III "Economía" (T22-T28). Tiene preguntas pero
// 0 exámenes oficiales PROPIOS (los oficiales del bloque son de auxiliar CARM C2,
// Madrid, Valencia, Estado… con otro exam_position).
const ADMIN_CARM = 'administrativo-carm'
const ECON_THEMES = [22, 23, 24, 25, 26, 27, 28]

function req(extra: Partial<CheckAvailabilityRequest>): CheckAvailabilityRequest {
  return {
    oposicion: ADMIN_CARM,
    selectedThemes: ECON_THEMES,
    difficulty: 'mixed',
    onlyOfficialQuestions: false,
    includeSharedOfficials: false,
    focusEssentialArticles: false,
    userId: null,
    ...extra,
  } as CheckAvailabilityRequest
}

describeIfDb('checkQuestionAvailability honra focusEssentialArticles (caso Pilar)', () => {
  it('Administrativo CARM + focus_essential → 0 (no hay oficiales propios)', async () => {
    const res = await checkQuestionAvailability(req({ focusEssentialArticles: true }))
    expect(res.total).toBe(0)
  }, 30000)

  it('Administrativo CARM SIN focus_essential → > 0 (los temas sí tienen preguntas)', async () => {
    const res = await checkQuestionAvailability(req({ focusEssentialArticles: false }))
    expect(res.total).toBeGreaterThan(0)
  }, 30000)

  it('control positivo: una oposición CON oficiales propios sí devuelve > 0 con focus_essential', async () => {
    // Auxiliar Administrativo del Estado tiene cientos de oficiales propios.
    // Buscamos algún tema con pool imprescindible > 0 (escaneo robusto, sin
    // hardcodear estructura de temario).
    let found = 0
    for (const tema of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const res = await checkQuestionAvailability({
        oposicion: 'auxiliar-administrativo-estado',
        selectedThemes: [tema],
        difficulty: 'mixed',
        onlyOfficialQuestions: false,
        includeSharedOfficials: false,
        focusEssentialArticles: true,
        userId: null,
      } as CheckAvailabilityRequest)
      if (res.total > 0) { found = res.total; break }
    }
    expect(found).toBeGreaterThan(0)
  }, 60000)
})
