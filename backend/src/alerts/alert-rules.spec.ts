// backend/src/alerts/alert-rules.spec.ts
//
// Tests de las reglas de alerta añadidas en Bloque 4 Fase 1.6 (2026-05-26).
// Focal en las 4 nuevas: runtime_kill, tts_error_burst,
// hydration_mismatch_spike, workflow_failure_burst.

import {
  ALERT_RULES,
  RULE_SHUFFLE_ORDER_NOT_PERSISTED,
  RULE_SHUFFLE_ORDER_INVALID,
  RULE_SENAL_ERROR_SIN_VIGILANCIA,
  RULE_DISPUTE_SUBMIT_FAILED,
  RULE_DAILY_QUOTA_OVERCHARGE,
  RULE_NETWORK_RETRY_EXHAUSTED_SPIKE,
  RULE_LAWS_CONFIGURATOR_DEGRADED,
  RULE_HYDRATION_MISMATCH_SPIKE,
  RULE_RUNTIME_KILL,
  RULE_TTS_ERROR_BURST,
  RULE_WORKFLOW_FAILURE_BURST,
  RULE_MAIN_CI_ROJO,
  RULE_SUBSCRIPTION_VOID_FAILED,
  RULE_SUBSCRIPTION_FORCE_CANCEL_BURST,
  RULE_SUBSCRIPTION_CANCEL_ERROR_BURST,
  RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED,
  RULE_STRIPE_WEBHOOK_4XX_BURST,
  RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB,
  RULE_CI_INTEGRACION_ROJO,
  RULE_DISPUTE_EMAIL_DROP,
  RULE_FEEDBACK_EMAIL_DROP,
  RULE_EMAIL_SEND_FAILED,
  RULE_CANARY_AUTH_FAILED,
  RULE_CANARY_WEBHOOK_FAILED,
  RULE_CANARY_ANSWER_SAVE_FAILED,
  RULE_CANARY_DB_POOL_FAILED,
  RULE_SAVE_RECONCILIATION,
  RULE_STATS_PARIDAD_DIVERGENCE,
  RULE_CANARY_REDIS_FAILED,
  RULE_CANARY_TOPIC_DATA_FAILED,
  RULE_WATCHDOG_WALLCLOCK_RESIDUAL,
  RULE_POOL_IDLE_IN_TX_DETECTED,
  RULE_POOL_HUNG_CLIENTREAD_DETECTED,
  RULE_POOL_FRONTEND_SATURATION_HIGH,
  RULE_POOL_SAMPLER_STALE,
  RULE_SCRAPING_SWEEP,
  RULE_CANARY_QUESTIONS_GATE_FAILED,
  RULE_EXAM_INTEGRITY_DRIFT,
  RULE_CLIENT_EDGE_SUSTAINED,
  RULE_FILTERED_VALIDATION_REJECTED_SPIKE,
  RULE_FRONTEND_SATURATION,
  RULE_EVENT_LOOP_LAG,
  RULE_AUTH_TOKEN_MINT_FLOOD,
  RULE_AUTH_TOKEN_MINT_WASTE,
  RULE_CLIENT_METHOD_NOT_ALLOWED,
  RULE_CHECKOUT_SYNC_MUDO,
} from './alert-rules';
import { BENIGN_SIGNALS, CON_REGLA_PROPIA } from './benign-signals';

describe('RULE_CHECKOUT_SYNC_MUDO (la activación inmediata, muda 30 días)', () => {
  // La pantalla de después de pagar pedía el token a Supabase cuando las sesiones ya las
  // emitía Auth.js: salía por `no_token` sin llegar a llamar al endpoint. CERO llamadas en
  // 30 días, sin un solo 5xx — el síntoma era una AUSENCIA. Lo descubrió una usuaria
  // escribiendo «ya lo he pagado pero no se termina de activar».
  it('dispara si hubo pagos y NINGUNA sincronización', () => {
    expect(RULE_CHECKOUT_SYNC_MUDO.shouldFire([{ pagos: 1, sincronizaciones: 0 }])).toBe(true);
  });

  it('NO dispara si no hubo pagos (sin pagos, no sincronizar es lo normal)', () => {
    expect(RULE_CHECKOUT_SYNC_MUDO.shouldFire([{ pagos: 0, sincronizaciones: 0 }])).toBe(false);
  });

  it('NO dispara si las sincronizaciones fluyen', () => {
    expect(RULE_CHECKOUT_SYNC_MUDO.shouldFire([{ pagos: 3, sincronizaciones: 3 }])).toBe(false);
    expect(RULE_CHECKOUT_SYNC_MUDO.shouldFire([{ pagos: 3, sincronizaciones: 1 }])).toBe(false);
  });

  it('el aviso explica que NO se pierde dinero, para no provocar un pánico equivocado', () => {
    const n = RULE_CHECKOUT_SYNC_MUDO.buildNotification([{ pagos: 2, sincronizaciones: 0 }]);
    expect(n.body).toMatch(/no se pierde dinero/i);
    expect(n.body).toMatch(/getAuthHeaders/);
  });

  it('está registrada en ALERT_RULES', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('checkout_sync_mudo');
  });
});

describe('RULE_CLIENT_METHOD_NOT_ALLOWED (405 del 30/07, caso Rocío)', () => {
  // Una usuaria estuvo tres días sin poder pagar porque la página llamaba con POST a un
  // endpoint GET. Los 405 se registraron desde el primer intento; nadie los miró porque la
  // regla de 4xx de cliente pide 30 en 15 minutos y allí hubo 7 en dos días.
  it('dispara con UNA sola llamada (basta una para dejar la función inservible)', () => {
    expect(
      RULE_CLIENT_METHOD_NOT_ALLOWED.shouldFire([
        { endpoint: '/api/v2/premium/mi-oferta', metodo: 'POST', n: 1 },
      ]),
    ).toBe(true);
  });

  it('NO dispara sin 405 (en 14 días de producción no hubo ningún otro)', () => {
    expect(RULE_CLIENT_METHOD_NOT_ALLOWED.shouldFire([])).toBe(false);
  });

  it('el aviso dice el endpoint y el método, que es lo que se necesita para arreglarlo', () => {
    const n = RULE_CLIENT_METHOD_NOT_ALLOWED.buildNotification([
      { endpoint: '/api/v2/premium/mi-oferta', metodo: 'POST', n: 4 },
    ]);
    expect(n.body).toContain('/api/v2/premium/mi-oferta');
    expect(n.body).toContain('POST');
    // Y la pista de la causa, porque el error es fácil de repetir en cualquier fetcher.
    expect(n.body).toContain('apiFetch');
  });

  it('un fingerprint por endpoint (un aviso, no uno por llamada)', () => {
    const a = RULE_CLIENT_METHOD_NOT_ALLOWED.buildNotification([
      { endpoint: '/api/x', metodo: 'POST', n: 1 },
    ]);
    const b = RULE_CLIENT_METHOD_NOT_ALLOWED.buildNotification([
      { endpoint: '/api/x', metodo: 'POST', n: 9 },
    ]);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('está registrada en ALERT_RULES (si no, no la ejecuta nadie)', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('client_method_not_allowed');
  });
});

describe('RULE_LAWS_CONFIGURATOR_DEGRADED (fix configurador 24/07, caso David/Galicia)', () => {
  it('dispara con >=3 errores en 10 min (query rota/timeout)', () => {
    expect(
      RULE_LAWS_CONFIGURATOR_DEGRADED.shouldFire([{ errors: 3, slow: 0 }]),
    ).toBe(true);
  });
  it('dispara con >=3 cómputos lentos (>5s) aunque no haya errores (plan lento de vuelta)', () => {
    expect(
      RULE_LAWS_CONFIGURATOR_DEGRADED.shouldFire([{ errors: 0, slow: 5 }]),
    ).toBe(true);
  });
  it('NO dispara con ruido aislado (<3 de cada)', () => {
    expect(
      RULE_LAWS_CONFIGURATOR_DEGRADED.shouldFire([{ errors: 2, slow: 2 }]),
    ).toBe(false);
  });
  it('NO dispara con 0 / filas vacías (sano)', () => {
    expect(
      RULE_LAWS_CONFIGURATOR_DEGRADED.shouldFire([{ errors: 0, slow: 0 }]),
    ).toBe(false);
    expect(RULE_LAWS_CONFIGURATOR_DEGRADED.shouldFire([])).toBe(false);
  });
  it('fingerprint único (1 email, no N)', () => {
    const n = RULE_LAWS_CONFIGURATOR_DEGRADED.buildNotification([
      { errors: 4, slow: 1 },
    ]);
    expect(n.fingerprint).toBe('laws_configurator_degraded');
  });
  it('está registrada en ALERT_RULES', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain(
      'laws_configurator_degraded',
    );
  });
});

describe('RULE_NETWORK_RETRY_EXHAUSTED_SPIKE (fix resiliencia fetch 24/07, caso David)', () => {
  it('dispara con un spike (>30 en 10 min) = regresión que rompe los fetch a todos', () => {
    expect(
      RULE_NETWORK_RETRY_EXHAUSTED_SPIKE.shouldFire([
        { n: 45, topEndpoint: '/api/questions/filtered' },
      ]),
    ).toBe(true);
  });
  it('NO dispara con exhausted disperso (red de usuarios sueltos, no incidente nuestro)', () => {
    expect(
      RULE_NETWORK_RETRY_EXHAUSTED_SPIKE.shouldFire([
        { n: 30, topEndpoint: null },
      ]),
    ).toBe(false);
    expect(
      RULE_NETWORK_RETRY_EXHAUSTED_SPIKE.shouldFire([
        { n: 3, topEndpoint: null },
      ]),
    ).toBe(false);
  });
  it('NO dispara con 0 / filas vacías (todo verde)', () => {
    expect(
      RULE_NETWORK_RETRY_EXHAUSTED_SPIKE.shouldFire([
        { n: 0, topEndpoint: null },
      ]),
    ).toBe(false);
    expect(RULE_NETWORK_RETRY_EXHAUSTED_SPIKE.shouldFire([])).toBe(false);
  });
  it('el aviso lleva el endpoint y fingerprint único (1 email, no N)', () => {
    const notif = RULE_NETWORK_RETRY_EXHAUSTED_SPIKE.buildNotification([
      { n: 45, topEndpoint: '/api/questions/filtered' },
    ]);
    expect(notif.fingerprint).toBe(
      'network_retry_exhausted_/api/questions/filtered',
    );
    expect(notif.metadata).toMatchObject({ count: 45, windowMin: 10 });
  });
  it('está registrada en ALERT_RULES', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain(
      'network_retry_exhausted_spike',
    );
  });
});

describe('RULE_FRONTEND_SATURATION (incidente capacidad 21/07)', () => {
  it('dispara con ≥4 canaries en timeout simultáneo (firma de saturación)', () => {
    expect(
      RULE_FRONTEND_SATURATION.shouldFire([
        { canaries: 8, which: 'auth_failed, answer_save_failed' },
      ]),
    ).toBe(true);
    expect(
      RULE_FRONTEND_SATURATION.shouldFire([
        { canaries: 4, which: 'a, b, c, d' },
      ]),
    ).toBe(true);
  });
  it('NO dispara con <4 (un bug por-endpoint rompe 1-2 canaries, no es saturación)', () => {
    expect(
      RULE_FRONTEND_SATURATION.shouldFire([{ canaries: 3, which: 'a, b, c' }]),
    ).toBe(false);
    expect(
      RULE_FRONTEND_SATURATION.shouldFire([
        { canaries: 1, which: 'auth_failed' },
      ]),
    ).toBe(false);
  });
  it('NO dispara con 0 / filas vacías (todo verde)', () => {
    expect(
      RULE_FRONTEND_SATURATION.shouldFire([{ canaries: 0, which: null }]),
    ).toBe(false);
    expect(RULE_FRONTEND_SATURATION.shouldFire([])).toBe(false);
  });
  it('el aviso lleva fingerprint único (1 email, no N)', () => {
    const n = RULE_FRONTEND_SATURATION.buildNotification([
      { canaries: 8, which: 'auth_failed' },
    ]);
    expect(n.fingerprint).toBe('frontend_saturation');
    expect(n.title).toContain('8 canaries');
  });
});

