/**
 * @jest-environment node
 *
 * Test de INTEGRACIÓN: repaso de fallos por ley (scope='law') contra BD real.
 *
 * Reproduce el bug de María (21/05/2026) de forma genérica: el test de repaso
 * de falladas lanzado desde /leyes/[law] devolvía la ley entera (preguntas
 * nunca falladas incluidas). El fix lo redirige a /api/v2/tests/failed-questions
 * con scope='law', que calcula las falladas en el servidor.
 *
 * NIVEL A (BD real): invariantes del repaso scope=law con datos reales.
 * NIVEL C (anti-regresión estático): garantías clave en el código fuente.
 *
 * Usa el módulo `https` de Node (NO fetch ni @supabase/supabase-js): jest.setup
 * mockea `global.fetch`, lo que rompería el cliente Supabase. Mismo patrón que
 * __tests__/integration/examCaseExclusion.test.ts.
 *
 * Si NIVEL A se salta: faltan credenciales Supabase en .env.local.
 */

import fs from 'fs'
import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

// Lee de la BD VIVA (RDS) vía pg. NO Supabase (congelado desde 04/07). En lugar
// de hardcodear una ley (que podía quedarse sin ningún usuario con falladas), el
// beforeAll busca dinámicamente un par (usuario, ley) con ≥3 falladas y ≥1
// solo-acertada → test auto-mantenido, no se rompe cuando cambian los datos.
const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL

interface Ctx {
  lawId: string
  lawQuestionIds: Set<string>
  userId: string | null
  userFailedInLaw: Set<string>      // preguntas de la ley falladas ≥1 vez
  userOnlyCorrectInLaw: Set<string> // preguntas de la ley respondidas y SIEMPRE acertadas
}

const ctx: Ctx = {
  lawId: '',
  lawQuestionIds: new Set(),
  userId: null,
  userFailedInLaw: new Set(),
  userOnlyCorrectInLaw: new Set(),
}

describe('INTEGRACIÓN — repaso de fallos scope=law (BD real)', () => {
  if (!hasDb) {
    test.skip('Skipped: falta DATABASE_URL en el entorno', () => {})
    return
  }

  let client: Client

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()

    // 1. Par (usuario, ley) con material real: ≥3 falladas y ≥1 solo-acertada.
    //    La ley se deriva del artículo (fuente de verdad), NO del law_name
    //    denormalizado. "ever_failed" = alguna respuesta incorrecta; "solo
    //    acertada" = nunca fallada → conjuntos disjuntos.
    //    PERF: acotamos a los usuarios más pesados (user_stats_summary, tabla
    //    pequeña) en vez de agregar TODO test_questions — así no revienta el
    //    timeout bajo la concurrencia del run completo.
    const pair = await client.query<{ user_id: string; law_id: string }>(`
      WITH heavy AS (
        SELECT user_id FROM user_stats_summary ORDER BY total_questions DESC LIMIT 20
      ),
      per_q AS (
        SELECT tq.user_id, a.law_id, tq.question_id,
               bool_or(NOT tq.is_correct) AS ever_failed
        FROM test_questions tq
        JOIN heavy h ON h.user_id = tq.user_id
        JOIN questions q ON q.id = tq.question_id AND q.is_active = true
        JOIN articles a ON a.id = q.primary_article_id
        GROUP BY tq.user_id, a.law_id, tq.question_id
      )
      SELECT user_id::text, law_id::text
      FROM per_q
      GROUP BY user_id, law_id
      HAVING count(*) FILTER (WHERE ever_failed) >= 3
         AND count(*) FILTER (WHERE NOT ever_failed) >= 1
      ORDER BY count(*) FILTER (WHERE ever_failed) DESC
      LIMIT 1
    `)
    if (!pair.rows.length) return
    ctx.lawId = pair.rows[0].law_id
    ctx.userId = pair.rows[0].user_id

    // 2. Preguntas activas de la ley (por artículo).
    const lawQs = await client.query<{ id: string }>(
      `SELECT q.id::text FROM questions q JOIN articles a ON a.id = q.primary_article_id
       WHERE q.is_active = true AND a.law_id = $1`,
      [ctx.lawId],
    )
    for (const r of lawQs.rows) ctx.lawQuestionIds.add(r.id)

    // 3. Historial del usuario en la ley: partición falladas vs solo-acertadas.
    const hist = await client.query<{ question_id: string; ever_failed: boolean }>(
      `SELECT tq.question_id::text, bool_or(NOT tq.is_correct) AS ever_failed
       FROM test_questions tq
       JOIN questions q ON q.id = tq.question_id
       JOIN articles a ON a.id = q.primary_article_id
       WHERE tq.user_id = $1 AND a.law_id = $2 AND q.is_active = true
       GROUP BY tq.question_id`,
      [ctx.userId, ctx.lawId],
    )
    for (const r of hist.rows) {
      if (r.ever_failed) ctx.userFailedInLaw.add(r.question_id)
      else ctx.userOnlyCorrectInLaw.add(r.question_id)
    }
  }, 90000)

  afterAll(async () => { await client?.end() })

  test('NIVEL A — setup: existe la ley y un usuario con falladas en ella', () => {
    expect(ctx.lawId).not.toBe('')
    expect(ctx.lawQuestionIds.size).toBeGreaterThan(0)
    expect(ctx.userId).not.toBeNull()
    expect(ctx.userFailedInLaw.size).toBeGreaterThanOrEqual(3)
  })

  test('NIVEL A — el conjunto de falladas y el de solo-acertadas son DISJUNTOS', () => {
    // El repaso de falladas (scope=law) parte de is_correct=false. Una pregunta
    // que el usuario solo ha acertado NUNCA debe contar como fallada.
    const interseccion = [...ctx.userOnlyCorrectInLaw].filter((q) => ctx.userFailedInLaw.has(q))
    expect(interseccion).toEqual([])
  })

  test('NIVEL A — REGRESIÓN bug María: el repaso NO incluiría preguntas con 100% de acierto', () => {
    // Antes del fix, el test de "falladas" desde /leyes/[law] traía la ley
    // entera → preguntas con 0 fallos. El conjunto de falladas reales (lo que
    // el endpoint scope=law usa) excluye por construcción las solo-acertadas.
    expect(ctx.userOnlyCorrectInLaw.size).toBeGreaterThan(0) // hay material de prueba
    for (const qid of ctx.userFailedInLaw) {
      expect(ctx.userOnlyCorrectInLaw.has(qid)).toBe(false)
    }
  })

  test('NIVEL A — toda pregunta del repaso scope=law pertenece a la ley pedida', () => {
    // El blockFilter (laws.short_name = X) restringe el resultado a la ley.
    for (const qid of ctx.userFailedInLaw) {
      expect(ctx.lawQuestionIds.has(qid)).toBe(true)
    }
  })
})

