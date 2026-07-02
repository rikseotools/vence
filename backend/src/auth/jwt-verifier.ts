import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt, { type Algorithm, type JwtPayload } from 'jsonwebtoken';

/**
 * Resultado tipado de verificación de un JWT. Mismo contrato que
 * `lib/api/auth/verifyJwtLocal.ts` del frontend para que migrar callers
 * sea trivial.
 */
export type JwtVerifyResult =
  | {
      success: true;
      userId: string;
      email: string | null;
      role: string;
    }
  | {
      success: false;
      error:
        | 'no_token' // Bearer header ausente o malformado
        | 'no_secret_configured' // SUPABASE_JWT_SECRET no en env
        | 'invalid_signature' // firma no verifica
        | 'expired' // exp en el pasado
        | 'malformed' // JWT no parseable, claims faltantes
        | 'unsupported_alg' // header.alg no en whitelist
        | 'wrong_audience' // aud distinto de 'authenticated'
        | 'wrong_issuer'; // iss distinto del emisor propio (solo rama RS256)
    };

/** Datos del usuario inyectados en `request.user` por el JwtGuard. */
export interface AuthenticatedUser {
  userId: string;
  email: string | null;
  role: string;
}

/**
 * Verificador de JWT agnóstico. Misma semántica que
 * `lib/api/auth/verifyJwtLocal.ts` del frontend — se elige `jsonwebtoken`
 * por consistencia (es la misma lib que usa el frontend) y por estabilidad
 * con Jest CJS.
 *
 * Importante: este verifier NO conoce Supabase. Valida cualquier JWT HS256
 * firmado con el secret configurado (`SUPABASE_JWT_SECRET` hoy; el día que
 * migremos a Auth.js / Better Auth / Cognito, sólo cambia el secret).
 *
 * Seguridad crítica:
 *   - Whitelist explícita HS256 (anti algorithm-confusion attack).
 *   - Validación estricta de audience ('authenticated').
 *   - exp + iat verificados con clockTolerance 5s.
 */
@Injectable()
export class JwtVerifier {
  private readonly logger = new Logger(JwtVerifier.name);
  private readonly secret: string | null;
  /** Clave PÚBLICA RSA (PEM SPKI) para verificar los RS256 de Auth.js (Fase B). */
  private readonly rs256PublicKey: string | null;
  /** Emisor esperado en los RS256 propios. */
  private readonly issuer: string;

  /** Audience esperado en tokens de user autenticado. */
  private static readonly EXPECTED_AUDIENCE = 'authenticated';

  /** Algoritmos permitidos por RAMA. NUNCA añadir 'none'. Nunca mezclar material. */
  private static readonly HS_ALGORITHMS: Algorithm[] = ['HS256'];
  private static readonly RS_ALGORITHMS: Algorithm[] = ['RS256'];

