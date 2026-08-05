import {
  RULE_LEY_SIN_RESOLVER,
  RULE_LAW_NAME_RELLENO_ESCRITO,
  LEY_SIN_RESOLVER_MIN_USUARIOS,
  ALERT_RULES,
  type LeySinResolverRow,
  type LawNameRellenoRow,
} from './alert-rules';

// T-559 — las dos reglas que vigilan que no vuelva a persistirse una ley inventada.
//
// Son dos instrumentos con modos de fallo distintos y por eso se prueban por separado:
//   · `ley_sin_resolver`         mira los EVENTOS (se calla si el emisor se rompe),
//   · `law_name_relleno_escrito` mira la TABLA   (ve al escritor que no emite).

describe('RULE_LEY_SIN_RESOLVER — vigila las señales de los escritores', () => {
  const fila = (over: Partial<LeySinResolverRow> = {}): LeySinResolverRow => ({
    eventType: 'law_name_sin_resolver',
    eventos: 10,
    usuarios: 5,
    ...over,
  });

  it('no dispara sin filas', () => {
    expect(RULE_LEY_SIN_RESOLVER.shouldFire([])).toBe(false);
  });

  it('no dispara por debajo del umbral de usuarios (un blip no es un defecto)', () => {
    expect(
      RULE_LEY_SIN_RESOLVER.shouldFire([
        fila({ usuarios: LEY_SIN_RESOLVER_MIN_USUARIOS - 1 }),
      ]),
    ).toBe(false);
  });

  it('dispara al alcanzar el umbral', () => {
    expect(
      RULE_LEY_SIN_RESOLVER.shouldFire([
        fila({ usuarios: LEY_SIN_RESOLVER_MIN_USUARIOS }),
      ]),
    ).toBe(true);
  });

  it('un solo usuario con MUCHOS eventos NO dispara (un test de 40 preguntas es 1 caso)', () => {
    // El umbral es por usuarios distintos justamente para esto: contar eventos
    // convertiría a una sola persona respondiendo un test largo en una alarma.
    expect(
      RULE_LEY_SIN_RESOLVER.shouldFire([fila({ eventos: 400, usuarios: 1 })]),
    ).toBe(false);
  });

  it('basta con que UNA de las dos señales pase el umbral', () => {
    expect(
      RULE_LEY_SIN_RESOLVER.shouldFire([
        fila({ eventType: 'law_name_sin_resolver', usuarios: 1 }),
        fila({ eventType: 'notificacion_ley_no_resoluble', usuarios: 9 }),
      ]),
    ).toBe(true);
  });

  it('el aviso nombra solo las señales que superan el umbral y dice dónde mirar', () => {
    const n = RULE_LEY_SIN_RESOLVER.buildNotification([
      fila({ eventType: 'law_name_sin_resolver', usuarios: 8, eventos: 30 }),
      fila({ eventType: 'notificacion_ley_no_resoluble', usuarios: 1 }),
    ]);
    expect(n.body).toContain('law_name_sin_resolver');
    expect(n.body).not.toContain('notificacion_ley_no_resoluble');
    expect(n.body).toContain('decidirLawNamePersistida');
  });
});

describe('RULE_LAW_NAME_RELLENO_ESCRITO — el trinquete sobre la tabla', () => {
  const fila = (over: Partial<LawNameRellenoRow> = {}): LawNameRellenoRow => ({
    filas: 0,
    usuarios: 0,
    ejemploArticleId: null,
    ...over,
  });

  it('no dispara con la tabla limpia (el estado esperado tras el arreglo)', () => {
    expect(RULE_LAW_NAME_RELLENO_ESCRITO.shouldFire([fila()])).toBe(false);
  });

  it('dispara con UNA sola fila: tras el arreglo esto es imposible, no un umbral', () => {
    expect(
      RULE_LAW_NAME_RELLENO_ESCRITO.shouldFire([fila({ filas: 1, usuarios: 1 })]),
    ).toBe(true);
  });

  it('no revienta si la query no devuelve filas', () => {
    expect(RULE_LAW_NAME_RELLENO_ESCRITO.shouldFire([])).toBe(false);
  });

  it('el aviso da el comando de reparación (quien lo recibe no debería tener que buscarlo)', () => {
    const n = RULE_LAW_NAME_RELLENO_ESCRITO.buildNotification([
      fila({ filas: 12, usuarios: 3, ejemploArticleId: 'abc-123' }),
    ]);
    expect(n.body).toContain('backfill-law-name-unknown.cjs --apply');
    expect(n.body).toContain('abc-123');
  });

  it('la severidad es `error`: es una regresión demostrable, no un aviso', () => {
    expect(RULE_LAW_NAME_RELLENO_ESCRITO.severity).toBe('error');
  });
});

describe('registro', () => {
  it('las dos reglas están dadas de alta en ALERT_RULES', () => {
    const nombres = ALERT_RULES.map((r) => r.name);
    expect(nombres).toContain('ley_sin_resolver');
    expect(nombres).toContain('law_name_relleno_escrito');
  });

  it('los nombres de regla no colisionan con ninguna otra', () => {
    const nombres = ALERT_RULES.map((r) => r.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});