describe('RULE_EVENT_LOOP_LAG (Capa 5 postmortem 21/07)', () => {
  it('dispara con ≥1 evento critical (stall multi-segundo = health-check-killer)', () => {
    expect(
      RULE_EVENT_LOOP_LAG.shouldFire([{ n: 1, crit: 1, maxLagMs: 2400 }]),
    ).toBe(true);
  });
  // Umbral de warn subido de 5 a 12 el 28/07 (T-160). No es aflojar el
  // guardarraíl: es que AHORA un warn significa "stall multisegundo" (antes
  // bastaba 500 ms), así que 5 se había quedado corto y la regla disparaba ~65
  // veces al día. Calibrado sobre 7 días REALES: con 5 → 5,0 avisos/día; con
  // 12 → 0,4. Se elige 12 y no 10 porque 12 y 15 dan el MISMO resultado
  // (meseta), así que el umbral no se apoya en un borde.
  it('dispara con ≥12 warn sostenidos (loop pegajoso = precursor de cascada)', () => {
    expect(
      RULE_EVENT_LOOP_LAG.shouldFire([{ n: 12, crit: 0, maxLagMs: 2400 }]),
    ).toBe(true);
  });
  it('NO dispara con el racimo que ANTES disparaba (5 warn) — era el grueso del ruido', () => {
    expect(
      RULE_EVENT_LOOP_LAG.shouldFire([{ n: 5, crit: 0, maxLagMs: 2400 }]),
    ).toBe(false);
    expect(
      RULE_EVENT_LOOP_LAG.shouldFire([{ n: 11, crit: 0, maxLagMs: 3000 }]),
    ).toBe(false);
  });
  it('NO dispara con 0 / filas vacías (loop sano)', () => {
    expect(
      RULE_EVENT_LOOP_LAG.shouldFire([{ n: 0, crit: 0, maxLagMs: null }]),
    ).toBe(false);
    expect(RULE_EVENT_LOOP_LAG.shouldFire([])).toBe(false);
  });
  it('el aviso lleva el pico en segundos y fingerprint único (1 email, no N)', () => {
    const notif = RULE_EVENT_LOOP_LAG.buildNotification([
      { n: 6, crit: 2, maxLagMs: 3100 },
    ]);
    expect(notif.title).toContain('3.1s');
    expect(notif.fingerprint).toBe('event_loop_lag');
  });
  it('está registrada en ALERT_RULES', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('event_loop_lag');
  });
});

