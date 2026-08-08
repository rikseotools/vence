// T-597 (07/08, decisión de Manuel): las PERSONALIZADAS sí admiten oficiales, aquí en el
// GEMELO del backend — el que producción ejecuta de verdad (test-config está enrutado al
// backend, lib/api/backend-router.ts). Es el mismo caso que motivó esta ficha (Sergio,
// feedback 87e987d8): arreglar solo el frontend deja el fix inerte, mismo patrón que
// T-507/T-551 (ver __tests__/guardrails/estimateAvailableQuestionsParidad.test.ts).
//
// Manuel pidió explícitamente que el test fije las DOS mitades: que una personalizada ya
// admite oficiales, Y que una oposición normal SIGUE filtrando (el caso Laura).
import {
  buildOfficialExamFilter,
  getValidExamPositionsOrUnrestricted,
} from './test-config.helpers';

describe('buildOfficialExamFilter (backend, gemelo de lib/api/oposicion-scope/queries.ts)', () => {
  it('una personalizada admite TODAS las oficiales — filtro "true" sin restricción', () => {
    const filter = buildOfficialExamFilter(
      'personalizada_a92faefaf41b4d36b723c274f90a59f7',
    ) as unknown as { queryChunks: unknown };
    expect(filter.queryChunks).toEqual([{ value: ['true'] }]);
  });

  it('el prefijo no distingue mayúsculas', () => {
    const filter = buildOfficialExamFilter(
      'PERSONALIZADA_ABC123',
    ) as unknown as {
      queryChunks: unknown;
    };
    expect(filter.queryChunks).toEqual([{ value: ['true'] }]);
  });

  it('el caso Laura sigue protegido: positionType SIN mapeo (no personalizada) sigue bloqueando TODAS las oficiales', () => {
    const filter = buildOfficialExamFilter(
      'oposicion_inexistente_xyz',
    ) as unknown as {
      queryChunks: unknown;
    };
    expect(filter.queryChunks).not.toEqual([{ value: ['true'] }]);
  });

  it('un positionType que solo CONTIENE "personalizada" pero no empieza así sigue bloqueando', () => {
    const filter = buildOfficialExamFilter(
      'oposicion_personalizada_xyz',
    ) as unknown as {
      queryChunks: unknown;
    };
    expect(filter.queryChunks).not.toEqual([{ value: ['true'] }]);
  });

  it('una oposición con mapeo real sigue devolviendo la cláusula por exam_position, no "true"', () => {
    // auxiliar_administrativo_estado está en EXAM_POSITION_MAP con valores reales.
    const filter = buildOfficialExamFilter(
      'auxiliar_administrativo_estado',
    ) as unknown as {
      queryChunks: unknown;
    };
    expect(filter.queryChunks).not.toEqual([{ value: ['true'] }]);
  });
});

// T-597 (08/08): el filtro SQL (arriba) tenía su early-return desde el 07/08, pero los SIETE
// contadores de test-config.service.ts (estimateByLaws, estimateByTopic, essential articles,
// getArticlesForLaw) leían getValidExamPositions a pelo — para una personalizada eso es
// SIEMPRE [], así que "solo oficiales" seguía devolviendo count:0 pese a que el serve ya
// admitía las 518 oficiales servibles de la personalizada de Sergio. Este helper es la
// fuente única que arregla los siete de una vez.
describe('getValidExamPositionsOrUnrestricted — fuente única de CONTEO (gemelo de exam-positions.ts)', () => {
  it('una personalizada devuelve null (sin restricción), no []', () => {
    expect(
      getValidExamPositionsOrUnrestricted(
        'personalizada_a92faefaf41b4d36b723c274f90a59f7',
      ),
    ).toBeNull();
  });

  it('el prefijo no distingue mayúsculas', () => {
    expect(
      getValidExamPositionsOrUnrestricted('PERSONALIZADA_ABC123'),
    ).toBeNull();
  });

  it('una oposición real CON mapeo devuelve su lista normal (no null)', () => {
    const valid = getValidExamPositionsOrUnrestricted(
      'auxiliar_administrativo_estado',
    );
    expect(valid).not.toBeNull();
    expect(Array.isArray(valid)).toBe(true);
    expect((valid as string[]).length).toBeGreaterThan(0);
  });

  it('una oposición real SIN mapeo devuelve [] (no null) — el caso Laura sigue bloqueando', () => {
    expect(
      getValidExamPositionsOrUnrestricted('oposicion_inexistente_xyz'),
    ).toEqual([]);
  });

  it('un positionType que solo CONTIENE "personalizada" pero no empieza así NO devuelve null', () => {
    expect(
      getValidExamPositionsOrUnrestricted('oposicion_personalizada_xyz'),
    ).toEqual([]);
  });
});
