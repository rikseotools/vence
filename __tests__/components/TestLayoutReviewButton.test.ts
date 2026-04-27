/**
 * Tests para el botón "Revisar fallos" en TestLayout.
 *
 * Bug (27/04/2026): El botón aparecía sin comprobar saveStatus,
 * así que si completeTestOnServer fallaba (red, timeout, sesión expirada),
 * el usuario clicaba "Revisar fallos" → API devolvía 400 "test no completado".
 *
 * Fix: Añadir saveStatus === 'saved' a la condición del botón.
 *
 * El schema Zod de CompleteTestResponse define status: 'saved' | 'error'.
 * completeTestOnServer() lanza excepción en timeout/red → catch setSaveStatus('error').
 */

import fs from 'fs'
import path from 'path'

const TESTLAYOUT_PATH = path.join(__dirname, '../../components/TestLayout.tsx')
const SCHEMA_PATH = path.join(__dirname, '../../lib/api/v2/complete-test/schemas.ts')
const CLIENT_PATH = path.join(__dirname, '../../lib/api/v2/complete-test/client.ts')

describe('TestLayout — Botón "Revisar fallos"', () => {

  // ============================================
  // 1. CONDICIÓN DEL BOTÓN EN EL CÓDIGO FUENTE
  // ============================================
  describe('Condición de visibilidad en el código', () => {
    const src = fs.readFileSync(TESTLAYOUT_PATH, 'utf-8')

    it('requiere saveStatus === "saved" para mostrar el botón', () => {
      // El botón debe tener las 3 condiciones: session + fallos + saved
      expect(src).toMatch(/currentTestSession\s*&&\s*score\s*<\s*effectiveQuestions\.length\s*&&\s*saveStatus\s*===\s*['"]saved['"]/)
    })

    it('el botón apunta a /revisar/${testId}', () => {
      expect(src).toContain('href={`/revisar/${currentTestSession.id}`}')
    })

    it('el botón tiene texto "Revisar fallos"', () => {
      expect(src).toContain('Revisar fallos')
    })
  })

  // ============================================
  // 2. SIMULACIÓN DE LA LÓGICA DE VISIBILIDAD
  // ============================================
  describe('Lógica de visibilidad del botón', () => {

    type SaveStatus = 'saving' | 'saved' | 'error' | null

    function shouldShowReviewButton(
      currentTestSession: { id: string } | null,
      score: number,
      totalQuestions: number,
      saveStatus: SaveStatus
    ): boolean {
      return !!(currentTestSession && score < totalQuestions && saveStatus === 'saved')
    }

    it('MUESTRA: test guardado + tiene fallos', () => {
      expect(shouldShowReviewButton({ id: 'test-123' }, 7, 10, 'saved')).toBe(true)
    })

    it('MUESTRA: test guardado + 0 aciertos (peor caso)', () => {
      expect(shouldShowReviewButton({ id: 'test-123' }, 0, 20, 'saved')).toBe(true)
    })

    it('NO MUESTRA: test perfecto (0 fallos)', () => {
      expect(shouldShowReviewButton({ id: 'test-123' }, 10, 10, 'saved')).toBe(false)
    })

    it('NO MUESTRA: saveStatus es null (antes de guardar)', () => {
      expect(shouldShowReviewButton({ id: 'test-123' }, 7, 10, null)).toBe(false)
    })

    it('NO MUESTRA: saveStatus es "saving" (guardando)', () => {
      expect(shouldShowReviewButton({ id: 'test-123' }, 7, 10, 'saving')).toBe(false)
    })

    it('NO MUESTRA: saveStatus es "error" (guardado falló)', () => {
      expect(shouldShowReviewButton({ id: 'test-123' }, 7, 10, 'error')).toBe(false)
    })

    it('NO MUESTRA: no hay sesión de test', () => {
      expect(shouldShowReviewButton(null, 7, 10, 'saved')).toBe(false)
    })
  })

  // ============================================
  // 3. SCHEMA: CompleteTestResponse.status
  // ============================================
  describe('Schema CompleteTestResponse', () => {
    const schemaSource = fs.readFileSync(SCHEMA_PATH, 'utf-8')

    it('status solo permite "saved" o "error"', () => {
      expect(schemaSource).toMatch(/status:\s*z\.enum\(\[['"]saved['"],\s*['"]error['"]\]\)/)
    })
  })

  // ============================================
  // 4. CLIENT: manejo de errores → saveStatus
  // ============================================
  describe('completeTestOnServer — manejo de errores', () => {
    const clientSource = fs.readFileSync(CLIENT_PATH, 'utf-8')

    it('lanza error en SESSION_EXPIRED (no retorna status)', () => {
      expect(clientSource).toContain("throw new Error('SESSION_EXPIRED')")
    })

    it('lanza error en HTTP no-ok', () => {
      expect(clientSource).toContain('throw new Error(`HTTP ${response.status}`)')
    })

    it('lanza error en timeout (AbortError)', () => {
      expect(clientSource).toContain("throw new Error('Timeout after 15000ms')")
    })

    it('fallback en parse error devuelve status "error"', () => {
      // Línea: return { success: !!data?.success, status: data?.status || 'error' }
      expect(clientSource).toContain("status: data?.status || 'error'")
    })
  })

  // ============================================
  // 5. TESTLAYOUT: catch → setSaveStatus('error')
  // ============================================
  describe('TestLayout — catch de completeTestOnServer', () => {
    const src = fs.readFileSync(TESTLAYOUT_PATH, 'utf-8')

    it('catch establece saveStatus = "error"', () => {
      expect(src).toContain("setSaveStatus('error')")
    })

    it('success establece saveStatus = result.status', () => {
      expect(src).toContain('setSaveStatus(result.status')
    })
  })

  // ============================================
  // 6. ESCENARIOS END-TO-END SIMULADOS
  // ============================================
  describe('Escenarios end-to-end', () => {

    type SaveStatus = 'saving' | 'saved' | 'error' | null

    // Simula el flujo completo desde completeTestOnServer hasta la UI
    async function simulateTestCompletion(scenario: {
      serverReturns?: { success: boolean; status: 'saved' | 'error' }
      throwsError?: string
    }): Promise<{ saveStatus: SaveStatus; reviewButtonVisible: boolean }> {
      let saveStatus: SaveStatus = null

      try {
        if (scenario.throwsError) {
          throw new Error(scenario.throwsError)
        }
        const result = scenario.serverReturns!
        saveStatus = result.status
      } catch {
        saveStatus = 'error'
      }

      const currentTestSession = { id: 'test-abc' }
      const score = 7
      const totalQuestions = 10
      const reviewButtonVisible = !!(currentTestSession && score < totalQuestions && saveStatus === 'saved')

      return { saveStatus, reviewButtonVisible }
    }

    it('servidor devuelve success → botón visible', async () => {
      const result = await simulateTestCompletion({
        serverReturns: { success: true, status: 'saved' },
      })
      expect(result.saveStatus).toBe('saved')
      expect(result.reviewButtonVisible).toBe(true)
    })

    it('servidor devuelve error → botón oculto', async () => {
      const result = await simulateTestCompletion({
        serverReturns: { success: false, status: 'error' },
      })
      expect(result.saveStatus).toBe('error')
      expect(result.reviewButtonVisible).toBe(false)
    })

    it('timeout de red → botón oculto', async () => {
      const result = await simulateTestCompletion({
        throwsError: 'Timeout after 15000ms',
      })
      expect(result.saveStatus).toBe('error')
      expect(result.reviewButtonVisible).toBe(false)
    })

    it('sesión expirada → botón oculto', async () => {
      const result = await simulateTestCompletion({
        throwsError: 'SESSION_EXPIRED',
      })
      expect(result.saveStatus).toBe('error')
      expect(result.reviewButtonVisible).toBe(false)
    })

    it('error de red genérico → botón oculto', async () => {
      const result = await simulateTestCompletion({
        throwsError: 'Failed to fetch',
      })
      expect(result.saveStatus).toBe('error')
      expect(result.reviewButtonVisible).toBe(false)
    })

    it('pool de BD saturado (HTTP 500) → botón oculto', async () => {
      const result = await simulateTestCompletion({
        throwsError: 'HTTP 500',
      })
      expect(result.saveStatus).toBe('error')
      expect(result.reviewButtonVisible).toBe(false)
    })
  })
})
