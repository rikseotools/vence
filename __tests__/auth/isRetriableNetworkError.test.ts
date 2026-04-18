/**
 * Tests para isRetriableNetworkError — función centralizada que decide
 * qué errores de red son retriables en loadUserProfile.
 *
 * Bug de Lidia (18/04/2026): iOS Safari lanza "TypeError: Load failed"
 * al hacer fetch cross-origin a supabase.co. El retry no lo atrapaba
 * porque solo buscaba 'network' o 'fetch' en el mensaje.
 *
 * Fix: regex /network|fetch|Load failed/i + AbortError + NETWORK_ERROR.
 */

function isRetriableNetworkError(error: { name?: string; message?: string; code?: string }): boolean {
  if (error.name === 'AbortError') return true
  if (error.code === 'NETWORK_ERROR') return true
  const msg = error.message || ''
  return /network|fetch|Load failed/i.test(msg)
}

describe('isRetriableNetworkError', () => {

  // ============================================
  // iOS Safari: "Load failed"
  // ============================================
  describe('iOS Safari errors', () => {
    it('"TypeError: Load failed" → retriable', () => {
      expect(isRetriableNetworkError({ message: 'Load failed' })).toBe(true)
    })

    it('Supabase wrapped: "TypeError: Load failed (yqbpstxowvgipqspqrgo.supabase.co)" → retriable', () => {
      expect(isRetriableNetworkError({
        message: 'TypeError: Load failed (yqbpstxowvgipqspqrgo.supabase.co)'
      })).toBe(true)
    })

    it('"Load failed" con contexto adicional → retriable', () => {
      expect(isRetriableNetworkError({
        message: '[AuthContext.loadUserProfile client] db error: TypeError: Load failed (yqbpstxowvgipqspqrgo.supabase.co)'
      })).toBe(true)
    })

    it('"load failed" en minúsculas → retriable (case-insensitive)', () => {
      expect(isRetriableNetworkError({ message: 'load failed' })).toBe(true)
    })
  })

  // ============================================
  // Errores de red genéricos (ya cubiertos antes)
  // ============================================
  describe('Network errors genéricos', () => {
    it('"network error" → retriable', () => {
      expect(isRetriableNetworkError({ message: 'network error' })).toBe(true)
    })

    it('"Network request failed" → retriable', () => {
      expect(isRetriableNetworkError({ message: 'Network request failed' })).toBe(true)
    })

    it('"fetch failed" → retriable', () => {
      expect(isRetriableNetworkError({ message: 'fetch failed' })).toBe(true)
    })

    it('"Failed to fetch" → retriable', () => {
      expect(isRetriableNetworkError({ message: 'Failed to fetch' })).toBe(true)
    })

    it('NETWORK_ERROR code → retriable', () => {
      expect(isRetriableNetworkError({ code: 'NETWORK_ERROR' })).toBe(true)
    })
  })

  // ============================================
  // AbortError
  // ============================================
  describe('AbortError', () => {
    it('AbortError by name → retriable', () => {
      expect(isRetriableNetworkError({ name: 'AbortError' })).toBe(true)
    })

    it('AbortError con mensaje → retriable', () => {
      expect(isRetriableNetworkError({ name: 'AbortError', message: 'signal is aborted' })).toBe(true)
    })
  })

  // ============================================
  // NO retriable
  // ============================================
  describe('Errores NO retriable', () => {
    it('PGRST116 (no rows) → NO retriable', () => {
      expect(isRetriableNetworkError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })).toBe(false)
    })

    it('RLS error → NO retriable', () => {
      expect(isRetriableNetworkError({ message: 'new row violates row-level security policy' })).toBe(false)
    })

    it('Syntax error → NO retriable', () => {
      expect(isRetriableNetworkError({ message: 'SyntaxError: Unexpected token' })).toBe(false)
    })

    it('Auth error → NO retriable', () => {
      expect(isRetriableNetworkError({ message: 'JWT expired' })).toBe(false)
    })

    it('Error vacío → NO retriable', () => {
      expect(isRetriableNetworkError({})).toBe(false)
    })

    it('TypeError genérico sin "Load failed" → NO retriable', () => {
      expect(isRetriableNetworkError({ name: 'TypeError', message: 'Cannot read properties of undefined' })).toBe(false)
    })
  })

  // ============================================
  // Regresión: escenarios reales de los logs
  // ============================================
  describe('Regresión: mensajes reales de validation_error_logs', () => {
    const realErrors = [
      { msg: '[AuthContext.loadUserProfile client] db error: TypeError: Load failed (yqbpstxowvgipqspqrgo.supabase.co)', expected: true },
      { msg: '[answerSaveQueue syncOne network client] Load failed', expected: true },
      { msg: '[testSession client] Supabase INSERT error : TypeError: Load failed (yqbpstxowvgipqspqrgo.supabase.co)', expected: true },
      { msg: '[ExamLayout client] Load failed', expected: true },
      { msg: '[TestLayout client] Load failed', expected: true },
      { msg: '[TestLayout client] Network error fetching /api/answer: Load failed', expected: true },
      { msg: 'AbortError: Promise was rejected because the browsing context is going away', expected: false },
    ]

    realErrors.forEach(({ msg, expected }) => {
      it(`"${msg.slice(0, 60)}..." → ${expected ? 'retriable' : 'NO retriable'}`, () => {
        expect(isRetriableNetworkError({ message: msg })).toBe(expected)
      })
    })

    it('AbortError by name (browsing context) → retriable por name, no por message', () => {
      expect(isRetriableNetworkError({
        name: 'AbortError',
        message: 'Promise was rejected because the browsing context is going away'
      })).toBe(true)
    })
  })
})
