// __tests__/temario/temarioConsistency.test.ts
// Test de consistencia del temario dinámico.
// Verifica que la estructura BD (oposicion_bloques + topics) está completa y bien conectada.

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')

describe('Temario dinámico — estructura de archivos', () => {
  const oposicionesEsperadas = [
    'auxilio-judicial',
    'tramitacion-procesal',
    'auxiliar-administrativo-estado',
    'auxiliar-administrativo-madrid',
    'auxiliar-administrativo-cyl',
    'auxiliar-administrativo-andalucia',
    'administrativo-estado',
    'administrativo-castilla-leon',
    'auxiliar-administrativo-canarias',
    'auxiliar-administrativo-baleares',
    'auxiliar-administrativo-clm',
    'auxiliar-administrativo-asturias',
    'auxiliar-administrativo-extremadura',
    'auxiliar-administrativo-valencia',
    'auxiliar-administrativo-aragon',
    'auxiliar-administrativo-galicia',
    'auxiliar-administrativo-carm',
    'auxiliar-administrativo-ayuntamiento-valencia',
  ]

  it('existe el componente compartido DynamicTemarioPage', () => {
    const p = path.join(ROOT, 'components/temario/DynamicTemarioPage.tsx')
    expect(fs.existsSync(p)).toBe(true)
  })

  it('existe el componente compartido TemarioClient', () => {
    const p = path.join(ROOT, 'components/temario/TemarioClient.tsx')
    expect(fs.existsSync(p)).toBe(true)
  })

  it('cada oposición tiene page.tsx que usa DynamicTemarioPage', () => {
    for (const oposicion of oposicionesEsperadas) {
      const pagePath = path.join(ROOT, 'app', oposicion, 'temario/page.tsx')
      expect(fs.existsSync(pagePath)).toBe(true)

      const content = fs.readFileSync(pagePath, 'utf-8')

      // Debe importar el componente compartido
      expect(content).toContain('DynamicTemarioPage')
      // Debe usar static generation (SEO)
      expect(content).toContain('revalidate = false')
      // NO debe tener BLOQUES hardcoded
      expect(content).not.toMatch(/const\s+BLOQUES\s*=/)
    }
  })

  it('ninguna oposición tiene TemarioClient.tsx propio (debe usar el compartido)', () => {
    for (const oposicion of oposicionesEsperadas) {
      const p = path.join(ROOT, 'app', oposicion, 'temario/TemarioClient.tsx')
      expect(fs.existsSync(p)).toBe(false)
    }
  })

  it('los page.tsx son thin wrappers (< 30 líneas)', () => {
    for (const oposicion of oposicionesEsperadas) {
      const pagePath = path.join(ROOT, 'app', oposicion, 'temario/page.tsx')
      const content = fs.readFileSync(pagePath, 'utf-8')
      const lines = content.split('\n').length
      expect(lines).toBeLessThan(30)
    }
  })

  it('DynamicTemarioPage lee de BD (no hardcoded)', () => {
    const p = path.join(ROOT, 'components/temario/DynamicTemarioPage.tsx')
    const content = fs.readFileSync(p, 'utf-8')
    // Debe llamar a getTemarioByPositionType
    expect(content).toContain('getTemarioByPositionType')
    // Debe importar slugToPositionType
    expect(content).toContain('slugToPositionType')
  })

  it('getTemarioByPositionType está definida y exportada', () => {
    const p = path.join(ROOT, 'lib/api/temario/queries.ts')
    const content = fs.readFileSync(p, 'utf-8')
    expect(content).toContain('export async function getTemarioByPositionType')
    expect(content).toContain('oposicion_bloques')
  })
})
