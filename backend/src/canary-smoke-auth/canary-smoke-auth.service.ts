import { Injectable, Logger } from '@nestjs/common';

/**
 * Canary HTTP autenticado — Nivel 3 del roadmap canary-y-simulaciones.
 *
 * Cada 5 min hace flow crítico contra https://www.vence.es:
 *   1. POST /api/auth/login con smoke@vence.es + SMOKE_USER_PASSWORD.
 *   2. GET /api/profile?userId=<SMOKE_USER_ID> con Bearer.
 *   3. Validar response: 200 + planType esperado + latencia <2s.
 *
 * Hubiera cazado el incidente Rocío/Mercedes (27/05/2026) en ≤5 min:
 * cualquier regresión que rompa auth o profile → alarma critical inmediata.
 *
 * Origen: docs/roadmap/canary-y-simulaciones.md §Nivel 3.
 *
 * Pendiente humano antes de activarse:
 *   1. Crear smoke user en Supabase Auth: smoke@vence.es / password seguro.
 *   2. SSM put-parameter /vence-backend/SMOKE_USER_PASSWORD <password> SecureString.
 *   3. SSM put-parameter /vence-backend/SMOKE_USER_ID <uuid del smoke user> SecureString.
 *   4. Añadir ambos secrets a backend/infra/main.tf (igual que STRIPE_SECRET_KEY).
 *   5. terraform apply -target=aws_ecs_task_definition.backend.
 *   6. terraform apply -target=aws_iam_role_policy.task_execution_secrets.
 *   7. aws ecs update-service --force-new-deployment.
 *
 * Sin esos secrets, el service.run() devuelve { skipped: true } sin error
 * para no spam-alertar mientras se configura.
 */
@Injectable()
export class CanarySmokeAuthService {
  private readonly logger = new Logger(CanarySmokeAuthService.name);

  // Target absoluto — siempre producción real. Si quieres probar en preview,
  // sobreescribe la env SMOKE_TARGET_URL.
  private readonly TARGET_URL = process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';

  // Umbrales de éxito.
  private readonly MAX_TOTAL_DURATION_MS = 10_000; // 10s total para 2 requests
  private readonly EXPECTED_PLAN_TYPE = 'premium'; // el smoke user es premium

  async run(): Promise<CanaryResult> {
    const startedAt = Date.now();

    const email = process.env.SMOKE_USER_EMAIL ?? 'smoke@vence.es';
    const password = process.env.SMOKE_USER_PASSWORD;
    const userId = process.env.SMOKE_USER_ID;

    if (!password || !userId) {
      // Modo idle: no hay credenciales configuradas, no spam de alarmas.
      this.logger.warn(
        'SMOKE_USER_PASSWORD o SMOKE_USER_ID no configurados — canary inactivo. ' +
          'Configurar SSM /vence-backend/SMOKE_USER_PASSWORD y SMOKE_USER_ID + terraform apply.',
      );
      return {
        skipped: true,
        reason: 'credentials_not_configured',
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 1: login ───
    let accessToken: string;
    try {
      const loginRes = await fetch(`${this.TARGET_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Vence-Canary-Smoke/1.0',
          'x-vence-canary': '1',
        },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(5000),
      });

      if (!loginRes.ok) {
        const body = await loginRes.text().catch(() => '<no body>');
        return {
          ok: false,
          step: 'login',
          httpStatus: loginRes.status,
          errorMessage: `Login falló: HTTP ${loginRes.status} ${body.slice(0, 200)}`,
          durationMs: Date.now() - startedAt,
        };
      }

      const data = await loginRes.json();
      accessToken = data?.session?.access_token ?? data?.access_token;
      if (!accessToken) {
        return {
          ok: false,
          step: 'login',
          errorMessage: 'Login OK pero no devolvió access_token en el body',
          durationMs: Date.now() - startedAt,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'login',
        errorMessage: `Login excepción: ${msg}`,
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
            Authorization: `Bearer ${accessToken}`,
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
      step: 'login' | 'profile' | 'validate_plan' | 'validate_latency';
      httpStatus?: number;
      errorMessage: string;
      profilePlanType?: string | null;
      durationMs: number;
    };
