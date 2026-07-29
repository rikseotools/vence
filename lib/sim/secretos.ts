// Vence Sim — RESOLUCIÓN DEL SECRETO DE SESIÓN (agnóstica del proveedor).
//
// El runner necesita `AUTH_SECRET` para forjar la cookie de sesión de la cuenta de test. De
// dónde sale ese valor es lo ÚNICO que ata el harness a una nube concreta, así que vive aquí
// y no repartido por el runner: mismo patrón que `e2e/helpers/sessionProvider.ts` (un contrato,
// N implementaciones).
//
//   SIM_SECRET_PROVIDER=env      → solo variables de entorno (por defecto, y lo único que hará
//                                  falta en koigrid: el orquestador inyecta el valor).
//   SIM_SECRET_PROVIDER=aws-ssm  → cae a SSM si el entorno no lo trae (comodidad en local con
//                                  perfil AWS). Es el ÚNICO punto del harness que habla AWS.
//
// Migrar de nube = seguir usando `env` (o escribir un proveedor nuevo de 5 líneas), NUNCA tocar
// el runner ni los journeys.

export type ProveedorSecreto = 'env' | 'aws-ssm'

export interface EntornoSecreto {
  /** Variables de entorno visibles (se inyecta para poder testear sin tocar `process.env`). */
  env: Record<string, string | undefined>
  /** Ejecuta un comando y devuelve su salida. Solo lo usa el proveedor `aws-ssm`. */
  ejecutar?: (comando: string) => string
}

export const LONGITUD_MINIMA_SECRETO = 10

/** Nombre del proveedor activo (por defecto `aws-ssm`, que es env-first con red de seguridad). */
export function proveedorActivo(env: Record<string, string | undefined>): ProveedorSecreto {
  const v = env.SIM_SECRET_PROVIDER
  return v === 'env' || v === 'aws-ssm' ? v : 'aws-ssm'
}

/**
 * Devuelve el secreto o `null` si no hay forma de obtenerlo (el llamador decide si eso es
 * "saltar el journey autenticado" o "fallar"; hoy el runner lo salta, que es lo correcto:
 * un entorno sin identidad no es un fallo del producto).
 */
export function resolverAuthSecret(entorno: EntornoSecreto): string | null {
  const { env } = entorno
  const deEnv = env.SIM_AUTH_SECRET || env.AUTH_SECRET
  if (deEnv && deEnv.length > LONGITUD_MINIMA_SECRETO) return deEnv

  if (proveedorActivo(env) !== 'aws-ssm' || !entorno.ejecutar) return null

  const ruta = env.SIM_AUTH_SECRET_SSM_PATH || '/vence-frontend/AUTH_SECRET'
  try {
    const valor = entorno
      .ejecutar(`aws ssm get-parameter --name "${ruta}" --with-decryption --query "Parameter.Value" --output text`)
      .trim()
    return valor.length > LONGITUD_MINIMA_SECRETO ? valor : null
  } catch {
    return null
  }
}

/** Identidad de la cuenta de TEST. Nunca un cliente real: sin ella, el journey se salta. */
export function resolverIdentidad(env: Record<string, string | undefined>): { userId: string; email: string } | null {
  const userId = env.SIM_IDENTITY_USER_ID || env.SMOKE_USER_ID
  if (!userId) return null
  return { userId, email: env.SIM_IDENTITY_EMAIL || 'smoke@vence.es' }
}
