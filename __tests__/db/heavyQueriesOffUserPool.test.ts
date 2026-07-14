// Guardarraíl (fix contención RDS 14/07 + revisión adversarial): el pool de USUARIO
// (getDb, statement_timeout=10s) NO debe correr queries pesadas SIN withDbTimeout que
// puedan pasar de 10s — se abortarían donde antes (30s) sobrevivían. Las pesadas
// conocidas (REFRESH MATERIALIZED VIEW, el overview de /admin/contenido) deben ir a
// getAdminDb() (30s). Este test impide la regresión.
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`)
  if (start === -1) return ''
  const i = src.indexOf('{', start)
  let depth = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(i, j + 1) }
  }
  return src.slice(i)
}

// walk recursivo de .ts bajo un dir (frontend only; el backend NestJS usa su propio cliente)
function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '__tests__') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

describe('queries pesadas fuera del pool de usuario (anti contención RDS)', () => {
  it('refreshTeoriaCatalog corre en getAdminDb, no en getDb', () => {
    const src = readFileSync(join(ROOT, 'lib', 'api', 'laws', 'teoriaCatalog.ts'), 'utf-8')
    const body = fnBody(src, 'refreshTeoriaCatalog')
    expect(body).toMatch(/getAdminDb\(\)/)
    expect(body).not.toMatch(/getDb\(\)/)
  })

  it('getContenidoOverview (página /admin/contenido, CTE pesado) corre en getAdminDb', () => {
    const src = readFileSync(join(ROOT, 'lib', 'api', 'admin-contenido', 'queries.ts'), 'utf-8')
    const body = fnBody(src, 'getContenidoOverview')
    expect(body).toMatch(/getAdminDb\(\)/)
    expect(body).not.toMatch(/const db = getDb\(\)/)
  })

  it('NINGÚN fichero frontend hace REFRESH MATERIALIZED VIEW sobre getDb() (pool de usuario)', () => {
    const files = [...walk(join(ROOT, 'lib')), ...walk(join(ROOT, 'app'))]
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf-8')
      if (/REFRESH MATERIALIZED VIEW/.test(src) && /\bgetDb\(\)/.test(src)) {
        offenders.push(f.replace(ROOT + '/', ''))
      }
    }
    expect(offenders).toEqual([])
  })
})

// Badges/contadores/charts admin que se movieron del pool de usuario a getAdminDb
// (2ª ola del fix, 14/07: daban 500 bajo carga en el pool de usuario / getReadDb).
describe('badges y charts admin en pool admin (no user pool)', () => {
  it.each([
    'lib/api/scope-verification/queries.ts',
    'lib/api/oposiciones/rollover.ts',
    'lib/api/admin-charts/queries.ts',
  ])('%s usa getAdminDb y NO getReadDb (que cae al pool de usuario)', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf-8')
    expect(src).toMatch(/getAdminDb/)
    // no debe IMPORTAR getReadDb desde db/client (cae a getDb con la réplica off)
    expect(src).not.toMatch(/import\s*\{[^}]*\bgetReadDb\b[^}]*\}\s*from\s*['\"]@\/db\/client/)
  })
})
