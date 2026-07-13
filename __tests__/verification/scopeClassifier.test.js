// Guardarraíl del clasificador de scope (Sistema 1). Codifica las lecciones de
// la sesión GVA 13/07 para que ninguna sesión futura auto-borre contenido
// implícito. Los casos son los REALES de GVA — el clasificador debe reproducir
// las decisiones humanas de esa sesión.
const { classifyChange, temaVerdict, epigrafeSegment } = require('../../scripts/lib/scope-classifier.cjs')

describe('classifyChange — puerta de juicio vs auto-seguro (casos reales GVA)', () => {
  it('sin cambio → auto_safe', () => {
    const r = classifyChange({ ley: 'CE', quitar: [], anadir: [] })
    expect(r.category).toBe('auto_safe')
  })

  it('T6: mover bloque estructural (Ley 5/1983, 9 preg) → auto_safe', () => {
    const r = classifyChange({
      ley: 'Ley 5/1983 Consell',
      quitar: [31, 32, 33, 43], anadir: [],
      epigrafe: 'La Ley 5/1983 del Consell: Título III...; Título IV...; Título V responsabilidad.',
      lawsInTema: 1, emptiesLaw: false, impacto: 9, deltaValid: true,
    })
    expect(r.category).toBe('auto_safe')
  })

  it('T5: solo añadir (sin quitar) → auto_safe', () => {
    const r = classifyChange({
      ley: 'Ley 4/2021 FPV', quitar: [], anadir: [23, 24, 25, 106],
      epigrafe: 'Ley 4/2021 FPV: Título I; Título III...', lawsInTema: 1, emptiesLaw: false, impacto: 0, deltaValid: true,
    })
    expect(r.category).toBe('auto_safe')
  })

  it('T14: recorte estructural con secciones precisas (47 preg) → auto_safe', () => {
    const r = classifyChange({
      ley: 'Ley 9/2017', quitar: [4, 5, 19, 28, 35], anadir: [118, 119, 120],
      epigrafe: 'Ley 9/2017: Título preliminar Capítulo I Sección 1ª; Capítulo II Sección 1ª y 3ª; Libro II...',
      lawsInTema: 1, emptiesLaw: false, impacto: 47, deltaValid: true,
    })
    expect(r.category).toBe('auto_safe')
  })

  it('T20: Decreto pero recorte PARCIAL estructural (no vacía, 32 preg) → auto_safe', () => {
    const r = classifyChange({
      ley: 'Decreto 30/2025 GVA', quitar: [14, 15, 24, 25], anadir: [],
      epigrafe: 'Decreto 30/2025: Título I; Título II; Título III; Título IV Capítulo III y Capítulo IV.',
      lawsInTema: 1, emptiesLaw: false, impacto: 32, deltaValid: true,
    })
    expect(r.category).toBe('auto_safe')
  })

  // ── PUERTA DE JUICIO (lo que NO se debe auto-aplicar) ──

  it('T17: Decreto 77/2019 VACIADO en tema con ≥2 leyes → gate (reglamento_desarrolla)', () => {
    const r = classifyChange({
      ley: 'Decreto 77/2019 GVA', quitar: [1, 2, 3, 14, 15], anadir: [],
      epigrafe: 'Ley 1/2015 Hacienda GVA: Título II Cap I, III, IV.',
      lawsInTema: 2, emptiesLaw: true, impacto: 14, deltaValid: true,
    })
    expect(r.category).toBe('judgment_gate')
    expect(r.flags).toContain('reglamento_desarrolla')
  })

  it('T8: Ley 4/2023 epígrafe TEMÁTICO ("medidas en el ámbito administrativo") → gate', () => {
    const r = classifyChange({
      ley: 'Ley 4/2023', quitar: [8, 9, 28, 36], anadir: [4, 11, 12, 13],
      epigrafe: 'Ley 4/2023 LGTBI: deber de protección y medidas en el ámbito administrativo.',
      lawsInTema: 4, emptiesLaw: false, impacto: 21, deltaValid: true,
    })
    expect(r.category).toBe('judgment_gate')
    expect(r.flags).toContain('epigrafe_tematico')
  })

  it('T10: recorte estructural pero IMPACTO ALTO (272 preg) → gate (impacto_alto)', () => {
    const r = classifyChange({
      ley: 'LPRL', leyNombre: 'Ley 31/1995, de 8 de noviembre, de prevención de riesgos laborales',
      quitar: [5, 6, 7, 8, 9, 30, 31, 41], anadir: [],
      epigrafe: 'La Ley 31/1995 PRL: Capítulo I...; Capítulo III, Derechos y obligaciones.',
      lawsInTema: 1, emptiesLaw: false, impacto: 272, deltaValid: true,
    })
    expect(r.category).toBe('judgment_gate')
    expect(r.flags).toContain('impacto_alto')
  })

  it('delta inválido (arts a quitar no estaban) → gate', () => {
    const r = classifyChange({
      ley: 'X', quitar: [99], anadir: [], epigrafe: 'X: Título I.', lawsInTema: 1,
      emptiesLaw: false, impacto: 0, deltaValid: false,
    })
    expect(r.category).toBe('judgment_gate')
    expect(r.flags).toContain('delta_invalido')
  })

  it('epígrafe no localizable para la ley del recorte → gate (cautela)', () => {
    const r = classifyChange({
      ley: 'Ley Foral 999/2099', quitar: [5], anadir: [],
      epigrafe: 'Un epígrafe que no menciona esa ley por ningún lado.',
      lawsInTema: 1, emptiesLaw: false, impacto: 3, deltaValid: true,
    })
    expect(r.category).toBe('judgment_gate')
    expect(r.flags).toContain('epigrafe_no_localizable')
  })

  it('umbral de impacto configurable', () => {
    const base = {
      ley: 'LPRL', leyNombre: 'Ley 31/1995 de prevención de riesgos laborales',
      quitar: [5], anadir: [], epigrafe: 'Ley 31/1995: Capítulo I; Capítulo III.',
      lawsInTema: 1, emptiesLaw: false, impacto: 100, deltaValid: true,
    }
    expect(classifyChange(base, { impactThreshold: 150 }).category).toBe('auto_safe')
    expect(classifyChange(base, { impactThreshold: 50 }).category).toBe('judgment_gate')
  })
})

describe('temaVerdict — un tema es correct solo si TODOS sus cambios son auto_safe', () => {
  it('todos auto_safe → correct', () => {
    expect(temaVerdict([{ category: 'auto_safe' }, { category: 'auto_safe' }])).toBe('correct')
  })
  it('alguno a la puerta → issues', () => {
    expect(temaVerdict([{ category: 'auto_safe' }, { category: 'judgment_gate' }])).toBe('issues')
  })
})

describe('epigrafeSegment — localiza el trozo del epígrafe de una ley', () => {
  it('localiza por número de ley', () => {
    const seg = epigrafeSegment('LO 3/2007: Título I. LO 1/2004: Título preliminar.', 'LO 1/2004')
    expect(seg).toContain('1/2004')
    expect(seg).toContain('preliminar')
    expect(seg).not.toContain('3/2007')
  })
})
