import {
  computeSettlementSplit,
  computeSettlementAfterRefund,
  MANUEL_SHARE,
} from '@/lib/stripe-settlement-helpers'

describe('computeSettlementSplit', () => {
  it('reparte 90/10 sobre el neto (bruto - fee)', () => {
    // €20 bruto, fee 0 → net 2000, manuel 1800, armando 200
    expect(computeSettlementSplit(2000, 0)).toEqual({
      amountNet: 2000,
      manuelAmount: 1800,
      armandoAmount: 200,
    })
  })

  it('descuenta el fee de Stripe antes del split', () => {
    // €20 bruto, fee 49c → net 1951, manuel round(1755.9)=1756, armando 195
    expect(computeSettlementSplit(2000, 49)).toEqual({
      amountNet: 1951,
      manuelAmount: 1756,
      armandoAmount: 195,
    })
  })

  it('armando absorbe el redondeo (manuel+armando == net exacto)', () => {
    const s = computeSettlementSplit(3333, 0)
    expect(s.manuelAmount + s.armandoAmount).toBe(s.amountNet)
  })

  it('MANUEL_SHARE es 0.9', () => {
    expect(MANUEL_SHARE).toBe(0.9)
  })
})

describe('computeSettlementAfterRefund', () => {
  it('sin reembolso (refundedAmount=0) → split intacto', () => {
    expect(computeSettlementAfterRefund({ amountGross: 2000, stripeFee: 0, refundedAmount: 0 })).toEqual({
      amountNet: 2000,
      manuelAmount: 1800,
      armandoAmount: 200,
    })
  })

  it('reembolso TOTAL → todo a 0 (caso Lidia)', () => {
    expect(computeSettlementAfterRefund({ amountGross: 2000, stripeFee: 0, refundedAmount: 2000 })).toEqual({
      amountNet: 0,
      manuelAmount: 0,
      armandoAmount: 0,
    })
  })

  it('reembolso PARCIAL 50% → neto y split a la mitad', () => {
    // net original 2000, 50% reembolsado → net 1000, manuel 900, armando 100
    expect(computeSettlementAfterRefund({ amountGross: 2000, stripeFee: 0, refundedAmount: 1000 })).toEqual({
      amountNet: 1000,
      manuelAmount: 900,
      armandoAmount: 100,
    })
  })

  it('es IDEMPOTENTE: reprocesar el mismo refund total da el mismo resultado', () => {
    const once = computeSettlementAfterRefund({ amountGross: 2000, stripeFee: 49, refundedAmount: 2000 })
    const twice = computeSettlementAfterRefund({ amountGross: 2000, stripeFee: 49, refundedAmount: 2000 })
    expect(once).toEqual(twice)
    expect(once.amountNet).toBe(0)
  })

  it('reembolso parcial con fee: reduce el neto en la fracción del bruto reembolsado', () => {
    // bruto 2000, fee 49 → net original 1951; reembolsado 500/2000 = 25%
    // net = round(1951 * 0.75) = round(1463.25) = 1463
    const r = computeSettlementAfterRefund({ amountGross: 2000, stripeFee: 49, refundedAmount: 500 })
    expect(r.amountNet).toBe(1463)
    expect(r.manuelAmount + r.armandoAmount).toBe(r.amountNet)
  })

  it('clampa refundedAmount > bruto a reembolso total (defensa ante datos raros)', () => {
    expect(computeSettlementAfterRefund({ amountGross: 2000, stripeFee: 0, refundedAmount: 9999 })).toEqual({
      amountNet: 0,
      manuelAmount: 0,
      armandoAmount: 0,
    })
  })

  it('clampa refundedAmount negativo a 0', () => {
    expect(computeSettlementAfterRefund({ amountGross: 2000, stripeFee: 0, refundedAmount: -5 }).amountNet).toBe(2000)
  })

  it('amountGross<=0 → todo a 0 sin dividir por cero', () => {
    expect(computeSettlementAfterRefund({ amountGross: 0, stripeFee: 0, refundedAmount: 0 })).toEqual({
      amountNet: 0,
      manuelAmount: 0,
      armandoAmount: 0,
    })
  })
})
