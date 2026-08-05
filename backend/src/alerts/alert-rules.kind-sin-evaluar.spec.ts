// Tests de RULE_CONTENT_HEALTH_KIND_SIN_EVALUAR (T-529, 05/08/2026).
//
// En spec propio (no en alert-rules.spec.ts) por la misma razón que
// alert-rules.materialized-stats-stale.spec.ts: no colisionar con cambios en curso de otra
// sesión en ese fichero gigante.
//
// El contrato de fondo: `content_health_findings` a 0 para un kind era indistinguible de "nadie
// lo evaluó" (caso [T-406]/[T-384]). Esta regla lee el latido que `content-health-sweep.service.ts`
// ya emite (`kindsEvaluados` en el `cron_run`) y avisa cuando un kind que SÍ aparecía deja de
// hacerlo — sin mantener una lista estática de "todos los kinds que deberían existir".

import { ALERT_RULES, RULE_CONTENT_HEALTH_KIND_SIN_EVALUAR, kindsSinEvaluarBackend } from './alert-rules';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.parse('2026-08-05T07:30:00Z');
const pasada = (haceDias: number, kindsEvaluados: Record<string, number>) => ({
  ts: new Date(AHORA - haceDias * DIA).toISOString(),
  status: 'success',
  kindsEvaluados,
});

describe('kindsSinEvaluarBackend — mismo criterio que lib/health/kindsEvaluados.cjs', () => {
  it('un kind visto ANOCHE no sale como sin evaluar', () => {
    expect(kindsSinEvaluarBackend([pasada(0, { opciones_duplicadas: 0 })], AHORA)).toEqual([]);
  });

  it('un kind que dejó de aparecer en pasadas recientes sale, con su último valor', () => {
    const rows = [
      pasada(0, { otro: 5 }),
      pasada(1, { otro: 5 }),
      pasada(3, { otro: 5, psicotecnico_integridad: 7102 }),
    ];
    const out = kindsSinEvaluarBackend(rows, AHORA);
    expect(out).toEqual([{ kind: 'psicotecnico_integridad', diasSinEvaluar: 3, sujetos: 7102 }]);
  });

  it('un kind gateado por flag OFF (nunca aparece) NO genera falso positivo', () => {
    const rows = [pasada(0, { opciones_duplicadas: 10 })];
    expect(kindsSinEvaluarBackend(rows, AHORA).map((s) => s.kind)).not.toContain('shuffle_encendido_sin_efecto');
  });

  it('respeta el umbral configurado', () => {
    const rows = [pasada(3, { x: 0 })];
    expect(kindsSinEvaluarBackend(rows, AHORA, 2)).toHaveLength(1);
    expect(kindsSinEvaluarBackend(rows, AHORA, 5)).toHaveLength(0);
  });

  it('ignora filas con timestamp inválido en vez de reventar', () => {
    expect(kindsSinEvaluarBackend([{ ts: 'no-es-fecha', status: 'success', kindsEvaluados: { x: 1 } }], AHORA)).toEqual([]);
  });
});

describe('RULE_CONTENT_HEALTH_KIND_SIN_EVALUAR', () => {
  it('NO dispara sin filas (aún no hay historial, o todo se evaluó anoche)', () => {
    expect(RULE_CONTENT_HEALTH_KIND_SIN_EVALUAR.shouldFire([])).toBe(false);
  });

  it('NO dispara si todos los kinds vistos siguen dentro del umbral', () => {
    expect(RULE_CONTENT_HEALTH_KIND_SIN_EVALUAR.shouldFire([pasada(0, { opciones_duplicadas: 0 })])).toBe(false);
  });

  it('dispara cuando un kind deja de aparecer — el caso T-406/T-384', () => {
    const rows = [
      pasada(0, { otro: 5 }),
      pasada(3, { otro: 5, psicotecnico_integridad: 7102 }),
    ];
    expect(RULE_CONTENT_HEALTH_KIND_SIN_EVALUAR.shouldFire(rows)).toBe(true);
  });

  it('la notificación nombra el kind, los días y el comando de diagnóstico', () => {
    const rows = [pasada(0, { otro: 5 }), pasada(3, { otro: 5, opciones_duplicadas: 33 })];
    const notif = RULE_CONTENT_HEALTH_KIND_SIN_EVALUAR.buildNotification(rows);
    expect(notif.title).toContain('1');
    expect(notif.body).toContain('opciones_duplicadas');
    expect(notif.body).toContain('health:kinds-evaluados');
    expect(notif.metadata?.kinds).toBe('opciones_duplicadas');
  });

  it('severity warn — es un aviso de vigilancia, no un outage', () => {
    expect(RULE_CONTENT_HEALTH_KIND_SIN_EVALUAR.severity).toBe('warn');
  });

  it('cooldown largo (12h): el barrido es diario, no hace falta reenviar cada tick', () => {
    expect(RULE_CONTENT_HEALTH_KIND_SIN_EVALUAR.cooldownMin).toBe(720);
  });

  it('está registrada en ALERT_RULES', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('content_health_kind_sin_evaluar');
  });
});
