// __tests__/lib/temario/resolveTemarioEfectivo.test.js
//
// Resolución PURA del temario efectivo por convocatoria (Fase 3). Espeja la vista SQL
// convocatoria_temario_efectivo. Sin BD.

const { resolveTemarioEfectivo } = require('../../../lib/temario/resolveTemarioEfectivo');

const V = (id, over = {}) => ({ id, es_default: false, estado: 'active', created_at: '2025-01-01', ...over });

describe('resolveTemarioEfectivo', () => {
  test('1) convocatoria con su propia versión servible → propia', () => {
    const versions = [V('v1', { es_default: true }), V('v2')];
    const r = resolveTemarioEfectivo({ temario_version_id: 'v2' }, versions);
    expect(r).toEqual({ temarioVersionId: 'v2', origen: 'propia' });
  });

  test('2) OEP aprobada sin temario propio → FALLBACK a la default servible', () => {
    const versions = [V('v1', { es_default: true, verified_at: '2024-12-01' })];
    const r = resolveTemarioEfectivo({ temario_version_id: null }, versions);
    expect(r).toEqual({ temarioVersionId: 'v1', origen: 'fallback_anterior' });
  });

  test('2b) versión propia en DRAFT (no servible) → fallback a la anterior', () => {
    const versions = [V('vieja', { es_default: true, estado: 'active', verified_at: '2024-01-01' }), V('draft', { estado: 'draft' })];
    const r = resolveTemarioEfectivo({ temario_version_id: 'draft' }, versions);
    expect(r).toEqual({ temarioVersionId: 'vieja', origen: 'fallback_anterior' });
  });

  test('2c) fallback elige la default servible MÁS RECIENTE', () => {
    const versions = [
      V('a', { es_default: true, estado: 'active', verified_at: '2023-06-01' }),
      V('b', { es_default: true, estado: 'active', verified_at: '2025-06-01' }),
    ];
    // (nota: el invariante de BD es 1 default por oposición; aquí probamos el orden de recencia)
    const r = resolveTemarioEfectivo({ temario_version_id: null }, versions);
    expect(r.temarioVersionId).toBe('b');
    expect(r.origen).toBe('fallback_anterior');
  });

  test('3) ninguna versión servible → sin_temario', () => {
    const versions = [V('d1', { es_default: true, estado: 'draft' })];
    const r = resolveTemarioEfectivo({ temario_version_id: 'd1' }, versions);
    expect(r).toEqual({ temarioVersionId: null, origen: 'sin_temario' });
  });

  test('3b) sin versiones → sin_temario, no revienta', () => {
    expect(resolveTemarioEfectivo({ temario_version_id: null }, [])).toEqual({ temarioVersionId: null, origen: 'sin_temario' });
    expect(resolveTemarioEfectivo(null, null)).toEqual({ temarioVersionId: null, origen: 'sin_temario' });
  });

  test('verified cuenta como servible (además de active)', () => {
    const versions = [V('v', { estado: 'verified' })];
    expect(resolveTemarioEfectivo({ temario_version_id: 'v' }, versions).origen).toBe('propia');
  });
});
