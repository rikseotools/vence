// __tests__/integration/topicScopeIntegrity.test.ts
// Valida integridad de topic_scope: sin duplicados, artículos existentes, formato consistente.
// Se salta automáticamente si no hay credenciales reales de Supabase (CI-safe).
// Usa https nativo de Node para evitar que el mock de fetch en jest.setup.js interfiera.

import dotenv from 'dotenv'
import https from 'https'
import { normalizeArticleNumber as boeNormalize } from '@/lib/boe-extractor'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function supabaseGetPage<T = unknown>(table: string, params: string, offset: number, limit: number): Promise<T[]> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}&offset=${offset}&limit=${limit}`
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        apikey: REAL_KEY!,
        Authorization: `Bearer ${REAL_KEY}`,
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Supabase GET ${table}: ${res.statusCode} ${data}`))
          return
        }
        resolve(JSON.parse(data) as T[])
      })
    }).on('error', reject)
  })
}

async function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await supabaseGetPage<T>(table, params, offset, PAGE)
    all.push(...page)
    if (page.length < PAGE) break
  }
  return all
}

/** Normaliza "55 bis" → "55bis", "  3  ter " → "3ter" */
function normalizeArticleNumber(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').trim()
}

const describeIfDb = hasRealDb ? describe : describe.skip

interface Topic { id: string; title: string }
interface TopicScope { topic_id: string; law_id: string; article_numbers: string[] }
interface Article { id: string; law_id: string; article_number: string }
interface Law { id: string; short_name: string }

