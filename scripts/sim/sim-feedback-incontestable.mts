/**
 * sim-feedback-incontestable.mts — comprueba que una solicitud creada desde el CHAT DE IA
 * nace CONTESTABLE (T-247).
 *
 * Uso:  npx tsx scripts/sim/sim-feedback-incontestable.mts
 *
 * ## Qué comprueba y por qué así
 *
 * Llama a la función REAL de producción (`registerOposicionRequest`), no a una copia, y
 * verifica dos cosas seguidas: que el feedback queda con su `feedback_conversations` (sin
 * ella, `/api/v2/feedback/respond` devuelve 409 y el usuario **no recibe respuesta jamás**) y
 * que el detector del sweep NO lo marca. Después **borra lo que ha creado**.
 *
 * Es una simulación y no un test de jest porque la función abre su propia conexión con
 * `getAdminDb()`: no se le puede inyectar una transacción, así que se escribe de verdad y se
 * limpia. Por eso vive aquí y no en `__tests__`.
 *
 * Validado por mutación: quitando la creación de la conversación, imprime los dos ❌.
 */
import 'dotenv/config'
import fs from 'fs'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const url = fs.readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)![1].trim()
process.env.DATABASE_URL = url
const { registerOposicionRequest } = await import('../../lib/chat/domains/oposicion-catalog/queries.ts')
const postgres = (await import('postgres')).default
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 25, onnotice: () => {} })

const [u] = await sql`SELECT id, email FROM user_profiles ORDER BY created_at DESC LIMIT 1`
const NOMBRE = `__SIM_T247_${Date.now()}`
console.log('usuario de prueba:', u.email)

const r: any = await registerOposicionRequest({
  userId: u.id, detectedName: NOMBRE,
  userMessage: 'simulación T-247', userOposicion: null, logId: null,
})
console.log('registerOposicionRequest →', JSON.stringify(r))

let ok = false
if (r.status === 'created') {
  const [conv] = await sql`SELECT id, status FROM feedback_conversations WHERE feedback_id = ${r.id}`
  ok = !!conv
  console.log(ok ? `✅ conversación creada (${conv.id}, ${conv.status}) → el feedback SÍ se puede responder`
                 : '❌ SIN conversación → seguiría siendo incontestable')
  // Y la prueba de fondo: el detector del sweep NO debe marcarlo (tiene conversación).
  const [det] = await sql`
    SELECT count(*)::int n FROM user_feedback f
    WHERE f.id = ${r.id} AND f.status='pending'
      AND f.message NOT LIKE '[Solicitud de eliminación de cuenta%'
      AND NOT EXISTS (SELECT 1 FROM feedback_conversations c WHERE c.feedback_id = f.id)`
  console.log(det.n === 0 ? '✅ el detector NO lo marca (correcto: es contestable)' : '❌ el detector lo marca')

  await sql`DELETE FROM feedback_conversations WHERE feedback_id = ${r.id}`
  await sql`DELETE FROM user_feedback WHERE id = ${r.id}`
  const [q] = await sql`SELECT count(*)::int n FROM user_feedback WHERE id = ${r.id}`
  console.log(q.n === 0 ? '🧹 limpiado' : '⚠️ NO se limpió')
}
await sql.end({ timeout: 5 })
process.exit(ok ? 0 : 1)
