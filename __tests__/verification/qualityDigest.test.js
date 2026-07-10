// __tests__/verification/qualityDigest.test.js
// Unit tests de la función pura del digest semanal de calidad de contenido.
// (Capa 1 de las 5: unit. Capa "simulación" = DRY_RUN del script contra la BD real.)
const { buildQualityReport } = require('../../scripts/content-quality-digest.cjs')

const STAMP = '2026-07-10'

describe('buildQualityReport', () => {
  test('sin deuda accionable (todo verified) → hasContent false, silencio', () => {
    const rows = [
      { position_type: 'a', total: 20, correct: 20, issues: 0, needs_human: 0, stale: 0, never: 0, epigrafe_pending: 0 },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.hasContent).toBe(false)
    expect(r.issuesTotal).toBe(0)
    expect(r.needsHumanTotal).toBe(0)
    expect(r.oposConDeuda).toHaveLength(0)
  })

  test('never_verified/stale SOLOS no disparan email (son cobertura, no bug)', () => {
    const rows = [
      { position_type: 'a', total: 30, correct: 0, issues: 0, needs_human: 0, stale: 5, never: 25, epigrafe_pending: 30 },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.hasContent).toBe(false) // no issues ni needs_human
    expect(r.pendientesTotal).toBeGreaterThan(0) // pero SÍ hay deuda contada
  })

  test('issues dispara email y cuenta bien', () => {
    const rows = [
      { position_type: 'admin_madrid', total: 47, correct: 29, issues: 9, needs_human: 9, stale: 0, never: 0, epigrafe_pending: 0 },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.hasContent).toBe(true)
    expect(r.issuesTotal).toBe(9)
    expect(r.needsHumanTotal).toBe(9)
    expect(r.oposConDeuda).toHaveLength(1)
    expect(r.subject).toContain('9 issues')
    expect(r.subject).toContain('9 needs_human')
  })

  test('needs_human solo (sin issues) también dispara', () => {
    const rows = [
      { position_type: 'a', total: 28, correct: 26, issues: 0, needs_human: 2, stale: 0, never: 0, epigrafe_pending: 0 },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.hasContent).toBe(true)
    expect(r.needsHumanTotal).toBe(2)
  })

  test('ordena por deuda accionable (issues+needs_human) descendente', () => {
    const rows = [
      { position_type: 'poca', total: 20, correct: 18, issues: 0, needs_human: 2, stale: 0, never: 0, epigrafe_pending: 0 },
      { position_type: 'mucha', total: 47, correct: 29, issues: 9, needs_human: 9, stale: 0, never: 0, epigrafe_pending: 0 },
      { position_type: 'media', total: 30, correct: 25, issues: 3, needs_human: 2, stale: 0, never: 0, epigrafe_pending: 0 },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.oposConDeuda.map((o) => o.position_type)).toEqual(['mucha', 'media', 'poca'])
  })

  test('excluye del listado las oposiciones sin deuda accionable', () => {
    const rows = [
      { position_type: 'limpia', total: 21, correct: 21, issues: 0, needs_human: 0, stale: 0, never: 0, epigrafe_pending: 0 },
      { position_type: 'sucia', total: 30, correct: 27, issues: 3, needs_human: 0, stale: 0, never: 0, epigrafe_pending: 0 },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.oposConDeuda.map((o) => o.position_type)).toEqual(['sucia'])
  })

  test('epigrafe_pending suma a la deuda total pero NO dispara solo', () => {
    const rows = [
      { position_type: 'a', total: 20, correct: 20, issues: 0, needs_human: 0, stale: 0, never: 0, epigrafe_pending: 8 },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.hasContent).toBe(false)
    expect(r.pendientesTotal).toBe(8)
  })

  test('sinVerificar cuenta oposiciones nunca tocadas (cobertura)', () => {
    const rows = [
      { position_type: 'curada', total: 21, correct: 21, issues: 0, needs_human: 0, stale: 0, never: 0, epigrafe_pending: 0 },
      { position_type: 'con_bug', total: 30, correct: 25, issues: 3, needs_human: 2, stale: 0, never: 0, epigrafe_pending: 0 },
      { position_type: 'virgen1', total: 40, correct: 0, issues: 0, needs_human: 0, stale: 0, never: 40, epigrafe_pending: 40 },
      { position_type: 'virgen2', total: 35, correct: 0, issues: 0, needs_human: 0, stale: 0, never: 35, epigrafe_pending: 35 },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.sinVerificar).toBe(2) // virgen1 + virgen2
    expect(r.html).toContain('<b>2</b> oposiciones aún sin verificar')
  })

  test('escapa HTML del position_type (no inyección en el email)', () => {
    const rows = [
      { position_type: 'a<script>&', total: 10, correct: 5, issues: 5, needs_human: 0, stale: 0, never: 0, epigrafe_pending: 0 },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.html).toContain('a&lt;script&gt;&amp;')
    expect(r.html).not.toContain('<script>')
  })

  test('campos numéricos como string (vienen de count()::int→pg) se normalizan', () => {
    const rows = [
      { position_type: 'a', total: '30', correct: '25', issues: '3', needs_human: '2', stale: '0', never: '0', epigrafe_pending: '0' },
    ]
    const r = buildQualityReport(rows, STAMP)
    expect(r.issuesTotal).toBe(3)
    expect(r.needsHumanTotal).toBe(2)
    expect(r.hasContent).toBe(true)
  })
})
