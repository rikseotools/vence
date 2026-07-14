// Guardarraíl (fix contención RDS 14/07): los badges de conteo del nav admin se
// pollean por cada admin. Deben (a) correr en el pool ADMIN (getAdminDb), no en el
// de usuario (getDb) que es el hot path, y (b) usar una query DEDICADA barata, no
// reusar agregaciones pesadas. Verifica POR FUENTE que no se regresa a ninguno de
// los dos anti-patrones (los que causaron los 5xx de contenido/competidores).
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..', '..')
const contenido = readFileSync(join(ROOT, 'lib', 'api', 'admin-contenido', 'queries.ts'), 'utf-8')
const competitors = readFileSync(join(ROOT, 'lib', 'api', 'competitors', 'queries.ts'), 'utf-8')

// quita comentarios (// y /* */) para no matchear menciones en prosa
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

// extrae el cuerpo (SIN comentarios) de `export async function NAME(...) { ... }`
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`)
  if (start === -1) return ''
  const i = src.indexOf('{', start)
  let depth = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') { depth--; if (depth === 0) return stripComments(src.slice(i, j + 1)) }
  }
  return stripComments(src.slice(i))
}

describe('badge contenido/count — query dedicada en pool admin (anti contención RDS)', () => {
  const body = fnBody(contenido, 'getContenidoCount')

  it('existe la función', () => {
    expect(body.length).toBeGreaterThan(0)
  })

  it('corre en getAdminDb (pool admin), NO en getDb (pool de usuario)', () => {
    expect(body).toMatch(/getAdminDb\(\)/)
    expect(body).not.toMatch(/getDb\(\)/)
  })

  it('NO reusa getContenidoOverview (el CTE pesado de 5 sub-agregaciones)', () => {
    expect(body).not.toMatch(/getContenidoOverview/)
  })

  it('cuenta con la semántica exacta del overview: disponible + 0 preguntas', () => {
    // debe filtrar por disponible (temas publicados) y por 0 preguntas vía la MV
    expect(body).toMatch(/t\.disponible/)
    expect(body).toMatch(/topic_law_question_summary/)
  })
})

describe('badge competidores/changes-count — pool admin (anti contención RDS)', () => {
  const body = fnBody(competitors, 'getCompetitorChangesCount')

  it('existe la función', () => {
    expect(body.length).toBeGreaterThan(0)
  })

  it('corre en getAdminDb (pool admin), NO en getDb (pool de usuario)', () => {
    expect(body).toMatch(/getAdminDb\(\)/)
    expect(body).not.toMatch(/getDb\(\)/)
  })
})
