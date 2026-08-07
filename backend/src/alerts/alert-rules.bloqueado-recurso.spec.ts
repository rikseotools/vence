// La vigilancia del bloqueo FUERA de las rutas de cobro (T-670, 07/08/2026).
//
// `cobro_bloqueado_auth` solo miraba rutas de pago, así que 190 rechazos en /api/exam/validate y
// 20 personas sin poder corregir su examen no dispararon nada: lo contó una usuaria, no el
// sistema. Estos casos fijan el umbral y, sobre todo, que la regla NO se solape con su hermana.
import { RULE_BLOQUEADO_EN_SU_RECURSO } from './alert-rules';

const fila = (n: number, usuarios = 1, topEndpoint = '/api/exam/validate') => ({
  n,
  usuarios,
  topEndpoint,
});

describe('RULE_BLOQUEADO_EN_SU_RECURSO', () => {
  it('NO dispara con el goteo de un día normal (máximo medido: 9 en una hora)', () => {
    expect(RULE_BLOQUEADO_EN_SU_RECURSO.shouldFire([fila(1)])).toBe(false);
    expect(RULE_BLOQUEADO_EN_SU_RECURSO.shouldFire([fila(4)])).toBe(false);
  });

  it('dispara con la firma del incidente (>20 por cuarto de hora)', () => {
    expect(RULE_BLOQUEADO_EN_SU_RECURSO.shouldFire([fila(5)])).toBe(true);
    expect(RULE_BLOQUEADO_EN_SU_RECURSO.shouldFire([fila(22, 4)])).toBe(true);
  });

  it('sin filas no dispara (la ausencia de datos no es una alarma)', () => {
    expect(RULE_BLOQUEADO_EN_SU_RECURSO.shouldFire([])).toBe(false);
  });

  it('EXCLUYE las rutas de cobro: esas las lleva cobro_bloqueado_auth, y dos avisos del mismo hecho no avisan el doble', () => {
    const q = JSON.stringify(RULE_BLOQUEADO_EN_SU_RECURSO.query);
    expect(q).toContain('auth_identidad_ajena_rechazada');
    expect(q).toContain('NOT');
    expect(q).toContain('stripe');
  });

  it('el aviso dice QUÉ mirar, no solo que pasó algo', () => {
    const aviso = RULE_BLOQUEADO_EN_SU_RECURSO.buildNotification([fila(22, 4)]);
    expect(aviso.title).toContain('/api/exam/validate');
    expect(aviso.title).toContain('4 usuario');
    expect(aviso.body).toContain('recurso_ajeno');
    expect(aviso.body).toContain('apiFetch');
  });

  it('el fingerprint separa por endpoint (dos endpoints rotos son dos problemas)', () => {
    const a = RULE_BLOQUEADO_EN_SU_RECURSO.buildNotification([fila(9, 2, '/api/exam/validate')]);
    const b = RULE_BLOQUEADO_EN_SU_RECURSO.buildNotification([
      fila(9, 2, '/api/tests/[testId]/review'),
    ]);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('es `error`, no `critical`: el dinero conserva su regla más ruidosa', () => {
    expect(RULE_BLOQUEADO_EN_SU_RECURSO.severity).toBe('error');
  });
});
