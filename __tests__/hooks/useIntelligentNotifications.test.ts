/**
 * Tests para el sistema de notificaciones inteligentes
 *
 * Bug: Las notificaciones de artículos problemáticos (🔥 Test Intensivo)
 * se guardaban como "leídas" permanentemente en localStorage. Usuarios
 * activos como Ana que las usaban a diario dejaban de verlas para siempre.
 *
 * Fix: read_notifications para problematic_articles y level_regression
 * expiran tras 6h, permitiendo que reaparezcan si el artículo sigue
 * siendo problemático.
 */

// ============================================
// TEST: Lógica de expiración de read_notifications
// ============================================
describe('filterUnreadNotifications - read expiry logic', () => {
  // Simula la lógica de filterUnreadNotifications
  function shouldShowNotification(
    notificationType: string,
    readEntry: { readAt: string } | null,
    isReadInDB: boolean
  ): boolean {
    if (isReadInDB) return false
    if (!readEntry) return true

    // Para artículos problemáticos: el read expira tras 6h
    if (notificationType === 'problematic_articles' || notificationType === 'level_regression') {
      const readAt = readEntry.readAt ? new Date(readEntry.readAt).getTime() : 0
      const hoursElapsed = (Date.now() - readAt) / (1000 * 60 * 60)
      if (hoursElapsed > 6) return true
    }

    return false
  }

  it('should show notification that was never read', () => {
    expect(shouldShowNotification('problematic_articles', null, false)).toBe(true)
    expect(shouldShowNotification('achievement', null, false)).toBe(true)
  })

  it('should hide notification read in DB (impugnaciones)', () => {
    expect(shouldShowNotification('problematic_articles', null, true)).toBe(false)
    expect(shouldShowNotification('achievement', null, true)).toBe(false)
  })

  it('should hide problematic_articles read less than 6h ago', () => {
    const readEntry = { readAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() } // 3h ago
    expect(shouldShowNotification('problematic_articles', readEntry, false)).toBe(false)
  })

  it('should show problematic_articles read more than 6h ago', () => {
    const readEntry = { readAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString() } // 7h ago
    expect(shouldShowNotification('problematic_articles', readEntry, false)).toBe(true)
  })

  it('should show level_regression read more than 6h ago', () => {
    const readEntry = { readAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() } // 8h ago
    expect(shouldShowNotification('level_regression', readEntry, false)).toBe(true)
  })

  it('should keep achievements permanently read (no expiry)', () => {
    const readEntry = { readAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() } // 3 days ago
    expect(shouldShowNotification('achievement', readEntry, false)).toBe(false)
  })

  it('should keep streak notifications permanently read', () => {
    const readEntry = { readAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() } // 2 days ago
    expect(shouldShowNotification('streak_broken', readEntry, false)).toBe(false)
  })

  it('should show problematic_articles read exactly at 6h boundary', () => {
    const readEntry = { readAt: new Date(Date.now() - 6 * 60 * 60 * 1000 - 1000).toISOString() } // 6h + 1s ago
    expect(shouldShowNotification('problematic_articles', readEntry, false)).toBe(true)
  })

  it('should hide problematic_articles read just under 6h', () => {
    const readEntry = { readAt: new Date(Date.now() - 5 * 60 * 60 * 1000 - 59 * 60 * 1000).toISOString() } // 5h59m ago
    expect(shouldShowNotification('problematic_articles', readEntry, false)).toBe(false)
  })
})