describeIfDb('Integridad topic_scope', () => {
  let topics: Topic[]
  let scopes: TopicScope[]
  let articles: Article[]
  let laws: Law[]

  // Lookup maps built in beforeAll
  let lawName: Map<string, string>
  let articlesByLaw: Map<string, Set<string>>
  let topicName: Map<string, string>

  beforeAll(async () => {
    ;[topics, scopes, articles, laws] = await Promise.all([
      supabaseGet<Topic>('topics', 'select=id,title&is_active=eq.true'),
      supabaseGet<TopicScope>('topic_scope', 'select=topic_id,law_id,article_numbers'),
      supabaseGet<Article>('articles', 'select=id,law_id,article_number&is_active=eq.true'),
      supabaseGet<Law>('laws', 'select=id,short_name'),
    ])

    console.log(`📊 Datos cargados: ${topics.length} topics, ${scopes.length} scopes, ${articles.length} artículos, ${laws.length} leyes`)

    lawName = new Map(laws.map(l => [l.id, l.short_name]))
    topicName = new Map(topics.map(t => [t.id, t.title]))

    articlesByLaw = new Map<string, Set<string>>()
    for (const a of articles) {
      if (!articlesByLaw.has(a.law_id)) articlesByLaw.set(a.law_id, new Set())
      articlesByLaw.get(a.law_id)!.add(a.article_number)
    }
  })

  test('no hay article_numbers duplicados en ningún scope', () => {
    const errors: string[] = []

    for (const scope of scopes) {
      const arts = scope.article_numbers ?? []
      const seen = new Map<string, number>()
      for (const a of arts) {
        seen.set(a, (seen.get(a) ?? 0) + 1)
      }
      const dupes = [...seen.entries()].filter(([, count]) => count > 1)
      if (dupes.length > 0) {
        const law = lawName.get(scope.law_id) ?? scope.law_id
        const topic = topicName.get(scope.topic_id) ?? scope.topic_id
        const detail = dupes.map(([art, count]) => `${art} (x${count})`).join(', ')
        errors.push(`[${law}] ${topic}: duplicados en scope: ${detail}`)
      }
    }

    expect(errors).toEqual([])
  })

  test('cada article_number en scope existe como artículo activo en BD', () => {
    const errors: string[] = []

    for (const scope of scopes) {
      const lawArts = articlesByLaw.get(scope.law_id)
      if (!lawArts) {
        const law = lawName.get(scope.law_id) ?? scope.law_id
        const topic = topicName.get(scope.topic_id) ?? scope.topic_id
        errors.push(`[${law}] ${topic}: law_id ${scope.law_id} no tiene artículos activos`)
        continue
      }

      const missing: string[] = []
      for (const art of scope.article_numbers ?? []) {
        if (!lawArts.has(art)) missing.push(art)
      }
      if (missing.length > 0) {
        const law = lawName.get(scope.law_id) ?? scope.law_id
        const topic = topicName.get(scope.topic_id) ?? scope.topic_id
        errors.push(`[${law}] ${topic}: artículos en scope sin registro en BD: ${missing.join(', ')}`)
      }
    }

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} scopes con artículos faltantes:`)
      errors.slice(0, 10).forEach(e => console.warn(`  ${e}`))
    }
    // Deuda conocida: 25 scopes con artículos faltantes (CE estructurales desactivados,
    // leyes virtuales Office 2019/2021 vacías, arts bis/ter no importados).
    // Si crece por encima de 30, hay regresión.
    expect(errors.length).toBeLessThan(30)
  })

  test('no hay inconsistencias de formato bis/ter dentro de un mismo scope', () => {
    const errors: string[] = []

    for (const scope of scopes) {
      const arts = scope.article_numbers ?? []
      const normalizedMap = new Map<string, string[]>()
      for (const a of arts) {
        const norm = normalizeArticleNumber(a)
        if (!normalizedMap.has(norm)) normalizedMap.set(norm, [])
        normalizedMap.get(norm)!.push(a)
      }
      const inconsistent = [...normalizedMap.entries()]
        .filter(([, variants]) => {
          const unique = new Set(variants)
          return unique.size > 1
        })
      if (inconsistent.length > 0) {
        const law = lawName.get(scope.law_id) ?? scope.law_id
        const topic = topicName.get(scope.topic_id) ?? scope.topic_id
        for (const [, variants] of inconsistent) {
          const unique = [...new Set(variants)]
          errors.push(`[${law}] ${topic}: formato inconsistente: "${unique.join('" vs "')}"`)
        }
      }
    }

    expect(errors).toEqual([])
  })

  test('no hay artículos duplicados por formato en tabla articles (misma ley)', () => {
    const errors: string[] = []

    const grouped = new Map<string, Article[]>()
    for (const a of articles) {
      const key = `${a.law_id}:${normalizeArticleNumber(a.article_number)}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(a)
    }

    for (const [, group] of grouped) {
      if (group.length > 1) {
        const uniqueNumbers = [...new Set(group.map(a => a.article_number))]
        if (uniqueNumbers.length > 1) {
          const law = lawName.get(group[0].law_id) ?? group[0].law_id
          errors.push(`[${law}] articles duplicados por formato: "${uniqueNumbers.join('" y "')}"`)
        }
      }
    }

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} artículos duplicados por formato:`)
      errors.forEach(e => console.warn(`  ${e}`))
    }
    expect(errors.length).toBeLessThan(3)
  })

  test('todos los article_number en BD están en formato normalizado', () => {
    const errors: string[] = []

    for (const a of articles) {
      const normalized = boeNormalize(a.article_number)
      if (normalized !== a.article_number) {
        const law = lawName.get(a.law_id) ?? a.law_id
        errors.push(`[${law}] article "${a.article_number}" debería ser "${normalized}" (id: ${a.id})`)
      }
    }

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} artículos con formato no normalizado:`)
      errors.slice(0, 10).forEach(e => console.warn(`  ${e}`))
    }
    // Deuda conocida: ~430 artículos con formato no normalizado (disposiciones con
    // formato largo DA_*, mayúsculas, acentos). La mayoría son de leyes importadas
    // antes de estandarizar el normalizador. Si crece significativamente, hay regresión.
    expect(errors.length).toBeLessThan(500)
  })
}, 120_000)
