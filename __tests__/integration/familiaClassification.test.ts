/** @jest-environment node */
// __tests__/integration/familiaClassification.test.ts
//
// La MITAD de VIGILANCIA de la FAMILIA (T-384, 07/08/2026): ¿el clasificador `classifyFamilia()`
// sigue de acuerdo con lo persistido en BD? ¿hay cobertura suficiente entre las oposiciones que
// se muestran hoy? Un rojo aquí NO dice «tú acabas de romper esto» — dice «hay una fila
// desincronizada o un hueco de cobertura», casi siempre de hace semanas.
//
// MISMA lógica que ahora emite `scripts/health-sweep.cjs` (kinds `familia_desincronizada` /
// `familia_cobertura_baja`, CLI-only — el @Cron del backend no puede importar el clasificador,
// que es TS del frontend). Este test SIGUE corriendo en el job de CI — lo que cambió es que
// ahora está DECLARADO como `vigilancia` en `lib/admin/suiteRegistry.ts`, no como código: su
// rojo no debe bloquear el merge por sí solo, tiene su propio dueño (frase-gatillo «revisa la
// familia desincronizada» / «revisa la cobertura de familia» → `salud-contenido.md`).
//
// El contrato de esquema (¿la vista expone `familia`? ¿el CHECK rechaza valores inválidos?) se
// separó a `familiaSchemaContract.test.ts` — eso SÍ es código y SÍ debe bloquear.
//
// Lee de RDS. Skip si no hay DATABASE_URL (mismo patrón que configDbIntegrity).

import { testDbConfig } from '../helpers/db'
import dotenv from 'dotenv'
import { Client } from 'pg'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { degradaFamilia } = require('@/lib/oposiciones/familiaBackfill.cjs')
import { classifyFamilia } from '@/lib/oposiciones/familia'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

describeIfDb('Familia — vigilancia de datos (integración)', () => {
  let client: Client
  beforeAll(async () => {
    client = new Client(testDbConfig())
    await client.connect()
  })
  afterAll(async () => { await client?.end() })

  it('CONSISTENCIA: el clasificador reproduce la familia persistida (muestra 300)', async () => {
    const r = await client.query(
      'SELECT nombre, administracion, familia FROM oposiciones WHERE familia IS NOT NULL ORDER BY id LIMIT 300',
    )
    // EXENCIÓN (31/07, T-377): que el clasificador diga `otros` donde la BD tiene familia
    // concreta NO es desincronización, es una fila que alguien arregló a mano y que el
    // backfill PROTEGE a propósito (`degradaFamilia`). Sin esta exención, el test exigiría
    // justo lo contrario que la herramienta hace: borrar esas correcciones para ponerse verde.
    // Se usa el MISMO núcleo puro que el backfill — dos criterios distintos aquí serían la
    // divergencia de siempre.
    const desincronizados = r.rows.filter((o) => {
      const nueva = classifyFamilia(o.nombre, o.administracion)
      if (nueva === o.familia) return false
      return !degradaFamilia(o.familia, nueva)
    })
    const protegidas = r.rows.filter((o) => degradaFamilia(o.familia, classifyFamilia(o.nombre, o.administracion)))
    if (desincronizados.length) {
      console.log('desincronizados (clasificador vs BD):', desincronizados.slice(0, 5).map((m) => m.nombre))
    }
    if (protegidas.length) {
      console.log(`(${protegidas.length} protegidas: el clasificador las mandaría a 'otros' y no se degradan)`)
    }
    // 0 = el backfill está sincronizado con el clasificador actual. Si falla, re-correr
    // scripts/backfill-familia.cjs (o revisar un cambio de keywords sin re-backfill).
    expect(desincronizados).toHaveLength(0)
  })

  it('COBERTURA: ≥80% de catalogadas mostrables tienen familia (no otros/null)', async () => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
    const r = await client.query(
      `SELECT familia FROM oposiciones
       WHERE is_active = false AND seguimiento_url IS NOT NULL
         AND inscription_start::text <= $1 AND inscription_deadline::text >= $1`,
      [today],
    )
    const total = r.rows.length
    if (total === 0) return // no hay abiertas ahora → nada que cubrir
    const clasificadas = r.rows.filter((o) => o.familia && o.familia !== 'otros').length
    expect(clasificadas / total).toBeGreaterThanOrEqual(0.8)
  })
})