  constructor(config: ConfigService) {
    const secret = config.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) {
      this.logger.warn(
        'SUPABASE_JWT_SECRET no configurada — endpoints autenticados devolverán 401',
      );
      this.secret = null;
    } else {
      this.secret = secret;
    }
    // RS256/JWKS (Fase B): DORMIDO si la clave pública no está inyectada.
    this.rs256PublicKey = config.get<string>('AUTH_JWT_PUBLIC_KEY') || null;
    this.issuer =
      config.get<string>('AUTH_JWT_ISSUER') || 'https://www.vence.es';
  }

  /**
   * Verifica un access token JWT enrutando por el `alg` del header
   * (doble-aceptación de Fase B):
   *   - RS256 → clave pública propia (tokens nuevos de Auth.js)
   *   - HS256 → secreto Supabase (tokens legacy, intacto)
   * Whitelist POR RAMA con material de clave separado → anti algorithm-confusion
   * (la pública RSA JAMÁS se usa como secreto HS).
   *
   * @param token Bearer token SIN el prefijo "Bearer ".
   * @returns Resultado tipado con userId/email/role o error categórico.
   */
  verify(token: string | null | undefined): JwtVerifyResult {
    if (!token || typeof token !== 'string' || token.length === 0) {
      return { success: false, error: 'no_token' };
    }

    // Leer el alg del header SIN verificar (solo para enrutar).
    let decoded: ReturnType<typeof jwt.decode>;
    try {
      decoded = jwt.decode(token, { complete: true });
    } catch {
      return { success: false, error: 'malformed' };
    }
    // Basura que no es un JWT decodable → malformed (no unsupported_alg).
    if (!decoded || typeof decoded === 'string') {
      return { success: false, error: 'malformed' };
    }

    const alg = decoded.header?.alg;
    if (alg === 'RS256') return this.verifyRs256(token);
    if (alg === 'HS256') return this.verifyHs256(token);
    // JWT decodable pero con alg no permitido (p.ej. 'none') → unsupported_alg.
    return { success: false, error: 'unsupported_alg' };
  }

  /** Rama HS256 (Supabase legacy) — comportamiento histórico intacto. */
  private verifyHs256(token: string): JwtVerifyResult {
    if (!this.secret) {
      return { success: false, error: 'no_secret_configured' };
    }

    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: JwtVerifier.HS_ALGORITHMS,
        audience: JwtVerifier.EXPECTED_AUDIENCE,
        clockTolerance: 5,
      }) as JwtPayload;

      // Defense in depth: exigimos sub explícito aunque jwt.verify ya validó.
      const userId = typeof payload.sub === 'string' ? payload.sub : null;
      if (!userId) {
        return { success: false, error: 'malformed' };
      }

      const email =
        typeof payload.email === 'string' ? (payload.email as string) : null;
      const role =
        typeof payload.role === 'string'
          ? (payload.role as string)
          : 'authenticated';

      return { success: true, userId, email, role };
    } catch (err) {
      if (!(err instanceof Error)) {
        return { success: false, error: 'malformed' };
      }
      // jsonwebtoken tira errores con `name` específico — mapeamos a nuestra
      // taxonomía (idéntica al verifyJwtLocal del frontend).
      if (err.name === 'TokenExpiredError') {
        return { success: false, error: 'expired' };
      }
      if (err.name === 'JsonWebTokenError') {
        const msg = err.message.toLowerCase();
        if (msg.includes('signature')) return { success: false, error: 'invalid_signature' };
        if (msg.includes('audience')) return { success: false, error: 'wrong_audience' };
        if (msg.includes('algorithm')) return { success: false, error: 'unsupported_alg' };
        if (msg.includes('malformed') || msg.includes('jwt must')) {
          return { success: false, error: 'malformed' };
        }
        // Fallback safe — tratamos como malformed (no como invalid_signature).
        return { success: false, error: 'malformed' };
      }
      if (err.name === 'NotBeforeError') {
        return { success: false, error: 'expired' }; // mismo bucket UX
      }
      return { success: false, error: 'malformed' };
    }
  }

  /** Rama RS256 (Auth.js) — clave PÚBLICA propia, DORMIDA hasta el flip de Fase B. */
  private verifyRs256(token: string): JwtVerifyResult {
    if (!this.rs256PublicKey) {
      return { success: false, error: 'no_secret_configured' };
    }

    try {
      const payload = jwt.verify(token, this.rs256PublicKey, {
        algorithms: JwtVerifier.RS_ALGORITHMS,
        audience: JwtVerifier.EXPECTED_AUDIENCE,
        issuer: this.issuer,
        clockTolerance: 5,
      }) as JwtPayload;

      const userId = typeof payload.sub === 'string' ? payload.sub : null;
      if (!userId) {
        return { success: false, error: 'malformed' };
      }
      const email =
        typeof payload.email === 'string' ? (payload.email as string) : null;
      const role =
        typeof payload.role === 'string'
          ? (payload.role as string)
          : 'authenticated';

      return { success: true, userId, email, role };
    } catch (err) {
      if (!(err instanceof Error)) {
        return { success: false, error: 'malformed' };
      }
      if (err.name === 'TokenExpiredError') {
        return { success: false, error: 'expired' };
      }
      if (err.name === 'JsonWebTokenError') {
        const msg = err.message.toLowerCase();
        if (msg.includes('signature')) return { success: false, error: 'invalid_signature' };
        if (msg.includes('audience')) return { success: false, error: 'wrong_audience' };
        if (msg.includes('issuer')) return { success: false, error: 'wrong_issuer' };
        if (msg.includes('algorithm')) return { success: false, error: 'unsupported_alg' };
        if (msg.includes('malformed') || msg.includes('jwt must')) {
          return { success: false, error: 'malformed' };
        }
        return { success: false, error: 'malformed' };
      }
      if (err.name === 'NotBeforeError') {
        return { success: false, error: 'expired' };
      }
      return { success: false, error: 'malformed' };
    }
  }

  /**
   * Extrae el token Bearer del header Authorization.
   * Devuelve null si el header está ausente o no tiene prefijo "Bearer ".
   */
  static extractBearerToken(
    authHeader: string | null | undefined,
  ): string | null {
    if (!authHeader || typeof authHeader !== 'string') return null;
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }
}
