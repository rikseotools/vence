import {
  ALERT_RULES,
  RULE_PAGO_FALLIDO_FALSA_ALARMA,
} from './alert-rules';

/**
 * T-594 — nadie vuelve a recibir «Problema con el pago» mientras está pagando bien.
 *
 * La regla nace en VERDE (el arreglo ya está puesto), así que su valor es de trinquete:
 * cualquier subida es una regresión demostrable.
 */
describe('RULE_PAGO_FALLIDO_FALSA_ALARMA', () => {
  const fila = (over: Partial<{ n: number; ejemplo: string | null }> = {}) => ({
    n: 0,
    ejemplo: null,
    ...over,
  });

  it('no dispara con cero (el estado esperado tras el arreglo)', () => {
    expect(RULE_PAGO_FALLIDO_FALSA_ALARMA.shouldFire([fila()])).toBe(false);
  });

  it('dispara con UNO: asustar a un solo cliente en mitad de su compra ya es el fallo', () => {
    expect(
      RULE_PAGO_FALLIDO_FALSA_ALARMA.shouldFire([fila({ n: 1, ejemplo: 'a@b.com' })]),
    ).toBe(true);
  });

  it('no revienta si la query no devuelve filas', () => {
    expect(RULE_PAGO_FALLIDO_FALSA_ALARMA.shouldFire([])).toBe(false);
  });

  it('el aviso dice dónde mirar quién y desde cuándo', () => {
    const n = RULE_PAGO_FALLIDO_FALSA_ALARMA.buildNotification([
      fila({ n: 7, ejemplo: 'marta@ejemplo.com' }),
    ]);
    expect(n.body).toContain('stripe:pago-fallido-falsos');
    expect(n.body).toContain('decidirAvisoPagoFallido');
    expect(n.body).toContain('marta@ejemplo.com');
  });

  it('la severidad es `error`: hay dinero y confianza de por medio, no es contexto', () => {
    expect(RULE_PAGO_FALLIDO_FALSA_ALARMA.severity).toBe('error');
  });

  it('está dada de alta en ALERT_RULES (una regla sin registrar no vigila nada)', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('pago_fallido_falsa_alarma');
  });
});
