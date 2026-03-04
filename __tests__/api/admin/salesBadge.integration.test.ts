/**
 * @jest-environment node
 */
// __tests__/api/admin/salesBadge.integration.test.ts
// Tests de integración que ejecutan queries reales contra la BD.
// Detectan errores SQL (aliases rotos, columnas inexistentes, etc.)
// que TypeScript no puede detectar en compile-time.
//
// Requiere BD real. Ejecutar con:
//   npx jest salesBadge.integration --no-coverage

// Cargar .env.local para tener DATABASE_URL
import { config } from 'dotenv'
config({ path: '.env.local' })

// Importar DESPUÉS de cargar env
import { getUnreadSalesCount, markSalesAsRead } from '@/lib/api/admin/salesBadge'

describe('salesBadge queries (integración)', () => {
  it('getUnreadSalesCount ejecuta sin error SQL y devuelve número', async () => {
    const count = await getUnreadSalesCount()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('markSalesAsRead ejecuta sin error SQL', async () => {
    await expect(markSalesAsRead()).resolves.not.toThrow()
  })

  it('markSalesAsRead resetea el conteo a 0', async () => {
    await markSalesAsRead()
    const count = await getUnreadSalesCount()
    expect(count).toBe(0)
  })
})
