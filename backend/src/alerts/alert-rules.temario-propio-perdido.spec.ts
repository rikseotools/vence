import { RULE_TEMARIO_PROPIO_PERDIDO } from './alert-rules';

/**
 * Tests de `temario_propio_perdido` — la regla que avisa de que alguien armó su
 * temario entero y lo perdió al guardar (T-327).
 *
 * ## Por qué se le añade la HORA de la última pérdida (02/08/2026)
 *
 * La regla mira una ventana de **24 h** y dispara a la primera, a propósito: una sola
 * pérdida ya es un usuario perdido. El efecto secundario es que una pérdida **ya
 * arreglada** se sigue anunciando hasta que la ventana caduca, y el aviso no daba
 * ninguna pista de cuándo ocurrió.
 *
 * Caso real que lo motiva: el aviso del 02/08 a las 08:05 correspondía a una pérdida
 * de las **13:47 del 01/08**, anterior al arreglo (commit `d6bb20af0`, 15:56 del mismo
 * día). Media hora de investigación para concluir que ya estaba resuelto. Con la hora
 * delante, la comparación contra el último deploy es inmediata.
 *
 * Los datos de estos tests son los de ese caso, no inventados.
 */
describe('RULE_TEMARIO_PROPIO_PERDIDO', () => {
  const PERDIDA = new Date('2026-08-01T13:47:12.000Z');

  it('no dispara cuando no se ha perdido nada', () => {
    expect(RULE_TEMARIO_PROPIO_PERDIDO.shouldFire([{ veces: 0, detalle: '', ultima: null }])).toBe(false);
  });

  it('dispara con UNA sola pérdida (no es un umbral de volumen)', () => {
    expect(
      RULE_TEMARIO_PROPIO_PERDIDO.shouldFire([{ veces: 1, detalle: 'Failed query', ultima: PERDIDA }]),
    ).toBe(true);
  });

  it('el título lleva la hora de la última pérdida', () => {
    const n = RULE_TEMARIO_PROPIO_PERDIDO.buildNotification([
      { veces: 1, detalle: 'Failed query: INSERT INTO topic_scope', ultima: PERDIDA },
    ]);
    expect(n.title).toContain('1 temario(s) propios PERDIDOS');
    expect(n.title).toContain('2026-08-01T13:47:12.000Z');
  });

  it('el cuerpo manda comparar con el último deploy antes de investigar', () => {
    const n = RULE_TEMARIO_PROPIO_PERDIDO.buildNotification([
      { veces: 1, detalle: 'x', ultima: PERDIDA },
    ]);
    expect(n.body).toContain('último deploy');
    // Y sigue diciendo cómo reproducir: el aviso tiene que ser accionable por sí solo.
    expect(n.body).toContain('npm run sim:oposicion-personalizada');
  });

  it('la hora viaja también en metadata, para poder consultarla sin parsear el texto', () => {
    const n = RULE_TEMARIO_PROPIO_PERDIDO.buildNotification([
      { veces: 2, detalle: 'x', ultima: PERDIDA },
    ]);
    expect(n.metadata).toMatchObject({ veces: 2, ultima: '2026-08-01T13:47:12.000Z' });
  });

  it('aguanta que la fecha llegue como cadena (así la devuelve el driver a veces)', () => {
    const n = RULE_TEMARIO_PROPIO_PERDIDO.buildNotification([
      { veces: 1, detalle: 'x', ultima: '2026-08-01T13:47:12.000Z' },
    ]);
    expect(n.title).toContain('2026-08-01T13:47:12.000Z');
  });

  it('sin fecha no revienta ni inventa una', () => {
    const n = RULE_TEMARIO_PROPIO_PERDIDO.buildNotification([{ veces: 1, detalle: 'x', ultima: null }]);
    expect(n.title).not.toContain('última:');
    expect(n.body).toContain('(sin fecha)');
    expect(n.metadata).toMatchObject({ ultima: null });
  });

  it('la huella no cambia: el backoff por problema sigue agrupando igual', () => {
    const n = RULE_TEMARIO_PROPIO_PERDIDO.buildNotification([
      { veces: 1, detalle: 'x', ultima: PERDIDA },
    ]);
    expect(n.fingerprint).toBe('temario_propio_perdido');
  });
});
