import { accesoVigentePorFecha } from './pass1-facts';

describe('accesoVigentePorFecha', () => {
  const AHORA = new Date('2026-08-06T10:00:00Z');

  it('caso real T-295 (29/07/2026): current_period_end de hace meses → NO vigente', () => {
    expect(accesoVigentePorFecha('2026-05-27T00:00:00Z', AHORA)).toBe(false);
  });

  it('current_period_end en el futuro → vigente', () => {
    expect(accesoVigentePorFecha('2026-09-01T00:00:00Z', AHORA)).toBe(true);
  });

  it('current_period_end es EXACTAMENTE ahora → vigente (borde inclusivo)', () => {
    expect(accesoVigentePorFecha(AHORA.toISOString(), AHORA)).toBe(true);
  });

  it('un segundo después de ahora → vigente', () => {
    expect(
      accesoVigentePorFecha(
        new Date(AHORA.getTime() + 1000).toISOString(),
        AHORA,
      ),
    ).toBe(true);
  });

  it('un segundo antes de ahora → NO vigente', () => {
    expect(
      accesoVigentePorFecha(
        new Date(AHORA.getTime() - 1000).toISOString(),
        AHORA,
      ),
    ).toBe(false);
  });

  it('sin fecha (null) → se respeta el status, no hay hecho que lo contradiga', () => {
    expect(accesoVigentePorFecha(null, AHORA)).toBe(true);
  });

  it('sin fecha (undefined) → igual que null', () => {
    expect(accesoVigentePorFecha(undefined, AHORA)).toBe(true);
  });

  it('fecha ilegible/corrupta → no se puede usar para negar, se respeta el status', () => {
    expect(accesoVigentePorFecha('no-es-una-fecha', AHORA)).toBe(true);
  });
});
