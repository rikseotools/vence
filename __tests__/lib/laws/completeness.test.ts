import { classifyLawCompleteness } from '@/lib/laws/completeness'

describe('classifyLawCompleteness — estado honesto ley↔fuente', () => {
  test('falso verde: label actualizada SIN summary (caso ULE T18)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, scope: 'regional', boeUrl: null,
      verificationStatus: 'actualizada', lastVerificationSummary: null,
    })
    expect(r.state).toBe('false_green')
    expect(r.isFalseGreen).toBe(true)
    expect(r.actionable).toBe(true)
    expect(r.hasSource).toBe(false)
  })

  test('no_source: no virtual, sin URL, sin label mentiroso', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, scope: 'regional', boeUrl: null,
      verificationStatus: 'pendiente', lastVerificationSummary: null,
    })
    expect(r.state).toBe('no_source')
    expect(r.actionable).toBe(true)
  })

  test('never_verified: hay fuente pero nunca se comparó', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://www.boe.es/x', verificationStatus: 'pendiente',
      lastVerificationSummary: null,
    })
    expect(r.state).toBe('never_verified')
    expect(r.hasSource).toBe(true)
    expect(r.actionable).toBe(true)
  })

  test('incomplete: missing_in_db>0 (precedente Ley 2/2007, 3 de 55)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x', verificationStatus: 'actualizada',
      lastVerificationSummary: { is_ok: false, boe_count: 55, db_count: 3, missing_in_db: 52 },
    })
    expect(r.state).toBe('incomplete')
    expect(r.missingInDb).toBe(52)
    expect(r.actionable).toBe(true)
  })

  test('incomplete: deriva missing de boe_count>db_count aunque missing_in_db falte', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x',
      lastVerificationSummary: { boe_count: 74, db_count: 28 },
    })
    expect(r.state).toBe('incomplete')
    expect(r.missingInDb).toBe(46)
  })

  test('issues: content/title mismatch sin faltantes', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x',
      lastVerificationSummary: { is_ok: false, boe_count: 10, db_count: 10, missing_in_db: 0, content_mismatch: 2 },
    })
    expect(r.state).toBe('issues')
    expect(r.actionable).toBe(true)
  })

  test('verified: summary is_ok sin faltantes ni discrepancias', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x', verificationStatus: 'actualizada',
      lastVerificationSummary: { is_ok: true, boe_count: 47, db_count: 47, missing_in_db: 0 },
    })
    expect(r.state).toBe('verified')
    expect(r.actionable).toBe(false)
  })

  test('verified legítimo: no_consolidated_text (doc no parseable clasificado)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x',
      lastVerificationSummary: { no_consolidated_text: true },
    })
    expect(r.state).toBe('verified')
    expect(r.actionable).toBe(false)
  })

  test('verified legítimo: histórico (versión anual sustituida)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x',
      lastVerificationSummary: { historical: true },
    })
    expect(r.state).toBe('verified')
    expect(r.actionable).toBe(false)
  })

  test('verified legítimo: subconjunto deliberado (temas escopan el subconjunto presente)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x',
      lastVerificationSummary: { deliberate_subset: true, boe_count: 236, db_count: 9, missing_in_db: 227 },
    })
    expect(r.state).toBe('verified')
    expect(r.actionable).toBe(false)
  })

  // T-395 (07/08/2026): un summary con is_ok:false pero SIN contadores no es una
  // comparación — es una NOTA DE INCIDENCIA (detector `audit_boe_url` cuando el `boe_url`
  // apuntaba a otro documento). Antes del fix caía al ELSE final y salía `verified`.
  // Fixture verbatim del caso real OPCAT (114 preguntas activas, reproducido contra RDS).
  test('never_verified (no falso verde): is_ok:false SIN contadores es nota de incidencia, no comparación (caso real OPCAT)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://www.boe.es/x', verificationStatus: 'error',
      lastVerificationSummary: {
        is_ok: false,
        source: 'audit_boe_url',
        message: 'boe_url ERRÓNEO: apuntaba a BOE-A-1994-9268 = "Real Decreto 643/1994… por el que se nombra Decano"',
        verified_at: '2026-07-16',
        boe_url_erroneo: true,
      },
    })
    expect(r.state).toBe('never_verified')
    expect(r.actionable).toBe(true)
    expect(r.isFalseGreen).toBe(false) // no es el mismo camino que false_green (ese es sin summary)
  })

  test('is_ok:false con contadores LIMPIOS también deja de ser falso verde', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x',
      lastVerificationSummary: { is_ok: false, boe_count: 10, db_count: 10, missing_in_db: 0 },
    })
    expect(r.state).toBe('never_verified')
    expect(r.actionable).toBe(true)
  })

  test('is_ok:false NO pisa incomplete: missing_in_db manda si está presente (caso real RGGIT)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x', verificationStatus: 'pendiente',
      lastVerificationSummary: { is_ok: false, boe_count: 30, db_count: 8, missing_in_db: 22 },
    })
    expect(r.state).toBe('incomplete')
    expect(r.missingInDb).toBe(22)
  })

  test('is_ok:false NO pisa las exenciones legítimas (deliberate_subset sigue mandando)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x',
      lastVerificationSummary: { is_ok: false, deliberate_subset: true, boe_count: 40, db_count: 5, missing_in_db: 35 },
    })
    expect(r.state).toBe('verified')
    expect(r.actionable).toBe(false)
  })

  test('is_ok:true sigue dando verified (no se toca el camino feliz)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x',
      lastVerificationSummary: { is_ok: true },
    })
    expect(r.state).toBe('verified')
    expect(r.actionable).toBe(false)
  })

  test('sin is_ok en el summary (undefined) sigue dando verified (no confundir ausencia con false)', () => {
    const r = classifyLawCompleteness({
      isVirtual: false, boeUrl: 'https://boe/x',
      lastVerificationSummary: { boe_count: 10, db_count: 10 },
    })
    expect(r.state).toBe('verified')
    expect(r.actionable).toBe(false)
  })

  test('virtual: fuera del detector (lo cubre scope↔epígrafe)', () => {
    const r = classifyLawCompleteness({
      isVirtual: true, boeUrl: null, verificationStatus: 'actualizada', lastVerificationSummary: null,
    })
    expect(r.state).toBe('verified')
    expect(r.actionable).toBe(false)
  })
})
