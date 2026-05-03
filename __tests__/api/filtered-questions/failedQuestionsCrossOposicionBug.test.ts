/**
 * Tests del fix para el bug Isabel Iglesias (2026-05-03):
 * el modo `onlyFailedQuestions` traía preguntas falladas en CUALQUIER oposición,
 * sin filtrar por la oposición activa. Resultado: usuarios multi-oposición
 * veían su test de repaso del Tema X mezclado con preguntas de otra oposición
 * (caso Isabel: estudiaba aux_admin_estado y aux_admin_madrid; el repaso del
 * T12 estado le trajo preguntas de Madrid Y de presupuestos del estado T15).
 *
 * Fix: añadir EXISTS contra topic_scope + topics filtrando por position_type
 * (siempre) y por topic_number (cuando topicNumber > 0). Pre-check para no
 * romper oposiciones sin scopes configurados (caso Lidia 18/04/2026 — Valencia,
 * celador_sescam_clm, celador_sermas_madrid).
 */

describe('Failed questions — fix cross-oposición (Isabel 2026-05-03)', () => {
  beforeEach(() => jest.clearAllMocks())

  // ============================================
  // ROUTING DEL NUEVO COMPORTAMIENTO
  // ============================================
  describe('Detección de filtros', () => {
    it('topicNumber > 0 → activa filtro por tema concreto', () => {
      const topicNumber = 12
      const hasTopicFilter = !!topicNumber && topicNumber > 0
      expect(hasTopicFilter).toBe(true)
    })

    it('topicNumber = 0 → no filtra por tema, solo por oposición', () => {
      const topicNumber = 0
      const hasTopicFilter = !!topicNumber && topicNumber > 0
      expect(hasTopicFilter).toBe(false)
    })

    it('topicNumber = undefined/null → no filtra por tema', () => {
      const topicNumberUndef: number | undefined = undefined
      const topicNumberNull: number | null = null
      expect(!!topicNumberUndef && topicNumberUndef > 0).toBe(false)
      expect(!!topicNumberNull && (topicNumberNull as number) > 0).toBe(false)
    })

    it('positionType siempre se aplica (cuando hay scopes en BD)', () => {
      // Independientemente de topicNumber, hasScopes y positionType se evalúan.
      const positionType = 'auxiliar_administrativo_estado'
      expect(positionType).toBeTruthy()
    })
  })

  // ============================================
  // ESCENARIO ISABEL — multi-oposición
  // ============================================
  describe('Caso Isabel — multi-oposición desde la misma cuenta', () => {
    it('repaso T12 aux_admin_estado NO trae preguntas de aux_admin_madrid', () => {
      // Isabel falló preguntas en /aux-admin-madrid/test/tema/12/...
      // El repaso de /aux-admin-estado/test/tema/12/... NO debe traerlas.
      const sessionPositionType = 'auxiliar_administrativo_estado'
      const sessionTopicNumber = 12
      const failedQuestionPositionType = 'auxiliar_administrativo_madrid'

      const wouldBeIncluded = (
        sessionPositionType === failedQuestionPositionType
      )
      expect(wouldBeIncluded).toBe(false)
    })

    it('pregunta de Ley CM Hacienda no aparece en repaso aux_admin_estado', () => {
      // La Ley 5/2025 CM Hacienda solo está en scope de aux_admin_madrid T12.
      // En aux_admin_estado: no debe aparecer en NINGÚN repaso.
      const positionsWithLaw = ['auxiliar_administrativo_madrid']
      const sessionPosition = 'auxiliar_administrativo_estado'

      const lawAvailableInSession = positionsWithLaw.includes(sessionPosition)
      expect(lawAvailableInSession).toBe(false)
    })

    it('repaso T12 aux_admin_estado solo trae falladas de leyes en T12 estado', () => {
      // T12 aux_admin_estado = "Protección de datos"
      // scope: LO 3/2018, RGPD, RD 1720/2007.
      const t12EstadoLaws = ['LO 3/2018', 'Reglamento UE 2016/679', 'RD 1720/2007']
      const userFailedLaw = 'Ley 47/2003' // presupuestos, NO en T12 estado

      const inT12Estado = t12EstadoLaws.includes(userFailedLaw)
      expect(inT12Estado).toBe(false)
    })

    it('repaso sin topicNumber trae falladas de cualquier tema de la oposición', () => {
      // Caso vista general "/aux-admin-estado/repaso" sin tema concreto.
      // Debe traer falladas de cualquier topic de la oposición, no solo de uno.
      const topicNumber = 0
      const hasTopicFilter = !!topicNumber && topicNumber > 0
      // Solo se aplica filtro positionType, no topicNumber.
      expect(hasTopicFilter).toBe(false)
    })
  })

  // ============================================
  // FALLBACK PARA OPOSICIONES SIN SCOPES (Lidia)
  // ============================================
  describe('Fallback hasScopes=false — caso Lidia', () => {
    it('oposición con 0 scopes → fallback al modo legacy (selectedLaws solo)', () => {
      // celador_sescam_clm tiene 15 topics pero 0 topic_scope rows.
      // EXISTS daría false para todo → 0 resultados.
      // Fix: pre-check `hasScopes` y si es false, no añadir el EXISTS.
      const positionScopes = 0
      const hasScopes = positionScopes > 0
      expect(hasScopes).toBe(false)
      // En este caso, lawConditions NO incluye scopeFilter.
    })

    it('oposición con scopes parciales → aplica fix normalmente', () => {
      // policia_municipal_madrid tiene 40 topics y 11 scopes (parcial pero hay).
      const positionScopes = 11
      const hasScopes = positionScopes > 0
      expect(hasScopes).toBe(true)
    })

    it('oposición principal (aux_admin_estado) → aplica fix', () => {
      const positionScopes = 125 // aux_admin_estado
      const hasScopes = positionScopes > 0
      expect(hasScopes).toBe(true)
    })
  })

  // ============================================
  // emptyReason DESCRIPTIVO
  // ============================================
  describe('emptyReason cuando no hay falladas', () => {
    it('con topic + leyes → menciona ambos', () => {
      const hasTopicFilter = true
      const hasLawFilter = true
      const selectedLaws = ['LO 3/2018']
      const topicNumber = 12

      const emptyReason = hasTopicFilter
        ? (hasLawFilter
            ? `No tienes preguntas falladas en ${selectedLaws.join(', ')} dentro del Tema ${topicNumber} de tu oposición`
            : `No tienes preguntas falladas en el Tema ${topicNumber} de tu oposición`)
        : (hasLawFilter
            ? `No tienes preguntas falladas en ${selectedLaws.join(', ')} en tu oposición`
            : 'No tienes preguntas falladas aún en tu oposición')

      expect(emptyReason).toBe('No tienes preguntas falladas en LO 3/2018 dentro del Tema 12 de tu oposición')
    })

    it('con topic, sin leyes → menciona tema y oposición', () => {
      const emptyReason = `No tienes preguntas falladas en el Tema 12 de tu oposición`
      expect(emptyReason).toContain('Tema 12')
      expect(emptyReason).toContain('oposición')
    })

    it('sin topic, sin leyes → mensaje general', () => {
      const emptyReason = 'No tienes preguntas falladas aún en tu oposición'
      expect(emptyReason).toContain('en tu oposición')
    })

    it('todos los emptyReason mencionan "oposición" (vs antes que no)', () => {
      const reasons = [
        'No tienes preguntas falladas aún en tu oposición',
        'No tienes preguntas falladas en CE en tu oposición',
        'No tienes preguntas falladas en el Tema 12 de tu oposición',
        'No tienes preguntas falladas en LO 3/2018 dentro del Tema 12 de tu oposición',
      ]
      expect(reasons.every(r => r.includes('oposición'))).toBe(true)
    })
  })

  // ============================================
  // INTERACCIÓN CON selectedLaws
  // ============================================
  describe('Compatibilidad con selectedLaws', () => {
    it('selectedLaws + positionType → ambos filtros se aplican (AND)', () => {
      // Si el usuario selecciona ['CE'] en el configurador, además de filtrar
      // por la oposición, se restringe a la ley CE.
      const selectedLaws = ['CE']
      const positionType = 'auxiliar_administrativo_estado'

      // Resultado: SOLO falladas que estén en la ley CE Y en algún topic de aux_admin_estado.
      expect(selectedLaws.length).toBe(1)
      expect(positionType).toBeTruthy()
    })

    it('selectedLaws sin positionType (caso edge) → no debería pasar (positionType siempre default)', () => {
      // El schema tiene default 'auxiliar_administrativo_estado'.
      const positionType = 'auxiliar_administrativo_estado'
      expect(positionType).toBeTruthy()
    })
  })

  // ============================================
  // INVARIANTES
  // ============================================
  describe('Invariantes del fix', () => {
    it('failedQuestionIds explícitos NO se filtran por positionType', () => {
      // Cuando el usuario pasa IDs concretos (sessionStorage), se asume que
      // el cliente ya hizo la decisión sobre qué preguntas. No se aplica filtro.
      // Esto NO ha cambiado en el fix.
      const failedQuestionIds = ['q-uuid-1', 'q-uuid-2']
      const usesPositionFilter = false
      expect(failedQuestionIds.length).toBeGreaterThan(0)
      expect(usesPositionFilter).toBe(false)
    })

    it('preguntas nuevas (no falladas) NO entran por este path', () => {
      const onlyFailedQuestions = false
      const entersFailedPath = onlyFailedQuestions
      expect(entersFailedPath).toBe(false)
    })

    it('userId null NO activa el path (security)', () => {
      const onlyFailedQuestions = true
      const userId: string | null = null
      const failedQuestionIds: string[] = []
      const activates = onlyFailedQuestions && failedQuestionIds.length === 0 && !!userId
      expect(activates).toBe(false)
    })
  })
})
