/**
 * Test de integridad: verifica que los position_type usados en páginas de examen
 * existen realmente en la tabla topics de la BD.
 *
 * Detecta bugs como usar 'administrativo' en vez de 'administrativo_estado'.
 * Requiere .env.local con credenciales reales de Supabase.
 */
import https from 'https'
import dotenv from 'dotenv'
import { SLUG_TO_POSITION_TYPE } from '@/lib/config/oposiciones'

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
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error(`Failed to parse: ${data.substring(0, 200)}`))
        }
      })
    }).on('error', reject)
  })
}

const describeIfDb = hasRealDb ? describe : describe.skip

describeIfDb('position_type integrity', () => {
  let dbPositionTypes: string[]

  beforeAll(async () => {
    const rows = await supabaseGet<{ position_type: string }>(
      'topics',
      'select=position_type&limit=10000'
    )
    dbPositionTypes = [...new Set(rows.map(r => r.position_type))]
  }, 30000)

  test('all SLUG_TO_POSITION_TYPE values exist in DB topics', () => {
    const missing: string[] = []
    for (const [slug, positionType] of Object.entries(SLUG_TO_POSITION_TYPE)) {
      if (!dbPositionTypes.includes(positionType)) {
        missing.push(`${slug} → ${positionType}`)
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} position_types from config not found in DB:\n${missing.join('\n')}`
      )
    }
  })

  test('all DB position_types have a config mapping', () => {
    const configValues = Object.values(SLUG_TO_POSITION_TYPE)
    const unmapped = dbPositionTypes.filter(pt => !configValues.includes(pt))
    if (unmapped.length > 0) {
      throw new Error(
        `${unmapped.length} DB position_types without config mapping: ${unmapped.join(', ')}`
      )
    }
  })
})
