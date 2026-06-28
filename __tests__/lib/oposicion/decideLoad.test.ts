// __tests__/lib/oposicion/decideLoad.test.ts
// Regresión bug Nila (heavy user móvil): un fallo del fetch de oposición
// (401 por race de token al reanudar, 5xx por saturación) NO debe interpretarse
// como "el usuario no tiene oposición". OposicionContext borraba la oposición
// conocida ante un no-2xx → rompía tests en curso y mostraba "Selecciona tu
// oposición" en falso. El helper PURO documenta y blinda el invariante.

import { decideOposicionLoad } from '@/lib/oposicion/decideLoad'

describe('decideOposicionLoad — error ≠ sin oposición', () => {
  it('fetch NO-ok (401 race token) → KEEP (mantener oposición conocida)', () => {
    // Aunque el body venga vacío/erróneo, si res.ok=false NO se toca el estado.
    expect(decideOposicionLoad(false, null, false)).toBe('keep')
    expect(decideOposicionLoad(false, 'auxiliar_administrativo_madrid', true)).toBe('keep')
  })

  it('fetch NO-ok (5xx saturación) → KEEP', () => {
    expect(decideOposicionLoad(false, undefined, false)).toBe('keep')
  })

  it('200 OK + target null = genuinamente sin oposición → CLEAR', () => {
    expect(decideOposicionLoad(true, null, false)).toBe('clear')
    expect(decideOposicionLoad(true, undefined, false)).toBe('clear')
    expect(decideOposicionLoad(true, '', false)).toBe('clear')
  })

  it('200 OK + target válido → SET', () => {
    expect(decideOposicionLoad(true, 'auxiliar_administrativo_madrid', true)).toBe('set')
  })

  it('200 OK + target sucio (UUID/JSON/slug desconocido) → INVALID', () => {
    expect(decideOposicionLoad(true, '30e43315-uuid-sucio', false)).toBe('invalid')
  })

  it('NUNCA devuelve clear/invalid/set cuando el fetch falló', () => {
    // Propiedad: si resOk=false, la acción es siempre 'keep' sea cual sea el body.
    for (const target of [null, undefined, '', 'x', 'auxiliar_administrativo_madrid']) {
      for (const valid of [true, false]) {
        expect(decideOposicionLoad(false, target as string | null, valid)).toBe('keep')
      }
    }
  })
})
