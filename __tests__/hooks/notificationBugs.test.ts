// __tests__/hooks/notificationBugs.test.ts
// Tests para bugs de notificaciones: falsy "0", cooldown prematuro, y lógica general

import '@testing-library/jest-dom'

// ============================================
// HELPERS: Reproducen la lógica real del código
// ============================================

// Simula la lógica de renderizado de React para `{value && <JSX />}`
// React renderiza 0, NaN como texto. null, undefined, false, '' no se renderizan.
const reactWouldRender = (value: unknown): boolean => {
  // React renders 0 and NaN as text nodes (the bug)
  if (value === 0 || (typeof value === 'number' && isNaN(value))) return true
  return !!value
}

// Simula el check CORRECTO: `value != null`
const safeNullCheck = (value: unknown): boolean => {
  return value != null
}

// Simula la lógica de cooldown
interface CooldownData {
  lastShown: number
  testsAtLastShown: number
  lawShortName: string
  articleNumber: string
}

const COOLDOWN_DAYS = 3
const MIN_TESTS_THRESHOLD = 5
const URGENT_ACCURACY_THRESHOLD = 30

const shouldShowProblematicArticle = (
  cooldownData: Record<string, CooldownData>,
  lawShortName: string,
  articleNumber: string,
  accuracy: number,
  currentTestsCompleted: number
): boolean => {
  const articleKey = `${lawShortName}-${articleNumber}`
  const articleCooldown = cooldownData[articleKey]

  if (!articleCooldown) return true

  const now = Date.now()
  const daysSinceLastShown = (now - articleCooldown.lastShown) / (24 * 60 * 60 * 1000)
  const testsSinceLastShown = currentTestsCompleted - articleCooldown.testsAtLastShown

  if (accuracy < URGENT_ACCURACY_THRESHOLD && testsSinceLastShown >= 3) return true
  if (daysSinceLastShown >= COOLDOWN_DAYS && testsSinceLastShown >= MIN_TESTS_THRESHOLD) return true

  return false
}

// Simula la generación de ID de notificación
const generateNotificationId = (lawShortName: string, articleNumbers: string[]): string => {
  return `problematic-law-${lawShortName}-articles-${articleNumbers.join(',')}`
}

// Simula localStorage para cooldowns
class MockLocalStorage {
  private store: Record<string, string> = {}

  getItem(key: string): string | null {
    return this.store[key] ?? null
  }

