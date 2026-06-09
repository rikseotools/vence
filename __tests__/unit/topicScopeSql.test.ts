// __tests__/unit/topicScopeSql.test.ts
// Bloquea la semántica de la fuente única de resolución de topic_scope:
// `article_numbers IS NULL` = "toda la ley". Sin la guarda IS NULL, un
// `x = ANY(NULL)` evalúa a NULL y descarta los scopes de ley completa
// (bug 2026-06-10: 283 temas activos servían tests vacíos).

import { sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { articleInScope } from '@/lib/api/_shared/topicScopeSql'

const render = (frag: ReturnType<typeof articleInScope>) =>
  new PgDialect().sqlToQuery(frag).sql

describe('articleInScope — resolución canónica de topic_scope', () => {
  it('renderiza la guarda IS NULL + el = ANY exactamente', () => {
    const out = render(
      articleInScope(sql.raw('a.article_number'), sql.raw('ts.article_numbers')),
    )
    expect(out).toBe(
      '(ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))',
    )
  })

  it('SIEMPRE incluye la guarda IS NULL (que un = ANY suelto omite)', () => {
    const out = render(articleInScope(sql.raw('x'), sql.raw('y')))
    expect(out).toContain('IS NULL')
    expect(out).toContain('= ANY(')
  })
})
