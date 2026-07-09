/**
 * @jest-environment node
 */
// __tests__/integration/testPositionTypePersistence.integration.test.ts
//
// Test de PERSISTENCIA real (INSERT contra RDS) del invariante que rompió el
// 05/07/2026 (commit b4ef6fc9): un test creado dentro de una oposición debe
// guardar tests.position_type NO nulo y correcto.
//
// Ejercita el camino REAL: createTestSession() → Drizzle → INSERT en `tests`.
// Es la red que faltaba a nivel de persistencia (los tests previos sobre
// position_type miraban config↔DB o una copia de la lógica, nunca el INSERT).
//
// db/client crea su cliente postgres.js EN EL IMPORT leyendo DATABASE_URL. Por
// eso ajustamos el env (sslmode=no-verify para el cert self-signed de RDS en
// local) ANTES de importarlo, y cargamos createTestSession con import() dinámico
// dentro de beforeAll — un import estático se hoistea por encima del env.
import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
}

const DB_URL = process.env.DATABASE_URL
// Este test ESCRIBE (INSERT + DELETE). El CI de integración usa DATABASE_URL
// read-only → se saltaría con error. Opt-in explícito para entornos escribibles.
// Correr en local:  NODE_TLS_REJECT_UNAUTHORIZED=0 INTEGRATION_DB_WRITABLE=1 \
//                   npx jest __tests__/integration/testPositionTypePersistence.integration.test.ts
// (NODE_TLS al ARRANCAR el proceso: Node lo cachea; getDb usa postgres.js estricto
//  con el cert self-signed de RDS. En CI/prod la cadena TLS es válida.)
const canRun = !!DB_URL && process.env.INTEGRATION_DB_WRITABLE === '1'
const describeIfDb = canRun ? describe : describe.skip

type CreateTestSession = typeof import('@/lib/api/v2/tests/queries')['createTestSession']

describeIfDb('tests.position_type — persistencia real (INSERT en RDS)', () => {
  let client: Client
  let userId: string | null = null
  let createTestSession: CreateTestSession
  const createdIds: string[] = []

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    // Un user real cualquiera (tests.user_id tiene FK a user_profiles).
    const { rows } = await client.query<{ id: string }>('SELECT id FROM user_profiles LIMIT 1')
    userId = rows[0]?.id ?? null
    // El singleton postgres.js de db/client vive en globalThis.db; si algún otro
    // módulo lo creó con sslmode=require, lo reseteamos para que se recree con el
    // DATABASE_URL no-verify ya ajustado. Luego import() dinámico.
    delete (globalThis as unknown as { db?: unknown }).db
    createTestSession = (await import('@/lib/api/v2/tests/queries')).createTestSession
  })

  afterAll(async () => {
    if (createdIds.length) {
      await client.query('DELETE FROM tests WHERE id = ANY($1::uuid[])', [createdIds])
    }
    await client.end()
  })

  async function readPositionType(testId: string): Promise<string | null> {
    const { rows } = await client.query<{ position_type: string | null }>(
      'SELECT position_type FROM tests WHERE id = $1::uuid',
      [testId],
    )
    return rows[0]?.position_type ?? null
  }

  test('crear test en URL de oposición persiste position_type derivado (caso Ana)', async () => {
    if (!userId) return // sin users no se puede probar el FK; describeIfDb ya cubre el skip por BD
    const res = await createTestSession(
      {
        tema: 106,
        testNumber: 90001,
        totalQuestions: 1,
        testType: 'practice',
        title: 'INTEG position_type oposición',
        testUrl: '/administrativo-gva/test/tema/106/test-personalizado',
      },
      userId,
    )
    if (!res.success) throw new Error('createTestSession falló: ' + JSON.stringify(res))
    expect(res.id).toBeTruthy()
    if (res.id) createdIds.push(res.id)
    expect(await readPositionType(res.id!)).toBe('administrativo_gva')
  })

  test('positionType explícito del cliente se persiste tal cual', async () => {
    if (!userId) return
    const res = await createTestSession(
      {
        tema: 5,
        testNumber: 90002,
        totalQuestions: 1,
        testType: 'practice',
        title: 'INTEG position_type explícito',
        testUrl: '/test/rapido',
        positionType: 'auxiliar_administrativo_estado',
      },
      userId,
    )
    expect(res.success).toBe(true)
    if (res.id) createdIds.push(res.id)
    expect(await readPositionType(res.id!)).toBe('auxiliar_administrativo_estado')
  })

  test('test global legítimo (/test/rapido) persiste position_type NULL', async () => {
    if (!userId) return
    const res = await createTestSession(
      {
        tema: 0,
        testNumber: 90003,
        totalQuestions: 1,
        testType: 'practice',
        title: 'INTEG position_type global',
        testUrl: '/test/rapido',
      },
      userId,
    )
    expect(res.success).toBe(true)
    if (res.id) createdIds.push(res.id)
    expect(await readPositionType(res.id!)).toBeNull()
  })
})
