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

/**
 * EXISTS correlado: el artículo `(lawId, articleNumber)` pertenece a ALGÚN
 * `topic_scope` del `positionType` (opcionalmente acotado a un `topicNumber`).
 *
 * FUENTE ÚNICA del "scope por artículo a nivel de oposición". La pertenencia
 * por artículo delega en {@link articleInScope}, por lo que respeta
 * `article_numbers IS NULL` = "toda la ley" (ley virtual). Pensado para
 * incrustarse como condición en el WHERE de queries que sirven preguntas:
 *   - modo global de /api/questions/filtered (Test Rápido / aleatorio sin tema)
 *   - repaso de falladas con scope de oposición
 *
 * Referencia `topic_scope`/`topics` por nombre crudo (alias ts/t) porque vive
 * dentro de un EXISTS correlacionado con la query externa. Plan verificado sin
 * Seq Scan sobre `articles` (la externa ya viene podada por law_id + joins).
 *
 * @param lawId         expr del law_id del artículo externo (p.ej. `articles.lawId`)
 * @param articleNumber expr del article_number externo (p.ej. `articles.articleNumber`)
 * @param positionType  position_type de la oposición
 * @param topicNumber   si se pasa y es > 0, acota además a ese tema concreto
 */
export function articleInPositionScopeExists(opts: {
  lawId: SqlExpr
  articleNumber: SqlExpr
  positionType: string
  topicNumber?: number | null
}): SQL {
  const topicCond =
    opts.topicNumber && opts.topicNumber > 0
      ? sql`AND t.topic_number = ${opts.topicNumber}`
      : sql``
  return sql`EXISTS (
    SELECT 1
    FROM topic_scope ts
    INNER JOIN topics t ON t.id = ts.topic_id
    WHERE t.position_type = ${opts.positionType}
      AND ts.law_id = ${opts.lawId}
      ${topicCond}
      AND ${articleInScope(opts.articleNumber, sql`ts.article_numbers`)}
  )`
}
