/**
 * Toda tabla GRANDE que borra `delete_user_account()` tiene que tener índice por `user_id`.
 *
 * Nadie comparaba esas dos listas, y por eso `observable_events` (6,7 GB, 10,6 M filas) llevaba meses
 * sin índice por `user_id` mientras la función de borrado la barría entera: **31 s de seq scan**. El
 * pool corta a los 20 s (`backend/src/db/database.module.ts`), así que `/api/admin/delete-user`
 * devolvía `success:false` y la cuenta NO se borraba.
 *
 * Se destapó el 28/07/2026 procesando una baja real de un usuario con **121 eventos** — o sea, casi
 * ninguno: la mediana de la base es 136 y 5.019 de 9.045 usuarios (55%) están por encima. El derecho
 * de supresión (RGPD Art. 17) fallaba para más de la mitad de la gente, en silencio, porque las bajas
 * que se procesaban eran de usuarios recién llegados.
 *
 * Este test cruza ambas listas leyendo el catálogo de Postgres: si alguien añade una tabla al borrado
 * (o una tabla ya incluida crece), salta aquí y no dentro de dos meses en forma de baja fallida.
 *
 * Integración: necesita BD. Se salta solo si no hay DATABASE_URL (mismo patrón que el resto de
 * `__tests__/integration`).
 */
import { Client } from 'pg'

const RAW = process.env.DATABASE_URL
const describeSiHayBD = RAW ? describe : describe.skip

/** Por encima de esto, un seq scan por borrado ya es caro de verdad. */
const UMBRAL_MB = 50

describeSiHayBD('cobertura de índices del borrado RGPD', () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({
      connectionString: (RAW || '').replace(/[?&]sslmode=require/, ''),
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
  })

  afterAll(async () => { if (client) await client.end() })

  it('ninguna tabla grande borrada por user_id se queda sin índice', async () => {
    const fn = await client.query<{ d: string }>(
      `SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname = 'delete_user_account'`,
    )
    expect(fn.rows.length).toBe(1)

    // Tablas que la función borra filtrando por user_id.
    const tablas = [...new Set(
      [...fn.rows[0].d.matchAll(/DELETE FROM (?:public\.)?([a-z_]+)[\s\S]{0,120}?user_id/gi)].map((m) => m[1]),
    )].filter((t) => t !== 'public')

    expect(tablas.length).toBeGreaterThan(3)   // si el parseo deja de encontrar tablas, que falle

    const sinIndice: string[] = []
    for (const tabla of tablas) {
      const r = await client.query<{ mb: number; idx: boolean }>(
        `SELECT (pg_total_relation_size(c.oid) / 1024 / 1024)::int AS mb,
                EXISTS (
                  SELECT 1 FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
                   WHERE i.indrelid = c.oid AND a.attname = 'user_id' AND a.attnum = i.indkey[0]
                ) AS idx
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`,
        [tabla],
      )
      const fila = r.rows[0]
      if (fila && fila.mb > UMBRAL_MB && !fila.idx) sinIndice.push(`${tabla} (${fila.mb} MB)`)
    }

    // Un fallo aquí NO es cosmético: significa que hay bajas de usuario que van a expirar por timeout.
    expect(sinIndice).toEqual([])
  }, 60_000)

  it('el índice que motivó este test sigue existiendo', async () => {
    const r = await client.query(
      `SELECT 1 FROM pg_indexes WHERE tablename = 'observable_events' AND indexname = 'idx_observable_events_user_id'`,
    )
    expect(r.rows.length).toBe(1)
  }, 30_000)
})
