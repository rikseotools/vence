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

// ── El token de baja como SEGUNDA evidencia (T-501) ───────────────────────────────────
//
// Nace del lado de feedback, donde hay dos saltos legítimos más que en impugnaciones y uno
// depende de una ventana de 5 segundos que nadie puede releer. Sin este hecho, la única
// pérdida real de 90 días queda enterrada entre 42 saltos legítimos.
describe('clasificarVerdicto — el token prueba que el envío pasó el gate', () => {
  it('token sin email: drop REAL aunque la preferencia de hoy explicaría el salto', () => {
    // Éste es el caso que el criterio viejo NO podía afirmar: `soporteDisabled` lo habría
    // rebajado a "inferido" y nadie lo miraría. El token dice que sendEmailV2 llegó a
    // ejecutarse, así que el gate ya lo había dejado pasar.
    const v = clasificarVerdicto(
      hechos({ hasUnsubscribeToken: true, soporteDisabled: true }),
    );
    expect(v).toBe('real_drop');
    expect(esDropReal(v)).toBe(true);
  });

  it('token sin email y sin destinatario conocido: sigue siendo drop (hubo intento)', () => {
    expect(clasificarVerdicto(hechos({ hasUnsubscribeToken: true, email: null }))).toBe(
      'real_drop',
    );
  });

  it('el email entregado sigue mandando sobre el token', () => {
    expect(
      clasificarVerdicto(hechos({ hasUnsubscribeToken: true, hasEmailEvent: true })),
    ).toBe('delivered');
  });

  it('la evidencia del salto gana al token (no pueden darse a la vez de verdad)', () => {
    // Contradicción imposible por construcción —el token se crea DESPUÉS del gate y el
    // skip se emite AL cortarlo—, así que si aparecen juntos es una colisión de la ventana
    // temporal con otro envío del mismo tipo. Ante la duda, no se grita.
    expect(
      clasificarVerdicto(hechos({ hasUnsubscribeToken: true, hasSkipEvent: true })),
    ).toBe('expected_skip');
  });

  it('SIN el hecho nuevo, el criterio de impugnaciones no cambia ni un ápice', () => {
    // El campo es opcional a propósito: el reconciliador de impugnaciones no lo pasa
    // todavía y su comportamiento verificado en producción tiene que quedar idéntico.
    expect(clasificarVerdicto(hechos({ soporteDisabled: true }))).toBe(
      'expected_skip_inferred',
    );
    expect(clasificarVerdicto(hechos())).toBe('real_drop');
  });
});
