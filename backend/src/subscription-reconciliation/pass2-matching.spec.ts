import {
  isNoOp,
  pickMatch,
  profileRepairs,
  resolvePlanType,
} from './pass2-matching';

describe('resolvePlanType', () => {
  it('mapea el catálogo real (1/3/6/12 meses y anual)', () => {
    expect(resolvePlanType('month', 1)).toBe('premium_monthly');
    expect(resolvePlanType('month', 3)).toBe('premium_quarterly');
    expect(resolvePlanType('month', 6)).toBe('premium_semester');
    expect(resolvePlanType('month', 12)).toBe('premium_annual');
    expect(resolvePlanType('year', 1)).toBe('premium_annual');
  });

  it('la trimestral y la semestral YA NO caen a mensual (regresión 29/07/2026)', () => {
    // La versión vieja hacía `interval === 'year' ? annual : monthly`.
    expect(resolvePlanType('month', 3)).not.toBe('premium_monthly');
    expect(resolvePlanType('month', 6)).not.toBe('premium_monthly');
  });

  it('un intervalo desconocido cae a mensual (no regala acceso no pagado)', () => {
    expect(resolvePlanType('week', 2)).toBe('premium_monthly');
    expect(resolvePlanType(null, null)).toBe('premium_monthly');
    expect(resolvePlanType(undefined, undefined)).toBe('premium_monthly');
  });
});

describe('pickMatch', () => {
  it('prioriza metadata sobre customer_id y email', () => {
    expect(
      pickMatch({ byMetadata: 'u1', byCustomerId: 'u1', byEmail: 'u1' }),
    ).toEqual({ userId: 'u1', matchedBy: 'metadata', conflict: false });
  });

  it('cae a customer_id cuando no hay metadata', () => {
    expect(pickMatch({ byCustomerId: 'u2', byEmail: 'u2' })).toEqual({
      userId: 'u2',
      matchedBy: 'customer_id',
      conflict: false,
    });
  });

  it('cae a email como último recurso', () => {
    expect(pickMatch({ byEmail: 'u3' })).toEqual({
      userId: 'u3',
      matchedBy: 'email',
      conflict: false,
    });
  });

  it('rescata al re-comprador cuyo customer_id del perfil es el de la cuenta VIEJA', () => {
    // Escenario real del multi-cuenta: pagó por Nila, el webhook falló, el
    // perfil conserva el `cus_` de Manuel → por customer no hay match, pero la
    // metadata de la sub (la escribe create-checkout) sí lo identifica.
    const m = pickMatch({
      byMetadata: 'u4',
      byCustomerId: null,
      byEmail: null,
    });
    expect(m).toEqual({ userId: 'u4', matchedBy: 'metadata', conflict: false });
  });

  it('devuelve null si ninguna vía identifica al usuario', () => {
    expect(pickMatch({})).toBeNull();
    expect(
      pickMatch({ byMetadata: null, byCustomerId: null, byEmail: null }),
    ).toBeNull();
  });

  it('marca conflict cuando dos vías apuntan a usuarios distintos (datos cruzados)', () => {
    const m = pickMatch({ byMetadata: 'u5', byCustomerId: 'u6' });
    expect(m).toEqual({ userId: 'u5', matchedBy: 'metadata', conflict: true });
  });
});

describe('profileRepairs', () => {
  const actual = { customerId: 'cus_nila', account: 'nila' };

  it('repara premium, customer y cuenta cuando el perfil está stale', () => {
    const r = profileRepairs(
      {
        planType: 'free',
        stripeCustomerId: 'cus_manuel',
        paymentAccount: 'manuel',
      },
      actual,
    );
    expect(r).toEqual({
      grantPremium: true,
      stripeCustomerId: 'cus_nila',
      paymentAccount: 'nila',
    });
    expect(isNoOp(r)).toBe(false);
  });

  it('arregla la cuenta aunque el premium ya esté puesto', () => {
    // Rescatar solo el premium dejaría cancelar/portal/reembolso apuntando a
    // la cuenta equivocada: es el medio-arreglo que hay que evitar.
    const r = profileRepairs(
      {
        planType: 'premium',
        stripeCustomerId: 'cus_nila',
        paymentAccount: 'manuel',
      },
      actual,
    );
    expect(r.grantPremium).toBe(false);
    expect(r.paymentAccount).toBe('nila');
    expect(isNoOp(r)).toBe(false);
  });

  it('no toca nada si el perfil ya es coherente', () => {
    const r = profileRepairs(
      {
        planType: 'premium',
        stripeCustomerId: 'cus_nila',
        paymentAccount: 'nila',
      },
      actual,
    );
    expect(r).toEqual({
      grantPremium: false,
      stripeCustomerId: null,
      paymentAccount: null,
    });
    expect(isNoOp(r)).toBe(true);
  });

  it('rellena payment_account cuando viene null (filas legacy)', () => {
    const r = profileRepairs(
      {
        planType: 'premium',
        stripeCustomerId: 'cus_nila',
        paymentAccount: null,
      },
      actual,
    );
    expect(r.paymentAccount).toBe('nila');
  });
});
