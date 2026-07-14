// Guardarraíl (fix contención RDS 14/07): el POOL DE USUARIO (createDbClient/getDb)
// debe tener statement_timeout BAJO (≈10s), NO 30s. El mecanismo del incidente fue:
// withDbTimeout devuelve 503 a los 8s, pero postgres-js NO cancela la query → el slot
// del pool (max:5) quedaba ocupado hasta el statement_timeout=30s → bajo carga el pool
// se agotaba y disparaba 503 en cascada. Con 10s el slot se libera ~2s tras el timeout
// de request. Este test impide que se regrese a 30s en el pool de usuario.
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const clientSrc = readFileSync(join(ROOT, 'db', 'client.ts'), 'utf-8')

// extrae el cuerpo de `function NAME(...) { ... }` (sin export para createDbClient)
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

describe('pool de usuario (createDbClient) — statement_timeout bajo (anti contención RDS)', () => {
  const body = fnBody(clientSrc, 'function createDbClient')

  it('existe la función', () => {
    expect(body.length).toBeGreaterThan(0)
  })

  it('el statement_timeout del pool de usuario es ≤ 12s (no 30s)', () => {
    const matches = [...body.matchAll(/statement_timeout=(\d+)/g)].map((m) => parseInt(m[1], 10))
    expect(matches.length).toBeGreaterThan(0)
    for (const ms of matches) {
      expect(ms).toBeLessThanOrEqual(12000)
    }
  })

  it('NO usa statement_timeout=30000 en el pool de usuario', () => {
    expect(body).not.toMatch(/statement_timeout=30000/)
  })

  it('sigue estando por encima del withDbTimeout (8s) para no preemptar queries legítimas', () => {
    const matches = [...body.matchAll(/statement_timeout=(\d+)/g)].map((m) => parseInt(m[1], 10))
    for (const ms of matches) {
      expect(ms).toBeGreaterThanOrEqual(9000)
    }
  })
})
