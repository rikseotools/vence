// Guardarraíl del atajo Premium "Practicar mis fallos" (pantalla de resultados).
// Feature registrada + botón cableado al gate central + 👑 para free + modal.
import { readFileSync } from 'fs'
import { join } from 'path'
import { getPremiumFeature } from '@/lib/premium/features'

const ROOT = join(__dirname, '..', '..')
const testLayout = readFileSync(join(ROOT, 'components', 'TestLayout.tsx'), 'utf-8')

describe('Premium "Practicar mis fallos" — integrado en el sistema premium', () => {
  it("'repaso_fallos' está registrado en el registro premium (fuente de verdad)", () => {
    const f = getPremiumFeature('repaso_fallos')
    expect(f).not.toBeNull()
    expect(f!.id).toBe('repaso_fallos')
    expect(f!.unlockPlan).toBe('premium')
    expect(f!.modalTitle).toBeTruthy()
    expect(f!.benefit).toBeTruthy()
  })

  it('el botón pasa por el gate central usePremiumGate (no un if suelto)', () => {
    expect(testLayout).toMatch(/gate\(\s*'repaso_fallos'/)
    expect(testLayout).toMatch(/usePremiumGate/)
  })

  it('muestra el 👑 SOLO a los free (patrón del sistema)', () => {
    expect(testLayout).toMatch(/!isPremium\s*&&[^\n]*👑/)
  })

  it('el destino es el repaso scopeado (helper puro, no URL a mano)', () => {
    expect(testLayout).toMatch(/buildRepasoFallosUrl\(/)
  })

  it('renderiza el modal de conversión (PremiumFeatureModal)', () => {
    expect(testLayout).toMatch(/PremiumFeatureModal/)
  })
})
