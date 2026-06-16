/**
 * @jest-environment node
 *
 * Test de INTEGRACIÓN: scope a nivel de ARTÍCULO en el "modo global" de
 * /api/questions/filtered (Test Rápido y aleatorio sin tema).
 *
 * Reproduce el bug de Laura (CARM, 16/06/2026, dispute e7f0b57c): el modo
 * global acotaba SOLO por law_id, no por article_number. Como CARM escopa de
 * la Constitución los arts. 1-55+116 (no el 134, presupuestos), las preguntas
 * de los artículos NO escopados de leyes compartidas se colaban en el test.
 *
 * El fix añade un EXISTS contra topic_scope que replica la semántica del modo
 * tema:
 *   - article_numbers IS NULL  → ley virtual: toda la ley
 *   - article_numbers = []     → no aporta
 *   - article_numbers = [vals] → solo esos artículos
 *
 * NIVEL A (BD real): invariantes del scope por artículo con datos reales.
 * NIVEL C (anti-regresión estático): el filtro está en el código del modo global.
 *
 * Usa el módulo `https` de Node (NO fetch ni @supabase/supabase-js): jest.setup
 * mockea `global.fetch`, lo que rompería el cliente Supabase. Mismo patrón que
 * __tests__/integration/failedQuestionsLawScope.integration.test.ts.
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

const POSITION = 'auxiliar_administrativo_carm'

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

// Réplica EXACTA en JS de la semántica del EXISTS SQL del modo global:
//   NULL → toda la ley | [] → nada | [vals] → solo esos.
type ScopeEntry = { full: boolean; arts: Set<string> }
function buildInScope(scopeByLaw: Map<string, ScopeEntry>) {
  return (lawId: string, articleNumber: string): boolean => {
    const e = scopeByLaw.get(lawId)
    if (!e) return false
    if (e.full) return true
    return e.arts.has(String(articleNumber))
  }
}

const ctx: {
  ceLawId: string
  scopeByLaw: Map<string, ScopeEntry>
  virtualLawId: string | null
} = { ceLawId: '', scopeByLaw: new Map(), virtualLawId: null }

describe('INTEGRACIÓN — modo global: scope por artículo (BD real)', () => {
  if (!hasRealDb) {
    test.skip('Skipped: faltan credenciales Supabase en .env.local', () => {})
    return
  }

  beforeAll(async () => {
    // 1. law_id de la Constitución
    const ceLaws = await restGet<{ id: string }[]>(`laws?short_name=eq.CE&select=id`)
    if (ceLaws.length) ctx.ceLawId = ceLaws[0].id

    // 2. topics de CARM
    const topics = await restGet<{ id: string }[]>(
      `topics?position_type=eq.${POSITION}&select=id`,
    )
    const topicIds = topics.map((t) => t.id)
    if (topicIds.length === 0) return

    // 3. topic_scope de esos topics → mapa law_id → {full, arts}
    const scopes = await restGet<{ law_id: string; article_numbers: string[] | null }[]>(
      `topic_scope?topic_id=in.(${topicIds.join(',')})&select=law_id,article_numbers`,
    )
    for (const row of scopes) {
      if (!row.law_id) continue
      const entry = ctx.scopeByLaw.get(row.law_id) ?? { full: false, arts: new Set<string>() }
      if (row.article_numbers === null) {
        entry.full = true // ley virtual: toda la ley
      } else {
        for (const a of row.article_numbers) entry.arts.add(String(a))
      }
      ctx.scopeByLaw.set(row.law_id, entry)
    }

    // 4. una ley virtual (full=true) cualquiera del scope CARM, para el test
    for (const [lawId, e] of ctx.scopeByLaw) {
      if (e.full) { ctx.virtualLawId = lawId; break }
    }
  }, 90000)

  test('NIVEL A — setup: CE y scope CARM presentes', () => {
    expect(ctx.ceLawId).not.toBe('')
    expect(ctx.scopeByLaw.size).toBeGreaterThan(0)
    expect(ctx.scopeByLaw.has(ctx.ceLawId)).toBe(true) // CARM incluye la CE
  })

  test('NIVEL A — REGRESIÓN Laura: CE art. 134 (presupuestos) NO está en el scope CARM', () => {
    // El bug: como la CE entera estaba en validLawIds (nivel ley), el art. 134
    // se colaba. El scope por artículo lo excluye.
    const inScope = buildInScope(ctx.scopeByLaw)
    expect(inScope(ctx.ceLawId, '134')).toBe(false) // ← la fuga, ahora cerrada
    // contraste a nivel de ley (lo que pasaba antes): la CE SÍ está permitida
    expect(ctx.scopeByLaw.has(ctx.ceLawId)).toBe(true)
  })

  test('NIVEL A — los artículos de la CE SÍ escopados siguen dentro', () => {
    const inScope = buildInScope(ctx.scopeByLaw)
    const ceEntry = ctx.scopeByLaw.get(ctx.ceLawId)!
    // CARM escopa de la CE arts del Título Preliminar/DDFF (1-55) + 116.
    expect(ceEntry.full).toBe(false) // la CE en CARM es scope parcial, no virtual
    expect(inScope(ctx.ceLawId, '14')).toBe(true)
    expect(inScope(ctx.ceLawId, '116')).toBe(true)
  })

  test('NIVEL A — leyes virtuales (article_numbers NULL) siguen incluyendo TODA la ley', () => {
    // No romper Word/Excel/eIDAS… (ley virtual = toda la ley en scope).
    expect(ctx.virtualLawId).not.toBeNull()
    const inScope = buildInScope(ctx.scopeByLaw)
    // cualquier número de artículo de una ley virtual está en scope
    expect(inScope(ctx.virtualLawId as string, '1')).toBe(true)
    expect(inScope(ctx.virtualLawId as string, '999')).toBe(true)
  })

  test('NIVEL A — el scope CARM no queda vacío (no colapsa a 0)', () => {
    // Suma de artículos escopados explícitos + al menos una ley virtual ⇒ hay material.
    let explicitArts = 0
    let virtualLaws = 0
    for (const e of ctx.scopeByLaw.values()) {
      explicitArts += e.arts.size
      if (e.full) virtualLaws++
    }
    expect(explicitArts + virtualLaws).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------
// NIVEL C — Anti-regresión estático (siempre corre)
// ---------------------------------------------------------
describe('NIVEL C — scope por artículo vía fuente única en el código', () => {
  const src = fs.readFileSync('lib/api/filtered-questions/queries.ts', 'utf-8')
  const helperSrc = fs.readFileSync('lib/api/_shared/topicScopeSql.ts', 'utf-8')

  it('el helper articleInPositionScopeExists existe y respeta article_numbers IS NULL', () => {
    expect(helperSrc).toContain('export function articleInPositionScopeExists')
    // delega la pertenencia por artículo en articleInScope (que guarda el NULL)
    expect(helperSrc).toMatch(/articleInScope\(opts\.articleNumber/)
    expect(helperSrc).toContain('IS NULL') // articleInScope: "toda la ley"
  })

  it('el modo global usa el helper (no reimplementa el EXISTS a mano)', () => {
    expect(src).toContain("import { articleInPositionScopeExists }")
    expect(src).toContain('const articleScopeFilter = articleInPositionScopeExists(')
    // no debe quedar el unnest sin guarda en el modo global
    expect(src).not.toMatch(/articleScopeFilter\s*=\s*sql`EXISTS/)
  })

  it('usa allowed.positionType (coherente con validLawIds), no el param suelto', () => {
    expect(src).toContain('const scopePositionType = allowed.positionType')
    expect(src).toMatch(/articleScopeFilter = articleInPositionScopeExists\(\{[\s\S]{0,120}positionType: scopePositionType/)
  })

  it('el articleScopeFilter se aplica en el WHERE del query global', () => {
    expect(src).toMatch(/inArray\(laws\.id, validLawIds\)[\s\S]{0,200}articleScopeFilter/)
  })

  it('observabilidad: emite global_scope_empty si hay scope pero 0 preguntas', () => {
    expect(src).toContain("errorType: 'global_scope_empty'")
  })

  it('los paths de "falladas" también usan el helper (NULL-aware, sin unnest suelto)', () => {
    // Regresión: el repaso de falladas con scope omitía las falladas de leyes
    // virtuales (article_numbers NULL) por usar unnest sin guarda.
    expect(src).not.toContain('CROSS JOIN LATERAL unnest(ts.article_numbers)')
    // ambos paths (sin IDs y con IDs) deben pasar por el helper
    const usos = src.match(/articleInPositionScopeExists\(/g) || []
    expect(usos.length).toBeGreaterThanOrEqual(3) // global + falladas + falladas-ids
  })
})