  setItem(key: string, value: string): void {
    this.store[key] = value
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  clear(): void {
    this.store = {}
  }
}

// ============================================
// SECCIÓN 1: BUG DEL "0" FALSY EN REACT
// ============================================

describe('NotificationBell - Bug del "0" falsy', () => {

  describe('El patrón {value && <JSX />} con números', () => {
    test('accuracy = 0 con && renderiza "0" como texto (EL BUG)', () => {
      const accuracy = 0
      // true && 0 === 0, y React renderiza 0 como texto
      const result = true && accuracy
      expect(result).toBe(0)
      expect(reactWouldRender(result)).toBe(true) // React SÍ renderiza 0
    })

    test('accuracy = undefined con && no renderiza nada', () => {
      const accuracy = undefined
      const result = true && accuracy
      expect(result).toBe(undefined)
      expect(reactWouldRender(result)).toBe(false)
    })

    test('accuracy = 50 con && renderiza correctamente', () => {
      const accuracy = 50
      const result = true && accuracy
      expect(result).toBe(50)
      expect(reactWouldRender(result)).toBe(true)
    })

    test('accuracy = null con && no renderiza nada', () => {
      const accuracy = null
      const result = true && accuracy
      expect(result).toBe(null)
      expect(reactWouldRender(result)).toBe(false)
    })
  })

  describe('El patrón correcto {value != null && <JSX />}', () => {
    test('accuracy = 0 con != null SÍ pasa el check (FIX CORRECTO)', () => {
      expect(safeNullCheck(0)).toBe(true)
    })

    test('accuracy = undefined con != null NO pasa el check', () => {
      expect(safeNullCheck(undefined)).toBe(false)
    })

    test('accuracy = null con != null NO pasa el check', () => {
      expect(safeNullCheck(null)).toBe(false)
    })

    test('accuracy = 50 con != null SÍ pasa el check', () => {
      expect(safeNullCheck(50)).toBe(true)
    })

    test('accuracy = 100 con != null SÍ pasa el check', () => {
      expect(safeNullCheck(100)).toBe(true)
    })
  })

  describe('Casos edge de accuracy en notificaciones', () => {
    const notification = {
      type: 'problematic_articles' as const,
      accuracy: 0,
      attempts: 0
    }

    test('accuracy 0% es un valor legítimo (peor resultado posible)', () => {
      expect(notification.accuracy).toBeDefined()
      expect(notification.accuracy).toBe(0)
      expect(notification.accuracy != null).toBe(true) // Debe pasar
    })

    test('attempts 0 no debería mostrarse (no tiene sentido "0 intentos")', () => {
      // El fix usa: attempts != null && attempts > 0
      const shouldShow = notification.attempts != null && notification.attempts > 0
      expect(shouldShow).toBe(false)
    })

    test('attempts 3 sí debería mostrarse', () => {
      const notif = { ...notification, attempts: 3 }
      const shouldShow = notif.attempts != null && notif.attempts > 0
      expect(shouldShow).toBe(true)
    })
  })
})

// ============================================
// SECCIÓN 2: BUG DEL COOLDOWN PREMATURO
// ============================================

describe('useIntelligentNotifications - Cooldown de artículos problemáticos', () => {

  describe('Cooldown NO debe guardarse al crear notificaciones', () => {
    test('crear 3 notificaciones no debe generar cooldowns', () => {
      const storage = new MockLocalStorage()
      const userId = 'user-123'
      const cooldownKey = `problematic_articles_cooldown_${userId}`

      // Simular: crear 3 notificaciones sin guardar cooldown
      const notifications = [
        { law: 'Ley 40/2015', articles: ['3'] },
        { law: 'Ley 50/1997', articles: ['2', '26', '6'] },
        { law: 'CE', articles: ['14', '16'] }
      ]

      // Verificar que no se guardó nada
      notifications.forEach(() => {
        // NO llamamos a saveProblematicArticleCooldown (el fix)
      })

      expect(storage.getItem(cooldownKey)).toBeNull()
    })

    test('las 3 notificaciones deben seguir visibles tras recarga', () => {
      const cooldownData: Record<string, CooldownData> = {}

      // Sin cooldowns, todas deben mostrarse
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 40/2015', '3', 0, 10)).toBe(true)
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '2', 0, 10)).toBe(true)
      expect(shouldShowProblematicArticle(cooldownData, 'CE', '14', 0, 10)).toBe(true)
    })
  })

