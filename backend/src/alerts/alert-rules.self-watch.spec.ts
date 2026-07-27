import { RULE_ALERT_RULE_FAILING } from './alert-rules';

/**
 * Tests de `alert_rule_failing` — la regla que vigila al motor de alertas.
 *
 * Origen (27/07/2026, cabo de T-162): `traffic_drop` (255 fallos en 24 h),
 * `cron_overdue` (132) y `materialized_stats_stale` (110) llevaban más de un día
 * sin evaluarse por timeout de query, y el único rastro era una línea de log.
 * Una regla caída era indistinguible de una regla que no dispara.
 */
describe('RULE_ALERT_RULE_FAILING', () => {
  const row = (rule: string, fallos: number, causa: string | null = null) => ({
    rule,
    fallos,
    ultimaCausa: causa,
  });

  it('no dispara sin fallos', () => {
    expect(RULE_ALERT_RULE_FAILING.shouldFire([])).toBe(false);
  });

  it('dispara con una regla que acumula fallos', () => {
    expect(RULE_ALERT_RULE_FAILING.shouldFire([row('cron_overdue', 12)])).toBe(
      true,
    );
  });

  it('es warn, no critical: la vigilancia tiene un hueco pero nada está roto para el usuario', () => {
    expect(RULE_ALERT_RULE_FAILING.severity).toBe('warn');
  });

  it('el umbral de 3 vive en SQL (HAVING), no en shouldFire', () => {
    // Documenta el reparto a propósito: filtrar en SQL evita traer a memoria
    // el ruido de fallos puntuales. shouldFire sólo mira si quedó algo.
    // La SQL de Drizzle es un objeto con `queryChunks`, no una cadena:
    // `String(...)` daría "[object Object]" y el test pasaría en falso.
    const q = JSON.stringify(RULE_ALERT_RULE_FAILING.query);
    expect(q).toContain('HAVING');
    expect(q).toContain('alert_rule_failed');
    expect(q).toContain("INTERVAL '1 hour'");
  });

  it('la notificación dice QUÉ regla, cuántas veces y la causa real del driver', () => {
    const n = RULE_ALERT_RULE_FAILING.buildNotification([
      row('cron_overdue', 12, 'canceling statement due to statement timeout'),
      row('traffic_drop', 11, null),
    ]);
    expect(n.title).toContain('2 regla(s)');
    expect(n.body).toContain('cron_overdue: 12 fallos');
    expect(n.body).toContain('canceling statement due to statement timeout');
    expect(n.body).toContain('(sin detalle)'); // causa nula no rompe el cuerpo
    // Debe orientar al diagnóstico que costó media tarde el 27/07.
    expect(n.body).toContain('statement_timeout');
    expect(n.body).toContain('VACUUM');
  });

  it('el fingerprint distingue QUÉ reglas están caídas (no colapsa dos incidentes distintos)', () => {
    const a = RULE_ALERT_RULE_FAILING.buildNotification([row('x', 3)]);
    const b = RULE_ALERT_RULE_FAILING.buildNotification([row('y', 3)]);
    expect(a.fingerprint).not.toEqual(b.fingerprint);
  });

  it('no depende de AlertRuleContext (es SQL-only): no lanza sin ctx', () => {
    expect(() => RULE_ALERT_RULE_FAILING.shouldFire([row('x', 3)])).not.toThrow();
  });
});
