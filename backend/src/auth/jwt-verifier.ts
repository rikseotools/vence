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
        | 'wrong_audience'; // aud distinto de 'authenticated'
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

  /** Audience esperado en tokens de user autenticado. */
  private static readonly EXPECTED_AUDIENCE = 'authenticated';

  /** Algoritmos permitidos. NUNCA añadir 'none' aquí. */
  private static readonly ALLOWED_ALGORITHMS: Algorithm[] = ['HS256'];

  constructor(config: ConfigService) {
    const secret = config.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) {
      this.logger.warn(
        'SUPABASE_JWT_SECRET no configurada — endpoints autenticados devolverán 401',
      );
      this.secret = null;
      return;
    }
    this.secret = secret;
  }

  /**
   * Verifica un access token JWT.
   *
   * @param token Bearer token SIN el prefijo "Bearer ".
   * @returns Resultado tipado con userId/email/role o error categórico.
   */
  verify(token: string | null | undefined): JwtVerifyResult {
    if (!token || typeof token !== 'string' || token.length === 0) {
      return { success: false, error: 'no_token' };
    }
    if (!this.secret) {
      return { success: false, error: 'no_secret_configured' };
    }

    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: JwtVerifier.ALLOWED_ALGORITHMS,
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
