/** @jest-environment node */
// __tests__/integration/emailEventsTiposAceptados.test.ts
//
// T-456. El arreglo del recordatorio de renovación consiste en que ahora DEJA RASTRO en
// `email_events`. Ese rastro solo existe mientras la BD acepte su `email_type`: la columna
// tiene un CHECK con lista blanca (`email_events_email_type_check`), y `logEmailSent` inserta
// dentro de un try/catch — así que un tipo que no esté en la lista **no da error a nadie**,
// simplemente no deja fila. Es la misma ceguera que motivó T-456, un piso más abajo.
//
// Medido el 01/08 sobre RDS: 18 tipos declarados en la app, 24 en el CHECK, y **2 tipos que la
// app puede enviar y la BD rechaza** (`nueva_oposicion`, `fin_suscripcion_precio_heredado`).
// El segundo se estrenó esa misma mañana con T-448: 4 personas recibieron el aviso y las 8 filas
// que quedaron son de `email_logs` (dos por envío), ninguna de `email_events`.
//
// Este guardarraíl es un TRINQUETE, no un gate: la deuda conocida se declara abajo y solo falla
// si CRECE. Poner el listón en cero hoy dejaría el CI rojo para todas las sesiones por un
// defecto que no se cierra desde aquí (hace falta una migración que amplíe el CHECK).
import { testDbConfig } from '../helpers/db'
import dotenv from 'dotenv'
import { Client } from 'pg'
import { EMAIL_TYPES } from '@/lib/api/emails/schemas'

dotenv.config({ path: '.env.local', override: true })

// Deuda conocida y medida el 01/08. Al ampliar el CHECK, QUITAR de aquí lo que se arregle:
// la lista solo puede encoger.
//
// ✅ VACÍA desde el 01/08/2026 (migración `20260801_email_events_tipos_faltantes.sql`, aplicada
// en RDS ese día): los dos huecos que se declararon aquí por la mañana —`nueva_oposicion` y
// `fin_suscripcion_precio_heredado`— ya están en la lista blanca. Al quedarse a cero, este
// trinquete deja de ser «que no crezca» y pasa a ser un gate de verdad: cualquier tipo nuevo
// que la app pueda enviar y la BD rechace pone el CI en rojo ANTES de que un correo real salga
// sin rastro. No volver a rellenar esta lista para «desbloquear» un push: eso es exactamente
// el fallo que vigila.
const HUECOS_CONOCIDOS: string[] = []

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

describeIfDb('email_events acepta los tipos que la app envía (T-456)', () => {
  let client: Client
  let aceptados: string[] = []

  beforeAll(async () => {
    client = new Client(testDbConfig())
    await client.connect()
    const { rows } = await client.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE conname = 'email_events_email_type_check'`,
    )
    const def: string = rows[0]?.def ?? ''
    aceptados = [...def.matchAll(/'([a-z0-9_]+)'::text/g)].map((m) => m[1])
  })

  afterAll(async () => { await client?.end() })

  it('el CHECK existe y se puede leer (si no, este guardarraíl no vigila nada)', () => {
    expect(aceptados.length).toBeGreaterThan(0)
  })

  it('el recordatorio de renovación puede dejar rastro — es lo que arregla T-456', () => {
    // Si esto se rompe, el correo vuelve a ser invisible y el arreglo queda inerte.
    expect(aceptados).toContain('recordatorio_renovacion')
  })

  it('no crece el número de tipos que la BD rechaza en silencio', () => {
    const rechazados = (EMAIL_TYPES as readonly string[]).filter((t) => !aceptados.includes(t))
    const nuevos = rechazados.filter((t) => !HUECOS_CONOCIDOS.includes(t))

    expect({ nuevos, rechazados }).toEqual({ nuevos: [], rechazados: expect.any(Array) })
    // Y el trinquete en la otra dirección: al arreglar un hueco hay que quitarlo de la lista,
    // o dejaría de vigilarse sin que nadie se entere.
    const yaResueltos = HUECOS_CONOCIDOS.filter((t) => aceptados.includes(t))
    expect(yaResueltos).toEqual([])
  })
})
