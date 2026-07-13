import { buildRepasoFallosUrl } from '@/lib/nav/repasoFallosUrl'

describe('buildRepasoFallosUrl — URL del repaso scopeada a la oposición', () => {
  it('incluye positionType (scope estricto por oposición) + defaults', () => {
    const u = buildRepasoFallosUrl('auxiliar_administrativo_valencia')
    expect(u).toContain('/test/repaso-fallos-v2?')
    expect(u).toContain('positionType=auxiliar_administrativo_valencia')
    expect(u).toContain('n=20')
    expect(u).toContain('order=recent')
    expect(u).toContain('days=365')
  })

  it('sin positionType NO lo mete (repaso-v2 se aísla por leyes del usuario)', () => {
    const u = buildRepasoFallosUrl(null)
    expect(u).not.toContain('positionType')
    expect(u).toContain('n=20')
  })

  it('respeta overrides', () => {
    const u = buildRepasoFallosUrl('tramitacion_procesal', { n: 30, order: 'most_failed', days: 30 })
    expect(u).toContain('n=30')
    expect(u).toContain('order=most_failed')
    expect(u).toContain('days=30')
  })

  it('trim de positionType vacío', () => {
    expect(buildRepasoFallosUrl('   ')).not.toContain('positionType')
  })
})
