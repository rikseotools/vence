import { RULE_SIM_JOURNEY_FALLIDO, ALERT_RULES } from './alert-rules';
import { CON_REGLA_PROPIA } from './benign-signals';

/**
 * Tests de `sim_journey_fallido` — el aviso que NO existía (T-491).
 *
 * `lib/sim/report.ts` emite `sim_journey_result` con severidad `error` desde que existe Vence Sim.
 * Pero ese tipo de evento no aparecía en ninguna regla ni entre las señales benignas: **nadie lo
 * miraba y nadie lo había declarado ruido**. El catch-all tampoco lo cubría, porque exige 150
 * eventos del mismo tipo en una hora y una corrida produce unidades.
 *
 * Resultado: un journey en rojo se veía en la tarjeta «Todas las señales (24h)» si alguien entraba
 * a mirarla, y no avisaba a nadie — justo después de un deploy, que es cuando estos journeys
 * corren.
 */
describe('RULE_SIM_JOURNEY_FALLIDO', () => {
  const ULTIMA = new Date('2026-08-03T09:12:00.000Z');
  const fila = (over: Partial<Parameters<typeof RULE_SIM_JOURNEY_FALLIDO.shouldFire>[0][0]> = {}) => ({
    journeys: 1, corridas: 1, muestra: 'examen-controles-flotantes',
    invariante: 'floating_control_is_reachable', ultima: ULTIMA, ...over,
  });

  it('no dispara si no ha fallado ningún journey', () => {
    expect(RULE_SIM_JOURNEY_FALLIDO.shouldFire([fila({ journeys: 0, corridas: 0 })])).toBe(false);
  });

  // Un solo journey en rojo ya es una pantalla rota para alguien: no es un umbral de volumen.
  it('dispara con UNO solo', () => {
    expect(RULE_SIM_JOURNEY_FALLIDO.shouldFire([fila()])).toBe(true);
  });

  it('el título nombra el journey, para poder triarlo sin abrir la consulta', () => {
    const n = RULE_SIM_JOURNEY_FALLIDO.buildNotification([fila()]);
    expect(n.title).toContain('examen-controles-flotantes');
    expect(n.title).toContain('ROJO');
  });

  it('el cuerpo trae la invariante que cayó y el comando para reproducirla', () => {
    const n = RULE_SIM_JOURNEY_FALLIDO.buildNotification([fila()]);
    expect(n.body).toContain('floating_control_is_reachable');
    expect(n.body).toContain('npm run sim -- examen-controles-flotantes');
  });

  // Estos journeys corren atados a un despliegue: si el aviso no manda a mirar eso primero, se
  // investiga el app cuando la respuesta está en el commit que acaba de publicarse.
  it('manda a mirar el deploy antes que el app', () => {
    expect(RULE_SIM_JOURNEY_FALLIDO.buildNotification([fila()]).body).toMatch(/despliegue|publicarse/);
  });

  // Un rojo puede ser del entorno (contenedor frío, límite de peticiones). Decirlo evita que el
  // aviso se lea como certeza y acabe ignorándose cuando falle en falso.
  it('avisa de que un rojo suelto puede ser del entorno', () => {
    expect(RULE_SIM_JOURNEY_FALLIDO.buildNotification([fila()]).body).toMatch(/contenedor frío|entorno/);
  });

  it('la huella agrupa por journey: no manda un correo por corrida', () => {
    const a = RULE_SIM_JOURNEY_FALLIDO.buildNotification([fila({ corridas: 1 })]).fingerprint;
    const b = RULE_SIM_JOURNEY_FALLIDO.buildNotification([fila({ corridas: 4 })]).fingerprint;
    expect(a).toBe(b);
  });

  it('sin filas no revienta (una regla que peta deja de vigilar)', () => {
    expect(RULE_SIM_JOURNEY_FALLIDO.shouldFire([])).toBe(false);
    expect(() => RULE_SIM_JOURNEY_FALLIDO.buildNotification([])).not.toThrow();
  });
});

// Una regla que existe pero no está registrada no vigila nada, y una que vigila un tipo sin
// declararlo hace que el catch-all lo cuente dos veces.
describe('está enchufada de verdad', () => {
  it('entra en ALERT_RULES', () => {
    expect(ALERT_RULES.some((r) => r.name === 'sim_journey_fallido')).toBe(true);
  });

  it('los dos eventos de Vence Sim están declarados con regla propia', () => {
    expect(CON_REGLA_PROPIA).toContain('sim_journey_result');
    expect(CON_REGLA_PROPIA).toContain('sim_ruta_rota');
  });
});
