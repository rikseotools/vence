/** @jest-environment node */
// __tests__/integration/topicScopeNullCoverage.test.ts
//
// GUARDARRAÍL del bug 2026-06-10: el fetcher de tests filtraba el scope con un
// `article_number = ANY(ts.article_numbers)` sin guarda para NULL. Como en
// Postgres `x = ANY(NULL)` es NULL (descarta la fila), CUALQUIER tema con scope
// "toda la ley" (`article_numbers IS NULL`) servía 0 preguntas. Afectaba a 283
// temas activos sirviendo tests vacíos.
//
// Invariante que se bloquea: NINGÚN tema activo y `disponible` puede resolver a
// 0 preguntas servidas usando la condición canónica de scope (con NULL = toda la
// ley). Si este test falla, o ha vuelto el bug (algún fetcher dejó de usar
// `articleInScope`) o hay un tema disponible sin contenido — ambos son fallos.
//
// CI-safe: se salta si no hay DATABASE_URL (conexión directa Postgres).

import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL

const describeIfDb = hasDb ? describe : describe.skip

describeIfDb('Guardarraíl: cobertura de scope con NULL (toda la ley)', () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })

  afterAll(async () => {
    if (client) await client.end()
  })

  it('ningún tema activo+disponible resuelve a 0 preguntas (NULL = toda la ley honrado)', async () => {
    // Réplica EXACTA de la condición canónica articleInScope():
    //   (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    const { rows } = await client.query<{
      position_type: string
      topic_number: number
      served: number
    }>(`
      SELECT t.position_type, t.topic_number,
        count(DISTINCT q.id)::int AS served
      FROM topics t
      JOIN topic_scope ts ON ts.topic_id = t.id
      JOIN articles a
        ON a.law_id = ts.law_id
       AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
      JOIN questions q
        ON q.primary_article_id = a.id
       AND q.is_active = true
      WHERE t.is_active = true
        AND t.disponible = true
      GROUP BY t.position_type, t.topic_number
      HAVING count(DISTINCT q.id) = 0
    `)

    if (rows.length > 0) {
      const detalle = rows
        .map((r) => `  ${r.position_type} T${r.topic_number}`)
        .join('\n')
      throw new Error(
        `${rows.length} tema(s) activo+disponible sirven 0 preguntas ` +
          `(posible regresión del bug NULL=toda-la-ley o tema sin contenido):\n${detalle}`,
      )
    }

    expect(rows.length).toBe(0)
  }, 30000)

  it('el guard NULL aporta preguntas extra frente al = ANY suelto (la condición vieja serviría menos)', async () => {
    // Confirma que la guarda IS NULL NO es decorativa: hay temas cuyo scope es
    // NULL (toda la ley) y que con el `= ANY` suelto darían 0/menos.
    const { rows } = await client.query<{ buggy: number; canonical: number }>(`
      SELECT
        count(*) FILTER (WHERE buggy = 0 AND canonical > 0)::int AS buggy,
        count(*)::int AS canonical
      FROM (
        SELECT t.id,
          count(DISTINCT q.id) FILTER (
            WHERE a.article_number = ANY(ts.article_numbers)
          ) AS buggy,
          count(DISTINCT q.id) FILTER (
            WHERE ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers)
          ) AS canonical
        FROM topics t
        JOIN topic_scope ts ON ts.topic_id = t.id
        JOIN articles a ON a.law_id = ts.law_id
        JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
        WHERE t.is_active = true AND t.disponible = true
        GROUP BY t.id
      ) s
    `)
    // Debe haber al menos un tema rescatado por la guarda (si no, el escenario
    // del bug ya no existe en datos y el test pierde sentido — lo avisamos).
    expect(rows[0].buggy).toBeGreaterThan(0)
  }, 30000)
})
