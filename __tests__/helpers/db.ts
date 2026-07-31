// __tests__/helpers/db.ts
//
// ÚNICA puerta de conexión a la BD desde los tests.
//
// POR QUÉ EXISTE (medido el 31/07/2026, T-377): 36 ficheros de test abrían su
// propia conexión a mano y habían divergido en tres variantes incompatibles:
//
//   (a) new Client({ connectionString: DB_URL })                        → 13 ficheros
//   (b) new Client({ connectionString: DB_URL, ssl:{rejectUnauthorized:false} })
//   (c) new Client({ connectionString: DB_URL.replace(/sslmode=/…), ssl:{…} })
//
// Desde el cutover a RDS (04/07) la variante (a) NO PUEDE CONECTAR: la URL lleva
// `sslmode=require`, node-postgres lo traduce a verificación de CA, y el
// certificado de RDS lo firma una CA privada → `self-signed certificate in
// certificate chain`. Resultado medido: 51 de los 80 fallos del job de
// integración (64%) eran ESE error, no un defecto de datos — 14 suites que ni
// llegaban a mirar la BD y llevaban meses contadas como "rojo de contenido".
// Como el gate de CI estaba ciego por otro motivo (T-370), nadie lo vio.
//
// GOTCHA que cuesta una tarde si no se mide: **(b) TAMPOCO basta**. En node-postgres
// el `sslmode` de la cadena de conexión PISA la opción `ssl` que le pases, así que
// `{ connectionString: url_con_sslmode, ssl: { rejectUnauthorized: false } }` sigue
// verificando la CA y sigue muriendo. Comprobado con las dos formas a la vez:
//
//   A) URL tal cual   + ssl:{rejectUnauthorized:false} → ❌ self-signed certificate
//   B) URL SIN sslmode + ssl:{rejectUnauthorized:false} → ✅ conecta
//
// Por eso (c) —arrancarle el `sslmode` a la URL— no era un adorno: es la parte que
// hace el trabajo. Es lo que hace este helper, y es la convención del proyecto para
// RDS (`ssl: { rejectUnauthorized: false }`, ver CLAUDE.md → Base de Datos).
//
// El guardarraíl `__tests__/guardrails/testDbHelper.guardrail.test.ts` impide que
// vuelva a aparecer una conexión pelada: si alguien copia la variante (a), CI lo para.

// La receta vive en lib/db/pgSsl.cjs — misma fuente que usan los scripts operativos,
// para que tests y canarios no puedan volver a divergir en cómo conectan.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sinSslMode: sinSslModeCjs } = require('../../lib/db/pgSsl.cjs')

import { Client, Pool } from 'pg'
import type { ClientConfig, PoolConfig } from 'pg'

// ⚠️ AQUÍ NO SE CARGA dotenv, y es a propósito (medido el 31/07): al hacerlo, importar
// este helper METÍA `DATABASE_URL` en el entorno y despertaba suites que estaban
// dormidas a propósito. El pre-commit corre SIN BD, así que sus canarios de BD se
// saltan; con el dotenv aquí, `shuffleRoundtripBD` pasó a ejecutarse en cada commit
// y a teñir de rojo el hook de todo el mundo por un hallazgo que ni era del commit.
// Un helper de conexión no debe decidir QUIÉN corre. Cada suite carga su entorno
// (todas lo hacen ya), y el job de integración pasa `--setupFiles dotenv/config`.

// Nada de constantes con `process.env` a nivel de módulo: los `import` se evalúan
// ANTES del `dotenv.config()` que cada suite hace en su cuerpo, así que una constante
// aquí saldría vacía y el helper fallaría justo en los tests que sí tienen BD.
// Todo se lee en el momento de llamar.

/**
 * Config de conexión a RDS para tests.
 *
 * `rejectUnauthorized: false` es deliberado: el certificado de RDS lo firma una CA
 * privada de AWS que Node no trae en su almacén. La alternativa correcta sería
 * embarcar el bundle `rds-ca-rsa2048-g1`; si algún día se hace, **se cambia aquí y
 * solo aquí** — que es justamente el motivo de que este helper exista.
 */
export function testDbConfig(): ClientConfig & PoolConfig {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('testDbConfig(): DATABASE_URL no está en el entorno')
  return { connectionString: sinSslMode(url), ssl: { rejectUnauthorized: false } }
}

/**
 * Quita el `sslmode=…` de la cadena de conexión. Imprescindible: si se queda, gana
 * él y la opción `ssl` de arriba no se aplica (ver el bloque de arriba). Exportada
 * para que el guardarraíl pueda probarla en aislamiento.
 */
export const sinSslMode: (url: string) => string = sinSslModeCjs

/**
 * Cliente conectado y listo. El test se encarga de cerrarlo en `afterAll`:
 *
 *   let client: Client
 *   beforeAll(async () => { client = await openTestClient() })
 *   afterAll(async () => { await client?.end() })
 */
export async function openTestClient(): Promise<Client> {
  const client = new Client(testDbConfig())
  await client.connect()
  return client
}

/** Pool para las suites que miden concurrencia o rendimiento. Cerrar con `pool.end()`. */
export function openTestPool(): Pool {
  return new Pool(testDbConfig())
}
