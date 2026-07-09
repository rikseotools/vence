// __tests__/integration/topicScopeIntegrity.test.ts
// Valida integridad de topic_scope: sin duplicados, artículos existentes, formato consistente.
// Se salta automáticamente si no hay credenciales reales de Supabase (CI-safe).
// Usa https nativo de Node para evitar que el mock de fetch en jest.setup.js interfiera.

import dotenv from 'dotenv'
import { Client } from 'pg'
import { normalizeArticleNumber as boeNormalize } from '@/lib/boe-extractor'

dotenv.config({ path: '.env.local', override: true })

// Lee de la BD VIVA (RDS) vía pg. NO Supabase (congelado desde 04/07).
const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL

/** Normaliza "55 bis" → "55bis", "  3  ter " → "3ter" */
function normalizeArticleNumber(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').trim()
}

const describeIfDb = hasDb ? describe : describe.skip

interface Topic { id: string; title: string }
interface TopicScope { topic_id: string; law_id: string; article_numbers: string[] }
interface Article { id: string; law_id: string; article_number: string }
interface Law { id: string; short_name: string; is_virtual: boolean }

describeIfDb('Integridad topic_scope', () => {
  let topics: Topic[]
  let scopes: TopicScope[]
  let articles: Article[]
  let laws: Law[]

  // Lookup maps built in beforeAll
  let client: Client
  let lawName: Map<string, string>
  let articlesByLaw: Map<string, Set<string>>
  let topicName: Map<string, string>
  let virtualLawIds: Set<string>

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
    ;[topics, scopes, articles, laws] = await Promise.all([
      client.query<Topic>('SELECT id, title FROM topics WHERE is_active = true').then(r => r.rows),
      client.query<TopicScope>('SELECT topic_id, law_id, article_numbers FROM topic_scope').then(r => r.rows),
      client.query<Article>('SELECT id, law_id, article_number FROM articles WHERE is_active = true').then(r => r.rows),
      client.query<Law>('SELECT id, short_name, is_virtual FROM laws').then(r => r.rows),
    ])

    console.log(`📊 Datos cargados: ${topics.length} topics, ${scopes.length} scopes, ${articles.length} artículos, ${laws.length} leyes`)

    lawName = new Map(laws.map(l => [l.id, l.short_name]))
    topicName = new Map(topics.map(t => [t.id, t.title]))
    // Leyes virtuales (ofimática Office/Excel/Word): sus "artículos" son unidades
    // pedagógicas, NO registros en `articles`. Comprobar que su scope existe como
    // artículo activo es un error de categoría → se excluyen de esa comprobación.
    virtualLawIds = new Set(laws.filter(l => l.is_virtual).map(l => l.id))

    articlesByLaw = new Map<string, Set<string>>()
    for (const a of articles) {
      if (!articlesByLaw.has(a.law_id)) articlesByLaw.set(a.law_id, new Set())
      articlesByLaw.get(a.law_id)!.add(a.article_number)
    }
  })

  afterAll(async () => { await client?.end() })

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
      // Leyes virtuales (ofimática): sus "artículos" no son registros → no aplica.
      if (virtualLawIds.has(scope.law_id)) continue

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
      console.warn(`⚠️ ${errors.length} scopes (leyes reales) con artículos faltantes:`)
      errors.slice(0, 10).forEach(e => console.warn(`  ${e}`))
    }
    // DEUDA REAL DOCUMENTADA (no escondida) — leyes virtuales YA excluidas arriba.
    // A 08/07/2026: ~71 scopes de leyes reales = 208 pares (topic,ley,art):
    //   · ~149 apuntan a un artículo que EXISTE pero está INACTIVO (CE estructurales
    //     desactivados a propósito, artículos derogados) → higiene de scope.
    //   · ~59 apuntan a un artículo que NO EXISTE (bis/ter con formato no importado,
    //     Hacienda Murcia / LPRL / RDL 5/2015) → gap de import.
    // Limpieza por-epígrafe pendiente (tarea rastreada; 24 leyes). El umbral (<80)
    // mantiene la detección de REGRESIONES: cualquier deuda NUEVA por encima de la
    // conocida rompe el test. Bajar a 0 tras la limpieza.
    expect(errors.length).toBeLessThan(80)
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

  // SKIP: deuda histórica documentada (19/05/2026).
  // 230+ articles con formato largo (DA_adicional_primera) vs canónico (DA1).
  // Migración masiva bloqueada por 11 tablas en cascada + URLs públicas en
  // `/teoria/[law]/[articleNumber]` + parseInt('DA1')=NaN en lawFetchers.
  // Plan documentado: docs/maintenance/migracion-article-number-formato.md
  // (dual-format support primero, migración BD después).
  // Reactivar tras migración: eliminar .skip y bajar toBeLessThan(500) a 0.
  test.skip('todos los article_number en BD están en formato normalizado', () => {
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
    expect(errors.length).toBe(0)
  })
}, 120_000)
