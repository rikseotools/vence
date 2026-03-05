// __tests__/contexts/isPremiumDerivation.test.ts
// Tests unitarios puros para la lógica de derivación de isPremium
// Replica la lógica de AuthContext línea 676:
//   isPremium: userProfile?.plan_type === 'premium' || userProfile?.plan_type === 'trial'

function deriveIsPremium(userProfile: { plan_type: string } | null): boolean {
  return userProfile?.plan_type === 'premium' || userProfile?.plan_type === 'trial' || false
}

describe('isPremium derivation', () => {
  test('plan_type premium → isPremium = true', () => {
    expect(deriveIsPremium({ plan_type: 'premium' })).toBe(true)
  })

  test('plan_type trial → isPremium = true', () => {
    expect(deriveIsPremium({ plan_type: 'trial' })).toBe(true)
  })

  test('plan_type free → isPremium = false', () => {
    expect(deriveIsPremium({ plan_type: 'free' })).toBe(false)
  })

  test('plan_type legacy_free → isPremium = false', () => {
    expect(deriveIsPremium({ plan_type: 'legacy_free' })).toBe(false)
  })

  test('userProfile null → isPremium = false', () => {
    expect(deriveIsPremium(null)).toBe(false)
  })
})