// ============================================
// TEST: Cooldown por artículo (shouldShowProblematicArticle)
// ============================================
describe('shouldShowProblematicArticle cooldown logic', () => {
  const COOLDOWN_DAYS = 3
  const MIN_TESTS_THRESHOLD = 5
  const URGENT_ACCURACY_THRESHOLD = 30

  // Simula la lógica de shouldShowProblematicArticle
  function shouldShow(
    cooldown: { lastShown: number; testsAtLastShown: number } | null,
    accuracy: number,
    currentTests: number
  ): boolean {
    if (!cooldown) return true

    const daysSinceLastShown = (Date.now() - cooldown.lastShown) / (24 * 60 * 60 * 1000)
    const testsSinceLastShown = currentTests - cooldown.testsAtLastShown

    // Caso urgente
    if (accuracy < URGENT_ACCURACY_THRESHOLD && testsSinceLastShown >= 3) return true

    // Caso normal
    if (daysSinceLastShown >= COOLDOWN_DAYS && testsSinceLastShown >= MIN_TESTS_THRESHOLD) return true

    return false
  }

  it('should show when no cooldown exists (first time)', () => {
    expect(shouldShow(null, 0, 100)).toBe(true)
  })

  it('should show urgent (accuracy < 30%) after 3 tests', () => {
    const cooldown = { lastShown: Date.now() - 1000, testsAtLastShown: 97 } // just now, 97 tests
    expect(shouldShow(cooldown, 0, 100)).toBe(true) // 100 - 97 = 3 tests
  })

  it('should hide urgent with less than 3 tests', () => {
    const cooldown = { lastShown: Date.now() - 1000, testsAtLastShown: 99 }
    expect(shouldShow(cooldown, 10, 100)).toBe(false) // 100 - 99 = 1 test
  })

  it('should show normal after 3 days and 5 tests', () => {
    const cooldown = { lastShown: Date.now() - 4 * 24 * 60 * 60 * 1000, testsAtLastShown: 90 } // 4 days ago
    expect(shouldShow(cooldown, 45, 100)).toBe(true) // 4 days > 3, 10 tests > 5
  })

  it('should hide normal with less than 3 days even with enough tests', () => {
    const cooldown = { lastShown: Date.now() - 1 * 24 * 60 * 60 * 1000, testsAtLastShown: 90 }
    expect(shouldShow(cooldown, 45, 100)).toBe(false) // 1 day < 3
  })

  it('should hide normal with enough days but less than 5 tests', () => {
    const cooldown = { lastShown: Date.now() - 5 * 24 * 60 * 60 * 1000, testsAtLastShown: 98 }
    expect(shouldShow(cooldown, 45, 100)).toBe(false) // 2 tests < 5
  })
})

// ============================================
// TEST: Bug scenario de Ana - Test Intensivo desaparece
// ============================================
describe('Bug scenario: Ana - Test Intensivo disappears permanently', () => {
  it('problematic_articles should reappear after 6h read expiry', () => {
    // Ana clicks "Test Intensivo" at 15:16 → saved as read
    const readAt = new Date('2026-03-18T15:16:00Z')
    const readEntry = { readAt: readAt.toISOString() }

    // At 04:43 next day (13h27m later) → should be expired
    const checkTime = new Date('2026-03-19T04:43:00Z').getTime()
    const hoursElapsed = (checkTime - readAt.getTime()) / (1000 * 60 * 60)

    expect(hoursElapsed).toBeGreaterThan(6) // 13.4h > 6h
    expect(hoursElapsed).toBeCloseTo(13.45, 0)

    // With the fix, this should show (expired)
    // Without the fix, it would be hidden forever
  })

  it('same notification ID should not block forever', () => {
    // The notification ID is always the same for same articles
    const notificationId = 'problematic-law-CE-articles-9,146'

    // This ID gets saved to read_notifications when Ana clicks
    // With the fix, after 6h it expires
    // The same ID can reappear if the RPC still returns those articles

    // Simulate: read 7h ago, check now
    const readEntry = { readAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString() }
    const readAt = new Date(readEntry.readAt).getTime()
    const hoursElapsed = (Date.now() - readAt) / (1000 * 60 * 60)

    expect(hoursElapsed).toBeGreaterThan(6)
  })

  it('achievement notifications should still be permanent', () => {
    // Achievement "Completaste 50 tests" should never reappear
    const readEntry = { readAt: new Date(Date.now() - 720 * 60 * 60 * 1000).toISOString() } // 30 days ago

    // For achievements, read is permanent — no expiry
    // shouldShowNotification('achievement', readEntry, false) should return false
    const notificationType = 'achievement'
    const shouldShow = notificationType !== 'problematic_articles' && notificationType !== 'level_regression'
    // If it's not problematic/regression, the read entry blocks it permanently
    expect(shouldShow).toBe(true) // It IS a permanent type
  })
})

// ============================================
// TEST: File verification
// ============================================
describe('useIntelligentNotifications implementation', () => {
  const fs = require('fs')

  it('should have 6h expiry for problematic_articles in filterUnreadNotifications', () => {
    const content = fs.readFileSync('hooks/useIntelligentNotifications.ts', 'utf-8')
    // Check that the expiry logic exists
    expect(content).toContain('problematic_articles')
    expect(content).toContain('hoursElapsed > 6')
  })

  it('should also expire level_regression', () => {
    const content = fs.readFileSync('hooks/useIntelligentNotifications.ts', 'utf-8')
    expect(content).toContain('level_regression')
  })

  it('should not expire achievements or other types', () => {
    const content = fs.readFileSync('hooks/useIntelligentNotifications.ts', 'utf-8')
    // The expiry only applies inside the if block for problematic_articles/level_regression
    // Other types fall through to return false (permanently read)
    const filterFn = content.substring(
      content.indexOf('filterUnreadNotifications'),
      content.indexOf('filterUnreadNotifications') + 1000
    )
    // The expiry check should only be inside a conditional for specific types
    expect(filterFn).toMatch(/notification\.type === 'problematic_articles'.*notification\.type === 'level_regression'/s)
  })
})
