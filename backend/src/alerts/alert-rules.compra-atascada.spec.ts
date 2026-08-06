import {
  ALERT_RULES,
  RULE_COMPRA_ATASCADA_CHECKOUT,
  RULE_SUBSCRIPTION_CANCEL_ERROR_BURST,
} from './alert-rules';

/**
 * T-601 — que nadie vuelva a pasarse 18 días sin poder pagarnos y sin que nadie lo vea.
 *
 * Nace en VERDE: el rescate ya está puesto, así que cualquier emisión futura es una persona que
 * SÍ estuvo atrapada. El valor es de trinquete y, sobre todo, de que la señal exista: el caso
 * original fue invisible porque lo único que sonó nombraba el endpoint de cancelar.
 */
describe('RULE_COMPRA_ATASCADA_CHECKOUT', () => {
  const fila = (
    over: Partial<{ n: number; usuarios: number; ultimoUsuario: string | null }> = {},
  ) => ({ n: 0, usuarios: 0, ultimoUsuario: null, ...over });

  it('no dispara con cero', () => {
    expect(RULE_COMPRA_ATASCADA_CHECKOUT.shouldFire([fila()])).toBe(false);
  });

  it('dispara con UNA sola persona — y ese umbral es el punto', () => {
    // Medido sobre 60 días de las dos cuentas de Stripe: solo 2 clientes llegaron a este estado.
    // Cualquier umbral por volumen dejaría la señal muda para siempre, que es justo lo que pasó.
    expect(
      RULE_COMPRA_ATASCADA_CHECKOUT.shouldFire([
        fila({ n: 1, usuarios: 1, ultimoUsuario: 'uuid-1' }),
      ]),
    ).toBe(true);
  });

  it('no revienta si la query no devuelve filas', () => {
    expect(RULE_COMPRA_ATASCADA_CHECKOUT.shouldFire([])).toBe(false);
  });

  it('vigila el evento que emite el rescate, y no otro', () => {
    // Si alguien renombra el eventType en `queries.ts` sin tocar esto, la regla queda mirando
    // a un evento que ya no existe: verde permanente por ceguera.
    // La SQL de Drizzle es un objeto con `queryChunks`, no una cadena: `String(...)` daría
    // "[object Object]" y el test pasaría en falso.
    expect(JSON.stringify(RULE_COMPRA_ATASCADA_CHECKOUT.query)).toContain(
      'subscription_checkout_expirado_para_cancelar',
    );
  });

  it('el aviso dice cuántas PERSONAS, no solo cuántos eventos', () => {
    const n = RULE_COMPRA_ATASCADA_CHECKOUT.buildNotification([
      fila({ n: 5, usuarios: 2, ultimoUsuario: 'uuid-9' }),
    ]);
    // Cinco rescates de una misma persona y cinco de cinco personas distintas son problemas
    // distintos: uno es alguien peleándose con su banco, el otro es el método de pago.
    expect(n.title).toContain('2 persona');
    expect(n.body).toContain('uuid-9');
  });

  it('el aviso deja escrito lo que ya sabemos: los 2 casos medidos murieron en Link', () => {
    // El hallazgo caro fue ese, no el bloqueo de la cancelación. Quien lea la alerta dentro de
    // seis meses no tendrá el contexto: tiene que venir en el propio correo.
    const n = RULE_COMPRA_ATASCADA_CHECKOUT.buildNotification([fila({ n: 1, usuarios: 1 })]);
    expect(n.body).toContain('Link');
  });

  it('está registrada en ALERT_RULES (si no, no se evalúa nunca)', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('compra_atascada_checkout_expirado');
  });
});

describe('la alerta que ENGAÑABA sigue avisando de que engaña', () => {
  it('el burst de cancelaciones manda contar usuarios distintos antes de culpar a Stripe', () => {
    // El 05/08 saltó por 16 intentos de UNA persona y se leyó como «Stripe degradado». Que la
    // primera pregunta sea «¿cuántos usuarios?» es lo que separa un incidente de un atasco.
    const n = RULE_SUBSCRIPTION_CANCEL_ERROR_BURST.buildNotification([
      { n: 8, lastMsg: 'You cannot cancel a subscription with an active checkout session.' },
    ]);
    expect(n.body).toContain('usuarios distintos');
    expect(n.body).toContain('T-601');
  });
});