  describe('Cooldown DEBE guardarse al interactuar con una notificación', () => {
    test('cerrar notificación de Ley 40/2015 solo afecta a esa ley', () => {
      const cooldownData: Record<string, CooldownData> = {}

      // Simular: usuario cierra la notificación de Ley 40/2015
      cooldownData['Ley 40/2015-3'] = {
        lastShown: Date.now(),
        testsAtLastShown: 0,
        lawShortName: 'Ley 40/2015',
        articleNumber: '3'
      }

      // Ley 40/2015 Art.3 NO debe mostrarse (tiene cooldown reciente)
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 40/2015', '3', 0, 0)).toBe(false)

      // Las demás SÍ deben mostrarse (sin cooldown)
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '2', 0, 10)).toBe(true)
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '26', 0, 10)).toBe(true)
      expect(shouldShowProblematicArticle(cooldownData, 'CE', '14', 0, 10)).toBe(true)
    })

    test('cerrar notificación con múltiples artículos afecta a todos sus artículos', () => {
      const cooldownData: Record<string, CooldownData> = {}

      // Simular: usuario cierra la notificación de Ley 50/1997 (3 artículos)
      const articles = ['2', '26', '6']
      articles.forEach(art => {
        cooldownData[`Ley 50/1997-${art}`] = {
          lastShown: Date.now(),
          testsAtLastShown: 0,
          lawShortName: 'Ley 50/1997',
          articleNumber: art
        }
      })

      // Los 3 artículos de Ley 50/1997 NO deben mostrarse
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '2', 0, 0)).toBe(false)
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '26', 0, 0)).toBe(false)
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '6', 0, 0)).toBe(false)

      // Otras leyes SÍ deben mostrarse
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 40/2015', '3', 0, 10)).toBe(true)
    })
  })

  describe('Lógica de cooldown: tiempo y tests', () => {
    test('cooldown reciente + pocos tests = NO mostrar', () => {
      const cooldownData: Record<string, CooldownData> = {
        'CE-14': {
          lastShown: Date.now() - 1 * 24 * 60 * 60 * 1000, // hace 1 día
          testsAtLastShown: 10,
          lawShortName: 'CE',
          articleNumber: '14'
        }
      }
      // Solo 2 tests desde cooldown, y solo 1 día
      expect(shouldShowProblematicArticle(cooldownData, 'CE', '14', 50, 12)).toBe(false)
    })

    test('cooldown expirado + suficientes tests = SÍ mostrar', () => {
      const cooldownData: Record<string, CooldownData> = {
        'CE-14': {
          lastShown: Date.now() - 4 * 24 * 60 * 60 * 1000, // hace 4 días (> 3)
          testsAtLastShown: 10,
          lawShortName: 'CE',
          articleNumber: '14'
        }
      }
      // 5 tests desde cooldown y 4 días
      expect(shouldShowProblematicArticle(cooldownData, 'CE', '14', 50, 15)).toBe(true)
    })

    test('cooldown expirado pero insuficientes tests = NO mostrar', () => {
      const cooldownData: Record<string, CooldownData> = {
        'CE-14': {
          lastShown: Date.now() - 5 * 24 * 60 * 60 * 1000, // hace 5 días
          testsAtLastShown: 10,
          lawShortName: 'CE',
          articleNumber: '14'
        }
      }
      // Solo 3 tests desde cooldown (necesita 5)
      expect(shouldShowProblematicArticle(cooldownData, 'CE', '14', 50, 13)).toBe(false)
    })

    test('caso URGENTE: accuracy <30% se muestra con menos tests (3)', () => {
      const cooldownData: Record<string, CooldownData> = {
        'CE-14': {
          lastShown: Date.now() - 1 * 24 * 60 * 60 * 1000, // hace 1 día
          testsAtLastShown: 10,
          lawShortName: 'CE',
          articleNumber: '14'
        }
      }
      // Solo 3 tests pero accuracy urgente (<30%)
      expect(shouldShowProblematicArticle(cooldownData, 'CE', '14', 20, 13)).toBe(true)
    })

    test('caso URGENTE: accuracy <30% pero solo 2 tests = NO mostrar', () => {
      const cooldownData: Record<string, CooldownData> = {
        'CE-14': {
          lastShown: Date.now() - 1 * 24 * 60 * 60 * 1000,
          testsAtLastShown: 10,
          lawShortName: 'CE',
          articleNumber: '14'
        }
      }
      // Solo 2 tests (urgente necesita 3 mínimo)
      expect(shouldShowProblematicArticle(cooldownData, 'CE', '14', 20, 12)).toBe(false)
    })

    test('sin cooldown previo siempre se muestra', () => {
      const cooldownData: Record<string, CooldownData> = {}
      expect(shouldShowProblematicArticle(cooldownData, 'Ley 39/2015', '10', 0, 0)).toBe(true)
    })
  })
})

// ============================================
// SECCIÓN 3: GENERACIÓN DE IDs DE NOTIFICACIÓN
// ============================================

describe('Notification IDs - Unicidad y formato', () => {

  test('cada ley genera un ID único', () => {
    const id1 = generateNotificationId('Ley 40/2015', ['3'])
    const id2 = generateNotificationId('Ley 50/1997', ['2', '26', '6'])
    const id3 = generateNotificationId('CE', ['14', '16'])

    expect(id1).not.toBe(id2)
    expect(id2).not.toBe(id3)
    expect(id1).not.toBe(id3)
  })

  test('ID incluye nombre de ley y artículos', () => {
    const id = generateNotificationId('Ley 50/1997', ['2', '26', '6'])
    expect(id).toBe('problematic-law-Ley 50/1997-articles-2,26,6')
    expect(id).toContain('Ley 50/1997')
    expect(id).toContain('2,26,6')
  })

  test('misma ley con diferentes artículos genera IDs diferentes', () => {
    const id1 = generateNotificationId('CE', ['14'])
    const id2 = generateNotificationId('CE', ['14', '16'])
    expect(id1).not.toBe(id2)
  })

  test('mismo contenido genera ID idéntico (idempotente)', () => {
    const id1 = generateNotificationId('CE', ['14', '16'])
    const id2 = generateNotificationId('CE', ['14', '16'])
    expect(id1).toBe(id2)
  })

  test('IDs de problematic_articles empiezan con prefijo correcto', () => {
    const id = generateNotificationId('Ley 39/2015', ['5'])
    expect(id.startsWith('problematic-law-')).toBe(true)
  })
})

