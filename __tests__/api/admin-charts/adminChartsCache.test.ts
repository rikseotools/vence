// __tests__/api/admin-charts/adminChartsCache.test.ts
//
// Blindaje del fix de /api/v2/admin/charts:
//   - unstable_cache envuelve ambas queries para evitar cold path repetido
//   - QUERY_TIMEOUT_MS bajado de 15000 a 5000 (fail-fast)
//   - Existe el covering index idx_tests_started_at_covering en la migración
//   - Migración SQL presente en database/migrations/
//
// Tests estáticos que leen el código fuente — sin mocks de Postgres ni de
// Next.js. Si alguien revierte cualquiera de los tres cambios, estos tests
// avisan.

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../..')

describe('admin-charts — cache + timeout + covering index', () => {
  describe('route.ts', () => {
    const routePath = path.join(ROOT, 'app/api/v2/admin/charts/route.ts')
    const routeContent = fs.readFileSync(routePath, 'utf-8')

    it('importa unstable_cache de next/cache', () => {
      expect(routeContent).toMatch(/import\s*\{[^}]*unstable_cache[^}]*\}\s*from\s*['"]next\/cache['"]/)
    })

    it('envuelve getActivityChartData con unstable_cache', () => {
      // Algún identificador que referencie getActivityChartData dentro de un
      // unstable_cache(...) call
      const match = routeContent.match(/unstable_cache\s*\(\s*async[\s\S]{0,200}getActivityChartData/)
      expect(match).not.toBeNull()
    })

    it('envuelve getRegistrationsChartData con unstable_cache', () => {
      const match = routeContent.match(/unstable_cache\s*\(\s*async[\s\S]{0,200}getRegistrationsChartData/)
      expect(match).not.toBeNull()
    })

    it('configura TTL de cache en 300 segundos (5 min)', () => {
      expect(routeContent).toMatch(/revalidate:\s*(?:CACHE_TTL_SECONDS|300)/)
      expect(routeContent).toMatch(/CACHE_TTL_SECONDS\s*=\s*300/)
    })

    it('usa tag "admin-charts" para poder invalidar manualmente', () => {
      expect(routeContent).toMatch(/tags:\s*\['admin-charts'\]/)
    })

    it('timeout bajado a 5000ms (antes 15000ms)', () => {
      expect(routeContent).toMatch(/QUERY_TIMEOUT_MS\s*=\s*5000/)
      expect(routeContent).not.toMatch(/=\s*15000/)
    })

    it('usa Promise.all con ambas queries cacheadas', () => {
      expect(routeContent).toMatch(/Promise\.all\(\s*\[[\s\S]*getCachedActivity[\s\S]*getCachedRegistrations[\s\S]*\]/)
    })

    it('envuelve cada query cacheada con withTimeout', () => {
      expect(routeContent).toMatch(/withTimeout\(\s*getCachedActivity/)
      expect(routeContent).toMatch(/withTimeout\(\s*getCachedRegistrations/)
    })
  })

  describe('migración SQL', () => {
    const migrationPath = path.join(
      ROOT,
      'database/migrations/add_covering_index_tests_started_at.sql',
    )

    it('la migración existe', () => {
      expect(fs.existsSync(migrationPath)).toBe(true)
    })

    it('crea un índice covering con INCLUDE (user_id)', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8')
      expect(content).toMatch(/CREATE INDEX CONCURRENTLY.*idx_tests_started_at_covering/i)
      expect(content).toMatch(/INCLUDE\s*\(\s*user_id\s*\)/i)
      expect(content).toMatch(/WHERE\s+user_id\s+IS\s+NOT\s+NULL/i)
    })

    it('dropea el índice viejo idx_tests_started_at (no parcial) CONCURRENTLY', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8')
      expect(content).toMatch(/DROP INDEX CONCURRENTLY.*idx_tests_started_at\b/i)
    })

    it('usa el patrón CONCURRENTLY para no bloquear tráfico', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8')
      // Ambas operaciones deben ser CONCURRENTLY
      const createMatches = content.match(/CREATE INDEX CONCURRENTLY/gi) || []
      const dropMatches = content.match(/DROP INDEX CONCURRENTLY/gi) || []
      expect(createMatches.length).toBeGreaterThanOrEqual(1)
      expect(dropMatches.length).toBeGreaterThanOrEqual(1)
    })

    it('incluye verificación post-migración con RAISE', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8')
      expect(content).toMatch(/RAISE\s+(EXCEPTION|NOTICE|WARNING)/i)
    })
  })
})