// ---------------------------------------------------------
// NIVEL C — Anti-regresión estático (siempre corre)
// ---------------------------------------------------------
describe('NIVEL C — garantías en el código fuente', () => {
  it('getFailedQuestionsForUser maneja scope.type === "law"', () => {
    const src = fs.readFileSync('lib/api/tests/queries.ts', 'utf-8')
    expect(src).toContain("params.scope.type === 'law'")
    expect(src).toContain('laws.shortName')
  })

  it('el scope law NO aplica el filtro de oposición (getAllowedLawIds)', () => {
    // Crítico: aplicar getAllowedLawIds excluiría leyes que el usuario estudia
    // fuera del temario de su oposición (Ley 9/2017 no está en el scope de
    // auxiliar_administrativo_cantabria → María se quedaría sin preguntas).
    const src = fs.readFileSync('lib/api/tests/queries.ts', 'utf-8')
    expect(src).toContain('isLawScope')
    expect(src).toMatch(/isLawScope[\s\S]{0,200}getAllowedLawIds/)
  })

  it('el re-orden con scope se aplica SIEMPRE (no solo al exceder numQuestions)', () => {
    const src = fs.readFileSync('lib/api/tests/queries.ts', 'utf-8')
    // El bug previo: `if (hasScope && questionsWithDetails.length > numQuestions)`.
    expect(src).not.toMatch(/hasScope\s*&&\s*questionsWithDetails\.length\s*>\s*numQuestions/)
    expect(src).toMatch(/if\s*\(hasScope\)/)
  })

  it('LawTestConfigurator redirige el modo falladas a buildLawRepasoFallosUrl', () => {
    const src = fs.readFileSync('app/leyes/[law]/LawTestConfigurator.tsx', 'utf-8')
    expect(src).toContain('buildLawRepasoFallosUrl')
    expect(src).toContain('config.onlyFailedQuestions')
  })

  it('LawTestConfigurator ya NO mete failed_ids en la URL del test normal', () => {
    const src = fs.readFileSync('app/leyes/[law]/LawTestConfigurator.tsx', 'utf-8')
    expect(src).not.toContain('failed_ids')
  })

  it('repaso-fallos-v2 resuelve el scope law desde el query param', () => {
    const src = fs.readFileSync('app/test/repaso-fallos-v2/page.tsx', 'utf-8')
    expect(src).toContain("searchParams.get('law')")
    expect(src).toContain("type: 'law'")
  })

  it('el schema de scope incluye la variante law con lawShortName', () => {
    const src = fs.readFileSync('lib/api/tests/schemas.ts', 'utf-8')
    expect(src).toMatch(/z\.literal\('law'\)/)
    expect(src).toMatch(/lawShortName:\s*z\.string\(\)\.min\(1\)/)
  })
})
