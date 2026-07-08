/**
 * Test de integridad: verifica que los position_type usados en páginas de examen
 * existen realmente en la tabla topics de la BD.
 *
 * Detecta bugs como usar 'administrativo' en vez de 'administrativo_estado'.
 * Requiere .env.local con credenciales reales de Supabase.
 */
import dotenv from 'dotenv'
import { Client } from 'pg'
import { SLUG_TO_POSITION_TYPE } from '@/lib/config/oposiciones'

dotenv.config({ path: '.env.local', override: true })

// Lee de la BD VIVA (RDS) vía pg. NO Supabase (congelado desde 04/07): las
// oposiciones nuevas (GVA, TAI…) tienen sus position_types en RDS pero no en el
// snapshot congelado → daba falsos negativos.
const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

describeIfDb('position_type integrity', () => {
  let client: Client
  let dbPositionTypes: string[]

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
    const { rows } = await client.query<{ position_type: string }>(
      'SELECT DISTINCT position_type FROM topics WHERE position_type IS NOT NULL',
    )
    dbPositionTypes = rows.map(r => r.position_type)
  }, 30000)

  afterAll(async () => { await client?.end() })

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
