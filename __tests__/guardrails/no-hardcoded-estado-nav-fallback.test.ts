// Guardarraíl SISTÉMICO (fix bug flor 12/07/2026 — "que no se vuelva a repetir"):
// prohíbe el anti-patrón `|| 'auxiliar-administrativo-estado'` / `|| "/auxiliar-administrativo-estado/…"`
// como FALLBACK de navegación. Ese patrón mandaba a un usuario de OTRA oposición
// (p.ej. Valencia) a la oposición flagship (Estado) cuando su oposición aún no había
// resuelto. La forma correcta es usar `useOposicionPaths()` (cae al `target_oposicion`
// del usuario antes que a Estado) o `resolveOposicionSlugForNav(pathname, userOposicion)`.
//
// NO afecta a:
//   - Las páginas propias de la oposición Estado (`app/auxiliar-administrativo-estado/**`),
//     cuyos enlaces a `/auxiliar-administrativo-estado/…` son correctos.
//   - Los defaults de ATRIBUCIÓN `positionType || 'auxiliar_administrativo_estado'`
//     (con GUIONES BAJOS): semántica distinta (a qué oposición pertenece un test), no navegación.
//     Este regex solo caza la versión con GUIONES (slug/URL de navegación).
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
// `|| 'auxiliar-administrativo-estado'` o `|| "/auxiliar-administrativo-estado…"` (con guiones = slug/URL)
const ANTIPATTERN = /\|\|\s*['"`]\/?auxiliar-administrativo-estado/

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return acc }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e === '__tests__') continue
    const p = join(dir, e)
    // excluir las páginas propias de la oposición Estado (sus enlaces a Estado son legítimos)
    if (p.includes('auxiliar-administrativo-estado')) continue
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (/\.(tsx?|jsx?)$/.test(e)) acc.push(p)
  }
  return acc
}

describe('guardarraíl — sin fallback de navegación hardcodeado a Estado (anti bug flor)', () => {
  it('ningún componente/hook/página usa `|| "auxiliar-administrativo-estado"` como fallback de nav', () => {
    const files = [
      ...walk(join(ROOT, 'components')),
      ...walk(join(ROOT, 'hooks')),
      ...walk(join(ROOT, 'app')),
    ]
    const offenders = files
      .filter((f) => ANTIPATTERN.test(readFileSync(f, 'utf-8')))
      .map((f) => f.replace(ROOT + '/', ''))
    if (offenders.length) {
      console.error('Anti-patrón fallback-a-Estado en:', offenders.join(', '),
        '\n→ usa useOposicionPaths() o resolveOposicionSlugForNav(pathname, userOposicion).')
    }
    expect(offenders).toEqual([])
  })
})
