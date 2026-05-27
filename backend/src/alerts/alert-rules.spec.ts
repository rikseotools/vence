// backend/src/alerts/alert-rules.spec.ts
//
// Tests de las reglas de alerta añadidas en Bloque 4 Fase 1.6 (2026-05-26).
// Focal en las 4 nuevas: runtime_kill, tts_error_burst,
// hydration_mismatch_spike, workflow_failure_burst.

import {
  ALERT_RULES,
  RULE_HYDRATION_MISMATCH_SPIKE,
  RULE_RUNTIME_KILL,
  RULE_TTS_ERROR_BURST,
  RULE_WORKFLOW_FAILURE_BURST,
  RULE_SUBSCRIPTION_VOID_FAILED,
  RULE_SUBSCRIPTION_FORCE_CANCEL_BURST,
  RULE_SUBSCRIPTION_CANCEL_ERROR_BURST,
  RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED,
  RULE_STRIPE_WEBHOOK_4XX_BURST,
  RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB,
  RULE_CANARY_AUTH_FAILED,
  RULE_CANARY_WEBHOOK_FAILED,
  RULE_CANARY_ANSWER_SAVE_FAILED,
  RULE_CANARY_DB_POOL_FAILED,
  RULE_CANARY_REDIS_FAILED,
} from './alert-rules';

describe('RULE_RUNTIME_KILL', () => {
  it('dispara con cualquier runtime_kill (n>0)', () => {
    const rows = [{ n: 1, topEndpoint: '/api/v2/admin/dashboard' }];
    expect(RULE_RUNTIME_KILL.shouldFire(rows)).toBe(true);
  });

  it('NO dispara con 0 runtime_kills', () => {
    const rows = [{ n: 0, topEndpoint: null }];
    expect(RULE_RUNTIME_KILL.shouldFire(rows)).toBe(false);
  });

  it('NO dispara con resultado vacío', () => {
    expect(RULE_RUNTIME_KILL.shouldFire([])).toBe(false);
  });

  it('notification incluye count + endpoint + cmd SQL útil', () => {
    const notif = RULE_RUNTIME_KILL.buildNotification([
      { n: 3, topEndpoint: '/api/v2/admin/dashboard' },
    ]);
    expect(notif.title).toContain('3');
    expect(notif.title).toContain('/api/v2/admin/dashboard');
    expect(notif.body).toContain('SELECT');
    expect(notif.body).toContain('runtime_kill');
    expect(notif.fingerprint).toBe('runtime_kill_/api/v2/admin/dashboard');
  });

  it('cooldown 10 min — más permisivo que 5xx_spike (queremos saber pronto)', () => {
    expect(RULE_RUNTIME_KILL.cooldownMin).toBe(10);
  });
});

describe('RULE_TTS_ERROR_BURST', () => {
  it('dispara con cualquier sesión que tenga ≥10 errores en 5 min', () => {
    const rows = [
      { sessionId: 'sess-abc', browser: 'chrome', isMobile: 'true', errors: 12 },
    ];
    expect(RULE_TTS_ERROR_BURST.shouldFire(rows)).toBe(true);
  });

  it('NO dispara sin sesiones', () => {
    expect(RULE_TTS_ERROR_BURST.shouldFire([])).toBe(false);
  });

  it('notification lista sesiones afectadas con browser/mobile', () => {
    const rows = [
      { sessionId: 'sess-aaaa1111', browser: 'chrome', isMobile: 'true', errors: 50 },
      { sessionId: 'sess-bbbb2222', browser: 'safari', isMobile: 'false', errors: 15 },
    ];
    const notif = RULE_TTS_ERROR_BURST.buildNotification(rows);
    expect(notif.title).toContain('2');
    expect(notif.body).toContain('sess-aaa');
    expect(notif.body).toContain('chrome');
    expect(notif.body).toContain('mobile=true');
    expect(notif.body).toContain('sess-bbb');
    expect(notif.body).toContain('MAX_CONSECUTIVE_CHUNK_ERRORS');
  });

  it('limita a 10 sesiones en el body para no saturar el email', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      sessionId: `sess-${i}`,
      browser: 'chrome',
      isMobile: 'true',
      errors: 12,
    }));
    const notif = RULE_TTS_ERROR_BURST.buildNotification(rows);
    // Mostrar 10 en body, total en title
    expect(notif.title).toContain('20');
    const sessionLines = (notif.body.match(/sesión sess-/g) ?? []).length;
    expect(sessionLines).toBe(10);
  });

  it('severity warn (es UX por user individual, no sistema)', () => {
    expect(RULE_TTS_ERROR_BURST.severity).toBe('warn');
  });

  it('cooldown 60 min — el bug es de user individual, no global', () => {
    expect(RULE_TTS_ERROR_BURST.cooldownMin).toBe(60);
  });
});

