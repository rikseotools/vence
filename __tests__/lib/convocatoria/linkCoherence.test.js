const { extraerIdBoe, extraerAño, checkConvocatoriaLinks } = require('@/lib/convocatoria/linkCoherence.cjs')

describe('extraerIdBoe', () => {
  it('extrae el ID de un texto con basura alrededor', () => {
    expect(extraerIdBoe('BOE-A-2026-9946 (RD 387/2026, OEP 2026). Anexo I...')).toBe('BOE-A-2026-9946')
  })
  it('extrae el ID de una URL', () => {
    expect(extraerIdBoe('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262')).toBe('BOE-A-2025-26262')
  })
  it('null si no hay ID', () => {
    expect(extraerIdBoe('sin referencia')).toBeNull()
    expect(extraerIdBoe(null)).toBeNull()
  })
})

describe('extraerAño', () => {
  it('extrae el año de una URL de seguimiento', () => {
    expect(extraerAño('.../convocatoria-2025')).toBe(2025)
  })
  it('null si no hay año', () => {
    expect(extraerAño('sin-anio')).toBeNull()
  })
})

describe('checkConvocatoriaLinks — GUARDARRAÍL enlace ≠ referencia', () => {
  it('CAZA el incidente real: muestra OEP 2026 pero enlaza a la convocatoria 2025', () => {
    const issues = checkConvocatoriaLinks({
      boeReference: 'BOE-A-2026-9946 (RD 387/2026, OEP 2026). Anexo I nuevo ingreso: 1450...',
      programaUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262',
      seguimientoUrl: '.../cuerpo-general-auxiliar...-convocatoria-2025',
      año: 2026,
    })
    const tipos = issues.map((i) => i.tipo)
    expect(tipos).toContain('ref_url_mismatch')
    expect(tipos).toContain('seguimiento_year_stale')
    expect(issues.find((i) => i.tipo === 'ref_url_mismatch').severidad).toBe('error')
  })
  it('OK cuando el enlace coincide con la referencia', () => {
    const issues = checkConvocatoriaLinks({
      boeReference: 'BOE-A-2024-14098',
      programaUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-14098',
      seguimientoUrl: null,
      año: 2024,
    })
    expect(issues).toEqual([])
  })
  it('no marca mismatch si falta uno de los dos IDs (regional, sin BOE)', () => {
    const issues = checkConvocatoriaLinks({
      boeReference: 'BOCM-20260218-2',
      programaUrl: 'https://www.comunidad.madrid/...',
      año: 2026,
    })
    expect(issues.filter((i) => i.tipo === 'ref_url_mismatch')).toEqual([])
  })
  it('seguimiento del MISMO año o posterior no es stale', () => {
    const issues = checkConvocatoriaLinks({
      boeReference: 'BOE-A-2026-1', programaUrl: 'id=BOE-A-2026-1',
      seguimientoUrl: '.../convocatoria-2026', año: 2026,
    })
    expect(issues.filter((i) => i.tipo === 'seguimiento_year_stale')).toEqual([])
  })
  it('entrada nula no revienta', () => {
    expect(checkConvocatoriaLinks(null)).toEqual([])
    expect(checkConvocatoriaLinks({})).toEqual([])
  })
})
