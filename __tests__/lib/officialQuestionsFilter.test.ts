/**
 * Tests para verificar que preguntas oficiales solo muestran las de la oposición correcta,
 * no de otras oposiciones que comparten temario.
 *
 * Bug: CARM (0 oficiales propias) mostraba ~1471 oficiales de GC, Policía, aux estado etc.
 * porque el fallback decía "si no tiene propias → mostrar todas".
 */

import { getValidExamPositions, EXAM_POSITION_MAP } from '@/lib/config/exam-positions'

describe('Filtro de preguntas oficiales por oposición', () => {
  // Simular preguntas oficiales con diferentes exam_position
  interface OfficialQuestion {
    id: string
    exam_position: string
    law_short_name: string
  }

  const MOCK_OFFICIALS: OfficialQuestion[] = [
    { id: 'q1', exam_position: 'auxiliar_administrativo_estado', law_short_name: 'CE' },
    { id: 'q2', exam_position: 'auxiliar_administrativo_estado', law_short_name: 'Ley 39/2015' },
    { id: 'q3', exam_position: 'guardia_civil', law_short_name: 'CE' },
    { id: 'q4', exam_position: 'guardia_civil', law_short_name: 'LO 3/2018' },
    { id: 'q5', exam_position: 'policia_nacional', law_short_name: 'Ley 40/2015' },
    { id: 'q6', exam_position: 'auxiliar_administrativo_carm', law_short_name: 'CE' },
    { id: 'q7', exam_position: 'auxiliar_administrativo_madrid', law_short_name: 'CE' },
    { id: 'q8', exam_position: 'tramitacion_procesal', law_short_name: 'RDL 5/2015' },
    { id: 'q9', exam_position: 'auxiliar_administrativo_valencia', law_short_name: 'LO 3/2007' },
    { id: 'q10', exam_position: 'auxiliar_administrativo_cyl', law_short_name: 'CE' },
  ]

  // Simular filtro de oficiales
  function filterOfficials(
    questions: OfficialQuestion[],
    positionType: string,
    includeShared: boolean
  ): OfficialQuestion[] {
    if (includeShared) return questions // sin filtro

    const validPositions = getValidExamPositions(positionType)
    if (validPositions.length === 0) return [] // sin mapeo → 0 oficiales
    return questions.filter(q => validPositions.includes(q.exam_position))
  }

  // Simular conteo de oficiales para UI (getThemeQuestionCounts)
  function countOfficials(
    questions: OfficialQuestion[],
    positionType: string
  ): number {
    const validPositions = getValidExamPositions(positionType)
    if (validPositions.length === 0) return 0
    return questions.filter(q => validPositions.includes(q.exam_position)).length
  }

  describe('getValidExamPositions — mapeos existentes', () => {
    it('aux estado tiene mapeo', () => {
      expect(getValidExamPositions('auxiliar_administrativo_estado').length).toBeGreaterThan(0)
    })

    it('CARM tiene mapeo', () => {
      expect(getValidExamPositions('auxiliar_administrativo_carm').length).toBeGreaterThan(0)
    })

    it('tramitación tiene mapeo', () => {
      expect(getValidExamPositions('tramitacion_procesal').length).toBeGreaterThan(0)
    })

    it('oposición sin mapeo devuelve []', () => {
      expect(getValidExamPositions('oposicion_inventada')).toEqual([])
    })
  })

  describe('Filtro sin includeSharedOfficials (comportamiento por defecto)', () => {
    it('aux estado: solo ve sus oficiales', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_estado', false)
      expect(result.map(q => q.id)).toEqual(['q1', 'q2'])
    })

    it('CARM: solo ve oficiales con exam_position de CARM', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_carm', false)
      expect(result.map(q => q.id)).toEqual(['q6'])
    })

    it('CARM NO ve oficiales de GC, Policía, aux estado', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_carm', false)
      const positions = result.map(q => q.exam_position)
      expect(positions).not.toContain('guardia_civil')
      expect(positions).not.toContain('policia_nacional')
      expect(positions).not.toContain('auxiliar_administrativo_estado')
    })

    it('GC: solo ve oficiales de GC', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'guardia_civil', false)
      expect(result.map(q => q.id)).toEqual(['q3', 'q4'])
    })

    it('oposición sin mapeo: 0 oficiales', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'oposicion_inventada', false)
      expect(result).toEqual([])
    })
  })

  describe('Filtro con includeSharedOfficials=true', () => {
    it('CARM con compartidas: ve TODAS las oficiales', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_carm', true)
      expect(result).toEqual(MOCK_OFFICIALS)
    })

    it('aux estado con compartidas: ve TODAS', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_estado', true)
      expect(result).toEqual(MOCK_OFFICIALS)
    })
  })

  describe('Conteo de oficiales para UI (getThemeQuestionCounts)', () => {
    it('aux estado: cuenta solo sus oficiales', () => {
      expect(countOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_estado')).toBe(2)
    })

    it('CARM: cuenta solo 1 (la suya)', () => {
      expect(countOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_carm')).toBe(1)
    })

    it('CARM con 0 oficiales propias en BD: muestra 0, no 1471', () => {
      // Simular: todas las oficiales son de otras oposiciones
      const noCarMOfficials = MOCK_OFFICIALS.filter(q => q.exam_position !== 'auxiliar_administrativo_carm')
      expect(countOfficials(noCarMOfficials, 'auxiliar_administrativo_carm')).toBe(0)
    })

    it('oposición sin mapeo: 0', () => {
      expect(countOfficials(MOCK_OFFICIALS, 'sin_mapeo')).toBe(0)
    })
  })

  describe('Escenario real: CARM usuario marca "solo oficiales"', () => {
    it('sin compartidas y sin oficiales propias → test vacío (correcto)', () => {
      const carmOfficials: OfficialQuestion[] = [] // CARM tiene 0 oficiales propias
      const result = filterOfficials(carmOfficials, 'auxiliar_administrativo_carm', false)
      expect(result).toEqual([])
    })

    it('con compartidas → ve oficiales de aux estado, GC etc. (opt-in)', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_carm', true)
      expect(result.length).toBe(10)
    })

    it('el checkbox "incluir compartidas" es el único camino a ver oficiales de otras', () => {
      const withoutShared = filterOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_carm', false)
      const withShared = filterOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_carm', true)
      // Sin checkbox: solo ve 1 (la suya)
      expect(withoutShared.length).toBe(1)
      // Con checkbox: ve todas
      expect(withShared.length).toBe(10)
    })
  })

  describe('Escenario: checkQuestionAvailability — fallback eliminado', () => {
    // Antes: si CARM no tenía oficiales propias, el código NO filtraba → mostraba todas
    // Ahora: siempre filtra por exam_position → devuelve 0 si no tiene

    function simulateAvailabilityCheck(
      positionType: string,
      onlyOfficial: boolean,
      includeShared: boolean,
      allQuestions: OfficialQuestion[]
    ): number {
      if (!onlyOfficial) return allQuestions.length

      if (includeShared) {
        return allQuestions.filter(q => q.exam_position !== null).length
      }

      const validPositions = getValidExamPositions(positionType)
      if (validPositions.length === 0) return 0
      return allQuestions.filter(q => validPositions.includes(q.exam_position)).length
    }

    it('CARM + solo oficiales + sin compartidas → 0 (antes daba 1471)', () => {
      // Solo hay oficiales de otras oposiciones, no de CARM
      const nonCarmOfficials = MOCK_OFFICIALS.filter(q => q.exam_position !== 'auxiliar_administrativo_carm')
      expect(simulateAvailabilityCheck('auxiliar_administrativo_carm', true, false, nonCarmOfficials)).toBe(0)
    })

    it('CARM + solo oficiales + con compartidas → todas', () => {
      expect(simulateAvailabilityCheck('auxiliar_administrativo_carm', true, true, MOCK_OFFICIALS)).toBe(10)
    })

    it('aux estado + solo oficiales → solo las suyas', () => {
      expect(simulateAvailabilityCheck('auxiliar_administrativo_estado', true, false, MOCK_OFFICIALS)).toBe(2)
    })

    it('cualquiera + no oficiales → todas las preguntas', () => {
      expect(simulateAvailabilityCheck('auxiliar_administrativo_carm', false, false, MOCK_OFFICIALS)).toBe(10)
    })
  })

  describe('Regresión: oposiciones con oficiales propias no se ven afectadas', () => {
    it('aux estado sigue viendo sus oficiales', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'auxiliar_administrativo_estado', false)
      expect(result.length).toBe(2)
      expect(result.every(q => q.exam_position === 'auxiliar_administrativo_estado')).toBe(true)
    })

    it('GC sigue viendo sus oficiales', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'guardia_civil', false)
      expect(result.length).toBe(2)
    })

    it('tramitación sigue viendo sus oficiales', () => {
      const result = filterOfficials(MOCK_OFFICIALS, 'tramitacion_procesal', false)
      expect(result.length).toBe(1)
    })

    it('todas las oposiciones del EXAM_POSITION_MAP tienen mapeo', () => {
      for (const posType of Object.keys(EXAM_POSITION_MAP)) {
        expect(getValidExamPositions(posType).length).toBeGreaterThan(0)
      }
    })
  })
})
