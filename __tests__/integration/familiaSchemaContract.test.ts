/** @jest-environment node */
// __tests__/integration/familiaSchemaContract.test.ts
//
// La MITAD de esquema de la FAMILIA (T-384, 07/08/2026): comprueba que el CONTRATO sigue en
// pie — la vista expone la columna, el CHECK rechaza valores fuera de la taxonomía cerrada, y
// nada en BD tiene un valor que ese CHECK debería haber impedido. Un rojo aquí dice «alguien
// rompió el esquema (una migración, un `ALTER TABLE`)», no «hay un dato mal clasificado» — por
// eso se queda en el job de CI, BLOQUEANTE.
//
// Antes vivía junto con la mitad de VIGILANCIA (¿el clasificador sigue de acuerdo con lo
// persistido? ¿hay cobertura?) en un solo `familiaClassification.test.ts` — mezclaba dos
// semánticas de fallo opuestas. Esa vigilancia se movió al barrido de salud (kinds
// `familia_desincronizada`/`familia_cobertura_baja` en `health-sweep.cjs`, CLI-only porque el
// clasificador es TS del frontend y el @Cron del backend no puede importarlo); lo que queda
// aquí es SOLO lo determinista.
//
// Lee de RDS. Skip si no hay DATABASE_URL (mismo patrón que configDbIntegrity).
//
// ⚠️ Para BD efímera (F2): el test del CHECK necesita AL MENOS una fila en `oposiciones` para
// tener algo sobre lo que intentar el UPDATE — con la tabla vacía, `WHERE id=(SELECT id FROM
// oposiciones LIMIT 1)` no matchea ninguna fila y el UPDATE "tiene éxito" (0 filas afectadas,
// sin violar el CHECK), así que el test fallaría por falta de fixture, no por un CHECK roto.

import { testDbConfig } from '../helpers/db'
import dotenv from 'dotenv'
import { Client } from 'pg'
import { FAMILIA_KEYS } from '@/lib/oposiciones/familia'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

describeIfDb('Familia — contrato de esquema (integración)', () => {
  let client: Client
  beforeAll(async () => {
    client = new Client(testDbConfig())
    await client.connect()
  })
  afterAll(async () => { await client?.end() })

  it('la vista oposiciones_ssot expone la columna familia', async () => {
    const r = await client.query("SELECT familia FROM oposiciones_ssot LIMIT 1")
    expect(r.fields.some((f) => f.name === 'familia')).toBe(true)
  })

  it('el CHECK rechaza familia fuera de la taxonomía', async () => {
    await expect(
      client.query("UPDATE oposiciones SET familia='inventada' WHERE id=(SELECT id FROM oposiciones LIMIT 1)"),
    ).rejects.toThrow()
  })

  it('toda familia persistida es una clave válida de la taxonomía', async () => {
    const r = await client.query('SELECT DISTINCT familia FROM oposiciones WHERE familia IS NOT NULL')
    for (const row of r.rows) expect(FAMILIA_KEYS).toContain(row.familia)
  })
})