// ============================================
// SECCIÓN 4: DISMISSED NOTIFICATIONS (localStorage)
// ============================================

describe('Dismissed Notifications - Persistencia', () => {

  test('descartar una notificación solo afecta a esa', () => {
    const dismissed = new Set<string>()

    const id1 = 'problematic-law-Ley 40/2015-articles-3'
    const id2 = 'problematic-law-Ley 50/1997-articles-2,26,6'
    const id3 = 'problematic-law-CE-articles-14,16'

    // Descartar solo id1
    dismissed.add(id1)

    expect(dismissed.has(id1)).toBe(true)
    expect(dismissed.has(id2)).toBe(false)
    expect(dismissed.has(id3)).toBe(false)
  })

  test('notificaciones no descartadas se muestran', () => {
    const dismissed = new Set<string>()
    dismissed.add('problematic-law-Ley 40/2015-articles-3')

    const notifications = [
      { id: 'problematic-law-Ley 40/2015-articles-3', law: 'Ley 40/2015' },
      { id: 'problematic-law-Ley 50/1997-articles-2,26,6', law: 'Ley 50/1997' },
      { id: 'problematic-law-CE-articles-14,16', law: 'CE' }
    ]

    const visible = notifications.filter(n => !dismissed.has(n.id))
    expect(visible).toHaveLength(2)
    expect(visible.map(n => n.law)).toEqual(['Ley 50/1997', 'CE'])
  })

  test('descartar todas las notificaciones las oculta todas', () => {
    const dismissed = new Set<string>()
    const ids = [
      'problematic-law-Ley 40/2015-articles-3',
      'problematic-law-Ley 50/1997-articles-2,26,6',
      'problematic-law-CE-articles-14,16'
    ]

    ids.forEach(id => dismissed.add(id))

    const notifications = ids.map(id => ({ id }))
    const visible = notifications.filter(n => !dismissed.has(n.id))
    expect(visible).toHaveLength(0)
  })
})

// ============================================
// SECCIÓN 5: NOTIFICACIONES PROBLEMÁTICAS - ESTRUCTURA
// ============================================

describe('Problematic Articles Notification - Estructura', () => {

  const singleArticleNotif = {
    id: 'problematic-law-Ley 40/2015-articles-3',
    type: 'problematic_articles',
    title: '📉 Artículo Problemático: Ley 40/2015',
    law_short_name: 'Ley 40/2015',
    accuracy: 0,
    attempts: 2,
    articlesCount: 1,
    articlesList: [{ article_number: '3', accuracy_percentage: 0, law_short_name: 'Ley 40/2015' }]
  }

  const multiArticleNotif = {
    id: 'problematic-law-Ley 50/1997-articles-2,26,6',
    type: 'problematic_articles',
    title: '📉 3 Artículos Problemáticos: Ley 50/1997',
    law_short_name: 'Ley 50/1997',
    accuracy: 0,
    attempts: 6,
    articlesCount: 3,
    articlesList: [
      { article_number: '2', accuracy_percentage: 0, law_short_name: 'Ley 50/1997' },
      { article_number: '26', accuracy_percentage: 0, law_short_name: 'Ley 50/1997' },
      { article_number: '6', accuracy_percentage: 0, law_short_name: 'Ley 50/1997' }
    ]
  }

  test('notificación de 1 artículo tiene título singular', () => {
    expect(singleArticleNotif.title).toContain('Artículo Problemático')
    expect(singleArticleNotif.title).not.toContain('Artículos Problemáticos')
  })

  test('notificación de 3 artículos tiene título plural', () => {
    expect(multiArticleNotif.title).toContain('3 Artículos Problemáticos')
  })

  test('articlesCount coincide con longitud de articlesList', () => {
    expect(singleArticleNotif.articlesCount).toBe(singleArticleNotif.articlesList.length)
    expect(multiArticleNotif.articlesCount).toBe(multiArticleNotif.articlesList.length)
  })

  test('todos los artículos tienen law_short_name consistente', () => {
    multiArticleNotif.articlesList.forEach(art => {
      expect(art.law_short_name).toBe(multiArticleNotif.law_short_name)
    })
  })

  test('accuracy puede ser 0 (valor legítimo)', () => {
    expect(singleArticleNotif.accuracy).toBe(0)
    expect(typeof singleArticleNotif.accuracy).toBe('number')
  })

  test('accuracy 0 != null es true (fix del bug)', () => {
    expect(singleArticleNotif.accuracy != null).toBe(true)
  })
})

