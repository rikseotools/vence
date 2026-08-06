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
/**
 * ¿Hay que ACOTAR al temario, o hay que DEGRADAR?
 *
 * Decisión pura, y vive aquí porque es la misma en los dos caminos que sirven o cuentan
 * preguntas. Hasta el 04/08 solo existía dentro de `filtered-questions` (como el `null` de
 * `scopedNumbersFor`) y el contador del configurador **no la tenía**: añadía el EXISTS de
 * {@link articleInPositionScopeExists} como condición dura, así que una oposición sin temario
 * construido contaba **0 en todas sus leyes** y el botón de empezar se quedaba en gris… mientras
 * el test, si hubiera podido lanzarse, servía preguntas de sobra.
 *
 * Caso que lo destapó ([T-551], feedback `a99d3fec`): Félix Peña, premium, oposición
 * `cuerpo_superior_de_la_administracion_castilla_y_leon_bocyl` (0 temas, 0 filas de `topic_scope`).
 * Su combinación guardada tenía **1.283 preguntas** y el contador le decía **0**.
 *
 * La regla es la que ya aprendió el camino del test con el incidente Alfonso (11/07): **no se
 * interseca contra vacío**. Si la oposición no tiene NINGUNA fila de scope para esa ley, se
 * respeta lo que el usuario pidió explícitamente; y si no pidió artículos, la ley entera. Nunca
 * un cero silencioso.
 *
 * @param tieneScopeDeLaLey ¿existe ALGUNA fila de topic_scope de esa oposición para esa ley?
 * @param haySeleccionManual ¿el usuario eligió artículos concretos de esa ley?
 */
export function decidirAlcanceDeLey(opts: {
  acotarAlTemario: boolean
  tieneScopeDeLaLey: boolean
  haySeleccionManual: boolean
}): 'ley_entera' | 'seleccion_del_usuario' | 'interseccion_con_temario' | 'temario' {
  if (!opts.acotarAlTemario) {
    return opts.haySeleccionManual ? 'seleccion_del_usuario' : 'ley_entera'
  }
  if (!opts.tieneScopeDeLaLey) {
    // DEGRADACIÓN: sin temario para esta ley, intersecar daría 0.
    return opts.haySeleccionManual ? 'seleccion_del_usuario' : 'ley_entera'
  }
  return opts.haySeleccionManual ? 'interseccion_con_temario' : 'temario'
}

/** ¿Se ha degradado, es decir, se pidió acotar y no se pudo? Útil para observarlo. */
export function esDegradacion(opts: {
  acotarAlTemario: boolean
  tieneScopeDeLaLey: boolean
}): boolean {
  return opts.acotarAlTemario && !opts.tieneScopeDeLaLey
}

/**
 * ¿Tiene esa oposición ALGUNA fila de `topic_scope` para esa ley?
 *
 * Query compartida por los dos caminos, para que «sin temario» signifique lo mismo en el
 * contador y en el test. `db` se inyecta para no acoplar este módulo a un cliente concreto.
 */
export async function positionHasScopeForLaw(
  db: { execute: (q: SQL) => Promise<unknown> },
  opts: { positionType: string; lawId: string },
): Promise<boolean> {
  const res = (await db.execute(sql`
    SELECT 1
    FROM topic_scope ts
    INNER JOIN topics t ON t.id = ts.topic_id
    WHERE t.position_type = ${opts.positionType}
      AND ts.law_id = ${opts.lawId}
    LIMIT 1
  `)) as { rows?: unknown[] } | unknown[]
  const rows = Array.isArray(res) ? res : (res?.rows ?? [])
  return rows.length > 0
}

/**
 * La MISMA pertenencia que {@link articleInScope}, pero en JS y sobre datos ya en memoria.
 *
 * Por qué existe (T-607, 06/08/2026): comprobar si lo que ACABAMOS de servir cae dentro del
 * temario solo se puede hacer **en el momento de servir**. Medirlo después no vale — y no es una
 * opinión: T-583 dio por fuga 73 servidas de las que 46 eran legítimas, y al re-medirlo bien
 * quedaban 33 que tampoco lo demostraban, porque la consulta comparaba servidas del PASADO contra
 * el scope y el vínculo de HOY. Si a una pregunta le cambian el `primary_article_id` o alguien
 * recorta un `topic_scope`, una servida perfectamente correcta aparece «fuera de scope» meses
 * después. La prueba: la pregunta del art. 9 de la Ley 7/2023 de Galicia figuraba servida en
 * cuatro oposiciones donde el modo tema NO puede servirla, porque fija la ley en el WHERE.
 *
 * Función PURA a propósito: el juicio se puede probar sin BD, y el que sirve no paga una query.
 *
 * ⚠️ Espeja `articleInScope`, así que las dos tienen que decir lo mismo: `articleNumbers` a
 * `null`/`undefined` es **toda la ley**, no «ninguno». Un array vacío es una fila inerte y no
 * aporta nada (misma convención que el modo tema).
 */
export function fueraDeScope<T extends { lawId: string | null; articleNumber: string | null }>(
  servidas: T[],
  scope: Array<{ lawId: string | null; articleNumbers: string[] | null }>,
): T[] {
  // Índice por ley: `null` = toda la ley gana sobre cualquier lista de esa misma ley (una
  // oposición puede escopar la ley entera en un tema y unos artículos sueltos en otro).
  const porLey = new Map<string, Set<string> | null>()
  for (const fila of scope) {
    if (!fila.lawId) continue
    if (fila.articleNumbers === null || fila.articleNumbers === undefined) {
      porLey.set(fila.lawId, null)
      continue
    }
    const actual = porLey.get(fila.lawId)
    if (actual === null) continue // ya es "toda la ley": no se puede acotar
    const set = actual ?? new Set<string>()
    for (const n of fila.articleNumbers) set.add(n)
    porLey.set(fila.lawId, set)
  }

  return servidas.filter((q) => {
    if (!q.lawId || q.articleNumber === null || q.articleNumber === undefined) return false
    if (!porLey.has(q.lawId)) return true // la ley entera está fuera del temario
    const permitidos = porLey.get(q.lawId)
    if (!permitidos) return false // `null` = toda la ley (y `undefined` no puede darse: has() lo cubre)
    return !permitidos.has(q.articleNumber)
  })
}

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
