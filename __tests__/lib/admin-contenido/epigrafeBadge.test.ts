// Guardarraíl del badge de epígrafe (S2) en /admin/contenido. El helper es PURO
// (sin BD) para poder testear la semántica de estados sin tocar prod.
import { epigrafeBadge, EPIGRAFE_TONE_CLS } from '@/lib/api/admin-contenido/epigrafeBadge'

const base = { epi_topics: 0, epi_literal: 0, epi_drift: 0, epi_provisional: 0, epi_stale: 0, epi_never: 0 }

describe('epigrafeBadge — semántica de estados', () => {
  it('none: sin temas → —', () => {
    const b = epigrafeBadge({ ...base })
    expect(b.tone).toBe('none')
    expect(b.label).toBe('—')
  })

  it('none: temas pero ninguno con fuente (todo never_sourced) → —', () => {
    const b = epigrafeBadge({ ...base, epi_topics: 24, epi_never: 24 })
    expect(b.tone).toBe('none')
    expect(b.label).toBe('—')
  })

  it('ok: todos literal → ✓ verde', () => {
    const b = epigrafeBadge({ ...base, epi_topics: 24, epi_literal: 24 })
    expect(b.tone).toBe('ok')
    expect(b.label).toBe('24/24 ✓')
  })

  it('warn: hay drift → ⚠ ámbar aunque el resto sea literal', () => {
    const b = epigrafeBadge({ ...base, epi_topics: 24, epi_literal: 21, epi_drift: 3 })
    expect(b.tone).toBe('warn')
    expect(b.label).toBe('21/24 ⚠')
    expect(b.title).toContain('3 drift')
  })

  it('warn: hay stale (cambió epígrafe/programa) → ⚠', () => {
    const b = epigrafeBadge({ ...base, epi_topics: 10, epi_literal: 8, epi_stale: 2 })
    expect(b.tone).toBe('warn')
    expect(b.title).toContain('2 stale')
  })

  it('partial: sin drift/stale pero faltan por verificar → azul', () => {
    const b = epigrafeBadge({ ...base, epi_topics: 24, epi_literal: 10, epi_never: 14 })
    expect(b.tone).toBe('partial')
    expect(b.label).toBe('10/24')
    expect(b.title).toContain('14 sin verificar')
  })

  it('provisional (editorial) NO penaliza: literal+provisional sin never/drift → ok', () => {
    // 21 literal + 3 editorial, 0 never/drift/stale = todo el temario resuelto
    const b = epigrafeBadge({ ...base, epi_topics: 24, epi_literal: 21, epi_provisional: 3 })
    expect(b.tone).toBe('ok')
    expect(b.title).toContain('3 editorial')
  })

  it('caso real GVA: 18 literal + 3 drift + 3 editorial → warn (por el drift)', () => {
    const b = epigrafeBadge({
      ...base, epi_topics: 24, epi_literal: 18, epi_drift: 3, epi_provisional: 3,
    })
    expect(b.tone).toBe('warn')
    expect(b.label).toBe('18/24 ⚠')
  })

  it('cada tono tiene clases Tailwind definidas', () => {
    ;(['ok', 'warn', 'partial', 'none'] as const).forEach((t) => {
      expect(EPIGRAFE_TONE_CLS[t]).toBeTruthy()
    })
  })
})
