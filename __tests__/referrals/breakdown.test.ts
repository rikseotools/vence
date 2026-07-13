import { mergeBreakdown, summarizeBreakdown, type BreakdownRow } from '@/lib/referrals/breakdown'

const sub = (date: string, amount = 3, status = 'approved'): BreakdownRow => ({ kind: 'bug', amount, status, date, asunto: 'x' })
const pay = (date: string, amount: number, status: string): BreakdownRow => ({ kind: 'payout', amount, status, date, asunto: 'amazon' })

describe('mergeBreakdown — línea de tiempo unificada', () => {
  it('ordena por fecha DESC (lo más reciente arriba) mezclando fuentes', () => {
    const subs = [sub('2026-07-11'), sub('2026-07-13')]
    const refs: BreakdownRow[] = [{ kind: 'referral', amount: 10, status: 'qualified', date: '2026-07-12', asunto: 'a@b.com' }]
    const pays = [pay('2026-07-14', 5, 'pending')]
    const out = mergeBreakdown(subs, refs, pays)
    expect(out.map((r) => r.date)).toEqual(['2026-07-14', '2026-07-13', '2026-07-12', '2026-07-11'])
    expect(out[0].kind).toBe('payout')
  })

  it('listas vacías → []', () => {
    expect(mergeBreakdown([], [], [])).toEqual([])
  })
})

describe('summarizeBreakdown — totales y "pidió el vale"', () => {
  it('separa ganado de pagos y marca lo solicitado (pending)', () => {
    const rows = mergeBreakdown(
      [sub('2026-07-11'), sub('2026-07-12')],           // 6 € earned (bug)
      [{ kind: 'referral', amount: 10, status: 'qualified', date: '2026-07-10', asunto: 'a@b.com' }], // +10 earned
      [pay('2026-07-13', 5, 'pending'), pay('2026-07-01', 8, 'paid')],
    )
    const t = summarizeBreakdown(rows)
    expect(t.earned).toBe(16)       // 6 bug + 10 referral (NO cuenta pagos)
    expect(t.requested).toBe(5)     // payout pending = pidió el vale
    expect(t.paid).toBe(8)
    expect(t.byKind.bug.count).toBe(2)
    expect(t.byKind.referral.amount).toBe(10)
    expect(t.byKind.payout.count).toBe(2)
  })

  it('un payout pending es "requested", no "earned"', () => {
    const t = summarizeBreakdown([pay('2026-07-13', 5, 'pending')])
    expect(t.earned).toBe(0)
    expect(t.requested).toBe(5)
    expect(t.paid).toBe(0)
  })
})
