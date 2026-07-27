import { RULE_TRAFFIC_DROP } from './alert-rules';

/**
 * `traffic_drop` tras la reescritura de T-173 (27/07/2026).
 *
 * Lo que protegen estos tests no es el SQL bonito: es que **la regla se pueda
 * ejecutar**. Durante >24 h no se evaluó (255 fallos/24 h) porque su query
 * barría 4.085.645 filas y superaba el `statement_timeout: 20000` del pool.
 * Una regla que no corre es indistinguible de una que no dispara — y esta es la
 * que avisa de que la web ha perdido tráfico.
 */
describe('RULE_TRAFFIC_DROP — forma de la query (anti-regresión de rendimiento)', () => {
  const crudo = JSON.stringify(RULE_TRAFFIC_DROP.query);
  // Los comentarios del SQL explican a propósito QUÉ se quitó (EXTRACT, el floor
  // de 2026-05-31), así que aserciones sobre el texto crudo darían falsos
  // positivos: hay que juzgar el SQL EJECUTABLE, no la prosa que lo documenta.
  const q = crudo.replace(/--[^\\]*?\\n/g, '\\n');

  it('NO usa EXTRACT(HOUR/DOW): es lo que forzaba el barrido de 29 días', () => {
    // El coste no venía del volumen de la tabla sino de filtrar por una función
    // no indexable. Si alguien reintroduce EXTRACT aquí, vuelve el timeout.
    expect(q).not.toMatch(/EXTRACT\s*\(\s*HOUR/i);
    expect(q).not.toMatch(/EXTRACT\s*\(\s*DOW/i);
  });

  it('pide las 4 ventanas por RANGO sobre ts (sargable, usa el índice)', () => {
    for (const d of [7, 14, 21, 28]) {
      expect(q).toContain(`INTERVAL '${d} days'`);
    }
  });

  it('ya no arrastra el floor de régimen del sampling (era temporal y caducó)', () => {
    // Su propio comentario pedía quitarlo pasado ≈28/06/2026; con ventanas de
    // 7-28 días es imposible alcanzar la era pre-sampling.
    expect(q).not.toContain('2026-05-31');
    expect(q).not.toMatch(/INTERVAL '29 days'/);
  });

  it('conserva las exclusiones que evitan falsos positivos', () => {
    // /api/auth/token se excluye por el flood del 15/07 (caso Natalia) y
    // localhost por el tráfico de desarrollo: quitarlos falsearía la mediana.
    expect(q).toContain('/api/auth/token');
    expect(q).toContain('localhost%');
  });

  it('conserva el umbral de disparo: mediana significativa y caída >60%', () => {
    expect(q).toContain('base.median > 30');
    expect(q).toContain('base.median * 0.4');
  });

  it('sigue siendo critical y con cooldown (una caída de tráfico se avisa ya)', () => {
    expect(RULE_TRAFFIC_DROP.severity).toBe('critical');
    expect(RULE_TRAFFIC_DROP.cooldownMin).toBeGreaterThan(0);
  });

  it('dispara solo si la query devuelve fila (el filtro vive en SQL)', () => {
    expect(RULE_TRAFFIC_DROP.shouldFire([])).toBe(false);
    expect(
      RULE_TRAFFIC_DROP.shouldFire([{ currentN: 10, baselineMedian: 100, dropPct: 90 }]),
    ).toBe(true);
  });

  it('la notificación dice cuánto cayó y contra qué', () => {
    const n = RULE_TRAFFIC_DROP.buildNotification([
      { currentN: 10, baselineMedian: 100, dropPct: 90 },
    ]);
    expect(`${n.title} ${n.body}`).toContain('90');
    expect(`${n.title} ${n.body}`).toContain('100');
  });
});
