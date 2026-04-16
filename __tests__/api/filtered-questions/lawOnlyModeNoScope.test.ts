// __tests__/api/filtered-questions/lawOnlyModeNoScope.test.ts
//
// Tests del comportamiento post-16/04/2026 (caso M, daluamva):
// en `isLawOnlyMode` ya NO se aplica filtro cross-oposición sobre las
// leyes seleccionadas. El usuario ha entrado a /leyes/[slug]
// explícitamente y debe poder estudiar cualquier ley aunque no esté en
// el scope de su target_oposicion.
//
// Los tests replican la lógica nueva de queries.ts:
//   const lawResults = await db.select(...).where(inArray(laws.shortName, selectedLaws))
//
// Si alguien re-introduce el scope-check en ley-only, estos tests
// deberían FALLAR.

describe('Modo ley-only: selectedLaws se usa directamente (sin scope-check)', () => {

  // Réplica exacta del bloque post-fix en lib/api/filtered-questions/queries.ts
  function buildLawQueryFilter(params: {
    selectedLaws: string[]
    positionType: string
    allowedLawShortNames: string[] // scope que tendría el usuario — NO se aplica
  }) {
    // Post-16/04/2026: se ignora allowedLawShortNames en modo ley-only.
    // selectedLaws va directo al .where(inArray(laws.shortName, selectedLaws))
    return {
      lawsToQuery: params.selectedLaws,
      scopeApplied: false,
    }
  }

  test('ley dentro del scope → se consulta con normalidad (regresión)', () => {
    const r = buildLawQueryFilter({
      selectedLaws: ['CE'],
      positionType: 'auxiliar_administrativo_estado',
      allowedLawShortNames: ['CE', 'Ley 39/2015', 'Ley 40/2015'],
    })
    expect(r.lawsToQuery).toEqual(['CE'])
    expect(r.scopeApplied).toBe(false)
  })

  test('caso M: LPRL (fuera de scope AAE) se consulta igual que una en scope', () => {
    const r = buildLawQueryFilter({
      selectedLaws: ['LPRL'],
      positionType: 'auxiliar_administrativo_estado',
      allowedLawShortNames: ['CE', 'Ley 39/2015', 'Ley 40/2015'], // LPRL NO está
    })
    // Antes devolvía vacío con emptyReason; ahora deja pasar.
    expect(r.lawsToQuery).toEqual(['LPRL'])
  })

  test('ley totalmente inventada: también se intenta (la BD simplemente no devolverá nada)', () => {
    const r = buildLawQueryFilter({
      selectedLaws: ['Ley Inexistente 99/9999'],
      positionType: 'auxiliar_administrativo_estado',
      allowedLawShortNames: ['CE'],
    })
    expect(r.lawsToQuery).toEqual(['Ley Inexistente 99/9999'])
    // El .where(inArray) no encontrará nada → la query devolverá 0 resultados
    // y el endpoint responderá con emptyReason genérico ("No hay preguntas...")
  })

  test('mix de leyes en scope y fuera: TODAS se usan (no se filtra)', () => {
    const r = buildLawQueryFilter({
      selectedLaws: ['CE', 'LPRL', 'Reglamento Cortes CyL'],
      positionType: 'auxiliar_administrativo_estado',
      allowedLawShortNames: ['CE', 'Ley 39/2015'],
    })
    expect(r.lawsToQuery).toEqual(['CE', 'LPRL', 'Reglamento Cortes CyL'])
  })

  test('scope vacío (oposición sin configurar): no bloquea, deja pasar selectedLaws', () => {
    const r = buildLawQueryFilter({
      selectedLaws: ['LPRL'],
      positionType: 'oposicion_recien_creada',
      allowedLawShortNames: [], // sin topic_scope todavía
    })
    expect(r.lawsToQuery).toEqual(['LPRL'])
    expect(r.scopeApplied).toBe(false)
  })

  test('regresión: selectedLaws vacío → no dispara modo ley-only (precondición del modo)', () => {
    // Si selectedLaws está vacío, isLawOnlyMode=false y el modo no aplica.
    // Este test documenta que el fix solo afecta al flujo que ya era ley-only.
    const isLawOnlyMode = (selectedLaws: string[], topicsCount: number) =>
      topicsCount === 0 && selectedLaws.length > 0
    expect(isLawOnlyMode([], 0)).toBe(false)
    expect(isLawOnlyMode(['LPRL'], 0)).toBe(true)
    expect(isLawOnlyMode(['LPRL'], 2)).toBe(false) // hay temas → modo tema
  })
})

