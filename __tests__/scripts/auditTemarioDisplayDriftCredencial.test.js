/**
 * Guardarraíl de la selección de credencial en `audit-temario-display-drift.cjs` (T-571).
 *
 * El detector hace un SELECT de solo lectura sobre `topics` (temario), NO sobre las 4 tablas
 * de coordinación de la flota. Usar `DATABASE_URL` (rol `vence_coordinacion`, sin grants de
 * negocio) daba SIEMPRE "permission denied" para un trabajador — el pre-commit lo trataba
 * como "no se pudo comprobar" (no bloquea), pero la comprobación real nunca se hacía. Con
 * `VENCE_LECTOR_URL` (rol `vence_lector`, sí tiene grants sobre `topics`) disponible, el
 * detector tiene que preferirla.
 */
const { pickDbUrl } = require('../../scripts/audit-temario-display-drift.cjs')

describe('pickDbUrl — VENCE_LECTOR_URL manda sobre DATABASE_URL', () => {
  it('usa VENCE_LECTOR_URL cuando está disponible, aunque también haya DATABASE_URL', () => {
    const url = pickDbUrl({ VENCE_LECTOR_URL: 'postgres://vence_lector@x/app', DATABASE_URL: 'postgres://vence_coordinacion@x/app' })
    expect(url).toBe('postgres://vence_lector@x/app')
  })

  it('cae a DATABASE_URL si VENCE_LECTOR_URL no está (sesión humana sin rol lector aparte)', () => {
    const url = pickDbUrl({ DATABASE_URL: 'postgres://vence_coordinacion@x/app' })
    expect(url).toBe('postgres://vence_coordinacion@x/app')
  })

  it('devuelve null si no hay ninguna credencial', () => {
    expect(pickDbUrl({})).toBeNull()
  })
})