describe('RULE_HYDRATION_MISMATCH_SPIKE', () => {
  it('dispara con cualquier (endpoint, deploy) con ≥5 mismatches', () => {
    const rows = [
      { endpoint: '/auxiliar-administrativo-madrid/temario/tema-1', deployVersion: 'abc123', n: 7 },
    ];
    expect(RULE_HYDRATION_MISMATCH_SPIKE.shouldFire(rows)).toBe(true);
  });

  it('NO dispara sin filas', () => {
    expect(RULE_HYDRATION_MISMATCH_SPIKE.shouldFire([])).toBe(false);
  });

  it('notification lista cada ruta afectada con deploy', () => {
    const rows = [
      { endpoint: '/ruta/uno', deployVersion: 'abc123', n: 8 },
      { endpoint: '/ruta/dos', deployVersion: 'abc123', n: 5 },
    ];
    const notif = RULE_HYDRATION_MISMATCH_SPIKE.buildNotification(rows);
    expect(notif.title).toContain('2');
    expect(notif.body).toContain('/ruta/uno');
    expect(notif.body).toContain('[abc123]');
    expect(notif.body).toContain('8 mismatches');
    expect(notif.body).toContain('new Date()');
  });

  it('tolera endpoint/deployVersion null sin romper', () => {
    const rows = [{ endpoint: null, deployVersion: null, n: 6 }];
    const notif = RULE_HYDRATION_MISMATCH_SPIKE.buildNotification(rows);
    expect(notif.body).toContain('(unknown)');
    expect(notif.body).toContain('[?]');
  });

  it('severity error (no critical) — regresión hydration es seria pero no caída', () => {
    expect(RULE_HYDRATION_MISMATCH_SPIKE.severity).toBe('error');
  });

  it('cooldown 60 min — se silencia hasta el siguiente deploy', () => {
    expect(RULE_HYDRATION_MISMATCH_SPIKE.cooldownMin).toBe(60);
  });
});

describe('RULE_WORKFLOW_FAILURE_BURST', () => {
  it('dispara con cualquier workflow con ≥2 fallos en 30 min', () => {
    const rows = [{ workflow: 'frontend-deploy', failures: 4 }];
    expect(RULE_WORKFLOW_FAILURE_BURST.shouldFire(rows)).toBe(true);
  });

  it('NO dispara sin filas', () => {
    expect(RULE_WORKFLOW_FAILURE_BURST.shouldFire([])).toBe(false);
  });

  it('notification incluye nombre del workflow y conteo', () => {
    const rows = [
      { workflow: 'frontend-deploy', failures: 4 },
      { workflow: 'backend-tests', failures: 2 },
    ];
    const notif = RULE_WORKFLOW_FAILURE_BURST.buildNotification(rows);
    expect(notif.title).toContain('2');
    expect(notif.body).toContain('frontend-deploy');
    expect(notif.body).toContain('4 fallos');
    expect(notif.body).toContain('backend-tests');
    expect(notif.body).toContain('2 fallos');
    expect(notif.body).toContain('SELECT');
  });

  it('tolera workflow null', () => {
    const rows = [{ workflow: null, failures: 3 }];
    const notif = RULE_WORKFLOW_FAILURE_BURST.buildNotification(rows);
    expect(notif.body).toContain('(unknown)');
  });
});