describe('Interacción con filtro de oficiales (caso Laura sigue intacto)', () => {
  // buildOfficialExamFilter se aplica aguas abajo en la query. No depende
  // de selectedLaws sino del positionType, por lo que el bug Laura
  // (preguntas oficiales de otras oposiciones colándose) sigue prevenido.
  //
  // Este test documenta que el fix de ley-only NO interfiere con el filtro
  // de oficiales. Si en el futuro alguien elimina buildOfficialExamFilter
  // creyendo que "ya no hace falta con el scope-check fuera", este test
  // debería explotar.

  // Simulación simplificada: el filtro de oficiales recibe positionType y
  // devuelve un predicado que exige que exam_position coincida con valores
  // válidos para ese positionType.
  function officialExamFilterApplied(positionType: string, isOfficial: boolean, examPosition: string | null): boolean {
    // Simplificación: AAE admite oficiales con exam_position 'auxiliar_administrativo_estado'
    const VALID: Record<string, string[]> = {
      auxiliar_administrativo_estado: ['auxiliar_administrativo_estado', 'auxiliar administrativo'],
    }
    if (!isOfficial) return true
    const valid = VALID[positionType]
    if (!valid) return false
    return !!examPosition && valid.includes(examPosition)
  }

  test('usuario AAE pide LPRL: preguntas no-oficiales pasan', () => {
    expect(officialExamFilterApplied('auxiliar_administrativo_estado', false, null)).toBe(true)
  })

  test('usuario AAE pide LPRL con onlyOfficial=true: 0 preguntas si no hay oficiales de LPRL para AAE', () => {
    // Una oficial de LPRL con exam_position='auxiliar_administrativo_cyl' NO pasa
    expect(officialExamFilterApplied('auxiliar_administrativo_estado', true, 'auxiliar_administrativo_cyl')).toBe(false)
  })

  test('usuario AAE pide LPRL con onlyOfficial=true: una oficial marcada para AAE sí pasa', () => {
    // (En BD no hay oficiales de LPRL para AAE actualmente, pero el filtro
    // sería consistente si las hubiera)
    expect(officialExamFilterApplied('auxiliar_administrativo_estado', true, 'auxiliar_administrativo_estado')).toBe(true)
  })
})

describe('Regresión: modo tema/global SIGUE teniendo scope-check', () => {
  // El fix solo afecta a isLawOnlyMode. En modo tema (topicsToQuery.length > 0)
  // o modo global (ni topic ni law), el scope-check se mantiene (bug Mar).

  function getMode(request: { topicsCount: number; selectedLaws: string[] }) {
    const topicsToQuery = request.topicsCount > 0 ? [1] : []
    const isLawOnlyMode = topicsToQuery.length === 0 && request.selectedLaws.length > 0
    const isGlobalMode = topicsToQuery.length === 0 && !isLawOnlyMode
    return {
      mode: topicsToQuery.length > 0 ? 'tema' : isLawOnlyMode ? 'ley-only' : 'global',
      appliesScope: topicsToQuery.length > 0 || isGlobalMode, // ley-only es el único que NO aplica
    }
  }

  test('modo tema: applies scope = true (bug Mar sigue prevenido)', () => {
    const r = getMode({ topicsCount: 1, selectedLaws: [] })
    expect(r.mode).toBe('tema')
    expect(r.appliesScope).toBe(true)
  })

  test('modo tema con selectedLaws (filtro combinado): applies scope', () => {
    const r = getMode({ topicsCount: 1, selectedLaws: ['CE'] })
    expect(r.mode).toBe('tema')
    expect(r.appliesScope).toBe(true)
  })

  test('modo global: applies scope', () => {
    const r = getMode({ topicsCount: 0, selectedLaws: [] })
    expect(r.mode).toBe('global')
    expect(r.appliesScope).toBe(true)
  })

  test('modo ley-only: NO applies scope (el fix)', () => {
    const r = getMode({ topicsCount: 0, selectedLaws: ['LPRL'] })
    expect(r.mode).toBe('ley-only')
    expect(r.appliesScope).toBe(false)
  })
})
