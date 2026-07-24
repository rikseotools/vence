// __tests__/components/LawTestCTA.test.tsx
//
// Superficie de RENDER del CTA compartido "Hacer test de {ley}" del temario (fix T-073).
// Renderiza el componente REAL, mockeando solo el contexto de slugs y el emisor de
// observabilidad. Verifica: el href ACOTA al scope del tema (nunca la ley entera) y el
// clic emite el evento con scopedArticleCount (señal para vigilar la regresión en prod).
import { render, screen, fireEvent } from '@testing-library/react'
import LawTestCTA from '@/components/temario/LawTestCTA'

const mockEmitClientEvent = jest.fn()
jest.mock('@/lib/observability/client', () => ({
  emitClientEvent: (...args: unknown[]) => mockEmitClientEvent(...args),
}))
jest.mock('@/contexts/LawSlugContext', () => ({
  useLawSlugs: () => ({ getSlug: (shortName: string) => (shortName === 'CE' ? 'ce' : shortName.toLowerCase()) }),
}))

describe('LawTestCTA (cliente, fix T-073)', () => {
  afterEach(() => jest.clearAllMocks())

  it('el href acota el test a los artículos del tema (no la ley entera)', () => {
    render(<LawTestCTA lawShortName="CE" articles={[{ articleNumber: 1 }, { articleNumber: 2 }, { articleNumber: 9 }]} />)
    const link = screen.getByRole('link', { name: /hacer test de ce/i })
    expect(link).toHaveAttribute('href', '/leyes/ce?selected_articles=1,2,9&source=temario')
    // NO enlaza a la ley pelada (el bug)
    expect(link).not.toHaveAttribute('href', '/leyes/ce')
  })

  it('el clic emite law_test_cta_click con el scope (scopedArticleCount>0)', () => {
    render(<LawTestCTA lawShortName="CE" articles={[{ articleNumber: 1 }, { articleNumber: 2 }]} />)
    fireEvent.click(screen.getByRole('link', { name: /hacer test de ce/i }))
    expect(mockEmitClientEvent).toHaveBeenCalledTimes(1)
    expect(mockEmitClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'law_test_cta_click',
        severity: 'info',
        metadata: expect.objectContaining({ source: 'temario', lawSlug: 'ce', scopedArticleCount: 2 }),
      }),
    )
  })

  it('scopedArticleCount deduplica y no cuenta vacíos', () => {
    render(<LawTestCTA lawShortName="CE" articles={[{ articleNumber: 1 }, { articleNumber: 1 }, { articleNumber: '' }, { articleNumber: 2 }]} />)
    fireEvent.click(screen.getByRole('link', { name: /hacer test de ce/i }))
    expect(mockEmitClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ scopedArticleCount: 2 }) }),
    )
  })
})
