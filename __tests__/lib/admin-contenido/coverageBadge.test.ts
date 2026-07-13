// Guardarraíl del badge de cobertura de artículos en /admin/contenido.
import { coverageBadge, COVERAGE_TONE_CLS } from '@/lib/api/admin-contenido/coverageBadge'

describe('coverageBadge — artículos en scope con 0 preguntas', () => {
  it('0 artículos sin preguntas → ok (✓ verde)', () => {
    const b = coverageBadge({ arts_sin_preguntas: 0, temas_sin_cobertura: 0 })
    expect(b.tone).toBe('ok')
    expect(b.label).toBe('✓')
  })

  it('N artículos sin preguntas → warn (⚠ ámbar) con el número', () => {
    const b = coverageBadge({ arts_sin_preguntas: 6, temas_sin_cobertura: 1 })
    expect(b.tone).toBe('warn')
    expect(b.label).toBe('6 ⚠')
    expect(b.title).toContain('6 artículo(s)')
    expect(b.title).toContain('1 tema(s)')
  })

  it('caso real M/SMS Tema 7 (6 arts, 1 tema)', () => {
    const b = coverageBadge({ arts_sin_preguntas: 6, temas_sin_cobertura: 1 })
    expect(b.tone).toBe('warn')
  })

  it('cada tono tiene clases Tailwind', () => {
    ;(['ok', 'warn'] as const).forEach((t) => expect(COVERAGE_TONE_CLS[t]).toBeTruthy())
  })
})
