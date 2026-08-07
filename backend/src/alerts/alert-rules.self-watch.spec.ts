import {
  RULE_ALERT_RULE_FAILING,
  RULE_ALERT_RULE_FAILING_SUSTAINED,
  ALERT_RULES,
} from './alert-rules';

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

/**
 * Tests de `alert_rule_failing_sustained` — el escalón de la de arriba.
 *
 * Origen (07/08/2026): `drenaje_atrasado` falló **201 evaluaciones seguidas durante 17 h** con un
 * error de CÓDIGO (`b.ts.getTime is not a function`), no de carga. Su hermana avisó, pero como
 * `warn`, y ahí se quedó: el drenaje estuvo media jornada sin vigilancia y el aviso se leyó como
 * uno más. Un timeout puntual y una regla rota se ven igual en la primera hora; lo que los separa
 * es que la rota no se cura sola.
 */
describe('RULE_ALERT_RULE_FAILING_SUSTAINED', () => {
  const row = (rule: string, fallos: number, horas: number, causa: string | null = null) => ({
    rule,
    fallos,
    horas,
    ultimaCausa: causa,
  });

  it('es CRITICAL: media jornada sin vigilar algo no es un aviso', () => {
    expect(RULE_ALERT_RULE_FAILING_SUSTAINED.severity).toBe('critical');
  });

  it('su hermana sigue siendo warn — las dos hacen falta', () => {
    expect(RULE_ALERT_RULE_FAILING.severity).toBe('warn');
  });

  // Lo que separa «ráfaga que se cura» de «regla muerta» es el TIEMPO, no el número: 201 fallos
  // en 20 min es un pico; 20 fallos repartidos en 17 h es una regla rota. Por eso el corte vive
  // en el HAVING sobre MIN(ts), no en un contador.
  it('el corte es la ANTIGÜEDAD del primer fallo, no cuántos van', () => {
    const q = JSON.stringify(RULE_ALERT_RULE_FAILING_SUSTAINED.query);
    expect(q).toContain('MIN(ts)');
    expect(q).toContain("INTERVAL '6 hours'");
  });

  // Y tiene que seguir fallando AHORA: una regla que se rompió esta mañana y ya se arregló no
  // debe gritar por la tarde.
  it('exige que siga fallando ahora, no solo que fallara hace horas', () => {
    const q = JSON.stringify(RULE_ALERT_RULE_FAILING_SUSTAINED.query);
    expect(q).toContain('MAX(ts)');
    expect(q).toContain("INTERVAL '1 hour'");
  });

  it('no dispara sin filas', () => {
    expect(RULE_ALERT_RULE_FAILING_SUSTAINED.shouldFire([])).toBe(false);
  });

  it('la notificación dice cuántas HORAS lleva ciega, que es el dato que decide', () => {
    const n = RULE_ALERT_RULE_FAILING_SUSTAINED.buildNotification([
      row('drenaje_atrasado', 201, 17, 'b.ts.getTime is not a function'),
    ]);
    expect(n.title).toContain('HORAS');
    expect(n.body).toContain('lleva 17 h');
    expect(n.body).toContain('b.ts.getTime is not a function');
    expect(n.body).toContain('drenaje_atrasado');
  });

  it('una causa nula no rompe el cuerpo', () => {
    const n = RULE_ALERT_RULE_FAILING_SUSTAINED.buildNotification([row('x', 9, 8)]);
    expect(n.body).toContain('(sin detalle)');
  });

  it('el fingerprint distingue qué reglas llevan horas caídas', () => {
    const a = RULE_ALERT_RULE_FAILING_SUSTAINED.buildNotification([row('x', 9, 8)]);
    const b = RULE_ALERT_RULE_FAILING_SUSTAINED.buildNotification([row('y', 9, 8)]);
    expect(a.fingerprint).not.toEqual(b.fingerprint);
  });

  // Una regla que no está en la lista no se evalúa NUNCA: escribirla y no registrarla es el
  // fallo silencioso de este subsistema.
  it('está registrada en ALERT_RULES (si no, no se evalúa jamás)', () => {
    const nombres = ALERT_RULES.map((r) => r.name);
    expect(nombres).toContain('alert_rule_failing_sustained');
    expect(nombres).toContain('alert_rule_failing');
  });
});
