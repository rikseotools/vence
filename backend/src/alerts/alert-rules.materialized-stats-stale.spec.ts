// Tests de RULE_MATERIALIZED_STATS_STALE (2026-06-03).
//
// En spec propio (no en alert-rules.spec.ts) para no colisionar con cambios
// en curso de otra sesión en ese fichero. La query SQL se valida aparte contra
// la BD viva (un unit test no ejecuta SQL); aquí se valida el contrato shouldFire/
// buildNotification/registro.

import {
  ALERT_RULES,
  RULE_MATERIALIZED_STATS_STALE,
  RULE_STATS_PARIDAD_DIVERGENCE,
  RULE_CANARY_STATS_PIPELINE_FAILED,
} from './alert-rules';

describe('RULE_MATERIALIZED_STATS_STALE', () => {
  it('dispara con ≥1 tabla materializada con lag (pipeline parado)', () => {
    expect(
      RULE_MATERIALIZED_STATS_STALE.shouldFire([
        { table: 'user_question_history_v2', lagMin: 840 },
      ]),
    ).toBe(true);
  });

  it('NO dispara sin filas (todas las tablas frescas o sin tráfico suficiente)', () => {
    expect(RULE_MATERIALIZED_STATS_STALE.shouldFire([])).toBe(false);
  });

  it('severity critical — congelar el progreso de todos los users es P1', () => {
    expect(RULE_MATERIALIZED_STATS_STALE.severity).toBe('critical');
  });

  it('notification lista las tablas afectadas + diagnóstico de flags del cutover', () => {
    const notif = RULE_MATERIALIZED_STATS_STALE.buildNotification([
      { table: 'user_question_history_v2', lagMin: 840 },
      { table: 'user_article_stats', lagMin: 840 },
    ]);
    expect(notif.title).toContain('2');
    expect(notif.body).toContain('user_question_history_v2');
    expect(notif.body).toContain('840 min sin actualizar');
    expect(notif.body).toContain('CUTOVER_DONE');
    expect(notif.body).toContain('test_questions_outbox');
    expect(notif.metadata?.staleTables).toEqual([
      'user_question_history_v2',
      'user_article_stats',
    ]);
    expect(notif.fingerprint).toContain('materialized_stats_stale');
  });

  it('el fingerprint es estable por conjunto de tablas (ordenado)', () => {
    const a = RULE_MATERIALIZED_STATS_STALE.buildNotification([
      { table: 'user_article_stats', lagMin: 30 },
      { table: 'user_daily_stats', lagMin: 25 },
    ]).fingerprint;
    const b = RULE_MATERIALIZED_STATS_STALE.buildNotification([
      { table: 'user_daily_stats', lagMin: 25 },
      { table: 'user_article_stats', lagMin: 30 },
    ]).fingerprint;
    expect(a).toBe(b); // mismo set, distinto orden → mismo fingerprint
  });

  it('está registrada en ALERT_RULES (el cron la ejecuta)', () => {
    expect(ALERT_RULES.some((r) => r.name === 'materialized_stats_stale')).toBe(true);
  });

  it('cooldown 30 min', () => {
    expect(RULE_MATERIALIZED_STATS_STALE.cooldownMin).toBe(30);
  });
});

describe('RULE_STATS_PARIDAD_DIVERGENCE', () => {
  it('dispara con ≥5 divergencias (pipeline escribe valores incorrectos)', () => {
    expect(RULE_STATS_PARIDAD_DIVERGENCE.shouldFire([{ divergent: 5 }])).toBe(true);
    expect(RULE_STATS_PARIDAD_DIVERGENCE.shouldFire([{ divergent: 40 }])).toBe(true);
  });

  it('NO dispara por debajo del umbral (absorbe fuzz de lag puntual)', () => {
    expect(RULE_STATS_PARIDAD_DIVERGENCE.shouldFire([{ divergent: 0 }])).toBe(false);
    expect(RULE_STATS_PARIDAD_DIVERGENCE.shouldFire([{ divergent: 4 }])).toBe(false);
    expect(RULE_STATS_PARIDAD_DIVERGENCE.shouldFire([])).toBe(false);
  });

  it('severity error (correctitud sutil; la frescura crítica cubre el freeze total)', () => {
    expect(RULE_STATS_PARIDAD_DIVERGENCE.severity).toBe('error');
  });

  it('notification explica divergencia + que el drift no lo caza', () => {
    const notif = RULE_STATS_PARIDAD_DIVERGENCE.buildNotification([{ divergent: 12 }]);
    expect(notif.title).toContain('12');
    expect(notif.body).toContain('test_questions');
    expect(notif.body).toContain('outbox');
    expect(notif.fingerprint).toBe('stats_paridad_divergence');
  });

  it('está registrada en ALERT_RULES', () => {
    expect(ALERT_RULES.some((r) => r.name === 'stats_paridad_divergence')).toBe(true);
  });
});

describe('RULE_CANARY_STATS_PIPELINE_FAILED', () => {
  it('dispara instantáneo si la NO-propagación es sustantiva (no un timeout de red)', () => {
    expect(
      RULE_CANARY_STATS_PIPELINE_FAILED.shouldFire([
        { n: 1, lastStep: 'propagation', lastError: 'uqh_v2 NO propagó: esperado >=5, visto 4' },
      ]),
    ).toBe(true);
  });

  it('NO dispara con 1 timeout de red suelto del POST (blip)', () => {
    expect(
      RULE_CANARY_STATS_PIPELINE_FAILED.shouldFire([
        { n: 1, lastStep: 'answer_save', lastError: 'Excepción POST: The operation was aborted due to timeout' },
      ]),
    ).toBe(false);
  });

  it('severity critical + registrada', () => {
    expect(RULE_CANARY_STATS_PIPELINE_FAILED.severity).toBe('critical');
    expect(ALERT_RULES.some((r) => r.name === 'canary_stats_pipeline_failed')).toBe(true);
  });
});
