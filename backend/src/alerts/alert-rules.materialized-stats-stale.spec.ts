// Tests de RULE_MATERIALIZED_STATS_STALE (2026-06-03).
//
// En spec propio (no en alert-rules.spec.ts) para no colisionar con cambios
// en curso de otra sesión en ese fichero. La query SQL se valida aparte contra
// la BD viva (un unit test no ejecuta SQL); aquí se valida el contrato shouldFire/
// buildNotification/registro.

import { ALERT_RULES, RULE_MATERIALIZED_STATS_STALE } from './alert-rules';

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
