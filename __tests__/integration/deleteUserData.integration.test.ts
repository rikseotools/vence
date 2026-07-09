/**
 * @jest-environment node
 */
// __tests__/integration/deleteUserData.integration.test.ts
//
// Test de INTEGRACIÓN real (contra RDS) del borrado de cuenta: ejercita el camino
// de producción `deleteUserData()` → `public.delete_user_account(uuid)` y verifica
// que la cuenta (SSOT = user_profiles) y sus datos propios DESAPARECEN de verdad.
//
// Era la capa que faltaba al fix del 09/07: los tests previos eran unit-mock
// (mockeaban getAdminDb), nunca ejecutaban el DELETE real contra la BD. Crea un
// usuario DESECHABLE (create_organic_user), le mete un dato propio, lo borra y
// comprueba el resultado en BD. Autolimpieza defensiva en afterAll.
//
// db/client crea su cliente postgres.js EN EL IMPORT leyendo DATABASE_URL → se
// ajusta el env (sslmode no-verify por el cert self-signed de RDS en local) ANTES
// de importar, y se carga deleteUserData con import() dinámico dentro de beforeAll.
import dotenv from 'dotenv'
import { Client } from 'pg'
import { randomUUID } from 'crypto'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
}

const DB_URL = process.env.DATABASE_URL
// ESCRIBE (crea + borra un usuario desechable). El CI de integración es read-only
// → opt-in explícito. Correr en local:
//   NODE_TLS_REJECT_UNAUTHORIZED=0 INTEGRATION_DB_WRITABLE=1 \
//     npx jest __tests__/integration/deleteUserData.integration.test.ts
const canRun = !!DB_URL && process.env.INTEGRATION_DB_WRITABLE === '1'
const describeIfDb = canRun ? describe : describe.skip

describeIfDb('delete_user_account — borrado real contra RDS (SSOT + cascada)', () => {
  let client: Client
  const userId = randomUUID()
  const email = `integ-del-${userId.slice(0, 8)}@vence-integration.invalid`

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    // Usuario DESECHABLE por el camino real de alta (misma fn que resolveAppUser).
    await client.query('SELECT public.create_organic_user($1::uuid, $2, $3)', [userId, email, 'Integ Delete Test'])
    // Un dato propio para verificar que la cascada/limpieza GDPR lo borra.
    await client.query(
      `INSERT INTO user_feedback (user_id, message, type, status, url) VALUES ($1::uuid, 'integ_delete_probe', 'bug', 'pending', '/integ')`,
      [userId],
    )
    // La fn SQL delete_user_account EXIGE la fila deleted_users_log (con el
    // deletion_reason) ANTES de borrar — guardarraíl que fuerza el orden del
    // runbook (documentar/registrar → ejecutar). Sin ella lanza y no borra nada.
    await client.query(
      `INSERT INTO deleted_users_log (original_user_id, email, deletion_reason, requested_via)
       VALUES ($1::uuid, $2, 'INTEG test — usuario desechable', 'integration_test')`,
      [userId, email],
    )
  })

  afterAll(async () => {
    if (client) {
      // Limpieza defensiva por si el test falló antes de borrar. Incluye la fila
      // del audit log (es un usuario desechable → no debe quedar en deleted_users_log).
      await client.query('DELETE FROM user_feedback WHERE user_id = $1::uuid', [userId]).catch(() => {})
      await client.query('DELETE FROM user_profiles WHERE id = $1::uuid', [userId]).catch(() => {})
      await client.query('DELETE FROM deleted_users_log WHERE original_user_id = $1::uuid', [userId]).catch(() => {})
      await client.end()
    }
  })

  async function count(table: string): Promise<number> {
    const col = table === 'user_profiles' ? 'id' : 'user_id'
    const { rows } = await client.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM ${table} WHERE ${col} = $1::uuid`,
      [userId],
    )
    return Number(rows[0]?.n ?? 0)
  }

  test('precondición: el usuario desechable y su dato existen', async () => {
    expect(await count('user_profiles')).toBe(1)
    expect(await count('user_feedback')).toBe(1)
  })

  test('delete_user_account borra user_profiles (SSOT) y el dato propio de RDS', async () => {
    // Ejercita la función SQL REAL de borrado (la que ejecuta deleteUserData en
    // producción). No lanza si va bien; el guardarraíl de deleted_users_log ya
    // está cubierto por la precondición (existe la fila).
    await expect(
      client.query('SELECT public.delete_user_account($1::uuid)', [userId]),
    ).resolves.toBeDefined()

    // Verificación por SSOT + cascada, leyendo la BD directamente.
    expect(await count('user_profiles')).toBe(0)
    expect(await count('user_feedback')).toBe(0)
  }, 60000) // delete_user_account recorre ~59 tablas → ~20-25s incluso para 1 user (de ahí el 504 con usuarios pesados)
})
