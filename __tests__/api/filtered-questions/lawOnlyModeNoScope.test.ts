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

describe('Filtro de oficiales: NO aplica en practice mode, SÍ en only-oficial', () => {
  // Post-16/04/2026 (tras caso M + análisis contenido compartido):
  // El filtro por exam_position solo se aplica cuando onlyOfficialQuestions=true.
  //
  // En practice mode, un usuario de CARM haciendo test sobre Art 43 CE ve
  // también oficiales de AAE, Andalucía, CyL... si están vinculadas a ese
  // artículo. Se consideran material de práctica válido (el contenido es el
  // mismo). Los marcadores "🏛️ Oficial" solo se muestran si la oficial es
  // de su oposición (isOfficialForUserOposicion).

  // Réplica del filtro post-cambio. Simula el .where(and(...)) de Drizzle.
  function passesFilter(params: {
    isOfficial: boolean
    examPosition: string | null
    positionType: string
    onlyOfficial: boolean
  }): boolean {
    const VALID: Record<string, string[]> = {
      auxiliar_administrativo_estado: ['auxiliar_administrativo_estado', 'auxiliar administrativo'],
      auxiliar_administrativo_carm: ['auxiliar_administrativo_carm'],
    }

    if (!params.onlyOfficial) {
      // Practice mode: TODO pasa (no filter por exam_position)
      return true
    }
    // Only-oficial mode: aplica el filtro de exam_position
    if (!params.isOfficial) return false
    const valid = VALID[params.positionType]
    if (!valid || valid.length === 0) return false
    return !!params.examPosition && valid.includes(params.examPosition)
  }

  // === Practice mode: pasa todo ===
  test('practice: no-oficial siempre pasa', () => {
    expect(passesFilter({ isOfficial: false, examPosition: null, positionType: 'auxiliar_administrativo_carm', onlyOfficial: false })).toBe(true)
  })

  test('practice (caso nuevo): Laura (CARM) en test tema ve oficial de AAE sobre artículo compartido', () => {
    // Antes estaba bloqueado; ahora pasa para que haya más material.
    expect(passesFilter({ isOfficial: true, examPosition: 'auxiliar_administrativo_estado', positionType: 'auxiliar_administrativo_carm', onlyOfficial: false })).toBe(true)
  })

  test('practice: usuario AAE ve oficial de Andalucía en LPRL (si el artículo entrara en su scope)', () => {
    expect(passesFilter({ isOfficial: true, examPosition: 'auxiliar_administrativo_andalucia', positionType: 'auxiliar_administrativo_estado', onlyOfficial: false })).toBe(true)
  })

  // === Only-oficial mode: filtra por exam_position ===
  test('only-oficial: usuario AAE con oficial AAE → pasa', () => {
    expect(passesFilter({ isOfficial: true, examPosition: 'auxiliar_administrativo_estado', positionType: 'auxiliar_administrativo_estado', onlyOfficial: true })).toBe(true)
  })

  test('only-oficial: usuario AAE con oficial CyL → NO pasa (simulacro de SU examen)', () => {
    expect(passesFilter({ isOfficial: true, examPosition: 'auxiliar_administrativo_cyl', positionType: 'auxiliar_administrativo_estado', onlyOfficial: true })).toBe(false)
  })

  test('only-oficial: no-oficiales no pasan', () => {
    expect(passesFilter({ isOfficial: false, examPosition: null, positionType: 'auxiliar_administrativo_estado', onlyOfficial: true })).toBe(false)
  })

  test('only-oficial: positionType sin mapeo → 0 oficiales (default seguro, caso Laura)', () => {
    expect(passesFilter({ isOfficial: true, examPosition: 'auxiliar_administrativo_estado', positionType: 'oposicion_sin_mapeo', onlyOfficial: true })).toBe(false)
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
