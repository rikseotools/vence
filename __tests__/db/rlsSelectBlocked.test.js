/**
 * @jest-environment node
 */
// T-574. `seleccionBloqueadaPorRls` es el núcleo que arregla el falso verde de
// `canary-rol-lector.cjs`: distinguir "tabla vacía de verdad" de "RLS sin política,
// filtrada en silencio" con datos de catálogo, no con "¿lanzó error?".
const { seleccionBloqueadaPorRls } = require('@/lib/db/rlsSelectBlocked.cjs')

describe('seleccionBloqueadaPorRls', () => {
  it('RLS desactivado: nunca bloquea, tenga o no políticas', () => {
    expect(seleccionBloqueadaPorRls(false, [], 'vence_lector')).toBe(false)
    expect(seleccionBloqueadaPorRls(false, [{ cmd: 'SELECT', roles: ['otro'] }], 'vence_lector')).toBe(false)
  })

  it('el caso real medido: RLS activo y CERO políticas → bloqueado (test_questions, tests)', () => {
    expect(seleccionBloqueadaPorRls(true, [], 'vence_lector')).toBe(true)
  })

  it('política SELECT para public: no bloquea a nadie', () => {
    expect(seleccionBloqueadaPorRls(true, [{ cmd: 'SELECT', roles: ['public'] }], 'vence_lector')).toBe(false)
  })

  it('política SELECT nombrando exactamente al rol: no bloquea', () => {
    expect(seleccionBloqueadaPorRls(true, [{ cmd: 'SELECT', roles: ['vence_lector'] }], 'vence_lector')).toBe(false)
  })

  it('política SELECT para OTRO rol: sigue bloqueado para este', () => {
    expect(seleccionBloqueadaPorRls(true, [{ cmd: 'SELECT', roles: ['vence_coordinacion'] }], 'vence_lector')).toBe(true)
  })

  it('cmd ALL cubre también el SELECT', () => {
    expect(seleccionBloqueadaPorRls(true, [{ cmd: 'ALL', roles: ['public'] }], 'vence_lector')).toBe(false)
  })

  it('solo hay política de escritura (INSERT/UPDATE/DELETE): el SELECT sigue bloqueado', () => {
    const policies = [
      { cmd: 'INSERT', roles: ['public'] },
      { cmd: 'UPDATE', roles: ['public'] },
      { cmd: 'DELETE', roles: ['public'] },
    ]
    expect(seleccionBloqueadaPorRls(true, policies, 'vence_lector')).toBe(true)
  })

  it('varias políticas mezcladas, una de ellas SÍ aplica: no bloquea', () => {
    const policies = [
      { cmd: 'INSERT', roles: ['public'] },
      { cmd: 'SELECT', roles: ['vence_lector'] },
    ]
    expect(seleccionBloqueadaPorRls(true, policies, 'vence_lector')).toBe(false)
  })

  it('sin lista de políticas (undefined/null): se comporta como vacía', () => {
    expect(seleccionBloqueadaPorRls(true, undefined, 'vence_lector')).toBe(true)
    expect(seleccionBloqueadaPorRls(true, null, 'vence_lector')).toBe(true)
  })
})
