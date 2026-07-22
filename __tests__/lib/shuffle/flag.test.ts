// Guardarraíl del feature flag de barajado (barajar-opciones Fase 1).
// Default OFF y scope por oposición para el piloto. Ver spec §7.

import { isShuffleEnabled, isShuffleEnabledFor } from '@/lib/shuffle/flag'

describe('isShuffleEnabled — default OFF', () => {
  const OLD = process.env.FEATURE_SHUFFLE_OPTIONS
  afterEach(() => {
    if (OLD === undefined) delete process.env.FEATURE_SHUFFLE_OPTIONS
    else process.env.FEATURE_SHUFFLE_OPTIONS = OLD
  })

  test('sin la env → off', () => {
    delete process.env.FEATURE_SHUFFLE_OPTIONS
    expect(isShuffleEnabled()).toBe(false)
  })

  test("solo 'true' enciende (no '1', no 'yes')", () => {
    process.env.FEATURE_SHUFFLE_OPTIONS = '1'
    expect(isShuffleEnabled()).toBe(false)
    process.env.FEATURE_SHUFFLE_OPTIONS = 'true'
    expect(isShuffleEnabled()).toBe(true)
    process.env.FEATURE_SHUFFLE_OPTIONS = 'false'
    expect(isShuffleEnabled()).toBe(false)
  })
})

describe('isShuffleEnabledFor — rollout por oposición', () => {
  const OLD_F = process.env.FEATURE_SHUFFLE_OPTIONS
  const OLD_S = process.env.FEATURE_SHUFFLE_OPTIONS_SCOPE
  afterEach(() => {
    for (const [k, v] of [
      ['FEATURE_SHUFFLE_OPTIONS', OLD_F],
      ['FEATURE_SHUFFLE_OPTIONS_SCOPE', OLD_S],
    ] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  test('flag off → false aunque el scope encaje', () => {
    delete process.env.FEATURE_SHUFFLE_OPTIONS
    process.env.FEATURE_SHUFFLE_OPTIONS_SCOPE = 'auxiliar_administrativo_estado'
    expect(isShuffleEnabledFor('auxiliar_administrativo_estado')).toBe(false)
  })

  test('flag on + scope vacío/all → todas', () => {
    process.env.FEATURE_SHUFFLE_OPTIONS = 'true'
    delete process.env.FEATURE_SHUFFLE_OPTIONS_SCOPE
    expect(isShuffleEnabledFor('cualquiera')).toBe(true)
    process.env.FEATURE_SHUFFLE_OPTIONS_SCOPE = 'all'
    expect(isShuffleEnabledFor(null)).toBe(true)
  })

  test('flag on + scope CSV → solo las listadas', () => {
    process.env.FEATURE_SHUFFLE_OPTIONS = 'true'
    process.env.FEATURE_SHUFFLE_OPTIONS_SCOPE = 'opos_a, opos_b'
    expect(isShuffleEnabledFor('opos_a')).toBe(true)
    expect(isShuffleEnabledFor('opos_b')).toBe(true)
    expect(isShuffleEnabledFor('opos_c')).toBe(false)
    expect(isShuffleEnabledFor(null)).toBe(false)
  })
})
