/**
 * @jest-environment node
 *
 * Unit (puro, sin BD) del contrato de la cola de PDFs.
 */
import { shouldRetry, DEFAULT_MAX_ATTEMPTS, DEFAULT_STALE_SECONDS } from '@/lib/temario/pdf/pdfJobQueue'

describe('shouldRetry — decisión pura reintento vs DLQ', () => {
  it('reintenta mientras queden intentos', () => {
    expect(shouldRetry(1, 3)).toBe(true)
    expect(shouldRetry(2, 3)).toBe(true)
  })
  it('se rinde (DLQ) al agotar los intentos', () => {
    expect(shouldRetry(3, 3)).toBe(false)
    expect(shouldRetry(4, 3)).toBe(false)
  })
  it('usa el tope por defecto si no se pasa', () => {
    expect(shouldRetry(DEFAULT_MAX_ATTEMPTS - 1)).toBe(true)
    expect(shouldRetry(DEFAULT_MAX_ATTEMPTS)).toBe(false)
  })
  it('constantes con valores sensatos', () => {
    expect(DEFAULT_MAX_ATTEMPTS).toBeGreaterThanOrEqual(2)
    expect(DEFAULT_STALE_SECONDS).toBeGreaterThanOrEqual(60)
  })
})
