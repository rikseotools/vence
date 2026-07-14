// Guardarraíl (incidente 14/07): el POOL DE USUARIO (createDbClient/getDb) NO debe
// tener un statement_timeout DEMASIADO BAJO. Se intentó bajarlo a 10s para liberar
// slots antes, pero abortó queries user-facing LEGÍTIMAS y pesadas que corren en este
// pool vía getReadDb() (fallback a getDb con la réplica off) — p.ej. /api/oposiciones/
// catalog pasó de 0 a 10 http_5xx. Se revirtió a 30s. La lección: el slot-hold se ataca
// moviendo las queries PESADAS a getAdminDb (ver heavyQueriesOffUserPool), NO recortando
// el timeout global del hot path. Este test impide re-introducir ese recorte agresivo.
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const clientSrc = readFileSync(join(ROOT, 'db', 'client.ts'), 'utf-8')

function fnBody(src: string, decl: string): string {
  const start = src.indexOf(decl)
  if (start === -1) return ''
  const i = src.indexOf('{', start)
  let depth = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(i, j + 1) }
  }
  return src.slice(i)
}

describe('pool de usuario (createDbClient) — statement_timeout NO demasiado bajo (incidente 14/07)', () => {
  const body = fnBody(clientSrc, 'function createDbClient')

  it('existe la función', () => {
    expect(body.length).toBeGreaterThan(0)
  })

  it('el statement_timeout del pool de usuario es ≥ 20s (NO se re-baja al agresivo 10s que rompió user-facing)', () => {
    const matches = [...body.matchAll(/statement_timeout=(\d+)/g)].map((m) => parseInt(m[1], 10))
    expect(matches.length).toBeGreaterThan(0)
    for (const ms of matches) {
      // ≥20s: por encima del techo de queries user-facing pesadas legítimas (catalog, etc.)
      expect(ms).toBeGreaterThanOrEqual(20000)
    }
  })
})
