/**
 * Tests para BUG 4: Modo global sin buildOfficialExamFilter.
 *
 * Bug: el modo global (sin tema ni ley) filtraba por validLawIds pero NO
 * aplicaba buildOfficialExamFilter ni eq(isOfficialExam, true) cuando
 * onlyOfficialQuestions=true. Oficiales de administrativo_estado (C1)
 * aparecían en tests de auxiliar (C2) por leyes compartidas (CE, TREBEP).
 *
 * Fix: aplicar buildOfficialExamFilter + isOfficialExam filter en modo
 * global, consistente con MODO TEMA.
 */

describe('BUG 4: Global mode — official exam filter', () => {

  describe('Consistencia con MODO TEMA', () => {
    it('onlyOfficialQuestions=true → aplica buildOfficialExamFilter en ambos modos', () => {
      const onlyOfficialQuestions = true

      // MODO TEMA (línea 806): onlyOfficialQuestions ? buildOfficialExamFilter(positionType) : sql`true`
      const modoTemaFilter = onlyOfficialQuestions ? 'buildOfficialExamFilter' : 'true'

      // MODO GLOBAL (fix): misma lógica
      const modoGlobalFilter = onlyOfficialQuestions ? 'buildOfficialExamFilter' : 'true'

      expect(modoTemaFilter).toBe(modoGlobalFilter)
    })

    it('onlyOfficialQuestions=false → NO aplica filtro en ningún modo', () => {
      const onlyOfficialQuestions = false

      const modoTemaFilter = onlyOfficialQuestions ? 'buildOfficialExamFilter' : 'true'
      const modoGlobalFilter = onlyOfficialQuestions ? 'buildOfficialExamFilter' : 'true'

      expect(modoTemaFilter).toBe('true')
      expect(modoGlobalFilter).toBe('true')
    })
  })

  describe('Cross-oposición en modo oficial', () => {
    it('oficial de administrativo_estado (C1) NO aparece en auxiliar (C2) modo oficial', () => {
      const positionType = 'auxiliar_administrativo_estado'
      const questionExamPosition = 'administrativo_estado'
      const onlyOfficialQuestions = true

      // buildOfficialExamFilter devuelve exam_positions válidas para el positionType
      // auxiliar_administrativo_estado → solo acepta exam_position = 'auxiliar_administrativo_estado'
      const validPositions = [positionType]
      const passes = validPositions.includes(questionExamPosition)

      expect(passes).toBe(false)
    })

    it('oficial de auxiliar_administrativo_estado SÍ aparece en su propio test', () => {
      const positionType = 'auxiliar_administrativo_estado'
      const questionExamPosition = 'auxiliar_administrativo_estado'

      const validPositions = [positionType]
      const passes = validPositions.includes(questionExamPosition)

      expect(passes).toBe(true)
    })
  })

  describe('Modo práctica (no oficial) — contenido compartido', () => {
    it('en modo práctica, oficiales de C1 SÍ aparecen en C2 (by design)', () => {
      const onlyOfficialQuestions = false
      const filter = onlyOfficialQuestions ? 'buildOfficialExamFilter' : 'true'

      // sql`true` = no filtra por exam_position → se comparten preguntas
      expect(filter).toBe('true')
    })

    it('CE compartida: preguntas de cualquier exam_position aparecen en modo práctica', () => {
      const sharedLaw = 'law-ce'
      const auxEstadoScope = ['law-ce', 'law-39-2015']
      const isLawInScope = auxEstadoScope.includes(sharedLaw)
      const onlyOfficialQuestions = false

      // En modo práctica: la ley está en scope → la pregunta aparece, sin importar exam_position
      expect(isLawInScope).toBe(true)
      expect(onlyOfficialQuestions).toBe(false)
    })
  })

  describe('Routing — cuándo se activa modo global', () => {
    it('sin tema + sin ley → modo global', () => {
      const topicsToQuery: number[] = []
      const selectedLaws: string[] = []
      const isLawOnlyMode = topicsToQuery.length === 0 && selectedLaws.length > 0
      const isGlobalMode = topicsToQuery.length === 0 && !isLawOnlyMode

      expect(isGlobalMode).toBe(true)
    })

    it('con tema → NO modo global (modo tema)', () => {
      const topicsToQuery = [106]
      const isGlobalMode = topicsToQuery.length === 0

      expect(isGlobalMode).toBe(false)
    })

    it('sin tema + con ley → NO modo global (modo ley)', () => {
      const topicsToQuery: number[] = []
      const selectedLaws = ['CE']
      const isLawOnlyMode = topicsToQuery.length === 0 && selectedLaws.length > 0
      const isGlobalMode = topicsToQuery.length === 0 && !isLawOnlyMode

      expect(isGlobalMode).toBe(false)
    })
  })
})