describe('ALERT_RULES — registro completo', () => {
  it('todas las reglas tienen nombre único', () => {
    const names = ALERT_RULES.map((r) => r.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('incluye las 4 reglas nuevas de Fase 1.6', () => {
    const names = ALERT_RULES.map((r) => r.name);
    expect(names).toContain('runtime_kill');
    expect(names).toContain('tts_error_burst');
    expect(names).toContain('hydration_mismatch_spike');
    expect(names).toContain('workflow_failure_burst');
  });

  it('incluye las 3 reglas nuevas de cancel-flow robusto (27/05/2026)', () => {
    const names = ALERT_RULES.map((r) => r.name);
    expect(names).toContain('subscription_void_failed');
    expect(names).toContain('subscription_force_cancel_burst');
    expect(names).toContain('subscription_cancel_error_burst');
  });

  it('incluye las 2 reglas de webhook entrante robusto (27/05/2026)', () => {
    const names = ALERT_RULES.map((r) => r.name);
    expect(names).toContain('stripe_webhook_signature_failed');
    expect(names).toContain('stripe_webhook_4xx_burst');
  });

  it('incluye regla de Pass-2 reconciliation: drift missing in DB', () => {
    const names = ALERT_RULES.map((r) => r.name);
    expect(names).toContain('subscription_drift_missing_in_db');
  });
});

describe('RULE_SUBSCRIPTION_VOID_FAILED', () => {
  it('dispara con cualquier void failed (n>=1)', () => {
    expect(
      RULE_SUBSCRIPTION_VOID_FAILED.shouldFire([
        { n: 1, topUser: 'user-1', lastError: 'Card declined' },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 0', () => {
    expect(
      RULE_SUBSCRIPTION_VOID_FAILED.shouldFire([
        { n: 0, topUser: null, lastError: null },
      ]),
    ).toBe(false);
  });

  it('notification incluye user + último error + SQL útil', () => {
    const notif = RULE_SUBSCRIPTION_VOID_FAILED.buildNotification([
      { n: 2, topUser: 'b6de5d74-aaaa', lastError: 'No such invoice' },
    ]);
    expect(notif.title).toContain('2');
    expect(notif.body).toContain('b6de5d74');
    expect(notif.body).toContain('No such invoice');
    expect(notif.body).toContain('SELECT');
    expect(notif.fingerprint).toBe('void_failed_b6de5d74-aaaa');
  });

  it('severity=error (cobros activos pendientes = bloqueante)', () => {
    expect(RULE_SUBSCRIPTION_VOID_FAILED.severity).toBe('error');
  });
});

describe('RULE_SUBSCRIPTION_FORCE_CANCEL_BURST', () => {
  it('dispara con ≥5 en 1h (señal de problema sistémico de cobros)', () => {
    expect(RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.shouldFire([{ n: 5 }])).toBe(true);
    expect(RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.shouldFire([{ n: 12 }])).toBe(true);
  });

  it('NO dispara con <5 (tasa normal <2/h, 3-4 es ruido aceptable)', () => {
    expect(RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.shouldFire([{ n: 4 }])).toBe(false);
    expect(RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.shouldFire([{ n: 0 }])).toBe(false);
  });

  it('notification incluye SQL para investigar últimas 2h', () => {
    const notif = RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.buildNotification([{ n: 8 }]);
    expect(notif.title).toContain('8');
    expect(notif.body).toContain('SELECT');
    expect(notif.body).toContain('subscription_force_canceled_past_due');
  });
});

describe('RULE_SUBSCRIPTION_CANCEL_ERROR_BURST', () => {
  it('dispara con ≥3 errores en 15 min', () => {
    expect(
      RULE_SUBSCRIPTION_CANCEL_ERROR_BURST.shouldFire([
        { n: 3, lastMsg: 'Stripe timeout' },
      ]),
    ).toBe(true);
  });

  it('NO dispara con <3 (1-2 errores en 15 min son ruido)', () => {
    expect(
      RULE_SUBSCRIPTION_CANCEL_ERROR_BURST.shouldFire([{ n: 2, lastMsg: 'x' }]),
    ).toBe(false);
  });

  it('notification incluye último mensaje + SQL', () => {
    const notif = RULE_SUBSCRIPTION_CANCEL_ERROR_BURST.buildNotification([
      { n: 5, lastMsg: 'StripeAPIError: 500' },
    ]);
    expect(notif.body).toContain('StripeAPIError: 500');
    expect(notif.body).toContain('status.stripe.com');
  });

  it('toda regla tiene severity válida', () => {
    for (const r of ALERT_RULES) {
      expect(['warn', 'error', 'critical']).toContain(r.severity);
    }
  });

  it('toda regla tiene cooldown > 0', () => {
    for (const r of ALERT_RULES) {
      expect(r.cooldownMin).toBeGreaterThan(0);
    }
  });
});

describe('RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED', () => {
  it('dispara con ≥1 (instant — cualquier firma fallida = pago no procesado)', () => {
    expect(
      RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED.shouldFire([
        { n: 1, lastMsg: 'Webhook signature verification failed' },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 0', () => {
    expect(
      RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED.shouldFire([{ n: 0, lastMsg: null }]),
    ).toBe(false);
  });

  it('severity=critical (es el bug más caro: pagos sin procesar)', () => {
    expect(RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED.severity).toBe('critical');
  });

  it('notification incluye runbook con 4 pasos exactos (SSM + redeploy + resend)', () => {
    const notif = RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED.buildNotification([
      { n: 12, lastMsg: 'Webhook signature verification failed' },
    ]);
    expect(notif.title).toContain('12');
    expect(notif.body).toContain('STRIPE_WEBHOOK_SECRET');
    expect(notif.body).toContain('dashboard.stripe.com');
    expect(notif.body).toContain('aws ssm put-parameter');
    expect(notif.body).toContain('aws ecs update-service');
    expect(notif.body).toContain('reenviar eventos fallidos');
    expect(notif.fingerprint).toBe('stripe_webhook_signature_failed');
  });

  it('cooldown 15 min (queremos saber ya pero no spam)', () => {
    expect(RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED.cooldownMin).toBe(15);
  });
});

describe('RULE_STRIPE_WEBHOOK_4XX_BURST', () => {
  it('dispara con ≥5 4xx en 10 min (excluyendo signature_failed)', () => {
    expect(
      RULE_STRIPE_WEBHOOK_4XX_BURST.shouldFire([{ n: 5, topError: 'Invalid body' }]),
    ).toBe(true);
  });

  it('NO dispara con <5', () => {
    expect(
      RULE_STRIPE_WEBHOOK_4XX_BURST.shouldFire([{ n: 4, topError: null }]),
    ).toBe(false);
  });

  it('severity=error (complementa la critical de signature)', () => {
    expect(RULE_STRIPE_WEBHOOK_4XX_BURST.severity).toBe('error');
  });

  it('notification incluye SQL útil para investigar', () => {
    const notif = RULE_STRIPE_WEBHOOK_4XX_BURST.buildNotification([
      { n: 8, topError: 'Unexpected token in body' },
    ]);
    expect(notif.title).toContain('8');
    expect(notif.body).toContain('Unexpected token');
    expect(notif.body).toContain('SELECT');
    expect(notif.body).toContain('stripe/webhook');
  });
});

describe('RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB (Pass-2)', () => {
  it('dispara con detected≥1 (cualquier sub Stripe sin BD = pago no procesado)', () => {
    expect(RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([{ detected: 1, fixed: 1 }])).toBe(true);
    expect(RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([{ detected: 3, fixed: 2 }])).toBe(true);
  });

  it('NO dispara con detected=0 (sin filas tampoco)', () => {
    expect(RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([{ detected: 0, fixed: 0 }])).toBe(false);
    expect(RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([])).toBe(false);
  });

  it('dispara aunque fixed===detected (la mitigación NO silencia la alerta — el bug raíz sigue)', () => {
    // Caso típico: Pass-2 detecta 3 subs missing y las arregla todas. Aun
    // así disparamos porque eso significa que el webhook entrante sigue roto.
    expect(RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([{ detected: 3, fixed: 3 }])).toBe(true);
  });

  it('notification incluye conteo detected/fixed + runbook hacia el bug raíz', () => {
    const notif = RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.buildNotification([
      { detected: 5, fixed: 5 },
    ]);
    expect(notif.title).toContain('5');
    expect(notif.body).toContain('webhook');
    expect(notif.body).toContain('stripe_webhook_signature_failed');
    expect(notif.body).toContain('stripe_webhook_4xx_burst');
    expect(notif.fingerprint).toBe('subscription_drift_missing_in_db');
  });

  it('severity=error — el daño está mitigado por el auto-fix, pero el bug raíz no', () => {
    expect(RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.severity).toBe('error');
  });
});

describe('RULE_CANARY_AUTH_FAILED', () => {
  it('dispara con ≥1 fallo (cualquier canary auth roto = users afectados ahora)', () => {
    expect(
      RULE_CANARY_AUTH_FAILED.shouldFire([
        { n: 1, lastStep: 'login', lastError: 'HTTP 500', lastStatus: 500 },
      ]),
    ).toBe(true);
  });

  it('NO dispara con n=0 ni filas vacías (canary verde = silencio)', () => {
    expect(
      RULE_CANARY_AUTH_FAILED.shouldFire([
        { n: 0, lastStep: null, lastError: null, lastStatus: null },
      ]),
    ).toBe(false);
    expect(RULE_CANARY_AUTH_FAILED.shouldFire([])).toBe(false);
  });

  it('severity=critical (P1 — flow crítico de auth roto en prod)', () => {
    expect(RULE_CANARY_AUTH_FAILED.severity).toBe('critical');
  });

  it('notification incluye step + http_status + error + runbook con 5 acciones', () => {
    const notif = RULE_CANARY_AUTH_FAILED.buildNotification([
      {
        n: 3,
        lastStep: 'profile',
        lastError: 'Profile falló: HTTP 401 Unauthorized',
        lastStatus: 401,
      },
    ]);
    expect(notif.title).toContain('3');
    expect(notif.title).toContain('Canary');
    expect(notif.body).toContain('profile');
    expect(notif.body).toContain('401');
    expect(notif.body).toContain('Unauthorized');
    expect(notif.body).toContain('/admin/salud-sistema');
    expect(notif.body).toContain('rollback');
    expect(notif.body).toContain('canary-y-simulaciones.md');
    expect(notif.fingerprint).toBe('canary_auth_failed');
  });

  it('cooldown 15 min (saber rápido pero sin spam si la regresión persiste)', () => {
    expect(RULE_CANARY_AUTH_FAILED.cooldownMin).toBe(15);
  });
});

describe('RULE_CANARY_WEBHOOK_FAILED', () => {
  it('dispara con ≥1 fallo (cualquier rotura del webhook = pagos en riesgo)', () => {
    expect(
      RULE_CANARY_WEBHOOK_FAILED.shouldFire([
        { n: 1, lastStep: 'http', lastError: 'HTTP 400 signature failed', lastStatus: 400 },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 0 fallos ni filas vacías', () => {
    expect(
      RULE_CANARY_WEBHOOK_FAILED.shouldFire([
        { n: 0, lastStep: null, lastError: null, lastStatus: null },
      ]),
    ).toBe(false);
    expect(RULE_CANARY_WEBHOOK_FAILED.shouldFire([])).toBe(false);
  });

  it('severity=critical (P1 — pagos potencialmente sin procesar)', () => {
    expect(RULE_CANARY_WEBHOOK_FAILED.severity).toBe('critical');
  });

  it('notification cita Rocío/Mercedes + runbook con 5 acciones step-aware', () => {
    const notif = RULE_CANARY_WEBHOOK_FAILED.buildNotification([
      { n: 2, lastStep: 'http', lastError: 'HTTP 400 signature verification failed', lastStatus: 400 },
    ]);
    expect(notif.title).toContain('2');
    expect(notif.title).toContain('Stripe webhook');
    expect(notif.body).toContain('Rocío/Mercedes');
    expect(notif.body).toContain('400');
    expect(notif.body).toContain('STRIPE_WEBHOOK_SECRET');
    expect(notif.body).toContain('rotar');
    expect(notif.body).toContain('canary-y-simulaciones.md');
    expect(notif.fingerprint).toBe('canary_stripe_webhook_failed');
  });

  it('cooldown 15 min', () => {
    expect(RULE_CANARY_WEBHOOK_FAILED.cooldownMin).toBe(15);
  });
});

describe('RULE_CANARY_ANSWER_SAVE_FAILED', () => {
  it('dispara con ≥1 fallo (cualquier rotura del endpoint más caliente = app inutilizable)', () => {
    expect(
      RULE_CANARY_ANSWER_SAVE_FAILED.shouldFire([
        { n: 1, lastStep: 'http', lastError: 'HTTP 503 saturated', lastStatus: 503 },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 0 fallos ni filas vacías', () => {
    expect(
      RULE_CANARY_ANSWER_SAVE_FAILED.shouldFire([
        { n: 0, lastStep: null, lastError: null, lastStatus: null },
      ]),
    ).toBe(false);
    expect(RULE_CANARY_ANSWER_SAVE_FAILED.shouldFire([])).toBe(false);
  });

  it('severity=critical (P1 — endpoint más caliente de la app)', () => {
    expect(RULE_CANARY_ANSWER_SAVE_FAILED.severity).toBe('critical');
  });

  it('notification step-aware con runbook diferenciado por código HTTP', () => {
    const notif = RULE_CANARY_ANSWER_SAVE_FAILED.buildNotification([
      { n: 2, lastStep: 'http', lastError: 'HTTP 422 schema validation failed', lastStatus: 422 },
    ]);
    expect(notif.title).toContain('2');
    expect(notif.title).toContain('answer-save');
    expect(notif.body).toContain('cada respuesta de cada user');
    expect(notif.body).toContain('422');
    expect(notif.body).toContain('schemas.ts');
    expect(notif.body).toContain('JwtGuard');
    expect(notif.body).toContain('load shedding');
    expect(notif.fingerprint).toBe('canary_answer_save_failed');
  });

  it('cooldown 15 min', () => {
    expect(RULE_CANARY_ANSWER_SAVE_FAILED.cooldownMin).toBe(15);
  });
});

describe('RULE_CANARY_DB_POOL_FAILED (canary infra)', () => {
  it('dispara con ≥1 fallo (saturación pool = P0 inmediato)', () => {
    expect(
      RULE_CANARY_DB_POOL_FAILED.shouldFire([
        { n: 1, lastStep: 'timeout', lastError: 'Query timeout >1000ms' },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 0', () => {
    expect(RULE_CANARY_DB_POOL_FAILED.shouldFire([{ n: 0, lastStep: null, lastError: null }])).toBe(false);
    expect(RULE_CANARY_DB_POOL_FAILED.shouldFire([])).toBe(false);
  });

  it('severity=critical', () => {
    expect(RULE_CANARY_DB_POOL_FAILED.severity).toBe('critical');
  });

  it('notification incluye runbook PgBouncer + Postgres + Supabase', () => {
    const notif = RULE_CANARY_DB_POOL_FAILED.buildNotification([
      { n: 3, lastStep: 'timeout', lastError: 'Query timeout >1000ms' },
    ]);
    expect(notif.title).toContain('DB pool');
    expect(notif.body).toContain('PgBouncer');
    expect(notif.body).toContain('max_connections');
    expect(notif.body).toContain('Supabase');
    expect(notif.fingerprint).toBe('canary_db_pool_failed');
  });

  it('cooldown 10 min (más corto — P0 operativo)', () => {
    expect(RULE_CANARY_DB_POOL_FAILED.cooldownMin).toBe(10);
  });
});

describe('RULE_CANARY_REDIS_FAILED (canary infra)', () => {
  it('dispara con ≥1 fallo (caída Upstash = cascada BD inminente)', () => {
    expect(
      RULE_CANARY_REDIS_FAILED.shouldFire([
        { n: 1, lastStep: 'get', lastError: 'Upstash timeout >2000ms' },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 0', () => {
    expect(RULE_CANARY_REDIS_FAILED.shouldFire([{ n: 0, lastStep: null, lastError: null }])).toBe(false);
  });

  it('severity=critical', () => {
    expect(RULE_CANARY_REDIS_FAILED.severity).toBe('critical');
  });

  it('notification cita cascada BD + Upstash console + fail-open', () => {
    const notif = RULE_CANARY_REDIS_FAILED.buildNotification([
      { n: 2, lastStep: 'validate', lastError: 'GET devolvió X esperado Y' },
    ]);
    expect(notif.title).toContain('Redis');
    expect(notif.body).toContain('Cascada');
    expect(notif.body).toContain('console.upstash.com');
    expect(notif.body).toContain('fail-open');
    expect(notif.body).toContain('CORRUPCIÓN');
    expect(notif.fingerprint).toBe('canary_redis_failed');
  });

  it('cooldown 10 min', () => {
    expect(RULE_CANARY_REDIS_FAILED.cooldownMin).toBe(10);
  });
});
