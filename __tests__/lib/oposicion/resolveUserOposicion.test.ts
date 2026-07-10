// __tests__/lib/oposicion/resolveUserOposicion.test.ts
// Unit del fix "guard fantasma": la identidad de oposición NO puede depender del
// blob denormalizado target_oposicion_data (428 filas lo tienen NULL).
import { resolveUserOposicion, extractOposicionId } from '@/lib/oposicion/resolveUserOposicion'

describe('resolveUserOposicion', () => {
  it('CASO 428: opoId válido + blob NULL → identidad con nombre del CONFIG (no null)', () => {
    // Antes: userOposicion=null → hasOposicion=false → selector fantasma en /test.
    expect(resolveUserOposicion('auxiliar_administrativo_madrid', 'Auxiliar Administrativo Comunidad de Madrid', null))
      .toEqual({ id: 'auxiliar_administrativo_madrid', name: 'Auxiliar Administrativo Comunidad de Madrid' })
  })

  it('blob presente → su nombre gana (enriquecimiento)', () => {
    expect(resolveUserOposicion('x', 'Nombre Config', { name: 'Nombre Blob' }))
      .toEqual({ id: 'x', name: 'Nombre Blob' })
  })

  it('sin opoId → null (genuinamente sin oposición)', () => {
    expect(resolveUserOposicion(null, 'Config', null)).toBeNull()
    expect(resolveUserOposicion(undefined, null, null)).toBeNull()
    expect(resolveUserOposicion('', 'Config')).toBeNull()
  })

  it('opoId sin blob ni config → nombre genérico, pero SÍ hay identidad', () => {
    expect(resolveUserOposicion('algo', null, null)).toEqual({ id: 'algo', name: 'Tu oposición' })
  })

  it('blob con name vacío → cae a config', () => {
    expect(resolveUserOposicion('x', 'Config', { name: '' })).toEqual({ id: 'x', name: 'Config' })
  })
})

describe('extractOposicionId', () => {
  it('string → tal cual', () => {
    expect(extractOposicionId('auxiliar_administrativo_madrid')).toBe('auxiliar_administrativo_madrid')
  })

  it('objeto {id,...} (OposicionDetector) → su id (antes se nuleaba la oposición)', () => {
    expect(extractOposicionId({ id: 'guardia_civil', name: 'Guardia Civil', slug: 'guardia-civil' }))
      .toBe('guardia_civil')
  })

  it('null / undefined / objeto sin id → null', () => {
    expect(extractOposicionId(null)).toBeNull()
    expect(extractOposicionId(undefined)).toBeNull()
    expect(extractOposicionId({ name: 'x' })).toBeNull()
    expect(extractOposicionId(123)).toBeNull()
  })
})
