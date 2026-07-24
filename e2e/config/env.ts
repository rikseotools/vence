// e2e/config/env.ts
//
// FUENTE ÚNICA de configuración del harness E2E. Todo lo que acopla a un entorno
// concreto (URL, cuenta, proveedor de sesión, BD para limpieza) se resuelve AQUÍ
// desde variables de entorno. Migrar de AWS a koigrid (u otro) = cambiar estas
// variables, NUNCA los tests ni los page objects.
//
//   E2E_BASE_URL        URL del app a probar (AWS ECS hoy, koigrid mañana, o local).
//   E2E_SESSION_PROVIDER 'bridge' | 'storage' | 'koigrid'  (cómo se autentica).
//   E2E_USER_EMAIL       cuenta con la que corre el harness (idealmente de test).
//   E2E_USER_PASSWORD    opcional, solo si el provider usa credenciales.
//   E2E_DATABASE_URL     BD para el cleanup (pg estándar; fallback a DATABASE_URL).

export const E2E_BASE_URL =
  process.env.E2E_BASE_URL ?? process.env.PROD_URL ?? 'https://www.vence.es'

// Proveedor de sesión activo. Es el ÚNICO punto que cambia si el stack de auth
// cambia (p.ej. koigrid). Ver e2e/helpers/sessionProvider.ts.
export const E2E_SESSION_PROVIDER = process.env.E2E_SESSION_PROVIDER ?? 'storage'

export const E2E_ACCOUNT = {
  email: process.env.E2E_USER_EMAIL ?? '',
  password: process.env.E2E_USER_PASSWORD ?? '',
}

// storageState autenticado que produce el setup y reutilizan todos los specs.
export const STORAGE_STATE = 'e2e/.auth/state.json'

// Estado capturado a mano (ruta 'storage'): login manual una vez → este fichero.
export const CAPTURED_STATE = process.env.E2E_CAPTURED_STATE ?? 'e2e/.auth/captured.json'

// BD para la limpieza de filas creadas por los tests (contrato Cleaner). pg estándar,
// no APIs de un proveedor concreto → agnóstico. Si koigrid mantiene Postgres, mismo
// código; si cambia de BD, se implementa otro Cleaner.
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
