/**
 * @jest-environment node
 */
// __tests__/integration/articlesDuplicateLawScope.integration.test.ts
//
// Regresión del bug "selector artículo por artículo todo en GRIS" (Marta,
// aux-admin Madrid T13, LO 1/2004, 17/07). Causa: `laws.short_name` DUPLICADO
// (una fila poblada + una vacía). `getArticlesForLaw` resolvía el law_id por
// short_name con LIMIT 1 sin tie-break → podía coger la fila VACÍA → cada
// artículo del scope reportaba question_count 0 → todos en gris, pese a que la
// ley del topic_scope SÍ tiene preguntas.
//
// INVARIANTE que fija este test (contra RDS): para CUALQUIER (tema, ley) cuya
// ley del topic_scope tenga preguntas activas, `getArticlesForLaw` NO puede
// devolver todos los artículos con question_count 0. En particular para las
// leyes con short_name duplicado.
import dotenv from 'dotenv'
import { getArticlesForLaw } from '@/lib/api/test-config'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

describeIfDb('getArticlesForLaw — leyes con short_name duplicado no salen en gris (RDS)', () => {
  test('caso Marta: LO 1/2004 en aux-admin Madrid T13 → artículos con preguntas (no gris)', async () => {
    const res = await getArticlesForLaw({
      lawShortName: 'LO 1/2004',
      topicNumber: 13,
      positionType: 'auxiliar_administrativo_madrid',
      includeOfficialCount: false,
    } as never)

    expect(res.success).toBe(true)
    expect(res.articles!.length).toBeGreaterThan(0)
    const conQ = res.articles!.filter((a) => a.question_count > 0).length
    // El corazón del bug: antes conQ === 0 (todos en gris). Ahora TODOS los
    // artículos del scope de LO 1/2004 tienen preguntas.
    expect(conQ).toBe(res.articles!.length)
  }, 60000)

  test('INVARIANTE global: ninguna (tema, ley-duplicada) con preguntas en el scope sale toda en gris', async () => {
    const db = getDb()
    // Filas de topic_scope cuya ley tiene short_name duplicado Y la ley del
    // scope tiene preguntas activas → getArticlesForLaw NO debe devolver 0.
    const rows = await db.execute<{
      position_type: string
      topic_number: number
      short_name: string
      scope_active_q: number
    }>(sql`
      SELECT DISTINCT t.position_type, t.topic_number, l.short_name,
             (SELECT count(*) FROM questions q JOIN articles a ON q.primary_article_id = a.id
              WHERE a.law_id = ts.law_id AND q.is_active)::int AS scope_active_q
      FROM topic_scope ts
      JOIN topics t ON t.id = ts.topic_id
      JOIN laws l ON l.id = ts.law_id
      WHERE l.short_name IN (SELECT short_name FROM laws GROUP BY short_name HAVING count(*) > 1)
      ORDER BY 1, 2`)

    const withQuestions = (rows as unknown as any[]).filter((r) => r.scope_active_q > 0)
    expect(withQuestions.length).toBeGreaterThan(0) // sanity: hay casos que ejercitar

    const greyedOut: string[] = []
    for (const r of withQuestions) {
      const res = await getArticlesForLaw({
        lawShortName: r.short_name,
        topicNumber: r.topic_number,
        positionType: r.position_type,
        includeOfficialCount: false,
      } as never)
      const total = (res.articles || []).reduce((s, a) => s + (a.question_count || 0), 0)
      if (res.success && (res.articles?.length ?? 0) > 0 && total === 0) {
        greyedOut.push(`${r.position_type} T${r.topic_number} · ${r.short_name} (scopeQ=${r.scope_active_q})`)
      }
    }

    if (greyedOut.length) {
      throw new Error(
        `Selector artículo por artículo TODO EN GRIS pese a haber preguntas en el scope (${greyedOut.length}):\n` +
          greyedOut.map((s) => `  - ${s}`).join('\n'),
      )
    }
  }, 180000)
})
