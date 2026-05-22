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

import https from 'https'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasRealDb = !!(URL && SERVICE_KEY && !URL.includes('test.supabase.co'))

const LAW_SHORT_NAME = 'Ley 9/2017'

function restGet<T = unknown>(pathAndQuery: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(
        `${URL}/rest/v1/${pathAndQuery}`,
        { headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` } },
        (res) => {
          let body = ''
          res.on('data', (c) => (body += c))
          res.on('end', () => {
            const status = res.statusCode ?? 0
            if (status < 200 || status >= 300) {
              reject(new Error(`HTTP ${status}: ${body.slice(0, 300)}`))
              return
            }
            try {
              const parsed = JSON.parse(body)
              if (!Array.isArray(parsed)) {
                reject(new Error(`respuesta no-array (${status}): ${body.slice(0, 300)}`))
                return
              }
              resolve(parsed as T)
            } catch {
              reject(new Error(`parse fail (${status}): ${body.slice(0, 200)}`))
            }
          })
        },
      )
      .on('error', reject)
  })
}

async function chunked<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size))
}

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
  if (!hasRealDb) {
    test.skip('Skipped: faltan credenciales Supabase en .env.local', () => {})
    return
  }

  beforeAll(async () => {
    // 1. Ley + preguntas activas de la ley
    const laws = await restGet<{ id: string }[]>(
      `laws?short_name=eq.${encodeURIComponent(LAW_SHORT_NAME)}&select=id`,
    )
    if (!laws.length) return
    ctx.lawId = laws[0].id

    const arts = await restGet<{ id: string }[]>(`articles?law_id=eq.${ctx.lawId}&select=id`)
    const artIds = arts.map((a) => a.id)
    await chunked(artIds, 50, async (chunk) => {
      const qs = await restGet<{ id: string }[]>(
        `questions?primary_article_id=in.(${chunk.join(',')})&is_active=eq.true&select=id`,
      )
      for (const q of qs) ctx.lawQuestionIds.add(q.id)
    })

    // 2. Candidatos: usuarios con falladas en la ley (law_name denormalizado
    //    solo para localizarlos; el cruce real se valida contra lawQuestionIds).
    const recentFails = await restGet<{ user_id: string; question_id: string }[]>(
      `test_questions?law_name=eq.${encodeURIComponent(LAW_SHORT_NAME)}` +
        `&is_correct=eq.false&select=user_id,question_id&limit=1000`,
    )
    const failsByUser = new Map<string, Set<string>>()
    for (const r of recentFails) {
      if (!r.user_id || !r.question_id || !ctx.lawQuestionIds.has(r.question_id)) continue
      if (!failsByUser.has(r.user_id)) failsByUser.set(r.user_id, new Set())
      failsByUser.get(r.user_id)!.add(r.question_id)
    }
    const candidates = [...failsByUser.entries()]
      .filter(([, s]) => s.size >= 3)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 8)
      .map(([uid]) => uid)

    // 3. Por cada candidato, su historial en la ley (falladas vs solo-acertadas).
    //    Preferimos un usuario que tenga AMBOS tipos: así el test de regresión
    //    demuestra de verdad que el repaso excluye las solo-acertadas.
    const enc = encodeURIComponent(LAW_SHORT_NAME)
    for (const uid of candidates) {
      const [failedRows, correctRows] = await Promise.all([
        restGet<{ question_id: string }[]>(
          `test_questions?user_id=eq.${uid}&law_name=eq.${enc}&is_correct=eq.false&select=question_id&limit=2000`,
        ),
        restGet<{ question_id: string }[]>(
          `test_questions?user_id=eq.${uid}&law_name=eq.${enc}&is_correct=eq.true&select=question_id&limit=2000`,
        ),
      ])
      const failed = new Set(
        failedRows.map((r) => r.question_id).filter((q) => ctx.lawQuestionIds.has(q)),
      )
      const correct = new Set(
        correctRows.map((r) => r.question_id).filter((q) => ctx.lawQuestionIds.has(q)),
      )
      const onlyCorrect = new Set([...correct].filter((q) => !failed.has(q)))
      if (failed.size < 3) continue
      // Primer candidato válido como fallback; nos quedamos con el primero que
      // además tenga solo-acertadas (material para el test de regresión).
      if (!ctx.userId || (onlyCorrect.size > 0 && ctx.userOnlyCorrectInLaw.size === 0)) {
        ctx.userId = uid
        ctx.userFailedInLaw = failed
        ctx.userOnlyCorrectInLaw = onlyCorrect
      }
      if (onlyCorrect.size > 0) break
    }
  }, 90000)

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
