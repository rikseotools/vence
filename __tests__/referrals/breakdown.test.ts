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

// ─────────────────────────────────────────────────────────────────────────────
// EL DESGLOSE, VISTO POR LA PROPIA PERSONA (30/07/2026)
//
// Nació para el panel de admin. Lo abrió al embajador María José, premium con 7 € en su
// cartera: «¿se podría enlazar cada aportación con la pregunta que ha dado ese
// reconocimiento? En mi caso tengo 7 €, pues que al pinchar en el saldo me diga las
// preguntas que han hecho eso posible».
//
// El dato ya se guardaba (`reward_submissions.dispute_id`), pero faltaban dos cosas:
// `impugnacion` no existía como fuente —se etiquetaba como «bug»— y no había nombres que
// significaran algo fuera de casa («ugc», «payout»).
// ─────────────────────────────────────────────────────────────────────────────
import { ETIQUETA_FUENTE, etiquetaEstado } from '@/lib/referrals/breakdown'

describe('el desglose que ve el embajador', () => {
  it('la impugnación es su propia fuente, no un «bug»', () => {
    expect(ETIQUETA_FUENTE.impugnacion).toBe('Pregunta impugnada')
    expect(ETIQUETA_FUENTE.bug).toBe('Fallo reportado')
  })

  it('ninguna fuente se le enseña con jerga interna', () => {
    for (const texto of Object.values(ETIQUETA_FUENTE)) {
      expect(texto).not.toMatch(/ugc|payout|bug|kind/i)
    }
  })

  it('lo aceptado y lo pagado CUENTA; lo rechazado no', () => {
    expect(etiquetaEstado('approved')).toEqual({ texto: 'Aceptada', cuenta: true })
    expect(etiquetaEstado('paid')).toEqual({ texto: 'Pagada', cuenta: true })
    expect(etiquetaEstado('rejected')).toEqual({ texto: 'No aceptada', cuenta: false })
  })

  it('lo que está en revisión NO se presenta como ganado', () => {
    // Si el desglose sumara lo retenido, generaría la queja contraria: «aquí pone 3 € y no
    // los tengo». Es el error más fácil al abrir esta pantalla.
    expect(etiquetaEstado('pending').cuenta).toBe(false)
    expect(etiquetaEstado('hold').cuenta).toBe(false)
  })

  it('un estado desconocido se trata como NO disponible, nunca como cobrado', () => {
    expect(etiquetaEstado('vete_a_saber').cuenta).toBe(false)
    expect(etiquetaEstado('').cuenta).toBe(false)
  })

  it('los totales cuentan las impugnaciones (antes ni existían en el reparto)', () => {
    const t = summarizeBreakdown([
      { kind: 'impugnacion', amount: 1, status: 'approved', date: '2026-07-29', asunto: 'Las Oficinas de Atención al Ciudadano…' },
      { kind: 'bug', amount: 3, status: 'approved', date: '2026-07-23', asunto: 'va muy lento' },
      { kind: 'bug', amount: 3, status: 'approved', date: '2026-07-15', asunto: 'psicotécnicos' },
    ])
    expect(t.byKind.impugnacion).toEqual({ count: 1, amount: 1 })
    expect(t.earned).toBe(7) // sus 7 € exactos
  })
})
