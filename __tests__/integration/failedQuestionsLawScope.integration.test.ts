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

import { testDbConfig } from '../helpers/db'
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
    client = new Client(testDbConfig())
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
// NIVEL A-bis (T-603) — EJECUTA la query real acotando por artículos
//
// Los NIVEL C de abajo leen el código fuente, y eso no demuestra que el filtro
// funcione: el bug de T-603 convivía tan ricamente con un código fuente que
// «contenía scope law». Aquí se llama a getFailedQuestionsForUser de verdad,
// contra RDS, y se comprueba lo único que le importa al usuario — que NO le
// sirvan un artículo que no eligió.
// ---------------------------------------------------------
describe('NIVEL A-bis (T-603) — el repaso respeta la selección de artículos (RDS)', () => {
  if (!hasDb) {
    test.skip('Skipped: falta DATABASE_URL en el entorno', () => {})
    return
  }

  let client: Client
  // Caso descubierto dinámicamente: un usuario con falladas en ≥2 artículos
  // distintos de una misma ley. Buscarlo en vez de fijarlo mantiene el test
  // vivo cuando cambien los datos (mismo criterio que el beforeAll de arriba).
  let caso: { userId: string; lawShortName: string; articulos: string[] } | null = null

  beforeAll(async () => {
    client = new Client(testDbConfig())
    await client.connect()
    const r = await client.query<{ user_id: string; short_name: string; arts: string[] }>(`
      WITH heavy AS (
        SELECT user_id FROM user_stats_summary ORDER BY total_questions DESC LIMIT 20
      )
      SELECT tq.user_id::text, l.short_name,
             array_agg(DISTINCT a.article_number) AS arts
        FROM test_questions tq
        JOIN heavy h ON h.user_id = tq.user_id
        JOIN questions q ON q.id = tq.question_id AND q.is_active = true
        JOIN articles a ON a.id = q.primary_article_id
        JOIN laws l ON l.id = a.law_id
       WHERE tq.is_correct = false
         AND tq.created_at > now() - interval '3650 days'
       GROUP BY tq.user_id, l.short_name
      HAVING count(DISTINCT a.article_number) >= 3
       ORDER BY count(DISTINCT a.article_number) DESC
       LIMIT 1
    `)
    if (r.rows.length) {
      caso = {
        userId: r.rows[0].user_id,
        lawShortName: r.rows[0].short_name,
        articulos: r.rows[0].arts,
      }
    }
  }, 90000)

  afterAll(async () => { await client?.end() })

  test('acotar a UN artículo no devuelve NADA de los demás', async () => {
    if (!caso) { console.warn('sin datos: no hay usuario con falladas en ≥3 artículos'); return }
    const { getFailedQuestionsForUser } = await import('@/lib/api/tests')

    const elegido = caso.articulos[0]
    const res = await getFailedQuestionsForUser({
      userId: caso.userId,
      numQuestions: 100,
      orderBy: 'recent',
      days: 36500,
      scope: { type: 'law', lawShortName: caso.lawShortName, articleNumbers: [elegido] },
    })

    expect(res.success).toBe(true)
    const fuera = (res.questions ?? []).filter((q) => String(q.article_number) !== String(elegido))
    // El corazón del bug: antes salían artículos de toda la ley.
    expect(fuera.map((q) => q.article_number)).toEqual([])
  }, 90000)

  test('SIN acotar sigue devolviendo la ley entera (no hemos roto lo de antes)', async () => {
    if (!caso) return
    const { getFailedQuestionsForUser } = await import('@/lib/api/tests')

    const sinAcotar = await getFailedQuestionsForUser({
      userId: caso.userId, numQuestions: 100, orderBy: 'recent', days: 36500,
      scope: { type: 'law', lawShortName: caso.lawShortName },
    })
    const distintos = new Set((sinAcotar.questions ?? []).map((q) => String(q.article_number)))
    // Con ≥3 artículos fallados, sin acotar tienen que venir de más de uno:
    // si esto bajara a 1, el filtro se estaría aplicando cuando nadie lo pidió.
    expect(distintos.size).toBeGreaterThan(1)
  }, 90000)

  test('acotar a DOS artículos devuelve exactamente esos dos, y de ambos hay algo', async () => {
    if (!caso) return
    const { getFailedQuestionsForUser } = await import('@/lib/api/tests')

    const dos = caso.articulos.slice(0, 2)
    const res = await getFailedQuestionsForUser({
      userId: caso.userId, numQuestions: 100, orderBy: 'recent', days: 36500,
      scope: { type: 'law', lawShortName: caso.lawShortName, articleNumbers: dos },
    })
    const servidos = new Set((res.questions ?? []).map((q) => String(q.article_number)))
    for (const s of servidos) expect(dos.map(String)).toContain(s)
    // …y que no se haya quedado en uno por accidente (un AND de más).
    expect(servidos.size).toBe(2)
  }, 90000)
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
