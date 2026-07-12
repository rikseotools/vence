// Guardarrail del framework de gating premium (lib/premium/*). Verifica que el registro
// es coherente, que la verdad server-side es correcta y que el guard hace fail-open ante
// ids desconocidos (un typo NUNCA debe bloquear a un usuario). Ver docs/runbooks/premium-gating.md.
import {
  PREMIUM_FEATURES,
  getPremiumFeature,
  type PremiumFeature,
} from '@/lib/premium/features'
import { isPremiumPlan, PREMIUM_PLAN_TYPES } from '@/lib/premium/isPremiumPlan'

describe('registro PREMIUM_FEATURES — integridad', () => {
  const entries = Object.entries(PREMIUM_FEATURES) as Array<[string, PremiumFeature]>

  it('cada clave del registro coincide con el id de su entrada (analítica estable)', () => {
    for (const [key, f] of entries) expect(f.id).toBe(key)
  })

  it('cada feature tiene copy no vacío (label, título, cuerpo, beneficio)', () => {
    for (const [, f] of entries) {
      expect(f.label.trim().length).toBeGreaterThan(0)
      expect(f.modalTitle.trim().length).toBeGreaterThan(0)
      expect(f.modalBody.trim().length).toBeGreaterThan(0)
      expect(f.benefit.trim().length).toBeGreaterThan(0)
    }
  })

  it('el kind es uno de los válidos', () => {
    const valid = ['ui_feature', 'experience', 'course', 'editorial']
    for (const [, f] of entries) expect(valid).toContain(f.kind)
  })

  it('cubre los kinds de CONTENIDO (course + editorial) — el sistema no es solo UI', () => {
    const kinds = entries.map(([, f]) => f.kind)
    expect(kinds).toContain('course')
    expect(kinds).toContain('editorial')
  })

  it('getPremiumFeature devuelve la entrada por id y null si no existe (fail-open)', () => {
    const first = entries[0][0]
    expect(getPremiumFeature(first)?.id).toBe(first)
    expect(getPremiumFeature('id-que-no-existe')).toBeNull()
  })
})

describe('isPremiumPlan — fuente única server-side', () => {
  it('todos los PREMIUM_PLAN_TYPES desbloquean', () => {
    for (const p of PREMIUM_PLAN_TYPES) expect(isPremiumPlan(p)).toBe(true)
  })

  it('free / null / vacío NO desbloquean', () => {
    expect(isPremiumPlan('free')).toBe(false)
    expect(isPremiumPlan(null)).toBe(false)
    expect(isPremiumPlan(undefined)).toBe(false)
    expect(isPremiumPlan('')).toBe(false)
  })

  it('es case-insensitive y tolera espacios (dato sucio no cuela ni bloquea)', () => {
    expect(isPremiumPlan(' Premium ')).toBe(true)
    expect(isPremiumPlan('PREMIUM')).toBe(true)
  })
})
