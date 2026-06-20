import { isBannerSnoozed, latestDismiss, BANNER_COOLDOWN_HOURS } from '@/lib/oposiciones/bannerSnooze'

describe('latestDismiss — el cierre más reciente (server vs local)', () => {
  it('ambos null → null', () => {
    expect(latestDismiss(null, null)).toBeNull()
  })
  it('solo uno → ese', () => {
    expect(latestDismiss('2026-06-20T10:00:00Z', null)).toBe('2026-06-20T10:00:00Z')
    expect(latestDismiss(null, '2026-06-20T10:00:00Z')).toBe('2026-06-20T10:00:00Z')
  })
  it('coge el más reciente', () => {
    const server = '2026-06-20T08:00:00Z'
    const local = '2026-06-20T12:00:00Z'
    expect(latestDismiss(server, local)).toBe(local)
    expect(latestDismiss(local, server)).toBe(local)
  })
})

describe('isBannerSnoozed — cooldown anti-martilleo', () => {
  const now = Date.parse('2026-06-20T12:00:00Z')

  it('sin cierre previo → NO silenciado', () => {
    expect(isBannerSnoozed(null, now)).toBe(false)
  })

  it('cierre hace 1h (dentro de 24h) → SILENCIADO', () => {
    expect(isBannerSnoozed('2026-06-20T11:00:00Z', now)).toBe(true)
  })

  it('cierre hace 25h (pasado el cooldown) → NO silenciado, vuelve a rotar', () => {
    expect(isBannerSnoozed('2026-06-19T11:00:00Z', now)).toBe(false)
  })

  it('justo en el límite de 24h → ya NO silenciado', () => {
    const exactly24hAgo = new Date(now - BANNER_COOLDOWN_HOURS * 3_600_000).toISOString()
    expect(isBannerSnoozed(exactly24hAgo, now)).toBe(false)
  })

  it('timestamp inválido → NO silencia (fail-open, mejor mostrar)', () => {
    expect(isBannerSnoozed('no-es-fecha', now)).toBe(false)
  })

  it('cooldown configurable', () => {
    // cierre hace 2h, cooldown de 1h → ya no silenciado
    expect(isBannerSnoozed('2026-06-20T10:00:00Z', now, 1)).toBe(false)
    // cierre hace 2h, cooldown de 3h → silenciado
    expect(isBannerSnoozed('2026-06-20T10:00:00Z', now, 3)).toBe(true)
  })
})
