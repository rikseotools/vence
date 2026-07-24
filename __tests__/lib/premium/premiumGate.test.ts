// __tests__/lib/premium/premiumGate.test.ts
//
// Clasificador server-autoritativo del gate premium (fix bug Iván, feedback 23d38071):
// el SERVIDOR decide; el isPremium cacheado del cliente es cosmético. Un usuario que el
// server tiene por premium (200) NUNCA puede quedar bloqueado, aunque su cliente crea free.

import { classifyPremiumGateResponse, needsPlanReconciliation } from '@/lib/premium/premiumGate'

describe('classifyPremiumGateResponse — casos base', () => {
  test('200 + cliente ya premium → allowed, sin desincronía', () => {
    const d = classifyPremiumGateResponse(200, true)
    expect(d).toEqual({ outcome: 'allowed', staleRecovered: false, staleBlocked: false })
  })

  test('200 + cliente creía FREE (caso Iván) → allowed + staleRecovered', () => {
    const d = classifyPremiumGateResponse(200, false)
    expect(d.outcome).toBe('allowed')
    expect(d.staleRecovered).toBe(true)   // hay que reconciliar el cliente a premium
    expect(d.staleBlocked).toBe(false)
  })

  test('403 + cliente creía free → blocked (free real), sin desincronía', () => {
    const d = classifyPremiumGateResponse(403, false)
    expect(d).toEqual({ outcome: 'blocked', staleRecovered: false, staleBlocked: false })
  })

  test('403 + cliente creía premium → blocked + staleBlocked (sub vencida)', () => {
    const d = classifyPremiumGateResponse(403, true)
    expect(d.outcome).toBe('blocked')
    expect(d.staleBlocked).toBe(true)     // reconciliar el cliente a free
  })

  test('413 → too_large (degrada a impresión de navegador)', () => {
    expect(classifyPremiumGateResponse(413, true).outcome).toBe('too_large')
    expect(classifyPremiumGateResponse(413, false).outcome).toBe('too_large')
  })

  test('5xx → error', () => {
    expect(classifyPremiumGateResponse(500, true).outcome).toBe('error')
    expect(classifyPremiumGateResponse(0, false).outcome).toBe('error')
  })

  test('otros 2xx (201/204) → allowed', () => {
    expect(classifyPremiumGateResponse(201, true).outcome).toBe('allowed')
    expect(classifyPremiumGateResponse(204, false).outcome).toBe('allowed')
  })
})

describe('SIMULACIÓN caso Iván (premium recién comprado, cliente aún free)', () => {
  test('el server autoriza pese al cliente obsoleto → nunca bloquea, y pide reconciliar', () => {
    // Iván: pagó a las 16:17, su AuthContext seguía en free. Con el gate server-autoritativo,
    // el endpoint responde 200 y el cliente NO puede mostrar el muro.
    const d = classifyPremiumGateResponse(200, /* clientThoughtPremium */ false)
    expect(d.outcome).toBe('allowed')            // descarga, NO muro
    expect(needsPlanReconciliation(d)).toBe(true) // dispara profileUpdated → cura la UI
  })
})

describe('INVARIANTES (canary) — matriz status × cliente', () => {
  const statuses = [200, 201, 204, 299, 403, 413, 400, 401, 404, 500, 502, 0]
  const clientStates = [true, false]

  test('INVARIANTE CLAVE: un 2xx (server-premium) NUNCA queda bloqueado, crea lo que crea el cliente', () => {
    for (const s of [200, 201, 204, 299]) for (const c of clientStates) {
      expect(classifyPremiumGateResponse(s, c).outcome).toBe('allowed')
    }
  })

  test('coherencia de flags para toda la matriz', () => {
    for (const s of statuses) for (const c of clientStates) {
      const d = classifyPremiumGateResponse(s, c)
      // allowed ⇒ no puede estar staleBlocked; blocked ⇒ no puede estar staleRecovered
      if (d.outcome === 'allowed') expect(d.staleBlocked).toBe(false)
      if (d.outcome === 'blocked') expect(d.staleRecovered).toBe(false)
      // staleRecovered SOLO si autorizó y el cliente creía free
      expect(d.staleRecovered).toBe(d.outcome === 'allowed' && c === false)
      // staleBlocked SOLO si bloqueó y el cliente creía premium
      expect(d.staleBlocked).toBe(d.outcome === 'blocked' && c === true)
      // needsPlanReconciliation ⇔ alguna desincronía
      expect(needsPlanReconciliation(d)).toBe(d.staleRecovered || d.staleBlocked)
      // exactamente un outcome válido
      expect(['allowed', 'blocked', 'too_large', 'error']).toContain(d.outcome)
    }
  })
})
