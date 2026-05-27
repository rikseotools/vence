import { Injectable, Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';

/**
 * Canary HTTP autenticado — Nivel 3 del roadmap canary-y-simulaciones.
 *
 * APPROACH AGNÓSTICO (decisión 27/05/2026):
 * En vez de hacer login real contra Supabase Auth REST (acoplarse al
 * proveedor), firmamos localmente un JWT smoke con `SUPABASE_JWT_SECRET`
 * — la misma clave que el `JwtVerifier` del backend usa para verificar
 * cualquier token entrante. Cuando se migre a otro proveedor, solo cambia
 * la lógica de firma; el canary sigue igual.
 *
 * Lo que SÍ cubre: regresiones en `/api/profile` (validación JWT, RLS,
 * Drizzle, timeouts, deploy roto, hidratación, etc.). Cualquier regresión
 * en el endpoint protegido más caliente de la app dispara alarma en ≤5min.
 *
 * Lo que NO cubre: caída de Supabase Auth como proveedor. Esa cobertura
 * la dará el smoke E2E del Nivel 4 (Playwright + login real). Hoy no la
 * necesitamos porque NO depende de Vence — si Supabase cae, lo notamos
 * por el status page del proveedor y otros mil sitios.
 *
 * Flow:
 *   1. Al arrancar el módulo, firmar JWT con HS256 (mismo formato que
 *      Supabase) + sub=SMOKE_USER_ID + audience='authenticated' + exp 1h.
 *      Se firma en cada `run()` para evitar tener JWTs largos en memoria.
 *   2. GET https://www.vence.es/api/profile?userId=<SMOKE_USER_ID> con Bearer.
 *   3. Validar response: 200 + planType esperado + latencia total <10s.
 *
 * Origen: docs/roadmap/canary-y-simulaciones.md §Nivel 3.
 *
 * Pendiente humano antes de activarse (mucho más simple que el approach
 * Supabase REST, evita 3 SSM params y un endpoint custom):
 *   1. Crear `smoke@vence.es` en Supabase Auth (vía dashboard o admin API)
 *      + UPSERT `user_profiles` con `plan_type='premium'`.
 *   2. SSM put-parameter /vence-backend/SMOKE_USER_ID <uuid> String.
 *   3. Añadir SMOKE_USER_ID a backend/infra/main.tf (environment, NO secret
 *      — es un UUID público, no es credencial).
 *   4. terraform apply + aws ecs update-service --force-new-deployment.
 *
 * Sin SMOKE_USER_ID, el service devuelve { skipped: true } sin error
 * para no spam-alertar mientras se configura.
 *
 * SUPABASE_JWT_SECRET ya está en el backend (lo usa JwtGuard) — no hay
 * que añadirlo.
 */
@Injectable()
export class CanarySmokeAuthService {
  private readonly logger = new Logger(CanarySmokeAuthService.name);

  private readonly TARGET_URL = process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly MAX_TOTAL_DURATION_MS = 10_000;
  private readonly EXPECTED_PLAN_TYPE = 'premium';
  // 1h de vida para el token smoke. No es persistente — se firma en cada
  // run() del cron (cada 5min). El JWT vive como mucho 5min en flight.
  private readonly TOKEN_TTL_SECONDS = 3600;

  async run(): Promise<CanaryResult> {
    const startedAt = Date.now();

    const userId = process.env.SMOKE_USER_ID;
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!userId || !jwtSecret) {
      this.logger.warn(
        'SMOKE_USER_ID o SUPABASE_JWT_SECRET no configurados — canary inactivo. ' +
          'Configurar SSM /vence-backend/SMOKE_USER_ID + terraform apply.',
      );
      return {
        skipped: true,
        reason: 'credentials_not_configured',
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 1: firmar JWT smoke localmente (mismo formato que el SDK) ───
    let token: string;
    try {
      const now = Math.floor(Date.now() / 1000);
      token = jwt.sign(
        {
          sub: userId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'smoke@vence.es',
          iat: now,
          exp: now + this.TOKEN_TTL_SECONDS,
        },
        jwtSecret,
        { algorithm: 'HS256' },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'sign_token',
        errorMessage: `Firma JWT falló: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 2: GET /api/profile con Bearer ───
    let profilePlanType: string | null = null;
    try {
      const profileRes = await fetch(
        `${this.TARGET_URL}/api/profile?userId=${encodeURIComponent(userId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'Vence-Canary-Smoke/1.0',
            'x-vence-canary': '1',
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!profileRes.ok) {
        const body = await profileRes.text().catch(() => '<no body>');
        return {
          ok: false,
          step: 'profile',
          httpStatus: profileRes.status,
          errorMessage: `Profile falló: HTTP ${profileRes.status} ${body.slice(0, 200)}`,
          durationMs: Date.now() - startedAt,
        };
      }

      const data = await profileRes.json();
      profilePlanType = data?.data?.planType ?? data?.data?.plan_type ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'profile',
        errorMessage: `Profile excepción: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 3: validar planType esperado ───
    if (profilePlanType !== this.EXPECTED_PLAN_TYPE) {
      return {
        ok: false,
        step: 'validate_plan',
        errorMessage: `Esperado planType=${this.EXPECTED_PLAN_TYPE}, recibido ${profilePlanType}`,
        profilePlanType,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 4: validar latencia total ───
    const durationMs = Date.now() - startedAt;
    if (durationMs > this.MAX_TOTAL_DURATION_MS) {
      return {
        ok: false,
        step: 'validate_latency',
        errorMessage: `Latencia total ${durationMs}ms > umbral ${this.MAX_TOTAL_DURATION_MS}ms`,
        profilePlanType,
        durationMs,
      };
    }

    return {
      ok: true,
      profilePlanType,
      durationMs,
    };
  }
}

export type CanaryResult =
  | { ok: true; profilePlanType: string | null; durationMs: number }
  | { skipped: true; reason: string; durationMs: number }
  | {
      ok: false;
      step: 'sign_token' | 'profile' | 'validate_plan' | 'validate_latency';
      httpStatus?: number;
      errorMessage: string;
      profilePlanType?: string | null;
      durationMs: number;
    };
