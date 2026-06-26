import {
  evaluateThemeStatsCanary,
  isPickedUserFresh,
  type CanaryThemeStatRow,
} from './canary-theme-stats.service';

const row = (o: Partial<CanaryThemeStatRow>): CanaryThemeStatRow => ({
  tema_number: 1,
  total: 100,
  accuracy: 85,
  scope_articles: 50,
  answered_articles: 40,
  ...o,
});

describe('evaluateThemeStatsCanary (lógica pura del veredicto)', () => {
  it('OK: el endpoint refleja el progreso esperado', () => {
    const stats = [row({ tema_number: 1, total: 3000 }), row({ tema_number: 2, total: 2000 })];
    const v = evaluateThemeStatsCanary(5000, stats);
    expect(v.ok).toBe(true);
    expect(v.endpointSum).toBe(5000);
  });

  it('FALLA (regresión tipo V4): endpoint vacío pese a progreso real', () => {
    const v = evaluateThemeStatsCanary(20000, []);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/vacío/i);
  });

  it('FALLA (regresión tipo V4): endpoint suma muy por debajo de lo esperado', () => {
    // Caso Nila: esperado 20.000, endpoint devuelve solo el subconjunto etiquetado.
    const v = evaluateThemeStatsCanary(20000, [row({ total: 600 })]);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/V4|esperado/i);
  });

  it('OK: ligeramente por debajo del esperado (staleness de caché tolerada)', () => {
    // 75% del esperado → por encima del 70%, no debe alarmar.
    const v = evaluateThemeStatsCanary(10000, [row({ total: 7500 })]);
    expect(v.ok).toBe(true);
  });

  it('FALLA: accuracy fuera de rango', () => {
    const v = evaluateThemeStatsCanary(5000, [row({ total: 5000, accuracy: 150 })]);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/accuracy/i);
  });

  it('FALLA: cobertura rota (scope_articles<=0)', () => {
    const v = evaluateThemeStatsCanary(5000, [row({ total: 5000, scope_articles: 0 })]);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/scope_articles/i);
  });

  it('FALLA: cobertura incoherente (answered>scope)', () => {
    const v = evaluateThemeStatsCanary(5000, [row({ total: 5000, scope_articles: 10, answered_articles: 30 })]);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/answered/i);
  });

  it('no afirma nada si el usuario tiene poco volumen (salvaguarda)', () => {
    const v = evaluateThemeStatsCanary(50, []);
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('expected_below_floor');
  });
});

describe('isPickedUserFresh (cache del usuario pesado, evita el full-scan de 6.7s)', () => {
  const TTL = 60 * 60 * 1000; // 1h
  it('null (nunca elegido) → no fresco', () => {
    expect(isPickedUserFresh(null, 1_000_000, TTL)).toBe(false);
  });
  it('dentro del TTL → fresco (reutiliza, NO full-scan)', () => {
    const now = 10_000_000;
    expect(isPickedUserFresh(now - 30 * 60 * 1000, now, TTL)).toBe(true); // 30min < 1h
  });
  it('justo en el borde del TTL → expirado (re-elige)', () => {
    const now = 10_000_000;
    expect(isPickedUserFresh(now - TTL, now, TTL)).toBe(false);
  });
  it('pasado el TTL → expirado (re-elige)', () => {
    const now = 10_000_000;
    expect(isPickedUserFresh(now - 2 * TTL, now, TTL)).toBe(false);
  });
});
