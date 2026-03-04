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

function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}`
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

/** Normaliza "55 bis" → "55bis", "  3  ter " → "3ter" */
function normalizeArticleNumber(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').trim()
}

const describeIfDb = hasRealDb ? describe : describe.skip

interface Topic { id: string; title: string }
interface TopicScope { topic_id: string; law_id: string; article_numbers: string[] }
interface Article { id: string; law_id: string; article_number: string }
interface Law { id: string; short_name: string }
interface QuestionRef { primary_article_id: string }

describeIfDb('Integridad topic_scope', () => {
  let topics: Topic[]
  let scopes: TopicScope[]
  let articles: Article[]
  let laws: Law[]
  let questionArticleIds: Set<string>

  // Lookup maps built in beforeAll
  let lawName: Map<string, string>
  let articlesByLaw: Map<string, Set<string>>
  let articleIdByLawAndNumber: Map<string, string>
  let topicName: Map<string, string>

  beforeAll(async () => {
    ;[topics, scopes, articles, laws] = await Promise.all([
      supabaseGet<Topic>('topics', 'select=id,title&is_active=eq.true&limit=5000'),
      supabaseGet<TopicScope>('topic_scope', 'select=topic_id,law_id,article_numbers&limit=10000'),
      supabaseGet<Article>('articles', 'select=id,law_id,article_number&is_active=eq.true&limit=50000'),
      supabaseGet<Law>('laws', 'select=id,short_name&limit=500'),
    ])

    const qRefs = await supabaseGet<QuestionRef>(
      'questions',
      'select=primary_article_id&is_active=eq.true&limit=100000'
    )
    questionArticleIds = new Set(qRefs.map(q => q.primary_article_id).filter(Boolean))

    lawName = new Map(laws.map(l => [l.id, l.short_name]))
    topicName = new Map(topics.map(t => [t.id, t.title]))

    articlesByLaw = new Map<string, Set<string>>()
    articleIdByLawAndNumber = new Map<string, string>()
    for (const a of articles) {
      if (!articlesByLaw.has(a.law_id)) articlesByLaw.set(a.law_id, new Set())
      articlesByLaw.get(a.law_id)!.add(a.article_number)
      articleIdByLawAndNumber.set(`${a.law_id}:${a.article_number}`, a.id)
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

    expect(errors).toEqual([])
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

    // Agrupar por law_id + normalizedArticleNumber
    const grouped = new Map<string, Article[]>()
    for (const a of articles) {
      const key = `${a.law_id}:${normalizeArticleNumber(a.article_number)}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(a)
    }

    for (const [, group] of grouped) {
      if (group.length > 1) {
        const uniqueNumbers = [...new Set(group.map(a => a.article_number))]
        // Solo reportar si los article_number originales difieren (formato inconsistente)
        if (uniqueNumbers.length > 1) {
          const law = lawName.get(group[0].law_id) ?? group[0].law_id
          errors.push(`[${law}] articles duplicados por formato: "${uniqueNumbers.join('" y "')}"`)
        }
      }
    }

    expect(errors).toEqual([])
  })

  test('cada scope tiene al menos 1 pregunta alcanzable', () => {
    const errors: string[] = []

    for (const scope of scopes) {
      const arts = scope.article_numbers ?? []
      if (arts.length === 0) continue

      let hasQuestion = false
      for (const art of arts) {
        const articleId = articleIdByLawAndNumber.get(`${scope.law_id}:${art}`)
        if (articleId && questionArticleIds.has(articleId)) {
          hasQuestion = true
          break
        }
      }

      if (!hasQuestion) {
        const law = lawName.get(scope.law_id) ?? scope.law_id
        const topic = topicName.get(scope.topic_id) ?? scope.topic_id
        errors.push(`[${law}] ${topic}: scope con ${arts.length} artículos pero 0 preguntas alcanzables`)
      }
    }

    expect(errors).toEqual([])
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

    expect(errors).toEqual([])
  })
}, 60_000)
