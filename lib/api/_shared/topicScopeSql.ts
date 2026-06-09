// lib/api/_shared/topicScopeSql.ts
//
// FUENTE ÚNICA de la condición "este artículo cae dentro de un topic_scope".
//
// Convención del modelo de datos: `topic_scope.article_numbers IS NULL` significa
// "toda la ley" (ya respetada por topic-progress, tema-resolver, temario y
// oposiciones-compatibles). Un `= ANY(article_numbers)` suelto NO la respeta:
// en Postgres `x = ANY(NULL)` evalúa a NULL → la fila se descarta → un tema con
// scope "toda la ley" sirve 0 preguntas (bug detectado 2026-06-10, afectaba a
// 283 temas activos sirviendo tests vacíos).
//
// Cualquier query que resuelva scope → artículos DEBE usar este helper en vez de
// reimplementar el `= ANY` a mano, para que la semántica viva en un solo sitio.

import { sql, type SQL } from 'drizzle-orm'

type SqlExpr = SQL | SQL.Aliased | { getSQL: () => SQL }

/**
 * Condición SQL: el `articleNumber` pertenece al scope definido por `articleNumbers`.
 * `articleNumbers IS NULL` ⇒ "toda la ley" (siempre verdadero para artículos de esa ley).
 *
 * @param articleNumber  columna/expr del article_number a comprobar (p.ej. `articles.articleNumber`)
 * @param articleNumbers columna/expr del array `topic_scope.article_numbers`
 *                       (Drizzle column, o `sql.raw('ts.article_numbers')` para un alias)
 */
export function articleInScope(articleNumber: SqlExpr, articleNumbers: SqlExpr): SQL {
  return sql`(${articleNumbers} IS NULL OR ${articleNumber} = ANY(${articleNumbers}))`
}
