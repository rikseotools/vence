// __tests__/lib/api/v2/tests/resolveTestPositionType.test.ts
//
// Blinda el INVARIANTE de persistencia que rompió el 05/07/2026 (commit b4ef6fc9):
// "un test hecho DENTRO de una oposición NUNCA se guarda con position_type NULL".
//
// resolveTestPositionType es el seam puro que usa createTestSession justo antes
// del INSERT. Testearlo aquí (sin BD) garantiza que el paso de atribución existe
// y funciona — la regresión fue precisamente que ese paso desapareció al migrar
// la creación al endpoint v2. Complementa el test de integración (INSERT real).

import { resolveTestPositionType } from '@/lib/api/v2/tests/queries'

describe('resolveTestPositionType — invariante de atribución por-oposición', () => {
  test('deriva el positionType del testUrl de oposición (el caso que rompió)', () => {
    expect(resolveTestPositionType({ testUrl: '/administrativo-gva/test/tema/106/test-personalizado' }))
      .toBe('administrativo_gva')
  })

  test('un test de oposición NUNCA resuelve a null (barrido del catálogo simulado)', () => {
    const urls = [
      '/auxiliar-administrativo-estado/test/tema/5',
      '/administrativo-seguridad-social/test/tema/105/test-personalizado',
      '/tramitacion-procesal/test/simulacro',
    ]
    for (const testUrl of urls) {
      expect(resolveTestPositionType({ testUrl })).not.toBeNull()
    }
  })

  test('el positionType explícito del cliente gana sobre la derivación', () => {
    expect(resolveTestPositionType({ positionType: 'administrativo_gva', testUrl: '/test/rapido' }))
      .toBe('administrativo_gva')
  })

  test('positionType explícito null NO fuerza null si hay testUrl derivable', () => {
    // nullable().optional() puede llegar como null explícito; `?? derive` debe cubrirlo.
    expect(resolveTestPositionType({ positionType: null, testUrl: '/administrativo-gva/test/tema/106' }))
      .toBe('administrativo_gva')
  })

  test('tests globales legítimos SÍ resuelven a null (no se inventa atribución)', () => {
    expect(resolveTestPositionType({ testUrl: '/test/rapido' })).toBeNull()
    expect(resolveTestPositionType({ testUrl: '/test/por-leyes' })).toBeNull()
    expect(resolveTestPositionType({ testUrl: null })).toBeNull()
    expect(resolveTestPositionType({})).toBeNull()
  })
})