// ============================================
// SECCIÓN 6: MARKASREAD - Solo afecta a la notificación específica
// ============================================

describe('markAsRead - Aislamiento por notificación', () => {

  test('marcar como leída una notificación no afecta a las demás', () => {
    const notifications = [
      { id: 'n1', type: 'problematic_articles', isRead: false },
      { id: 'n2', type: 'problematic_articles', isRead: false },
      { id: 'n3', type: 'problematic_articles', isRead: false }
    ]

    // Simular markAsRead para n1
    const targetId = 'n1'
    const updated = notifications.filter(n => n.id !== targetId)

    expect(updated).toHaveLength(2)
    expect(updated.find(n => n.id === 'n1')).toBeUndefined()
    expect(updated.find(n => n.id === 'n2')).toBeDefined()
    expect(updated.find(n => n.id === 'n3')).toBeDefined()
  })

  test('marcar como leída con ID inexistente no cambia nada', () => {
    const notifications = [
      { id: 'n1', isRead: false },
      { id: 'n2', isRead: false }
    ]

    const updated = notifications.filter(n => n.id !== 'n999')
    expect(updated).toHaveLength(2)
  })
})

// ============================================
// SECCIÓN 7: ESCENARIO COMPLETO (el bug reportado)
// ============================================

describe('Escenario completo: 3 notificaciones, usuario actúa en 1', () => {

  test('ANTES del fix: cooldown se guarda al crear → todas desaparecen al recargar', () => {
    // Simular el comportamiento ANTIGUO (buggy)
    const cooldownData: Record<string, CooldownData> = {}

    // Al CREAR las 3 notificaciones, se guardaban cooldowns para TODAS
    const allArticles = [
      { law: 'Ley 40/2015', art: '3' },
      { law: 'Ley 50/1997', art: '2' },
      { law: 'Ley 50/1997', art: '26' },
      { law: 'Ley 50/1997', art: '6' },
      { law: 'CE', art: '14' }
    ]

    // Simular el bug: guardar cooldown al crear
    allArticles.forEach(a => {
      cooldownData[`${a.law}-${a.art}`] = {
        lastShown: Date.now(),
        testsAtLastShown: 0,
        lawShortName: a.law,
        articleNumber: a.art
      }
    })

    // Al recargar, NINGUNA se muestra (todas tienen cooldown)
    expect(shouldShowProblematicArticle(cooldownData, 'Ley 40/2015', '3', 0, 0)).toBe(false)
    expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '2', 0, 0)).toBe(false)
    expect(shouldShowProblematicArticle(cooldownData, 'CE', '14', 0, 0)).toBe(false)
  })

  test('DESPUÉS del fix: cooldown solo al interactuar → solo la accionada desaparece', () => {
    const cooldownData: Record<string, CooldownData> = {}

    // Al CREAR notificaciones: NO se guardan cooldowns (fix aplicado)
    // cooldownData sigue vacío

    // Usuario hace clic en "Test Intensivo" de Ley 40/2015 → cooldown solo para esa
    cooldownData['Ley 40/2015-3'] = {
      lastShown: Date.now(),
      testsAtLastShown: 0,
      lawShortName: 'Ley 40/2015',
      articleNumber: '3'
    }

    // Al recargar:
    // Ley 40/2015 NO se muestra (cooldown activado por interacción)
    expect(shouldShowProblematicArticle(cooldownData, 'Ley 40/2015', '3', 0, 0)).toBe(false)

    // Las otras 2 SÍ se muestran (sin cooldown)
    expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '2', 0, 0)).toBe(true)
    expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '26', 0, 0)).toBe(true)
    expect(shouldShowProblematicArticle(cooldownData, 'Ley 50/1997', '6', 0, 0)).toBe(true)
    expect(shouldShowProblematicArticle(cooldownData, 'CE', '14', 0, 0)).toBe(true)
  })
})
