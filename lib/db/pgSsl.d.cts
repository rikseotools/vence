// lib/db/pgSsl.d.ts — tipos de `pgSsl.cjs`, para que lo pueda importar TypeScript.
//
// ── POR QUÉ EXISTE (T-492/T-656, 08/08/2026) ─────────────────────────────────────────────────
// `pgSsl.cjs` es la ÚNICA forma correcta de construir la conexión a RDS con `pg`: la URL lleva
// `sslmode`, ese `sslmode` PISA la opción `ssl`, y sin quitarlo la conexión muere con
// «self-signed certificate in certificate chain». Por eso el guardarraíl `pgConfigUnico` exige que
// nadie la construya a mano.
//
// Al drenar los 27 scripts que la construían a mano, tres de ellos son **TypeScript del backend**
// (`clonar-documento.ts`, `sim-radar-por-fuente.ts`, `sim-reconciliacion-convocatoria.ts`), y el
// `tsc` del backend no puede tipar un `.cjs` sin declaración: `TS7016 … implicitly has an 'any'`.
// **Rompía el typecheck del backend, y la revisión de la entrega no lo vio** — es el defecto que
// solo aparece al juntar las piezas, no al mirar una rama por separado.
//
// Se declara aquí, junto al fichero (misma convención que `components/*.d.ts`), en vez de relajar
// el `tsconfig` del backend o poner `any` en cada import: el primero apaga la comprobación para
// todo el proyecto y el segundo la apaga en cada sitio nuevo que aparezca.

import type { ClientConfig } from 'pg'

/**
 * Configuración lista para `new Client(...)` / `new Pool(...)` contra RDS.
 *
 * Quita el `sslmode` de la URL —que es lo que rompe— y deja el `ssl` que de verdad manda.
 *
 * @param url  cadena de conexión; por defecto `process.env.DATABASE_URL`
 */
export function pgConfig(url?: string): ClientConfig
