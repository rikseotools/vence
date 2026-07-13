// Guardarraíl del bug flor/MariSol (13/07): ExamReviewLayout tenía el prop
// oposicionSlug con DEFAULT hardcodeado a Estado y el "Volver a Tests" iba ahí →
// usuarios de otra oposición acababan en Estado. Este test fija que ya NO hardcodea.
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const comp = readFileSync(join(ROOT, 'components', 'ExamReviewLayout.tsx'), 'utf-8')
const client = readFileSync(join(ROOT, 'lib', 'observability', 'client.ts'), 'utf-8')

describe('ExamReviewLayout — "Volver a Tests" a la oposición del usuario, no a Estado', () => {
  it('el prop oposicionSlug ya NO tiene default hardcodeado a Estado', () => {
    expect(comp).not.toMatch(/oposicionSlug\s*=\s*['"]auxiliar-administrativo-estado['"]/)
  })

  it('resuelve la oposición con el helper puro + la del usuario (useOposicionPaths)', () => {
    expect(comp).toMatch(/resolveReviewBackSlug/)
    expect(comp).toMatch(/useOposicionPaths/)
  })

  it('el enlace "Volver a Tests" usa el slug resuelto (backSlug), no el prop crudo', () => {
    expect(comp).toMatch(/href=\{`\/\$\{backSlug\}\/test`\}/)
    expect(comp).not.toMatch(/href=\{`\/\$\{oposicionSlug\}\/test`\}/)
  })

  it('emite observabilidad cuando cae a la flagship (posible dead-end)', () => {
    expect(comp).toMatch(/review_oposicion_fallback/)
    expect(comp).toMatch(/usedFlagshipFallback/)
    // el eventType está registrado en el union de client.ts
    expect(client).toMatch(/'review_oposicion_fallback'/)
  })
})
