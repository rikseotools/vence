// __tests__/integration/configDbIntegrity.test.ts
// Valida que toda oposición en config tiene datos reales en BD (topics, topic_scope, etc.)
// Se salta automáticamente si no hay credenciales reales de Supabase (CI-safe).
// Usa https nativo de Node para evitar que el mock de fetch en jest.setup.js interfiera.

import { OPOSICIONES } from '@/lib/config/oposiciones'
import dotenv from 'dotenv'
import https from 'https'

// Cargar credenciales reales (bypasea jest.setup.js que pone test.supabase.co)
dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

/** Helper: GET a Supabase REST API usando https nativo (no afectado por jest mock de fetch) */
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

const describeIfDb = hasRealDb ? describe : describe.skip

describeIfDb('Integridad config ↔ BD', () => {
  for (const oposicion of OPOSICIONES) {
    describe(oposicion.name, () => {
      let dbTopics: Array<{ id: string; topic_number: number; position_type: string }>

      beforeAll(async () => {
        dbTopics = await supabaseGet(
          'topics',
          `select=id,topic_number,position_type&position_type=eq.${oposicion.positionType}&is_active=eq.true`
        )
      })

      test('tiene topics activos en BD', () => {
        expect(dbTopics.length).toBeGreaterThan(0)
      })

      test(`count de topics en BD >= totalTopics en config (${oposicion.totalTopics})`, () => {
        expect(dbTopics.length).toBeGreaterThanOrEqual(oposicion.totalTopics)
      })

      test('tiene al menos 1 topic_scope configurado', async () => {
        if (dbTopics.length === 0) return // ya falla en test anterior

        const topicIds = dbTopics.slice(0, 10).map(t => `"${t.id}"`).join(',')
        const scopes = await supabaseGet(
          'topic_scope',
          `select=topic_id&topic_id=in.(${topicIds})&limit=1`
        )
        expect(scopes.length).toBeGreaterThan(0)
      })

      test('cada theme.id de config tiene topic_number correspondiente en BD', () => {
        const dbTopicNumbers = new Set(dbTopics.map(t => t.topic_number))
        const allThemeIds = oposicion.blocks.flatMap(b => b.themes.map(t => t.id))
        const missing = allThemeIds.filter(id => !dbTopicNumbers.has(id))

        expect(missing).toEqual([])
      })
    })
  }
}, 30_000)
