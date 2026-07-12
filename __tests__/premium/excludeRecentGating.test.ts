// Guardarrail del gating premium de "excluir preguntas recientes" (primera feature
// cableada del framework). Verifica POR FUENTE las DOS capas — cliente (👑 + gate + modal)
// y servidor (strip para no-premium) — para que nadie las quite sin que falle el build.
// Capas de seguridad (memoria feature_multiples_capas_seguridad): unit(registro) +
// guardarrail(este) + integración/simulación(RDS, script) + canary-safe.
import { readFileSync } from 'fs'
import { join } from 'path'
import { getPremiumFeature } from '@/lib/premium/features'

const ROOT = join(__dirname, '..', '..')
const configurator = readFileSync(join(ROOT, 'components/TestConfigurator.tsx'), 'utf-8')
const route = readFileSync(join(ROOT, 'app/api/questions/filtered/route.ts'), 'utf-8')

describe('exclude_recent — registrado en el framework', () => {
  it('existe en el registro como ui_feature con copy', () => {
    const f = getPremiumFeature('exclude_recent')
    expect(f).not.toBeNull()
    expect(f!.kind).toBe('ui_feature')
    expect(f!.modalTitle.length).toBeGreaterThan(0)
  })
})

describe('capa CLIENTE — TestConfigurator gatea el toggle', () => {
  it('usa el guard usePremiumGate + el modal genérico', () => {
    expect(configurator).toMatch(/usePremiumGate/)
    expect(configurator).toMatch(/PremiumFeatureModal/)
  })
  it('el onChange del toggle pasa por gate(\'exclude_recent\', …) al activar', () => {
    expect(configurator).toMatch(/gate\(\s*['"]exclude_recent['"]/)
  })
  it('muestra la corona 👑 solo a usuarios NO premium', () => {
    expect(configurator).toMatch(/!isPremiumUser\s*&&[\s\S]{0,60}👑/)
  })
  it('renderiza el modal cuando hay feature activa', () => {
    expect(configurator).toMatch(/activeFeature\s*&&[\s\S]{0,120}PremiumFeatureModal/)
  })
})

describe('capa SERVIDOR — /api/questions/filtered neutraliza para no-premium (defensa en profundidad)', () => {
  it('valida el plan con isPremiumPlan y anula excludeRecentDays si no es premium', () => {
    expect(route).toMatch(/isPremiumPlan/)
    // El strip debe estar guardado por "no premium" y poner excludeRecentDays a 0.
    expect(route).toMatch(/!isPremiumPlan\([\s\S]{0,120}excludeRecentDays\s*=\s*0/)
  })
  it('solo consulta el plan cuando el toggle viene activo (barato en el caso común)', () => {
    expect(route).toMatch(/excludeRecentDays\s*\?\?\s*0\)\s*>\s*0[\s\S]{0,200}getUserPlanType/)
  })
})
