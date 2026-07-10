// __tests__/config/navOposicionSlugGuardrail.test.ts
// GUARDARRAÍL del fix "rebote de oposición" tras un test global.
//
// Caza a futuro toda la clase de bug (jinayda/flor 10/07): construir una URL de
// NAVEGACIÓN con `getOposicionSlugFromPathname(pathname)`. Ese helper devuelve el
// FLAGSHIP cuando la URL no trae slug (rutas globales: /test/rapido de la campana,
// práctica IA) → botaría al usuario a la oposición equivocada en vez de la SUYA.
// La navegación DEBE usar `resolveOposicionSlugForNav(pathname, <oposición-usuario>)`.
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { FLAGSHIP_OPOSICION_SLUG, ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '__tests__') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) acc.push(p)
  }
  return acc
}

describe('guardarraíl: navegación de oposición robusta', () => {
  it('NINGÚN fichero interpola getOposicionSlugFromPathname en una URL (usar resolveOposicionSlugForNav)', () => {
    const roots = ['components', 'app'].map(d => join(process.cwd(), d))
    const offenders: string[] = []
    for (const root of roots) {
      for (const file of walk(root)) {
        const src = readFileSync(file, 'utf-8')
        // Interpolación `${getOposicionSlugFromPathname(...)}` == construcción de URL.
        // El uso "bare" (const x = getOposicionSlugFromPathname(pathname)) para
        // scoring/atribución sigue permitido (no interpola).
        if (/\$\{\s*getOposicionSlugFromPathname\s*\(/.test(src)) {
          offenders.push(file.replace(process.cwd() + '/', ''))
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('getOposicionSlugFromPathname NO cae a ALL_OPOSICION_SLUGS[0] (frágil, "bug Raquel")', () => {
    const src = readFileSync(join(process.cwd(), 'lib/config/oposiciones.ts'), 'utf-8')
    // El cuerpo de la función no debe contener el fallback frágil.
    const fn = src.slice(src.indexOf('export function getOposicionSlugFromPathname'))
      .slice(0, 400)
    expect(fn).not.toMatch(/ALL_OPOSICION_SLUGS\[0\]/)
  })

  it('el FLAGSHIP designado es un slug real del catálogo', () => {
    expect(ALL_OPOSICION_SLUGS).toContain(FLAGSHIP_OPOSICION_SLUG)
  })
})
