/**
 * @jest-environment node
 *
 * INTEGRACIÓN contra BD real — [T-482]: el repaso de un test solo lo sirve su DUEÑO.
 *
 * La prueba unitaria (`__tests__/security/reviewOwnershipIdentity.test.ts`) fija que la ruta
 * autentica y traduce los códigos a HTTP. Lo que NO puede demostrar, porque mockea la
 * consulta, es lo único que de verdad protege al usuario: que con datos REALES el examen de
 * una persona no sale por pedirlo con la identidad de otra.
 *
 * SOLO LEE. No crea ni borra nada: coge un test completado que ya existe y a un usuario
 * distinto que también ya existe. Un test de aislamiento que tuviera que escribir en la BD de
 * producción sería peor que el agujero que vigila.
 *
 * Se auto-mantiene: no hay UUIDs clavados. Si algún día no hay datos con los que preguntar,
 * se salta diciéndolo — un verde por no haber podido mirar sería la peor mentira posible.
 */

import dotenv from 'dotenv'
import { Client } from 'pg'
import { testDbConfig } from '../helpers/db'
import { getTestReview } from '../../lib/api/test-review/queries'

dotenv.config({ path: '.env.local', override: true })

const hasDb = !!process.env.DATABASE_URL
const d = hasDb ? describe : describe.skip

let client: Client
/** Test completado real + su dueño. */
let testId = ''
let dueno = ''
/** Otro usuario real, cualquiera que no sea el dueño. */
let intruso = ''
/** Sesión psicotécnica completada real + su dueño. */
let psicoSessionId = ''
let psicoDueno = ''

beforeAll(async () => {
  if (!hasDb) return
  client = new Client(testDbConfig())
  await client.connect()

  const { rows } = await client.query(`
    SELECT t.id, t.user_id
    FROM tests t
    WHERE t.is_completed = true
      AND t.user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM test_questions tq WHERE tq.test_id = t.id)
    ORDER BY t.completed_at DESC NULLS LAST
    LIMIT 1`)
  if (rows[0]) {
    testId = rows[0].id
    dueno = rows[0].user_id
  }

  if (dueno) {
    const otros = await client.query(
      `SELECT id FROM user_profiles WHERE id <> $1 LIMIT 1`, [dueno]
    )
    if (otros.rows[0]) intruso = otros.rows[0].id
  }

  const psico = await client.query(`
    SELECT id, user_id FROM psychometric_test_sessions
    WHERE is_completed = true AND user_id IS NOT NULL
    ORDER BY completed_at DESC NULLS LAST
    LIMIT 1`)
  if (psico.rows[0]) {
    psicoSessionId = psico.rows[0].id
    psicoDueno = psico.rows[0].user_id
  }
}, 60_000)

afterAll(async () => { await client?.end() })

d('getTestReview contra datos reales', () => {
  test('hay con qué preguntar (si esto falla, el resto no demuestra nada)', () => {
    expect(testId).not.toBe('')
    expect(dueno).not.toBe('')
    expect(intruso).not.toBe('')
    expect(intruso).not.toBe(dueno)
  })

  test('el DUEÑO ve su test', async () => {
    if (!testId) return
    const r = await getTestReview({ testId, requesterId: dueno })
    expect(r.success).toBe(true)
    expect(r.test?.id).toBe(testId)
  }, 30_000)

  test('OTRO usuario no lo ve — y no se le filtra ni una pregunta', async () => {
    if (!testId || !intruso) return
    const r = await getTestReview({ testId, requesterId: intruso })
    expect(r.success).toBe(false)
    expect(r.errorCode).toBe('not_owner')
    // Lo que se le devuelve no lleva NADA del examen ajeno.
    expect(r.questions).toBeUndefined()
    expect(r.test).toBeUndefined()
    expect(r.summary).toBeUndefined()
  }, 30_000)

  test('un uuid que no es de nadie da not_found, no not_owner', async () => {
    const r = await getTestReview({
      testId: '00000000-0000-4000-8000-000000000000',
      requesterId: dueno || '00000000-0000-4000-8000-000000000001',
    })
    expect(r.success).toBe(false)
    expect(r.errorCode).toBe('not_found')
  }, 30_000)
})

d('la sesión psicotécnica tiene dueño y se puede contrastar', () => {
  // El gemelo `/api/psychometric/review` compara en la propia ruta, así que aquí se fija el
  // hecho del que depende esa comparación: la fila guarda a su dueño y no es nulo.
  test('las sesiones completadas guardan user_id', async () => {
    if (!psicoSessionId) return
    expect(psicoDueno).toBeTruthy()
    const { rows } = await client.query(
      `SELECT user_id FROM psychometric_test_sessions WHERE id = $1`, [psicoSessionId]
    )
    expect(rows[0].user_id).toBe(psicoDueno)
  }, 30_000)

  test('no hay sesiones completadas huérfanas que la comparación dejaría pasar', async () => {
    const { rows } = await client.query(`
      SELECT count(*)::int AS n FROM psychometric_test_sessions
      WHERE is_completed = true AND user_id IS NULL`)
    // Con user_id NULL, `session.userId !== identidad.userId` siempre corta (correcto), pero
    // significaría que alguien no puede ver SU propio repaso. Hoy son 0; si suben, es un
    // defecto de escritura, no de esta guarda.
    expect(rows[0].n).toBe(0)
  }, 30_000)
})
