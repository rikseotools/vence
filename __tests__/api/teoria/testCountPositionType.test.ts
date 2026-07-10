// __tests__/api/teoria/testCountPositionType.test.ts
// Normalización de positionType del endpoint /test-count: junk arbitrario del
// cliente NO debe llegar a buildOfficialExamFilter (log-spam) ni inflar la caché.
import { normalizePositionType } from '@/app/api/teoria/[law]/[articleNumber]/test-count/route'

describe('normalizePositionType', () => {
  it('oposición registrada → se respeta', () => {
    expect(normalizePositionType('policia_nacional')).toBe('policia_nacional')
    expect(normalizePositionType('auxiliar_administrativo_valencia')).toBe('auxiliar_administrativo_valencia')
  })

  it('junk / desconocido → default estado (evita warn por request)', () => {
    expect(normalizePositionType('DROP TABLE')).toBe('auxiliar_administrativo_estado')
    expect(normalizePositionType('random_'.repeat(20))).toBe('auxiliar_administrativo_estado')
    expect(normalizePositionType('')).toBe('auxiliar_administrativo_estado')
  })

  it('null / undefined → default estado', () => {
    expect(normalizePositionType(null)).toBe('auxiliar_administrativo_estado')
    expect(normalizePositionType(undefined)).toBe('auxiliar_administrativo_estado')
  })
})
