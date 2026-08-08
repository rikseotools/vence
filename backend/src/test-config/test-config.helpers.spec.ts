// T-597 (07/08, decisión de Manuel): las PERSONALIZADAS sí admiten oficiales, aquí en el
// GEMELO del backend — el que producción ejecuta de verdad (test-config está enrutado al
// backend, lib/api/backend-router.ts). Es el mismo caso que motivó esta ficha (Sergio,
// feedback 87e987d8): arreglar solo el frontend deja el fix inerte, mismo patrón que
// T-507/T-551 (ver __tests__/guardrails/estimateAvailableQuestionsParidad.test.ts).
//
// Manuel pidió explícitamente que el test fije las DOS mitades: que una personalizada ya
// admite oficiales, Y que una oposición normal SIGUE filtrando (el caso Laura).
import { buildOfficialExamFilter } from './test-config.helpers';

describe('buildOfficialExamFilter (backend, gemelo de lib/api/oposicion-scope/queries.ts)', () => {
  it('una personalizada admite TODAS las oficiales — filtro "true" sin restricción', () => {
    const filter = buildOfficialExamFilter(
      'personalizada_a92faefaf41b4d36b723c274f90a59f7',
    ) as unknown as { queryChunks: unknown };
    expect(filter.queryChunks).toEqual([{ value: ['true'] }]);
  });

  it('el prefijo no distingue mayúsculas', () => {
    const filter = buildOfficialExamFilter('PERSONALIZADA_ABC123') as unknown as {
      queryChunks: unknown;
    };
    expect(filter.queryChunks).toEqual([{ value: ['true'] }]);
  });

  it('el caso Laura sigue protegido: positionType SIN mapeo (no personalizada) sigue bloqueando TODAS las oficiales', () => {
    const filter = buildOfficialExamFilter('oposicion_inexistente_xyz') as unknown as {
      queryChunks: unknown;
    };
    expect(filter.queryChunks).not.toEqual([{ value: ['true'] }]);
  });

  it('un positionType que solo CONTIENE "personalizada" pero no empieza así sigue bloqueando', () => {
    const filter = buildOfficialExamFilter('oposicion_personalizada_xyz') as unknown as {
      queryChunks: unknown;
    };
    expect(filter.queryChunks).not.toEqual([{ value: ['true'] }]);
  });

  it('una oposición con mapeo real sigue devolviendo la cláusula por exam_position, no "true"', () => {
    // auxiliar_administrativo_estado está en EXAM_POSITION_MAP con valores reales.
    const filter = buildOfficialExamFilter('auxiliar_administrativo_estado') as unknown as {
      queryChunks: unknown;
    };
    expect(filter.queryChunks).not.toEqual([{ value: ['true'] }]);
  });
});
