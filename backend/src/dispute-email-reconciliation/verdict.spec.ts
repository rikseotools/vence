import { clasificarVerdicto, esDropReal, type HechosReconciliacion } from './verdict';

const hechos = (p: Partial<HechosReconciliacion> = {}): HechosReconciliacion => ({
  email: 'usuaria@example.com',
  soporteDisabled: false,
  hasEmailEvent: false,
  hasSkipEvent: false,
  ...p,
});

describe('clasificarVerdicto — la evidencia manda sobre el estado mutable', () => {
  it('si el email salió, es delivered pase lo que pase con el resto', () => {
    expect(
      clasificarVerdicto(hechos({ hasEmailEvent: true, soporteDisabled: true, hasSkipEvent: true })),
    ).toBe('delivered');
  });

  it('sin email y sin constancia de haberlo saltado: drop REAL (la señal que importa)', () => {
    expect(clasificarVerdicto(hechos())).toBe('real_drop');
    expect(esDropReal(clasificarVerdicto(hechos()))).toBe(true);
  });

  it('usuario sin email: no había a dónde enviarlo, no es un drop', () => {
    expect(clasificarVerdicto(hechos({ email: null }))).toBe('no_user_email');
    expect(clasificarVerdicto(hechos({ email: '' }))).toBe('no_user_email');
  });

  // ── Las dos regresiones que motivan el módulo (T-422) ────────────────────────────────
  it('REGRESIÓN T-422: con evidencia del salto, restaurar la preferencia DESPUÉS no lo convierte en drop', () => {
    // Caso real: las 3 impugnaciones de marta_benitopadilla cerradas el 31/07 a las 06:50
    // con el soporte apagado; a las 10:43 T-373 se lo restauró (soporteDisabled=false hoy).
    const v = clasificarVerdicto(hechos({ hasSkipEvent: true, soporteDisabled: false }));
    expect(v).toBe('expected_skip');
    expect(esDropReal(v)).toBe(false);
  });

  it('REGRESIÓN dirección peligrosa: apagar el soporte DESPUÉS de un drop real no lo entierra como certeza', () => {
    // Sin evidencia del momento, la preferencia actual es un indicio, no un hecho: se
    // etiqueta como inferido para que se pueda contar aparte y no se dé por resuelto.
    const v = clasificarVerdicto(hechos({ hasSkipEvent: false, soporteDisabled: true }));
    expect(v).toBe('expected_skip_inferred');
    expect(v).not.toBe('expected_skip');
  });

  it('la evidencia gana aunque la preferencia actual también lo explique (no hay ambigüedad)', () => {
    expect(clasificarVerdicto(hechos({ hasSkipEvent: true, soporteDisabled: true }))).toBe(
      'expected_skip',
    );
  });

  it('solo real_drop dispara la alerta', () => {
    const noDisparan: ReturnType<typeof clasificarVerdicto>[] = [
      'delivered',
      'expected_skip',
      'expected_skip_inferred',
      'no_user_email',
    ];
    for (const v of noDisparan) expect(esDropReal(v)).toBe(false);
    expect(esDropReal('real_drop')).toBe(true);
  });
});