describe('RULE_FILTERED_VALIDATION_REJECTED_SPIKE (incidente Alfonso)', () => {
  it('dispara con un pico sistémico (>30 rechazos/h)', () => {
    expect(
      RULE_FILTERED_VALIDATION_REJECTED_SPIKE.shouldFire([
        { n: 45, topReason: 'positionType: invalid_type' },
      ]),
    ).toBe(true);
  });

  it('NO dispara con ruido bajo (un usuario reintentando)', () => {
    expect(
      RULE_FILTERED_VALIDATION_REJECTED_SPIKE.shouldFire([
        { n: 5, topReason: 'positionType: invalid_type' },
      ]),
    ).toBe(false);
    expect(RULE_FILTERED_VALIDATION_REJECTED_SPIKE.shouldFire([])).toBe(false);
  });

  it('la notificación nombra el campo/causa más frecuente', () => {
    const notif = RULE_FILTERED_VALIDATION_REJECTED_SPIKE.buildNotification([
      { n: 40, topReason: 'positionType: invalid_type' },
    ]);
    expect(notif.title).toContain('40');
    expect(notif.body).toContain('positionType');
    expect(notif.fingerprint).toBe('filtered_validation_rejected');
  });

  it('está registrada en ALERT_RULES', () => {
    expect(
      ALERT_RULES.some((r) => r.name === 'filtered_validation_rejected_spike'),
    ).toBe(true);
  });
});

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
      {
        sessionId: 'sess-abc',
        browser: 'chrome',
        isMobile: 'true',
        errors: 12,
      },
    ];
    expect(RULE_TTS_ERROR_BURST.shouldFire(rows)).toBe(true);
  });

  it('NO dispara sin sesiones', () => {
    expect(RULE_TTS_ERROR_BURST.shouldFire([])).toBe(false);
  });

  it('notification lista sesiones afectadas con browser/mobile', () => {
    const rows = [
      {
        sessionId: 'sess-aaaa1111',
        browser: 'chrome',
        isMobile: 'true',
        errors: 50,
      },
      {
        sessionId: 'sess-bbbb2222',
        browser: 'safari',
        isMobile: 'false',
        errors: 15,
      },
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
      {
        endpoint: '/auxiliar-administrativo-madrid/temario/tema-1',
        deployVersion: 'abc123',
        n: 7,
      },
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

describe('RULE_SCRAPING_SWEEP', () => {
  const sweeper = {
    userId: 'a6bd29c1-0000-0000-0000-000000000000',
    email: 'scraper@example.com',
    planType: 'premium',
    served: 912,
    answered: 0,
  };
  const heavyStudent = {
    userId: 'b0000000-0000-0000-0000-000000000000',
    email: 'estudiante@example.com',
    planType: 'premium',
    served: 474,
    answered: 474,
  };

  it('dispara con filas (la query ya filtra >=300 servidas y <15% respondidas)', () => {
    expect(RULE_SCRAPING_SWEEP.shouldFire([sweeper])).toBe(true);
  });

  it('NO dispara sin filas (nadie cruza el umbral)', () => {
    expect(RULE_SCRAPING_SWEEP.shouldFire([])).toBe(false);
  });

  it('es critical y se silencia ~2h (cooldown 120 min)', () => {
    expect(RULE_SCRAPING_SWEEP.severity).toBe('critical');
    expect(RULE_SCRAPING_SWEEP.cooldownMin).toBe(120);
  });

  it('la notificación lista email, plan, servidas/respondidas y % ', () => {
    const notif = RULE_SCRAPING_SWEEP.buildNotification([sweeper]);
    expect(notif.title).toContain('1 cuenta');
    expect(notif.body).toContain('scraper@example.com');
    expect(notif.body).toContain('912 servidas');
    expect(notif.body).toContain('0.0%');
    expect(notif.metadata?.userIds).toEqual([sweeper.userId]);
    // fingerprint estable por conjunto de usuarios (dedup)
    expect(notif.fingerprint).toContain(sweeper.userId);
  });

  it('un estudiante intenso (474/474 = 100%) NO aparecería: lo descarta la query, no shouldFire', () => {
    // La query SQL excluye answered/served >= 0.15; aquí documentamos que
    // shouldFire es agnóstico (solo mira longitud) y la lógica vive en la query.
    const pct = (heavyStudent.answered / heavyStudent.served) * 100;
    expect(pct).toBeGreaterThanOrEqual(15);
  });
});

describe('RULE_CANARY_QUESTIONS_GATE_FAILED', () => {
  it('dispara con ≥1 fallo del canary en la ventana', () => {
    expect(
      RULE_CANARY_QUESTIONS_GATE_FAILED.shouldFire([
        {
          n: 1,
          lastStep: 'gate_false_positive',
          lastError: '403',
          lastStatus: 403,
        },
      ]),
    ).toBe(true);
  });

  it('NO dispara sin fallos', () => {
    expect(
      RULE_CANARY_QUESTIONS_GATE_FAILED.shouldFire([
        { n: 0, lastStep: null, lastError: null, lastStatus: null },
      ]),
    ).toBe(false);
  });

  it('la notificación incluye step y la mitigación (CAPTCHA_ENABLED=false)', () => {
    const notif = RULE_CANARY_QUESTIONS_GATE_FAILED.buildNotification([
      {
        n: 1,
        lastStep: 'gate_false_positive',
        lastError: 'reto a usuario normal',
        lastStatus: 403,
      },
    ]);
    expect(notif.body).toContain('gate_false_positive');
    expect(notif.body).toContain('CAPTCHA_ENABLED=false');
    expect(RULE_CANARY_QUESTIONS_GATE_FAILED.cooldownMin).toBe(15);
  });
});

describe('RULE_EXAM_INTEGRITY_DRIFT', () => {
  const row = (affected: number, empty = 0, worstMissing = 0) => ({
    affected,
    empty,
    worstMissing,
    lastRun: new Date('2026-06-08T04:30:00Z'),
  });

  it('dispara con ≥1 examen afectado', () => {
    expect(RULE_EXAM_INTEGRITY_DRIFT.shouldFire([row(1)])).toBe(true);
    expect(RULE_EXAM_INTEGRITY_DRIFT.shouldFire([row(50, 30, 77)])).toBe(true);
  });

  it('NO dispara con 0 afectados', () => {
    expect(RULE_EXAM_INTEGRITY_DRIFT.shouldFire([row(0)])).toBe(false);
  });

  it('NO dispara sin filas (cron no emitió evento = todo OK)', () => {
    expect(RULE_EXAM_INTEGRITY_DRIFT.shouldFire([])).toBe(false);
  });

  it('notification incluye afectados, vacíos, peor caso y SQL de investigación', () => {
    const notif = RULE_EXAM_INTEGRITY_DRIFT.buildNotification([row(3, 1, 77)]);
    expect(notif.title).toContain('3');
    expect(notif.title).toContain('1 vacíos');
    expect(notif.body).toContain('77');
    expect(notif.body).toContain('SELECT');
    expect(notif.body).toContain('test_questions');
    expect(notif.fingerprint).toBe('exam_integrity_drift');
  });

  it('severity error (pérdida de datos confirmada, no recuperable, pero no outage)', () => {
    expect(RULE_EXAM_INTEGRITY_DRIFT.severity).toBe('error');
  });

  it('cooldown 24h (el cron corre 1×/día — no reenviar el mismo run)', () => {
    expect(RULE_EXAM_INTEGRITY_DRIFT.cooldownMin).toBe(1440);
  });

  it('está registrada en ALERT_RULES', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('exam_integrity_drift');
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

  // Guardarraíl del cableado (26/07): una regla escrita pero NO registrada no la
  // ejecuta nadie — el cron solo recorre ALERT_RULES. Es el modo de fallo más
  // silencioso posible en este subsistema: el fichero "tiene" la alerta y en
  // producción no existe.
  it('las 2 reglas de email SILENCIOSO están registradas (no basta con declararlas)', () => {
    const names = ALERT_RULES.map((r) => r.name);
    expect(names).toContain('dispute_email_drop'); // nunca se intentó
    expect(names).toContain('email_send_failed'); // intentado y rechazado
  });

  // Mismo guardarraíl de cableado para T-210: la regla existía escrita y sin registrar
  // no la ejecutaría nadie (el cron solo recorre ALERT_RULES).
  it('las 2 reglas de acuñación de token están registradas (flood por-usuario Y desperdicio agregado)', () => {
    const names = ALERT_RULES.map((r) => r.name);
    expect(names).toContain('auth_token_mint_flood'); // catastrófico por usuario
    expect(names).toContain('auth_token_mint_waste'); // fino y ancho (T-210)
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
    expect(RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.shouldFire([{ n: 5 }])).toBe(
      true,
    );
    expect(RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.shouldFire([{ n: 12 }])).toBe(
      true,
    );
  });

  it('NO dispara con <5 (tasa normal <2/h, 3-4 es ruido aceptable)', () => {
    expect(RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.shouldFire([{ n: 4 }])).toBe(
      false,
    );
    expect(RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.shouldFire([{ n: 0 }])).toBe(
      false,
    );
  });

  it('notification incluye SQL para investigar últimas 2h', () => {
    const notif = RULE_SUBSCRIPTION_FORCE_CANCEL_BURST.buildNotification([
      { n: 8 },
    ]);
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
      RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED.shouldFire([
        { n: 0, lastMsg: null },
      ]),
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
      RULE_STRIPE_WEBHOOK_4XX_BURST.shouldFire([
        { n: 5, topError: 'Invalid body' },
      ]),
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
    expect(
      RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([
        { detected: 1, fixed: 1, affectedAccounts: null },
      ]),
    ).toBe(true);
    expect(
      RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([
        { detected: 3, fixed: 2, affectedAccounts: null },
      ]),
    ).toBe(true);
  });

  it('NO dispara con detected=0 (sin filas tampoco)', () => {
    expect(
      RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([
        { detected: 0, fixed: 0, affectedAccounts: null },
      ]),
    ).toBe(false);
    expect(RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([])).toBe(false);
  });

  it('dispara aunque fixed===detected (la mitigación NO silencia la alerta — el bug raíz sigue)', () => {
    // Caso típico: Pass-2 detecta 3 subs missing y las arregla todas. Aun
    // así disparamos porque eso significa que el webhook entrante sigue roto.
    expect(
      RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([
        { detected: 3, fixed: 3, affectedAccounts: null },
      ]),
    ).toBe(true);
  });

  it('notification incluye conteo detected/fixed + runbook hacia el bug raíz', () => {
    const notif = RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.buildNotification([
      { detected: 5, fixed: 5, affectedAccounts: null },
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
  it('nombra la cuenta afectada cuando el evento la trae (multi-cuenta 29/07/2026)', () => {
    // Cada cuenta Stripe tiene su propio webhook y su propio dashboard: sin el
    // nombre, el aviso obliga a adivinar dónde mirar.
    const notif = RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.buildNotification([
      { detected: 2, fixed: 2, affectedAccounts: 'nila' },
    ]);
    expect(notif.title).toContain('nila');
    expect(notif.body).toContain('nila');
    expect(notif.body).toContain('STRIPE_WEBHOOK_SECRET');
  });

  it('sigue sin disparar por una cuenta ciega (detected=0) — eso va a warn, no a email', () => {
    expect(
      RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB.shouldFire([
        { detected: 0, fixed: 0, affectedAccounts: null },
      ]),
    ).toBe(false);
  });
});

describe('RULE_CI_INTEGRACION_ROJO (T-370 — el gate que estuvo ≥5 días mudo)', () => {
  const fila = (causa: string) => ({ causa, sha: 'abc12345', run_url: 'https://gh/run/1' });

  it('dispara con cualquiera de las tres causas', () => {
    expect(RULE_CI_INTEGRACION_ROJO.shouldFire([fila('sin_base_de_datos')])).toBe(true);
    expect(RULE_CI_INTEGRACION_ROJO.shouldFire([fila('tests_en_rojo')])).toBe(true);
    expect(RULE_CI_INTEGRACION_ROJO.shouldFire([fila('landings_incoherentes')])).toBe(true);
  });

  it('no dispara si no hay señal en la ventana', () => {
    expect(RULE_CI_INTEGRACION_ROJO.shouldFire([])).toBe(false);
  });

  // Lo que justifica que sea una regla aparte y no un `workflow_failed` más: el mensaje tiene
  // que decir CUÁL de las dos cosas pasa, porque la reacción es distinta (reponer un secret
  // en 5 min vs. triar tests).
  it('distingue «no verificó nada» de «verificó y hay rojos»', () => {
    const sinBd = RULE_CI_INTEGRACION_ROJO.buildNotification([fila('sin_base_de_datos')]);
    expect(sinBd.title).toMatch(/NO está verificando nada/i);
    expect(sinBd.body).toMatch(/DATABASE_URL_READONLY/);

    const rojos = RULE_CI_INTEGRACION_ROJO.buildNotification([fila('tests_en_rojo')]);
    expect(rojos.title).toMatch(/en rojo/i);
    expect(rojos.body).toMatch(/CON base de datos/);

    // Tercera causa: el gate de landings vive en el mismo job pero no es un test.
    // Si el aviso lo llamara «tests en rojo» mandaría a buscar donde no es.
    const land = RULE_CI_INTEGRACION_ROJO.buildNotification([fila('landings_incoherentes')]);
    expect(land.title).toMatch(/landing/i);
    expect(land.body).toMatch(/audita la landing/);
    expect(land.body).not.toMatch(/hay tests en rojo/);
  });

  // El aviso NO debe heredar el «nadie puede commitear ni desplegar» de `main_ci_rojo`: aquí
  // es falso y una alerta que exagera se acaba ignorando — que es el fallo original.
  it('dice la verdad sobre su propio poder: NO bloquea merges ni deploys', () => {
    const n = RULE_CI_INTEGRACION_ROJO.buildNotification([fila('tests_en_rojo')]);
    expect(n.body).toMatch(/NO bloquea merges ni deploys/);
    expect(n.body).not.toMatch(/nadie puede commitear/);
  });

  it('es error y no repite más de una vez al día (estado persistente)', () => {
    expect(RULE_CI_INTEGRACION_ROJO.severity).toBe('error');
    expect(RULE_CI_INTEGRACION_ROJO.cooldownMin).toBe(720);
  });
});

describe('RULE_DISPUTE_EMAIL_DROP (Gap 17 — impugnación resuelta sin email)', () => {
  it('dispara con realDrops≥1 (notificación al usuario perdida)', () => {
    expect(RULE_DISPUTE_EMAIL_DROP.shouldFire([{ realDrops: 1 }])).toBe(true);
    expect(RULE_DISPUTE_EMAIL_DROP.shouldFire([{ realDrops: 3 }])).toBe(true);
  });

  it('NO dispara con realDrops=0 ni sin filas (skip legítimo no cuenta)', () => {
    expect(RULE_DISPUTE_EMAIL_DROP.shouldFire([{ realDrops: 0 }])).toBe(false);
    expect(RULE_DISPUTE_EMAIL_DROP.shouldFire([])).toBe(false);
  });

  it('notification incluye el conteo + apunta al detalle accionable', () => {
    const notif = RULE_DISPUTE_EMAIL_DROP.buildNotification([{ realDrops: 2 }]);
    expect(notif.title).toContain('2');
    expect(notif.body).toContain('invariant_violation');
  });

  it('severity=error — el usuario cree que le ignoramos', () => {
    expect(RULE_DISPUTE_EMAIL_DROP.severity).toBe('error');
  });
});

describe('RULE_FEEDBACK_EMAIL_DROP (T-501 — respuesta a feedback sin email)', () => {
  it('dispara con realDrops≥1', () => {
    expect(RULE_FEEDBACK_EMAIL_DROP.shouldFire([{ realDrops: 1 }])).toBe(true);
  });

  it('NO dispara con realDrops=0 ni sin filas (42 de 43 saltos medidos son legítimos)', () => {
    expect(RULE_FEEDBACK_EMAIL_DROP.shouldFire([{ realDrops: 0 }])).toBe(false);
    expect(RULE_FEEDBACK_EMAIL_DROP.shouldFire([])).toBe(false);
  });

  it('la notificación lee su invariante propia, no la de impugnaciones', () => {
    const notif = RULE_FEEDBACK_EMAIL_DROP.buildNotification([{ realDrops: 1 }]);
    expect(notif.body).toContain('feedback_responded_without_email');
    expect(notif.body).toContain('messageId');
  });

  it('avisa de NO reenviar sin mirar: reenviar tarde es peor que no hacerlo', () => {
    const notif = RULE_FEEDBACK_EMAIL_DROP.buildNotification([{ realDrops: 1 }]);
    expect(notif.body).toMatch(/NO reenviar/);
  });

  it('es una regla DISTINTA de la de impugnaciones (cooldowns que no se tapan)', () => {
    expect(RULE_FEEDBACK_EMAIL_DROP.name).not.toBe(RULE_DISPUTE_EMAIL_DROP.name);
    expect(RULE_FEEDBACK_EMAIL_DROP.severity).toBe('error');
  });
});

describe('RULE_EMAIL_SEND_FAILED (cabo de T-116 — intentado y RECHAZADO por el proveedor)', () => {
  // Fixture con el error REAL de producción: es el que estuvo 2 meses saliendo
  // sin que nadie lo viera (8 ocurrencias, 04/06 → 25/07, caso Sara 6da2513e).
  const ERROR_REAL =
    'This idempotency key has been used with this HTTP method and endpoint within ' +
    "the last 24 hours, but the request body was modified and doesn't match the " +
    'original request.';
  const fila = (over = {}) => ({
    n: 1,
    emailType: 'impugnacion_respuesta',
    lastError: ERROR_REAL,
    lastTo: 'usuaria@example.com',
    ...over,
  });

  it('dispara con UNA sola ocurrencia (calibrado: 9 failed vs 13.375 sent en 90d)', () => {
    expect(RULE_EMAIL_SEND_FAILED.shouldFire([fila()])).toBe(true);
    expect(RULE_EMAIL_SEND_FAILED.shouldFire([fila({ n: 2 })])).toBe(true);
  });

  it('NO dispara sin fallos ni sin filas (la ventana vacía es lo normal)', () => {
    expect(RULE_EMAIL_SEND_FAILED.shouldFire([fila({ n: 0 })])).toBe(false);
    expect(RULE_EMAIL_SEND_FAILED.shouldFire([])).toBe(false);
  });

  it('la notificación dice QUÉ tipo de email y a quién, no solo un número', () => {
    const n = RULE_EMAIL_SEND_FAILED.buildNotification([fila()]);
    expect(n.title).toContain('impugnacion_respuesta');
    expect(n.body).toContain('usuaria@example.com');
    expect(n.body).toContain(ERROR_REAL.slice(0, 40));
  });

  it('ante el error de idempotencia apunta al arreglo (T-116), no deja al lector a ciegas', () => {
    const n = RULE_EMAIL_SEND_FAILED.buildNotification([fila()]);
    expect(n.body).toContain('idempotency');
    expect(n.body).toContain('lib/api/v2/dispute/idempotency.ts');
  });

  it('explica que es SILENCIOSO (la campana in-app sí se actualiza)', () => {
    const n = RULE_EMAIL_SEND_FAILED.buildNotification([fila()]);
    expect(n.body).toMatch(/silencioso/i);
  });

  it('fingerprint POR email_type: un problema no silencia el de otro tipo', () => {
    const a = RULE_EMAIL_SEND_FAILED.buildNotification([fila()]);
    const b = RULE_EMAIL_SEND_FAILED.buildNotification([
      fila({ emailType: 'pago_fallido' }),
    ]);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('aguanta filas incompletas sin reventar (email_type/error nulos)', () => {
    const n = RULE_EMAIL_SEND_FAILED.buildNotification([
      { n: 1, emailType: null, lastError: null, lastTo: null },
    ]);
    expect(n.title).toContain('desconocido');
    expect(() => JSON.stringify(n.metadata)).not.toThrow();
  });

  it('severity=error — el usuario no recibió nada y la app pudo darlo por bueno', () => {
    expect(RULE_EMAIL_SEND_FAILED.severity).toBe('error');
  });

  it('la ventana (15 min) es mayor que el periodo del engine (5 min)', () => {
    // Si la ventana fuese <= al periodo, un tick perdido se tragaría el único
    // evento — y estos fallos son raros: no hay una segunda oportunidad.
    const n = RULE_EMAIL_SEND_FAILED.buildNotification([fila()]);
    expect((n.metadata as { windowMin: number }).windowMin).toBeGreaterThan(5);
  });

  it('NO se solapa con dispute_email_drop: cubren invariantes opuestas', () => {
    // dispute_email_drop → 0 filas en email_events (nunca se intentó).
    // email_send_failed  → fila con event_type='failed' (intentado, rechazado).
    expect(RULE_EMAIL_SEND_FAILED.name).not.toBe(RULE_DISPUTE_EMAIL_DROP.name);
  });
});

describe('RULE_AUTH_TOKEN_MINT_WASTE (T-210 — el flood FINO Y ANCHO)', () => {
  // Umbrales calibrados sobre 7 días de datos reales (28/07): régimen con el bug =
  // 29-136 acuñaciones reales por usuario y hora (mediana 45) para un TTL de 1 h;
  // suelo teórico 2.001/día frente a 58.680 reales → 29× de desperdicio.
  it('dispara con el régimen REAL medido antes del arreglo (45/usuario/hora)', () => {
    expect(
      RULE_AUTH_TOKEN_MINT_WASTE.shouldFire([
        { mintedSampled: 414, users: 98, perUserHour: 42.2 },
      ]),
    ).toBe(true);
  });

  it('dispara incluso en el régimen malo MÁS SUAVE observado (29,4)', () => {
    expect(
      RULE_AUTH_TOKEN_MINT_WASTE.shouldFire([
        { mintedSampled: 147, users: 50, perUserHour: 29.4 },
      ]),
    ).toBe(true);
  });

  it('NO dispara en el régimen sano esperado (~1-2 por usuario y hora, TTL 1 h)', () => {
    expect(
      RULE_AUTH_TOKEN_MINT_WASTE.shouldFire([
        { mintedSampled: 12, users: 100, perUserHour: 1.2 },
      ]),
    ).toBe(false);
  });

  it('NO dispara con margen de sobra sobre lo sano (hasta 8 inclusive)', () => {
    // 4-8× el ideal se considera tolerable (re-logins, varias pestañas, sesiones cortas).
    expect(
      RULE_AUTH_TOKEN_MINT_WASTE.shouldFire([
        { mintedSampled: 40, users: 50, perUserHour: 8 },
      ]),
    ).toBe(false);
    expect(
      RULE_AUTH_TOKEN_MINT_WASTE.shouldFire([
        { mintedSampled: 45, users: 50, perUserHour: 9 },
      ]),
    ).toBe(true);
  });

  it('NO dispara con pocos usuarios (la media no significaría nada)', () => {
    expect(
      RULE_AUTH_TOKEN_MINT_WASTE.shouldFire([
        { mintedSampled: 100, users: 3, perUserHour: 333 },
      ]),
    ).toBe(false);
  });

  it('NO dispara sin datos (hora muerta, no un fallo)', () => {
    expect(RULE_AUTH_TOKEN_MINT_WASTE.shouldFire([])).toBe(false);
    expect(
      RULE_AUTH_TOKEN_MINT_WASTE.shouldFire([
        { mintedSampled: 0, users: 0, perUserHour: 0 },
      ]),
    ).toBe(false);
  });

  it('la notificación dice qué mirar (el patrón que lo causa)', () => {
    const n = RULE_AUTH_TOKEN_MINT_WASTE.buildNotification([
      { mintedSampled: 414, users: 98, perUserHour: 42.2 },
    ]);
    expect(n.title).toContain('42.2');
    expect(n.body).toContain('refreshSession');
    expect(n.body).toContain('getAccessToken');
    expect(n.fingerprint).toBe('auth_token_mint_waste');
  });

  it('cubre el hueco de su regla hermana: el régimen real NO la dispararía', () => {
    // 42 reales/usuario/hora ≈ 7 reales/usuario/10min ≈ 0,7 muestreados → muy por debajo
    // del >5 muestreados/usuario/10min de auth_token_mint_flood. Este test fija POR QUÉ
    // hacen falta las dos: si alguien "unifica" las reglas, aquí se ve lo que se pierde.
    expect(
      RULE_AUTH_TOKEN_MINT_FLOOD.shouldFire([
        { minted: 70, users: 98, perUser: 0.7 },
      ]),
    ).toBe(false);
    expect(
      RULE_AUTH_TOKEN_MINT_WASTE.shouldFire([
        { mintedSampled: 414, users: 98, perUserHour: 42.2 },
      ]),
    ).toBe(true);
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

  it('NO dispara con 1 timeout de red suelto (blip transitorio)', () => {
    expect(
      RULE_CANARY_AUTH_FAILED.shouldFire([
        {
          n: 1,
          lastStep: 'login',
          lastError: 'The operation was aborted due to timeout',
          lastStatus: null,
        },
      ]),
    ).toBe(false);
  });

  it('dispara con 2 timeouts (2 ticks consecutivos = degradación sostenida)', () => {
    expect(
      RULE_CANARY_AUTH_FAILED.shouldFire([
        {
          n: 2,
          lastStep: 'login',
          lastError: 'The operation was aborted due to timeout',
          lastStatus: null,
        },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 1 solo 502 de gateway (CloudFront/ALB blip, no la app rota)', () => {
    expect(
      RULE_CANARY_AUTH_FAILED.shouldFire([
        {
          n: 1,
          lastStep: 'profile',
          lastError:
            'Profile falló: HTTP 502 <html><title>502 Bad Gateway</title>',
          lastStatus: 502,
        },
      ]),
    ).toBe(false);
  });

  it('SÍ dispara con 1 fallo sustantivo no-gateway (401 = auth roto de verdad)', () => {
    expect(
      RULE_CANARY_AUTH_FAILED.shouldFire([
        {
          n: 1,
          lastStep: 'profile',
          lastError: 'Profile falló: HTTP 401 Unauthorized',
          lastStatus: 401,
        },
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
        {
          n: 1,
          lastStep: 'http',
          lastError: 'HTTP 400 signature failed',
          lastStatus: 400,
        },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 1 timeout de red suelto (blip; firmas reales las cubre stripe_webhook_signature_failed)', () => {
    expect(
      RULE_CANARY_WEBHOOK_FAILED.shouldFire([
        {
          n: 1,
          lastStep: 'http',
          lastError:
            'Excepción POST webhook: The operation was aborted due to timeout',
          lastStatus: null,
        },
      ]),
    ).toBe(false);
  });

  it('dispara con 2 timeouts (sostenido)', () => {
    expect(
      RULE_CANARY_WEBHOOK_FAILED.shouldFire([
        {
          n: 2,
          lastStep: 'http',
          lastError:
            'Excepción POST webhook: The operation was aborted due to timeout',
          lastStatus: null,
        },
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
      {
        n: 2,
        lastStep: 'http',
        lastError: 'HTTP 400 signature verification failed',
        lastStatus: 400,
      },
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
  it('dispara con 1 fallo sustantivo del handler (503 load-shed = app saturada = P1)', () => {
    expect(
      RULE_CANARY_ANSWER_SAVE_FAILED.shouldFire([
        {
          n: 1,
          lastStep: 'http',
          lastError: 'HTTP 503 saturated',
          lastStatus: 503,
        },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 1 solo 502 de gateway (blip de infra; la request no llegó al handler)', () => {
    expect(
      RULE_CANARY_ANSWER_SAVE_FAILED.shouldFire([
        {
          n: 1,
          lastStep: 'http',
          lastError: 'HTTP 502: <html><title>502 Bad Gateway</title>',
          lastStatus: 502,
        },
      ]),
    ).toBe(false);
  });

  it('SÍ dispara con 2 fallos 502 (2 ticks = gateway sostenido, no blip)', () => {
    expect(
      RULE_CANARY_ANSWER_SAVE_FAILED.shouldFire([
        {
          n: 2,
          lastStep: 'http',
          lastError: 'HTTP 502: <html><title>502 Bad Gateway</title>',
          lastStatus: 502,
        },
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
      {
        n: 2,
        lastStep: 'http',
        lastError: 'HTTP 422 schema validation failed',
        lastStatus: 422,
      },
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
  // Recalibrado 13/07: un timeout AISLADO ya no dispara (stall breve del
  // event-loop con la BD sana). Reusa canaryFailureShouldFire.
  it('un timeout AISLADO (n=1) NO dispara — espera confirmación del siguiente tick', () => {
    expect(
      RULE_CANARY_DB_POOL_FAILED.shouldFire([
        { n: 1, lastStep: 'timeout', lastError: 'Query timeout >1000ms' },
      ]),
    ).toBe(false);
  });

  it('timeout SOSTENIDO (n≥2 = 2 ticks) dispara', () => {
    expect(
      RULE_CANARY_DB_POOL_FAILED.shouldFire([
        { n: 2, lastStep: 'timeout', lastError: 'Query timeout >1000ms' },
      ]),
    ).toBe(true);
  });

  it('un error SUSTANTIVO (no-timeout, n=1) dispara ya', () => {
    expect(
      RULE_CANARY_DB_POOL_FAILED.shouldFire([
        { n: 1, lastStep: 'query', lastError: 'connection refused' },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 0', () => {
    expect(
      RULE_CANARY_DB_POOL_FAILED.shouldFire([
        { n: 0, lastStep: null, lastError: null },
      ]),
    ).toBe(false);
    expect(RULE_CANARY_DB_POOL_FAILED.shouldFire([])).toBe(false);
  });

  it('severity=critical', () => {
    expect(RULE_CANARY_DB_POOL_FAILED.severity).toBe('critical');
  });

  it('notification apunta a RDS (no Supabase/PgBouncer obsoletos)', () => {
    const notif = RULE_CANARY_DB_POOL_FAILED.buildNotification([
      { n: 3, lastStep: 'timeout', lastError: 'Query timeout >1000ms' },
    ]);
    expect(notif.title).toContain('DB pool');
    // post-cutover a RDS: la guía NO debe mencionar el stack congelado
    expect(notif.body).not.toContain('PgBouncer');
    expect(notif.body).not.toContain('Supabase');
    expect(notif.body).toContain('RDS');
    expect(notif.body).toContain('CloudWatch');
    expect(notif.fingerprint).toBe('canary_db_pool_failed');
  });

  it('cooldown 10 min (más corto — P0 operativo)', () => {
    expect(RULE_CANARY_DB_POOL_FAILED.cooldownMin).toBe(10);
  });
});

describe('RULE_SAVE_RECONCILIATION (recalibrada 13/07 anti falso-positivo)', () => {
  const fire = (answered: number, saved: number) =>
    RULE_SAVE_RECONCILIATION.shouldFire([{ answered, saved }]);

  it('operación normal (ratio 70-100%) NO dispara', () => {
    expect(fire(800, 700)).toBe(false); // 87%
    expect(fire(300, 250)).toBe(false); // 83%
  });

  it('saved > answered (examen batch / duplicados) NO dispara', () => {
    expect(fire(100, 150)).toBe(false);
  });

  it('noche, poco tráfico, ratio 30% NO dispara (por encima del 25%)', () => {
    expect(fire(81, 24)).toBe(false); // 30%
  });

  it('hueco C1 (0 guardadas) SÍ dispara', () => {
    expect(fire(168, 0)).toBe(true);
  });

  it('rotura real sostenida (<25% con volumen) dispara', () => {
    expect(fire(200, 10)).toBe(true); // 5%
  });

  it('por debajo del suelo de volumen (a≤60) NO dispara aunque sea 0%', () => {
    expect(fire(40, 0)).toBe(false);
  });

  it('severity=critical', () => {
    expect(RULE_SAVE_RECONCILIATION.severity).toBe('critical');
  });
});

describe('RULE_STATS_PARIDAD_DIVERGENCE (recalibrada 13/07)', () => {
  it('umbral ≥5 divergencias (absorbe fuzz de lag)', () => {
    expect(RULE_STATS_PARIDAD_DIVERGENCE.shouldFire([{ divergent: 5 }])).toBe(
      true,
    );
    expect(RULE_STATS_PARIDAD_DIVERGENCE.shouldFire([{ divergent: 4 }])).toBe(
      false,
    );
    expect(RULE_STATS_PARIDAD_DIVERGENCE.shouldFire([{ divergent: 0 }])).toBe(
      false,
    );
  });

  it('severity=error', () => {
    expect(RULE_STATS_PARIDAD_DIVERGENCE.severity).toBe('error');
  });
});

describe('RULE_CANARY_REDIS_FAILED (canary infra)', () => {
  it('NO dispara con 1 timeout suelto de Upstash (blip transitorio, espera el siguiente tick)', () => {
    expect(
      RULE_CANARY_REDIS_FAILED.shouldFire([
        { n: 1, lastStep: 'get', lastError: 'Upstash timeout >2000ms' },
      ]),
    ).toBe(false);
  });

  it('dispara con 2 fallos en la ventana (2 ticks consecutivos = sostenido)', () => {
    expect(
      RULE_CANARY_REDIS_FAILED.shouldFire([
        { n: 2, lastStep: 'get', lastError: 'Upstash timeout >2000ms' },
      ]),
    ).toBe(true);
  });

  it('dispara con 1 fallo SUSTANTIVO (corrupción step=validate, no es un blip de red)', () => {
    expect(
      RULE_CANARY_REDIS_FAILED.shouldFire([
        { n: 1, lastStep: 'validate', lastError: 'GET devolvió X esperado Y' },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 0', () => {
    expect(
      RULE_CANARY_REDIS_FAILED.shouldFire([
        { n: 0, lastStep: null, lastError: null },
      ]),
    ).toBe(false);
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

// RULE_CRON_OVERDUE tiene su propio spec dedicado en
// `alert-rules.cron-overdue.spec.ts` — usa SchedulerRegistry como fuente
// de verdad de los schedules en lugar del mapa hardcoded previo.

import { RULE_ANSWER_WATCHDOG_BURST } from './alert-rules';

describe('RULE_ANSWER_WATCHDOG_BURST', () => {
  it('dispara con ≥3 watchdog events en 30min', () => {
    expect(
      RULE_ANSWER_WATCHDOG_BURST.shouldFire([
        { n: 3, maxDurationMs: 15000, uniqueUsers: 2 },
      ]),
    ).toBe(true);
    expect(
      RULE_ANSWER_WATCHDOG_BURST.shouldFire([
        { n: 9, maxDurationMs: 308109, uniqueUsers: 5 },
      ]),
    ).toBe(true);
  });

  it('NO dispara con <3 events', () => {
    expect(
      RULE_ANSWER_WATCHDOG_BURST.shouldFire([
        { n: 0, maxDurationMs: 0, uniqueUsers: 0 },
      ]),
    ).toBe(false);
    expect(
      RULE_ANSWER_WATCHDOG_BURST.shouldFire([
        { n: 2, maxDurationMs: 12500, uniqueUsers: 1 },
      ]),
    ).toBe(false);
  });

  it('severity=warn (no critical, es bug client-side recurrente bajo carga)', () => {
    expect(RULE_ANSWER_WATCHDOG_BURST.severity).toBe('warn');
  });

  it('notification cita 3 causas típicas + query de investigación', () => {
    const notif = RULE_ANSWER_WATCHDOG_BURST.buildNotification([
      { n: 9, maxDurationMs: 308109, uniqueUsers: 5 },
    ]);
    expect(notif.title).toContain('9 watchdog');
    expect(notif.body).toContain('Saturación pool BD');
    expect(notif.body).toContain('background');
    expect(notif.body).toContain('móvil');
    expect(notif.body).toContain('validation_error_logs');
    expect(notif.body).toContain('308.1s');
    expect(notif.fingerprint).toBe('answer_watchdog_burst');
  });

  it('cooldown 30 min (evitar spam si el bug se repite)', () => {
    expect(RULE_ANSWER_WATCHDOG_BURST.cooldownMin).toBe(30);
  });
});

// ────────────────────────────────────────────────────────────────
// RULE_CANARY_TOPIC_DATA_FAILED (31/05/2026, post Fase D-bis Iter 1.5)
// ────────────────────────────────────────────────────────────────

describe('RULE_CANARY_TOPIC_DATA_FAILED', () => {
  it('dispara con ≥1 fallo en 10 min', () => {
    expect(
      RULE_CANARY_TOPIC_DATA_FAILED.shouldFire([
        { n: 1, lastStep: 'http', lastError: 'HTTP 503', lastStatus: 503 },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 1 timeout de red suelto (blip transitorio)', () => {
    expect(
      RULE_CANARY_TOPIC_DATA_FAILED.shouldFire([
        {
          n: 1,
          lastStep: 'http',
          lastError: 'Excepción GET: The operation was aborted due to timeout',
          lastStatus: null,
        },
      ]),
    ).toBe(false);
  });

  it('dispara con 2 timeouts (sostenido)', () => {
    expect(
      RULE_CANARY_TOPIC_DATA_FAILED.shouldFire([
        {
          n: 2,
          lastStep: 'http',
          lastError: 'Excepción GET: The operation was aborted due to timeout',
          lastStatus: null,
        },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 0 fallos', () => {
    expect(
      RULE_CANARY_TOPIC_DATA_FAILED.shouldFire([
        { n: 0, lastStep: null, lastError: null, lastStatus: null },
      ]),
    ).toBe(false);
  });

  it('NO dispara con resultado vacío', () => {
    expect(RULE_CANARY_TOPIC_DATA_FAILED.shouldFire([])).toBe(false);
  });

  it('severity critical (cada fallo del path topic-data es P1)', () => {
    expect(RULE_CANARY_TOPIC_DATA_FAILED.severity).toBe('critical');
  });

  it('cooldown 15 min', () => {
    expect(RULE_CANARY_TOPIC_DATA_FAILED.cooldownMin).toBe(15);
  });

  it('notification cita step + runbook + acciones por step', () => {
    const notif = RULE_CANARY_TOPIC_DATA_FAILED.buildNotification([
      {
        n: 2,
        lastStep: 'shape_empty',
        lastError: 'totalQuestions=0',
        lastStatus: 200,
      },
    ]);
    expect(notif.title).toContain('2');
    expect(notif.title).toContain('topic-data');
    expect(notif.body).toContain('shape_empty');
    expect(notif.body).toContain('totalQuestions=0');
    expect(notif.body).toContain('topic-summary/refresh');
    expect(notif.body).toContain('canary-y-simulaciones.md');
    expect(notif.fingerprint).toBe('canary_topic_data_failed');
  });
});

// ────────────────────────────────────────────────────────────────
// RULE_WATCHDOG_WALLCLOCK_RESIDUAL (31/05/2026, post commit a4051a6b)
// ────────────────────────────────────────────────────────────────

describe('RULE_WATCHDOG_WALLCLOCK_RESIDUAL', () => {
  it('dispara si total≥5 y pct>20', () => {
    expect(
      RULE_WATCHDOG_WALLCLOCK_RESIDUAL.shouldFire([
        { total: 10, over60s: 3, pctResidual: 30 },
      ]),
    ).toBe(true);
  });

  it('NO dispara si total<5 (sample insuficiente)', () => {
    expect(
      RULE_WATCHDOG_WALLCLOCK_RESIDUAL.shouldFire([
        { total: 4, over60s: 3, pctResidual: 75 },
      ]),
    ).toBe(false);
  });

  it('NO dispara si pct≤20 aunque haya muestras', () => {
    expect(
      RULE_WATCHDOG_WALLCLOCK_RESIDUAL.shouldFire([
        { total: 50, over60s: 10, pctResidual: 20 },
      ]),
    ).toBe(false);
  });

  it('NO dispara con resultado vacío', () => {
    expect(RULE_WATCHDOG_WALLCLOCK_RESIDUAL.shouldFire([])).toBe(false);
  });

  it('severity warn (trending, no incidente)', () => {
    expect(RULE_WATCHDOG_WALLCLOCK_RESIDUAL.severity).toBe('warn');
  });

  it('cooldown 240 min (4h) — no spamear', () => {
    expect(RULE_WATCHDOG_WALLCLOCK_RESIDUAL.cooldownMin).toBe(240);
  });

  it('notification cita commit, % y causas Safari/mobile', () => {
    const notif = RULE_WATCHDOG_WALLCLOCK_RESIDUAL.buildNotification([
      { total: 25, over60s: 10, pctResidual: 40 },
    ]);
    expect(notif.title).toContain('40');
    expect(notif.title).toContain('10/25');
    expect(notif.body).toContain('a4051a6b');
    expect(notif.body).toContain('Safari');
    expect(notif.body).toContain('Mobile');
    expect(notif.body).toContain('userAgent');
    expect(notif.fingerprint).toBe('watchdog_wallclock_residual');
  });
});

// ════════════════════════════════════════════════════════════════════
// Pool capacity sampler — 4 reglas granulares (2026-06-01)
// Acción 2 observability-capacity
// ════════════════════════════════════════════════════════════════════

describe('RULE_POOL_IDLE_IN_TX_DETECTED', () => {
  it('dispara con ≥2 muestras con idle_in_tx_over_5s > 0 en 5 min', () => {
    expect(
      RULE_POOL_IDLE_IN_TX_DETECTED.shouldFire([{ n: 2, lastAt: new Date() }]),
    ).toBe(true);
    expect(
      RULE_POOL_IDLE_IN_TX_DETECTED.shouldFire([{ n: 5, lastAt: new Date() }]),
    ).toBe(true);
  });

  it('NO dispara con 1 muestra (puede ser blip transitorio)', () => {
    expect(
      RULE_POOL_IDLE_IN_TX_DETECTED.shouldFire([{ n: 1, lastAt: new Date() }]),
    ).toBe(false);
    expect(
      RULE_POOL_IDLE_IN_TX_DETECTED.shouldFire([{ n: 0, lastAt: null }]),
    ).toBe(false);
  });

  it('NO dispara con resultado vacío', () => {
    expect(RULE_POOL_IDLE_IN_TX_DETECTED.shouldFire([])).toBe(false);
  });

  it('notification incluye SQL de diagnóstico + referencia Hipótesis B', () => {
    const notif = RULE_POOL_IDLE_IN_TX_DETECTED.buildNotification([
      { n: 3, lastAt: new Date('2026-06-01T10:00:00Z') },
    ]);
    expect(notif.title).toContain('3');
    expect(notif.body).toContain('pg_stat_activity');
    expect(notif.body).toContain('idle in transaction');
    expect(notif.body).toContain('Hipótesis B');
    expect(notif.fingerprint).toBe('pool_idle_in_tx');
  });

  it('severity critical (zombi pool = pierde slot crítico)', () => {
    expect(RULE_POOL_IDLE_IN_TX_DETECTED.severity).toBe('critical');
  });

  it('cooldown 30 min', () => {
    expect(RULE_POOL_IDLE_IN_TX_DETECTED.cooldownMin).toBe(30);
  });
});

describe('RULE_POOL_HUNG_CLIENTREAD_DETECTED', () => {
  it('dispara con ≥2 muestras, acumulación real (≥10 conn-min) y pico ≥5', () => {
    expect(
      RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire([
        { n: 2, totalHung: 12, maxHung: 6 },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 1 muestra (blip transitorio)', () => {
    expect(
      RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire([
        { n: 1, totalHung: 1, maxHung: 1 },
      ]),
    ).toBe(false);
  });

  it('NO dispara con el goteo residual de bajo volumen (≥2 muestras pero <10 conn-min)', () => {
    // Recalibrado 2026-06-03: el residual de getDb()/Supavisor (front_active=0)
    // a 1-2 conns era un email CRITICAL cada 30 min. El piso lo silencia.
    expect(
      RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire([
        { n: 4, totalHung: 4, maxHung: 2 },
      ]),
    ).toBe(false);
  });

  it('NO dispara con el goteo residual sostenido (≥10 conn-min pero pico ≤3 simultáneas)', () => {
    // Recalibrado 2026-06-12: el caso real que spameaba — 2-3 conns colgadas
    // durante 5 muestras acumulan ~10-15 conn-min y cruzaban el piso, pero el
    // pico simultáneo nunca pasa de 3. El gate de pico lo silencia.
    expect(
      RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire([
        { n: 5, totalHung: 14, maxHung: 3 },
      ]),
    ).toBe(false);
  });

  it('NO dispara con resultado vacío o cero', () => {
    expect(RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire([])).toBe(false);
    expect(
      RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire([
        { n: 0, totalHung: 0, maxHung: 0 },
      ]),
    ).toBe(false);
  });

  it('notification referencia Hipótesis A + SQL de diagnóstico + pico', () => {
    const notif = RULE_POOL_HUNG_CLIENTREAD_DETECTED.buildNotification([
      { n: 3, totalHung: 10, maxHung: 6 },
    ]);
    expect(notif.body).toContain('Hipótesis A');
    expect(notif.body).toContain('ClientRead');
    expect(notif.body).toContain('pg_stat_activity');
    expect(notif.title).toContain('pico 6');
    expect(notif.metadata?.peakHungConns).toBe(6);
    expect(notif.fingerprint).toBe('pool_hung_clientread');
  });

  it('severity critical', () => {
    expect(RULE_POOL_HUNG_CLIENTREAD_DETECTED.severity).toBe('critical');
  });

  describe('deploy-aware (silencia goteo de rolling, alerta saturación real)', () => {
    const deployCtx = {
      deployWindow: {
        active: true,
        reasons: ['frontend_rolling: 2 versiones'],
      },
    } as never;
    const calmCtx = {
      deployWindow: { active: false, reasons: [] },
    } as never;

    it('NO dispara con ventana de deploy activa y recuento bajo (<5 conn-min)', () => {
      expect(
        RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire(
          [{ n: 2, totalHung: 1, maxHung: 1 }],
          deployCtx,
        ),
      ).toBe(false);
    });

    it('SÍ dispara con deploy activo si hay saturación real (conn-min alto + pico ≥5)', () => {
      expect(
        RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire(
          [{ n: 2, totalHung: 14, maxHung: 8 }],
          deployCtx,
        ),
      ).toBe(true);
    });

    it('sin deploy: NO dispara con recuento bajo (piso conn-min silencia el goteo residual)', () => {
      expect(
        RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire(
          [{ n: 2, totalHung: 1, maxHung: 1 }],
          calmCtx,
        ),
      ).toBe(false);
    });

    it('sin deploy: SÍ dispara con saturación real (≥10 conn-min + pico ≥5)', () => {
      expect(
        RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire(
          [{ n: 2, totalHung: 12, maxHung: 6 }],
          calmCtx,
        ),
      ).toBe(true);
    });

    it('sin ctx (fail-open) dispara si supera piso de conn-min y pico', () => {
      expect(
        RULE_POOL_HUNG_CLIENTREAD_DETECTED.shouldFire([
          { n: 2, totalHung: 12, maxHung: 6 },
        ]),
      ).toBe(true);
    });

    it('la notificación marca deployWindowActive en metadata', () => {
      const notif = RULE_POOL_HUNG_CLIENTREAD_DETECTED.buildNotification(
        [{ n: 2, totalHung: 14, maxHung: 8 }],
        deployCtx,
      );
      expect(notif.metadata?.deployWindowActive).toBe(true);
      expect(notif.body).toContain('Deploy/churn en curso');
    });
  });
});

describe('RULE_POOL_FRONTEND_SATURATION_HIGH', () => {
  it('dispara con ≥3 muestras de saturación (≥13 conns en últimos 5 min)', () => {
    expect(
      RULE_POOL_FRONTEND_SATURATION_HIGH.shouldFire([
        { maxActive: 15, samples: 3 },
      ]),
    ).toBe(true);
    expect(
      RULE_POOL_FRONTEND_SATURATION_HIGH.shouldFire([
        { maxActive: 16, samples: 5 },
      ]),
    ).toBe(true);
  });

  it('NO dispara con menos de 3 muestras (transitorio aceptable)', () => {
    expect(
      RULE_POOL_FRONTEND_SATURATION_HIGH.shouldFire([
        { maxActive: 14, samples: 2 },
      ]),
    ).toBe(false);
    expect(
      RULE_POOL_FRONTEND_SATURATION_HIGH.shouldFire([
        { maxActive: 0, samples: 0 },
      ]),
    ).toBe(false);
  });

  it('notification incluye plan de mitigación', () => {
    const notif = RULE_POOL_FRONTEND_SATURATION_HIGH.buildNotification([
      { maxActive: 15, samples: 4 },
    ]);
    expect(notif.title).toContain('4');
    expect(notif.title).toContain('15');
    expect(notif.body).toContain('desiredCount');
    expect(notif.body).toContain('observable_events');
    expect(notif.fingerprint).toBe('pool_saturation');
  });

  it('severity warn (no crítico — todavía hay margen)', () => {
    expect(RULE_POOL_FRONTEND_SATURATION_HIGH.severity).toBe('warn');
  });

  it('cooldown 15 min (más rápido que zombis, justifica notificar pronto)', () => {
    expect(RULE_POOL_FRONTEND_SATURATION_HIGH.cooldownMin).toBe(15);
  });
});

describe('RULE_POOL_SAMPLER_STALE', () => {
  it('dispara si última muestra hace >3 min', () => {
    expect(
      RULE_POOL_SAMPLER_STALE.shouldFire([{ lastAt: new Date(), ageMin: 5 }]),
    ).toBe(true);
    expect(
      RULE_POOL_SAMPLER_STALE.shouldFire([{ lastAt: new Date(), ageMin: 15 }]),
    ).toBe(true);
  });

  it('NO dispara con muestra reciente (<3 min)', () => {
    expect(
      RULE_POOL_SAMPLER_STALE.shouldFire([{ lastAt: new Date(), ageMin: 1 }]),
    ).toBe(false);
    expect(
      RULE_POOL_SAMPLER_STALE.shouldFire([{ lastAt: new Date(), ageMin: 0 }]),
    ).toBe(false);
  });

  it('dispara si NUNCA hubo muestra (tabla vacía)', () => {
    expect(
      RULE_POOL_SAMPLER_STALE.shouldFire([{ lastAt: null, ageMin: 0 }]),
    ).toBe(true);
  });

  it('notification incluye plan de recovery', () => {
    const notif = RULE_POOL_SAMPLER_STALE.buildNotification([
      { lastAt: new Date('2026-06-01T10:00:00Z'), ageMin: 10 },
    ]);
    expect(notif.title).toContain('10');
    expect(notif.body).toContain('CloudWatch');
    expect(notif.body).toContain('/health/crons');
    expect(notif.body).toContain('capture-pool-pressure.cjs');
    expect(notif.fingerprint).toBe('pool_sampler_stale');
  });

  it('cooldown 60 min (meta-alerta — no spammear si cron muerto)', () => {
    expect(RULE_POOL_SAMPLER_STALE.cooldownMin).toBe(60);
  });
});

describe('ALERT_RULES — registro de las 4 nuevas reglas del pool', () => {
  const expected = [
    'pool_idle_in_tx_detected',
    'pool_hung_clientread_detected',
    'pool_frontend_saturation_high',
    'pool_sampler_stale',
  ];
  for (const name of expected) {
    it(`incluye ${name}`, () => {
      expect(ALERT_RULES.map((r) => r.name)).toContain(name);
    });
  }
});

describe('RULE_CLIENT_EDGE_SUSTAINED (recalibrado 08/07)', () => {
  const rows = (
    edge5xx: number,
    netErr: number,
    topEndpoint = '/api/auth/session',
  ) => [{ edge5xx, netErr, topEndpoint }];

  it('dispara por edge 5xx/timeout sostenido a partir de 30/h', () => {
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire(rows(30, 0))).toBe(true);
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire(rows(36, 0))).toBe(true);
  });

  it('NO dispara con el residual de edge 5xx post-fix keep-alive (~8/h)', () => {
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire(rows(8, 0))).toBe(false);
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire(rows(29, 0))).toBe(false);
  });

  it('NO dispara con el baseline BENIGNO de network_error (~100-120/h)', () => {
    // Este era el bug: ~117/h de móviles en background cruzaba el viejo umbral
    // de 80 y disparaba cada hora. Ahora network_error solo cuenta a partir de
    // una avalancha (500/h).
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire(rows(0, 120))).toBe(false);
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire(rows(0, 300))).toBe(false);
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire(rows(0, 499))).toBe(false);
  });

  it('dispara ante una AVALANCHA de network_error (>=500/h) = outage real', () => {
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire(rows(0, 500))).toBe(true);
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire(rows(0, 2000))).toBe(true);
  });

  it('rows vacío → no dispara (defensivo)', () => {
    expect(RULE_CLIENT_EDGE_SUSTAINED.shouldFire([])).toBe(false);
  });

  it('mensaje por edge 5xx apunta al keep-alive 502', () => {
    const notif = RULE_CLIENT_EDGE_SUSTAINED.buildNotification(rows(36, 10));
    expect(notif.title).toContain('edge 5xx/timeout');
    expect(notif.title).toContain('/api/auth/session');
    expect(notif.body).toContain('keep-alive');
    expect(notif.metadata?.trigger).toBe('edge5xx');
    expect(notif.fingerprint).toContain('edge');
  });

  it('mensaje por avalancha de red apunta a outage', () => {
    const notif = RULE_CLIENT_EDGE_SUSTAINED.buildNotification(rows(0, 800));
    expect(notif.title).toContain('errores de red');
    expect(notif.body.toLowerCase()).toContain('outage');
    expect(notif.metadata?.trigger).toBe('netErr');
    expect(notif.fingerprint).toContain('net');
  });

  it('está registrada en ALERT_RULES', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('client_edge_sustained');
  });
});

// ── `main` en rojo (28/07/2026) ───────────────────────────────────────────────────────────────
// Tres veces en un día: detector nuevo sin su espejo → guardarraíl de paridad rojo → nadie avisado,
// porque el run se cancelaba Y la regla de racimo escuchaba un event_type muerto (`workflow_failure`
// cuando el emisor manda `workflow_failed`: 328 eventos vs 3, el último de hace cuatro semanas).
describe('RULE_MAIN_CI_ROJO', () => {
  const fila = {
    sha: 'abc12345',
    workflow: 'Tests',
    run_url: 'https://github.com/rikseotools/vence/actions/runs/1',
    cuando: '2026-07-28T18:00:00Z',
  };

  it('dispara con UN SOLO fallo: no hace falta racimo', () => {
    expect(RULE_MAIN_CI_ROJO.shouldFire([fila])).toBe(true);
  });

  it('no dispara sin fallos', () => {
    expect(RULE_MAIN_CI_ROJO.shouldFire([])).toBe(false);
  });

  it('el aviso dice lo que de verdad duele: nadie puede commitear ni desplegar', () => {
    const n = RULE_MAIN_CI_ROJO.buildNotification([fila]);
    expect(n.title).toMatch(/main/i);
    expect(n.body).toMatch(/pre-commit/);
    expect(n.body).toMatch(/desplegar/);
    expect(n.body).toContain(fila.run_url);
  });

  it('la query escucha el event_type que el emisor USA, no el que se creía', () => {
    // El SQL de Drizzle no es una cadena: hay que mirar dentro del objeto. Merece la pena, porque
    // este test es justo el que habría cazado los cuatro semanas de silencio.
    const q = JSON.stringify(RULE_MAIN_CI_ROJO.query);
    expect(q).toContain('workflow_failed');
    expect(q).toContain('refs/heads/main');
  });
});

describe('RULE_DAILY_QUOTA_OVERCHARGE (cupo free cobrado de más — 29/07, caso Sergio)', () => {
  const fila = (afectados: number, respondidasMedia = 13, desfaseMedio = 12) => [
    { afectados, respondidasMedia, desfaseMedio },
  ];

  it('NO dispara con el ruido normal (pocos casos: sesiones a caballo de dos días)', () => {
    expect(RULE_DAILY_QUOTA_OVERCHARGE.shouldFire(fila(0))).toBe(false);
    expect(RULE_DAILY_QUOTA_OVERCHARGE.shouldFire(fila(10))).toBe(false);
  });

  it('dispara cuando el desfase deja de ser cola larga (>10 usuarios en 48h)', () => {
    expect(RULE_DAILY_QUOTA_OVERCHARGE.shouldFire(fila(11))).toBe(true);
    // Magnitud del incidente original (41 usuarios en 14 días).
    expect(RULE_DAILY_QUOTA_OVERCHARGE.shouldFire(fila(41))).toBe(true);
  });

  it('no revienta si la query no devuelve filas', () => {
    expect(RULE_DAILY_QUOTA_OVERCHARGE.shouldFire([])).toBe(false);
  });

  it('la notificación dice cuántos son, cuánto respondieron y por dónde empezar', () => {
    const notif = RULE_DAILY_QUOTA_OVERCHARGE.buildNotification(fila(23, 12, 13));
    expect(notif.title).toContain('23');
    expect(notif.title).toContain('12');
    expect(notif.body).toContain('debeConsumirCupo');
    expect(notif.body).toContain('dailyQuotaServerSide');
    expect(notif.metadata).toMatchObject({ afectados: 23, respondidasMedia: 12, desfaseMedio: 13 });
  });

  it('está registrada en el catálogo que corre el cron', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('daily_quota_overcharge');
  });

  it('mide sobre las tablas de negocio (completas), no sobre eventos muestreados', () => {
    const q = JSON.stringify(RULE_DAILY_QUOTA_OVERCHARGE.query);
    expect(q).toContain('daily_question_usage');
    expect(q).toContain('test_questions');
    // Fecha en Europe/Madrid: es la que usa increment_daily_questions. En UTC la
    // comparación genera falsos positivos con las respuestas de última hora.
    expect(q).toContain('Europe/Madrid');
    expect(q).not.toContain('observable_events');
  });
});

describe('RULE_SENAL_ERROR_SIN_VIGILANCIA (catch-all — auditoría 29/07)', () => {
  // Existe porque escribir "una regla por tipo de evento" nunca cierra el hueco: el
  // hueco lo abre el tipo que aún no existe. 13 tipos graves llevaban un mes sin
  // ninguna regla (991 server_render_error, 277 pre_hydration_error, 24 cron_error).
  const fila = (event_type: string, n: number, fuente = 'frontend', top_endpoint: string | null = '/leyes') => ({
    event_type,
    n,
    fuente,
    top_endpoint,
  });

  it('NO dispara sin filas (la query ya aplica el HAVING >= 50)', () => {
    expect(RULE_SENAL_ERROR_SIN_VIGILANCIA.shouldFire([])).toBe(false);
  });

  it('dispara ante un tipo de evento que NINGUNA otra regla vigila', () => {
    expect(RULE_SENAL_ERROR_SIN_VIGILANCIA.shouldFire([fila('server_render_error', 991)])).toBe(true);
  });

  it('la query excluye los benignos Y los que ya tienen regla propia', () => {
    const q = JSON.stringify(RULE_SENAL_ERROR_SIN_VIGILANCIA.query);
    for (const t of [...BENIGN_SIGNALS, ...CON_REGLA_PROPIA]) {
      expect(q).toContain(t);
    }
    expect(q).toContain('error');
  });

  it('el umbral es 150/h — calibrado sobre el suelo real medido (console_error ~75/h)', () => {
    // Si alguien lo baja sin recalibrar, el correo suena solo por el ruido crónico y
    // deja de leerse, que es la muerte de un alerting.
    expect(JSON.stringify(RULE_SENAL_ERROR_SIN_VIGILANCIA.query)).toContain('150');
  });

  it('ninguna señal está a la vez en benignos y con regla propia (contradicción)', () => {
    const solape = CON_REGLA_PROPIA.filter((t) => BENIGN_SIGNALS.includes(t));
    expect(solape).toEqual([]);
  });

  it('la notificación nombra el tipo dominante y enseña dónde triar', () => {
    const notif = RULE_SENAL_ERROR_SIN_VIGILANCIA.buildNotification([
      fila('server_render_error', 991, 'frontend', '/oposiciones'),
      fila('cron_error', 24, 'backend', null),
    ]);
    expect(notif.title).toContain('server_render_error');
    expect(notif.title).toContain('991');
    expect(notif.body).toContain('cron_error');
    expect(notif.body).toContain('/admin/salud-sistema');
    expect(notif.body).toContain('health-check.md');
    expect(notif.metadata).toMatchObject({ tipos: 2, top: 'server_render_error' });
  });

  it('el fingerprint separa por tipo (dos fallos distintos no se tapan entre sí)', () => {
    const a = RULE_SENAL_ERROR_SIN_VIGILANCIA.buildNotification([fila('server_render_error', 100)]);
    const b = RULE_SENAL_ERROR_SIN_VIGILANCIA.buildNotification([fila('cron_error', 100)]);
    expect(a.fingerprint).not.toEqual(b.fingerprint);
  });

  it('está registrada en el catálogo que corre el cron', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('senal_error_sin_vigilancia');
  });

  it('es critical: el usuario pidió email solo para caídas y errores muy fuertes', () => {
    expect(RULE_SENAL_ERROR_SIN_VIGILANCIA.severity).toBe('critical');
  });
});

describe('RULE_DISPUTE_SUBMIT_FAILED (impugnaciones perdidas — 29/07, caso Pilar)', () => {
  const fila = (n: number, usuarios = 1, motivo = 'Load failed') => [{ n, usuarios, motivo }];

  it('NO dispara con el baseline sano (0-2 en una hora)', () => {
    expect(RULE_DISPUTE_SUBMIT_FAILED.shouldFire(fila(0))).toBe(false);
    expect(RULE_DISPUTE_SUBMIT_FAILED.shouldFire(fila(2))).toBe(false);
    expect(RULE_DISPUTE_SUBMIT_FAILED.shouldFire([])).toBe(false);
  });

  it('dispara a partir de 3 en una hora (ya no es mala cobertura puntual)', () => {
    expect(RULE_DISPUTE_SUBMIT_FAILED.shouldFire(fila(3))).toBe(true);
    expect(RULE_DISPUTE_SUBMIT_FAILED.shouldFire(fila(20, 14))).toBe(true);
  });

  it('la notificación dice cuántas, cuántos usuarios y el motivo dominante', () => {
    const notif = RULE_DISPUTE_SUBMIT_FAILED.buildNotification(fila(7, 5, 'Failed to fetch'));
    expect(notif.title).toContain('7');
    expect(notif.title).toContain('5');
    expect(notif.body).toContain('Failed to fetch');
    expect(notif.metadata).toMatchObject({ count: 7, usuarios: 5 });
  });

  it('está registrada en el catálogo que corre el cron', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('dispute_submit_failed');
  });

  it('mide el evento específico, no el http_network_error genérico', () => {
    // El genérico es indistinguible entre endpoints: fue justo lo que impidió
    // contar las impugnaciones perdidas en el caso Pilar.
    const q = JSON.stringify(RULE_DISPUTE_SUBMIT_FAILED.query);
    expect(q).toContain('dispute_submit_failed');
    expect(q).not.toContain('http_network_error');
  });
});

describe('Alertas del BARAJADO (29/07, tras el incidente del piloto T-235)', () => {
  describe('RULE_SHUFFLE_ORDER_NOT_PERSISTED — la firma exacta del incidente', () => {
    const fila = (servidas: number, guardadas: number) => [{ servidas, guardadas }];

    it('dispara cuando se sirve barajado y NO se guarda ni una permutación', () => {
      // Es lo que pasó el 28/07: 30 peticiones con barajado activo y option_order
      // NULL en el 100% de la tabla → 56 aciertos marcados como fallo.
      expect(RULE_SHUFFLE_ORDER_NOT_PERSISTED.shouldFire(fila(30, 0))).toBe(true);
      expect(RULE_SHUFFLE_ORDER_NOT_PERSISTED.shouldFire(fila(5, 0))).toBe(true);
    });

    it('NO dispara si la permutación sí se está guardando (el arreglo funcionando)', () => {
      expect(RULE_SHUFFLE_ORDER_NOT_PERSISTED.shouldFire(fila(30, 12))).toBe(false);
      expect(RULE_SHUFFLE_ORDER_NOT_PERSISTED.shouldFire(fila(30, 1))).toBe(false);
    });

    it('NO dispara con el barajado apagado o con ruido de una petición suelta', () => {
      expect(RULE_SHUFFLE_ORDER_NOT_PERSISTED.shouldFire(fila(0, 0))).toBe(false);
      expect(RULE_SHUFFLE_ORDER_NOT_PERSISTED.shouldFire(fila(4, 0))).toBe(false);
      expect(RULE_SHUFFLE_ORDER_NOT_PERSISTED.shouldFire([])).toBe(false);
    });

    it('es CRÍTICA y su aviso dice cómo apagar (el daño no se puede reparar después)', () => {
      expect(RULE_SHUFFLE_ORDER_NOT_PERSISTED.severity).toBe('critical');
      const notif = RULE_SHUFFLE_ORDER_NOT_PERSISTED.buildNotification(fila(30, 0));
      expect(notif.body).toContain('FEATURE_SHUFFLE_OPTIONS');
      expect(notif.body).toContain('shuffleOrderParidad');
    });

    it('cruza el evento del serve con la tabla real, no dos eventos', () => {
      const q = JSON.stringify(RULE_SHUFFLE_ORDER_NOT_PERSISTED.query);
      expect(q).toContain('shuffle_options_request_active');
      expect(q).toContain('test_questions');
      expect(q).toContain('option_order');
    });
  });

  describe('RULE_SHUFFLE_ORDER_INVALID — clave rota', () => {
    it('dispara con UNO solo (criterio de la ficha: cualquier cosa != 0 → apagar)', () => {
      expect(RULE_SHUFFLE_ORDER_INVALID.shouldFire([{ n: 1, usuarios: 1 }])).toBe(true);
    });

    it('no dispara sin eventos', () => {
      expect(RULE_SHUFFLE_ORDER_INVALID.shouldFire([{ n: 0, usuarios: 0 }])).toBe(false);
      expect(RULE_SHUFFLE_ORDER_INVALID.shouldFire([])).toBe(false);
    });
  });

  it('AMBAS están registradas en el catálogo que corre el cron', () => {
    const nombres = ALERT_RULES.map((r) => r.name);
    expect(nombres).toContain('shuffle_order_not_persisted');
    expect(nombres).toContain('shuffle_option_order_invalid');
  });
});

describe('RULE_DEVICE_LIMIT_MUDO (enforcement por dispositivo sin cortar — T-304, 30/07)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RULE_DEVICE_LIMIT_MUDO } = require('./alert-rules');
  const fila = (deviceDias: number, bloqueos: number, peor = 75) => [
    { deviceDias, bloqueos, peor },
  ];

  it('hay farmeo sostenido y CERO bloqueos → dispara (el bug de 3 meses)', () => {
    expect(RULE_DEVICE_LIMIT_MUDO.shouldFire(fila(11, 0))).toBe(true);
  });

  it('hay farmeo y TAMBIÉN bloqueos → no dispara (está funcionando)', () => {
    expect(RULE_DEVICE_LIMIT_MUDO.shouldFire(fila(11, 4))).toBe(false);
  });

  it('un solo bloqueo basta para callarla: prueba que el camino está vivo', () => {
    expect(RULE_DEVICE_LIMIT_MUDO.shouldFire(fila(50, 1))).toBe(false);
  });

  it('sin farmeo no dispara aunque no haya bloqueos (no hay nada que cortar)', () => {
    expect(RULE_DEVICE_LIMIT_MUDO.shouldFire(fila(0, 0))).toBe(false);
  });

  it('un par de device-días sueltos no bastan: se persigue el silencio SOSTENIDO', () => {
    expect(RULE_DEVICE_LIMIT_MUDO.shouldFire(fila(2, 0))).toBe(false);
    expect(RULE_DEVICE_LIMIT_MUDO.shouldFire(fila(3, 0))).toBe(true);
  });

  it('tolera filas vacías o corruptas sin lanzar (corre en un cron nocturno)', () => {
    expect(RULE_DEVICE_LIMIT_MUDO.shouldFire([])).toBe(false);
    expect(RULE_DEVICE_LIMIT_MUDO.shouldFire([{}] as never)).toBe(false);
  });

  it('el aviso dice DÓNDE mirar, no solo que algo va mal', () => {
    const n = RULE_DEVICE_LIMIT_MUDO.buildNotification(fila(11, 0, 100));
    expect(n.title).toContain('MUDO');
    expect(n.body).toContain('hw_fingerprint');   // la comprobación nº1
    expect(n.body).toContain('get_device_daily_usage_v2');
    expect(n.body).toContain('revisar-fraudes.md');
  });
});

describe('RULE_SESSION_IP_COVERAGE_DROP (writer que deja de escribir — T-314, 30/07)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RULE_SESSION_IP_COVERAGE_DROP } = require('./alert-rules');
  const fila = (sesiones: number, pct: number) => [
    { sesiones, conIp: Math.round((sesiones * pct) / 100), pct },
  ];

  it('EL CASO REAL: 1% de cobertura con volumen → dispara', () => {
    // 30/07/2026: 6.273 sesiones en 7 días, 6.189 sin IP.
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire(fila(1000, 1))).toBe(true);
  });

  it('la cobertura sana histórica (70-85%) no dispara', () => {
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire(fila(1000, 80))).toBe(false);
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire(fila(1000, 70))).toBe(false);
  });

  it('habría disparado el 04/07, el día de la caída (8%)', () => {
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire(fila(600, 8))).toBe(true);
  });

  it('el 03/07, con la caída a medias (55%), aún no: no se persigue el ruido', () => {
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire(fila(600, 55))).toBe(false);
  });

  it('con poco volumen NO opina (un porcentaje sobre 20 sesiones es ruido)', () => {
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire(fila(20, 0))).toBe(false);
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire(fila(199, 1))).toBe(false);
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire(fila(200, 1))).toBe(true);
  });

  it('tolera filas vacías o corruptas (corre en un cron)', () => {
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire([])).toBe(false);
    expect(RULE_SESSION_IP_COVERAGE_DROP.shouldFire([{}] as never)).toBe(false);
  });

  it('el aviso explica qué se pierde y dónde mirar', () => {
    const n = RULE_SESSION_IP_COVERAGE_DROP.buildNotification(fila(1000, 1));
    expect(n.title).toContain('1%');
    expect(n.body).toContain('track-session-ip');
    expect(n.body).toContain('sessionIpNoColgarDeEvento');
  });
});

describe('RULE_FRAUDE_SIN_TRIAR (mide lo accionable, no lo confirmado — T-426, 31/07)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RULE_FRAUDE_SIN_TRIAR: R } = require('./alert-rules');
  const fila = (total: number, dias: number) => [{ total, masAntiguaDias: dias }];

  it('señales sin mirar durante días → dispara', () => {
    expect(R.shouldFire(fila(4, 5))).toBe(true);
  });

  it('sin señales nuevas no dispara', () => {
    expect(R.shouldFire(fila(0, 0))).toBe(false);
  });

  it('recién detectadas NO disparan: el vigía ya las canta en el momento', () => {
    expect(R.shouldFire(fila(3, 0))).toBe(false);
    expect(R.shouldFire(fila(3, 2))).toBe(false);
    expect(R.shouldFire(fila(3, 3))).toBe(true);
  });

  it('tolera filas vacías o corruptas', () => {
    expect(R.shouldFire([])).toBe(false);
    expect(R.shouldFire([{}] as never)).toBe(false);
  });

  // Lo que hundió a la versión anterior: pedía «resolver» las confirmadas cuando confirmar era el
  // último paso que existía. El aviso tiene que mandar a una acción REAL (triar) y decir que el
  // farmeo por dispositivo ya se corta solo, para que nadie lo lea como una emergencia.
  it('el aviso manda a triar y no reclama una acción inexistente', () => {
    const n = R.buildNotification(fila(4, 5));
    expect(n.body).toContain('fraude:dossier');
    expect(n.body).toContain('enforce');
    expect(n.body).not.toContain('decidir qué hacer');
  });

  // El objeto `sql` de Drizzle no se convierte a texto (`String(...)` da "[object Object]"),
  // así que el SQL se lee de sus trozos literales.
  it('mide las SIN TRIAR, no las confirmadas (regresión de T-426)', () => {
    const sqlTexto = JSON.stringify(R.query);
    expect(sqlTexto).toContain("status = 'new'");
    expect(sqlTexto).not.toContain("status = 'confirmed'");
  });

  // Una regla definida pero no registrada no la ejecuta nadie: el silo más fácil de crear al
  // renombrar. Y el nombre viejo no puede volver: si reaparece, es que se restauró la versión
  // que pedía una acción inexistente.
  it('está registrada en ALERT_RULES (el cron la ejecuta) y el nombre viejo no vuelve', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ALERT_RULES } = require('./alert-rules');
    expect(ALERT_RULES.some((r: { name: string }) => r.name === 'fraude_sin_triar')).toBe(true);
    expect(
      ALERT_RULES.some((r: { name: string }) => r.name === 'fraude_confirmado_sin_accion'),
    ).toBe(false);
  });
});

describe('RULE_EVASION_MULTIDISPOSITIVO (cambiar de móvil al topar — T-304, 30/07)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RULE_EVASION_MULTIDISPOSITIVO: R } = require('./alert-rules');
  const fila = (cuentas: number, equipos: number) => [{ cuentas, equipos }];

  it('varias cuentas marcadas estrenando equipo → dispara', () => {
    expect(R.shouldFire(fila(3, 2))).toBe(true);
  });

  it('UNA sola cuenta con equipo nuevo NO dispara: cambiar de móvil es legítimo', () => {
    expect(R.shouldFire(fila(1, 1))).toBe(false);
  });

  it('ninguna cuenta marcada moviéndose → silencio', () => {
    expect(R.shouldFire(fila(0, 0))).toBe(false);
  });

  it('tolera basura', () => {
    expect(R.shouldFire([])).toBe(false);
    expect(R.shouldFire([{}] as never)).toBe(false);
  });

  it('el aviso admite que no es concluyente por sí solo', () => {
    const n = R.buildNotification(fila(3, 2));
    expect(n.body).toMatch(/no es concluyente/i);
  });
});

// ── Los caminos de cobro que la alerta vigila de verdad (T-341) ───────────────────────────
//
// La regla es la ÚNICA que avisa de que alguien intentó pagar y no pudo. Hasta el 31/07/2026
// miraba solo `/api/stripe/%`, y el cobro ya no vive únicamente ahí: el endpoint que devuelve
// el precio heredado devolvía 500 en el primer clic de cualquier afectado y quedaba fuera del
// radar. Declarar el patrón no basta — lo que cuenta es que la QUERY lo use.
import { PATRONES_RUTA_COBRO, RULE_STRIPE_CHECKOUT_FAILED } from './alert-rules';

describe('RULE_STRIPE_CHECKOUT_FAILED — qué considera «camino de cobro»', () => {
  it('la query usa TODOS los patrones declarados (declararlos y no usarlos es peor que no tenerlos)', () => {
    const q = JSON.stringify(RULE_STRIPE_CHECKOUT_FAILED.query);
    for (const patron of PATRONES_RUTA_COBRO) expect(q).toContain(patron);
  });

  it('cubre el precio heredado, que es lo que la dejó ciega', () => {
    expect(PATRONES_RUTA_COBRO).toContain('/api/v2/premium/%');
  });

  it('sigue cubriendo el checkout de siempre (ampliar no puede quitar)', () => {
    expect(PATRONES_RUTA_COBRO).toContain('/api/stripe/%');
  });

  it('salta con 3 fallos en 10 min y calla por debajo: cada uno es un cliente perdido', () => {
    expect(RULE_STRIPE_CHECKOUT_FAILED.shouldFire([{ n: 2, topEndpoint: '/api/stripe/create-checkout' }])).toBe(false);
    expect(RULE_STRIPE_CHECKOUT_FAILED.shouldFire([{ n: 3, topEndpoint: '/api/stripe/create-checkout' }])).toBe(true);
  });

  it('el aviso nombra el endpoint concreto y da la consulta para investigar', () => {
    const n = RULE_STRIPE_CHECKOUT_FAILED.buildNotification([
      { n: 5, topEndpoint: '/api/v2/premium/recuperar-precio' },
    ]);
    expect(n.body).toContain('/api/v2/premium/recuperar-precio');
    expect(n.body).toMatch(/observable_events/);
  });
});

// ── Cliente bloqueado en la caja (31/07/2026) ────────────────────────────────────────────
//
// Hermana de RULE_STRIPE_CHECKOUT_FAILED y su punto ciego: aquella cuenta 5xx (el servidor se
// rompió); ésta cuenta los «no» (el servidor funcionó y no le dejó pagar). 17 intentos
// bloqueados en 10 minutos no dispararon nada.
import { RULE_COBRO_BLOQUEADO_AUTH } from './alert-rules';

describe('RULE_COBRO_BLOQUEADO_AUTH — el 403 en la caja también es una venta perdida', () => {
  const fila = (n: number, usuarios = 1, topEndpoint = '/api/stripe/create-checkout') => [
    { n, usuarios, topEndpoint },
  ];

  it('calla con un rechazo suelto (un clic raro no es un incidente)', () => {
    expect(RULE_COBRO_BLOQUEADO_AUTH.shouldFire(fila(1))).toBe(false);
    expect(RULE_COBRO_BLOQUEADO_AUTH.shouldFire(fila(2))).toBe(false);
  });

  it('salta al tercero: ahí ya hay alguien peleándose con la pantalla de pago', () => {
    expect(RULE_COBRO_BLOQUEADO_AUTH.shouldFire(fila(3))).toBe(true);
    expect(RULE_COBRO_BLOQUEADO_AUTH.shouldFire(fila(17))).toBe(true);
  });

  it('no dispara sin datos', () => {
    expect(RULE_COBRO_BLOQUEADO_AUTH.shouldFire([])).toBe(false);
  });

  it('escucha el evento que emite el helper, no uno que nadie manda', () => {
    const q = JSON.stringify(RULE_COBRO_BLOQUEADO_AUTH.query);
    expect(q).toContain('auth_identidad_ajena_rechazada');
  });

  it('mira los MISMOS caminos de cobro que su hermana (una sola lista, no dos)', () => {
    const q = JSON.stringify(RULE_COBRO_BLOQUEADO_AUTH.query);
    for (const patron of PATRONES_RUTA_COBRO) expect(q).toContain(patron);
  });

  it('el aviso dice cuántas personas y cómo distinguir cliente rancio de abuso', () => {
    const n = RULE_COBRO_BLOQUEADO_AUTH.buildNotification(fila(17, 1));
    expect(n.title).toContain('17');
    expect(n.title).toMatch(/1 usuario/);
    expect(n.body).toMatch(/EXISTE en user_profiles/);
    expect(n.body).toContain('/api/stripe/create-checkout');
  });
});

// ── El canary de identidad en pagos (31/07/2026) ─────────────────────────────────────────
import { RULE_CANARY_IDENTIDAD_PAGO_FAILED } from './alert-rules';

describe('RULE_CANARY_IDENTIDAD_PAGO_FAILED', () => {
  const fila = (n: number, lastStep = 'checkout_cerrado') => [
    { n, lastStep, lastError: 'el checkout volvió a cortar', lastStatus: 403 },
  ];

  it('un solo fallo ya avisa: es post-deploy, no hay racimo que esperar', () => {
    expect(RULE_CANARY_IDENTIDAD_PAGO_FAILED.shouldFire(fila(1))).toBe(true);
    expect(RULE_CANARY_IDENTIDAD_PAGO_FAILED.shouldFire(fila(0))).toBe(false);
  });

  it('escucha el evento que emite el controlador', () => {
    expect(JSON.stringify(RULE_CANARY_IDENTIDAD_PAGO_FAILED.query)).toContain(
      'canary_identidad_pago_failed',
    );
  });

  it('el aviso distingue los dos fallos, que piden arreglos opuestos', () => {
    const n = RULE_CANARY_IDENTIDAD_PAGO_FAILED.buildNotification(fila(1));
    // Uno significa «nadie puede pagar»; el otro, «se cancela la cuenta equivocada».
    expect(n.body).toMatch(/checkout_cerrado/);
    expect(n.body).toMatch(/cancel_abierto/);
    expect(n.body).toMatch(/seguir-con-el-token/);
  });

  it('avisa de que una sesión inútil NO habla de la política', () => {
    // Sin esto, un `sesion_inutil` se leería como «los pagos están rotos» y se tocaría
    // justo lo que no falla.
    expect(RULE_CANARY_IDENTIDAD_PAGO_FAILED.buildNotification(fila(1)).body).toMatch(
      /sesion_inutil/,
    );
  });
});

// ── La ventana de la alerta del cupo (31/07/2026) ────────────────────────────────────────
//
// Medía también el día EN CURSO y disparó 4 veces en 48 h con 12-18 «afectados»; al volver a
// medir esos mismos días después salían 0 y 1. Mandaba correos por gente que no estaba
// cobrada de más. Se acota a días cerrados; este test lo fija para que no vuelva.
describe('RULE_DAILY_QUOTA_OVERCHARGE — mide días CERRADOS, no el que está en curso', () => {
  it('la ventana es exactamente ayer, no «desde ayer» (que incluye hoy)', () => {
    const q = JSON.stringify(RULE_DAILY_QUOTA_OVERCHARGE.query);
    expect(q).toContain("d.usage_date = (NOW() AT TIME ZONE 'Europe/Madrid')::date - 1");
    expect(q).not.toContain("d.usage_date >= (NOW() AT TIME ZONE 'Europe/Madrid')::date - 1");
  });

  it('la consulta del aviso enseña la MISMA ventana que la regla', () => {
    // Si divergen, quien investigue mira otro conjunto de datos que el que disparó.
    const body = RULE_DAILY_QUOTA_OVERCHARGE.buildNotification([
      { afectados: 12, respondidasMedia: 13, desfaseMedio: 12 },
    ]).body;
    expect(body).toContain("d.usage_date = (NOW() AT TIME ZONE 'Europe/Madrid')::date - 1");
  });
});

describe('RULE_ALTA_SIN_PERFIL (el alta que nace sin poder pagar — T-434, 31/07)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RULE_ALTA_SIN_PERFIL: R, ALERT_RULES } = require('./alert-rules');
  const fila = (usuarios: number, veces: number) => [{ usuarios, veces }];

  it('UNA sola alta rota ya dispara: no hay volumen mínimo aceptable', () => {
    expect(R.shouldFire(fila(1, 1))).toBe(true);
  });

  it('sin altas rotas, silencio', () => {
    expect(R.shouldFire(fila(0, 0))).toBe(false);
  });

  it('tolera filas vacías o corruptas', () => {
    expect(R.shouldFire([])).toBe(false);
    expect(R.shouldFire([{}] as never)).toBe(false);
  });

  it('es `error`: el afectado no puede pagar NI avisarnos', () => {
    expect(R.severity).toBe('error');
  });

  it('el aviso dice a quién afecta y dónde mirar, sin email en claro', () => {
    const n = R.buildNotification(fila(2, 5));
    expect(n.body).toContain('emailPrefijo');
    expect(n.body).toContain('T-434');
    expect(n.body).not.toMatch(/@[a-z]+\.[a-z]+/);
  });

  it('está registrada en ALERT_RULES (si no, la señal nace sin quien la mire)', () => {
    expect(ALERT_RULES.some((r: { name: string }) => r.name === 'alta_sin_perfil')).toBe(true);
  });
});

describe('RULE_IDENTIDAD_AJENA_NO_DRENA (el navegador con DOS identidades — T-434, 05/08)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RULE_IDENTIDAD_AJENA_NO_DRENA: R, ALERT_RULES } = require('./alert-rules');
  const fila = (dias: number, veces: number) => [{ dias, veces }];

  // El pico del drenaje NO es la señal: cada navegador afectado se limpia la primera vez que
  // vuelve, así que los primeros días habrá muchos eventos y eso es exactamente lo esperado.
  it('un pico grande concentrado en pocos días NO dispara: eso es el drenaje', () => {
    expect(R.shouldFire(fila(3, 500))).toBe(false);
  });

  it('siete días seguidos SÍ dispara aunque sean pocos: eso ya es goteo', () => {
    expect(R.shouldFire(fila(7, 9))).toBe(true);
  });

  it('sin eventos, silencio', () => {
    expect(R.shouldFire(fila(0, 0))).toBe(false);
  });

  it('tolera filas vacías o corruptas', () => {
    expect(R.shouldFire([])).toBe(false);
    expect(R.shouldFire([{}] as never)).toBe(false);
  });

  it('el aviso manda al ESCRITOR del rastro y al gemelo del servidor', () => {
    const n = R.buildNotification(fila(7, 40));
    expect(n.body).toContain('supabaseAdapter');
    expect(n.body).toContain('identityMismatch');
    expect(n.body).toContain('T-434');
  });

  it('está registrada en ALERT_RULES (si no, la señal nace sin quien la mire)', () => {
    expect(ALERT_RULES.some((r: { name: string }) => r.name === 'identidad_ajena_no_drena')).toBe(
      true,
    );
  });
});
