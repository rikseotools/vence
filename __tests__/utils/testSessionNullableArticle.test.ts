// Guardarrail (bug 07-12/07/2026): el questionSchema de createDetailedTestSession usaba
// primary_article_id: z.string().optional() → rechazaba el null EXPLÍCITO que mandan
// /test/articulo y /test/repaso-fallos ("expected string, received null") → la sesión
// detallada NO se creaba (38 fallos, analítica perdida en silencio). Fix: .nullish()
// (nullable + optional). Este test verifica por fuente que el campo tolera null.
import { readFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'

const src = readFileSync(join(__dirname, '..', '..', 'utils', 'testSession.ts'), 'utf-8')

describe('testSession — primary_article_id tolera null (bug /test/articulo)', () => {
  it('el schema NO usa z.string().optional() a secas para primary_article_id (rechazaría null)', () => {
    expect(src).not.toMatch(/primary_article_id:\s*z\.string\(\)\.optional\(\)\s*,/)
  })

  it('usa nullish/nullable en primary_article_id (acepta null explícito)', () => {
    expect(src).toMatch(/primary_article_id:\s*z\.string\(\)\.(nullish|nullable)/)
  })

  it('comportamiento: un schema equivalente acepta null, undefined y string', () => {
    // réplica mínima del campo arreglado
    const field = z.object({ primary_article_id: z.string().nullish() }).passthrough()
    expect(field.safeParse({ primary_article_id: null }).success).toBe(true)      // el caso que fallaba
    expect(field.safeParse({}).success).toBe(true)                                // undefined
    expect(field.safeParse({ primary_article_id: 'a1' }).success).toBe(true)      // string
    expect(field.safeParse({ primary_article_id: 123 }).success).toBe(false)      // sigue rechazando basura
  })
})

describe('/test/articulo — el transform pobla primary_article_id (no lo tira)', () => {
  const page = readFileSync(join(__dirname, '..', '..', 'app', 'test', 'articulo', 'page.tsx'), 'utf-8')

  it('NO hardcodea primary_article_id: null (perdía la atribución al artículo)', () => {
    expect(page).not.toMatch(/primary_article_id:\s*null\s*,/)
  })

  it('usa el id REAL que devuelve la API (q.primary_article_id)', () => {
    expect(page).toMatch(/primary_article_id:\s*q\.primary_article_id/)
  })
})
