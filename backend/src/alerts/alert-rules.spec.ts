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
