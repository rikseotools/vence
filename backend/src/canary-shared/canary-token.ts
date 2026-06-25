import jwt from 'jsonwebtoken';

/**
 * Patrón ÚNICO de autenticación de canaries que pegan a endpoints autenticados
 * (`/api/v2/*` tras la migración C1). Firma un JWT HS256 compatible con
 * `verifyAuth`/`verifyJwtLocal` para el `userId` dado.
 *
 * Antes cada canary (answer-save, stats-pipeline, smoke-auth) copiaba este
 * bloque `jwt.sign`; `canary-theme-stats` se quedó SIN migrar y la migración C1
 * (que metió `verifyAuth` en el endpoint) lo rompió con 401. Este helper lo
 * unifica para que ningún canary futuro vuelva a quedarse sin token.
 *
 * Devuelve `null` si falta `SUPABASE_JWT_SECRET` (canary inactivo, no error).
 * Forward-compatible con la futura migración a Auth.js RS256/JWKS: cuando cambie
 * el algoritmo, solo cambia este fichero.
 */
export interface CanaryTokenOpts {
  ttlSeconds?: number;
  email?: string;
  secret?: string;
}

export function signCanaryToken(
  userId: string,
  opts: CanaryTokenOpts = {},
): string | null {
  const secret = opts.secret ?? process.env.SUPABASE_JWT_SECRET;
  if (!secret || !userId) return null;
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: opts.email ?? 'canary@vence.es',
      iat: now,
      exp: now + (opts.ttlSeconds ?? 300),
    },
    secret,
    { algorithm: 'HS256' },
  );
}
