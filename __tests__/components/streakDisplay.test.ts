// __tests__/components/streakDisplay.test.ts
// Tests de que la racha se muestra desde user_streaks (global), no local

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ============================================
// 1. TemaTestPage — racha global
// ============================================
describe('TemaTestPage — racha global', () => {
  const src = fs.readFileSync(path.join(ROOT, 'components/test/TemaTestPage.tsx'), 'utf-8')

  it('usa globalStreak state', () => {
    expect(src).toMatch(/const \[globalStreak, setGlobalStreak\] = useState/)
  })

  it('carga racha desde /api/v2/user-stats', () => {
    expect(src).toMatch(/\/api\/v2\/user-stats/)
    expect(src).toMatch(/setGlobalStreak/)
  })

  it('muestra globalStreak en la UI (no cálculo local)', () => {
    expect(src).toMatch(/globalStreak/)
    // El valor se renderiza (ya sea directo o via IIFE)
    expect(src).toMatch(/return globalStreak/)
  })

  it('NO calcula racha localmente desde userAnswers', () => {
    // No debe haber cálculo de streak con diffDays
    expect(src).not.toMatch(/diffDays === streak/)
    expect(src).not.toMatch(/let streak = 0/)
  })

  it('carga racha en paralelo (no bloquea topic data)', () => {
    // fetch de user-stats debe estar antes o en paralelo con loadTopicData
    const fetchIdx = src.indexOf('/api/v2/user-stats')
    const loadIdx = src.indexOf('loadTopicData(temaNumber!, user.id)')
    expect(fetchIdx).toBeGreaterThan(-1)
    expect(loadIdx).toBeGreaterThan(-1)
    expect(fetchIdx).toBeLessThan(loadIdx)
  })
})

// ============================================
// 2. Auxiliar Estado page — racha global
// ============================================
describe('Auxiliar Estado tema page — racha global', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'app/auxiliar-administrativo-estado/test/tema/[numero]/page.tsx'),
    'utf-8',
  )

  it('usa globalStreak state', () => {
    expect(src).toMatch(/const \[globalStreak, setGlobalStreak\] = useState/)
  })

  it('carga racha desde /api/v2/user-stats', () => {
    expect(src).toMatch(/\/api\/v2\/user-stats/)
    expect(src).toMatch(/setGlobalStreak/)
  })

  it('muestra globalStreak en la UI', () => {
    expect(src).toMatch(/\{globalStreak\}/)
  })

  it('NO calcula racha localmente desde userAnswers', () => {
    expect(src).not.toMatch(/diffDays === streak/)
    expect(src).not.toMatch(/let streak = 0[\s\S]*?let currentDate = new Date\(\)[\s\S]*?for \(const date of dates\)/)
  })

  it('carga racha en paralelo con loadTopicData', () => {
    const fetchIdx = src.indexOf('/api/v2/user-stats')
    const loadIdx = src.indexOf('loadTopicData(temaNumber!, user.id)')
    expect(fetchIdx).toBeGreaterThan(-1)
    expect(loadIdx).toBeGreaterThan(-1)
    expect(fetchIdx).toBeLessThan(loadIdx)
  })
})

// ============================================
// 3. Ningún otro sitio calcula racha local de días
// ============================================
describe('No hay cálculo local de racha de días en otros componentes', () => {
  const glob = require('glob')

  // Buscar en todos los componentes y pages
  const files: string[] = [
    ...glob.sync('components/**/*.{tsx,js}', { cwd: ROOT }),
    ...glob.sync('app/**/test/**/*.{tsx,js}', { cwd: ROOT }),
  ]

  const badPattern = /let streak = 0[\s\S]{0,200}diffDays === streak/

  it('ningún archivo tiene cálculo local de racha de días', () => {
    const violations: string[] = []
    for (const file of files) {
      if (file.includes('node_modules') || file.includes('.test.')) continue
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      if (badPattern.test(content)) {
        violations.push(file)
      }
    }
    expect(violations).toEqual([])
  })
})

// ============================================
// 4. MainStats usa datos de API (no local)
// ============================================
describe('MainStats — usa currentStreak de API', () => {
  const src = fs.readFileSync(path.join(ROOT, 'components/Statistics/MainStats.js'), 'utf-8')

  it('muestra stats.currentStreak', () => {
    expect(src).toMatch(/stats\.currentStreak/)
  })

  it('NO calcula racha localmente', () => {
    expect(src).not.toMatch(/let streak = 0/)
    expect(src).not.toMatch(/diffDays === streak/)
  })
})

// ============================================
// 5. user_streaks API devuelve currentStreak
// ============================================
describe('/api/v2/user-stats devuelve currentStreak', () => {
  const queriesSrc = fs.readFileSync(path.join(ROOT, 'lib/api/stats/queries.ts'), 'utf-8')

  it('carga streakData en paralelo', () => {
    expect(queriesSrc).toMatch(/getStreakData\(db, userId\)/)
  })

  it('combina streak con mainStats', () => {
    expect(queriesSrc).toMatch(/currentStreak: streakData\?\.currentStreak/)
    expect(queriesSrc).toMatch(/longestStreak: streakData\?\.longestStreak/)
  })
})
