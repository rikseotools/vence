// __tests__/lib/import/validator.test.ts
//
// Tests unitarios del validator pre-INSERT de imports de exámenes oficiales.
// El validator es función PURA — NO toca BD, NO depende de credenciales.
// Estos tests SÍ corren en CI sin Supabase.
//
// Usa convocatorias REALES de lib/config/oposiciones.ts para que los tests
// fallen si alguien cambia el config de forma que rompe asunciones.

import {
  validateOfficialExamImport,
  getValidParteIds,
  findConvocatoria,
  type ValidationContext,
  type ValidatePayload,
} from '@/lib/import/official-exams/validator'
import { OPOSICIONES } from '@/lib/config/oposiciones'

// Convocatoria de referencia: 23 mayo 2026 Aux Admin Estado
// Tiene partes 'primera' + 'segunda' y existe en OPOSICIONES.
const CTX_AAE: ValidationContext = {
  oposicionSlug: 'auxiliar-administrativo-estado',
  examDate: '2026-05-23',
  parteId: 'primera',
}

// Convocatoria con estructura distinta (Guardia Civil → 'unica')
// para asegurar que no asumimos 'primera'/'segunda'.
function findGCConvocatoria() {
  const gc = OPOSICIONES.find((o) => o.slug === 'guardia-civil')
  return gc?.officialExams?.[0]
}

function basePayload(overrides: Partial<ValidatePayload> = {}): ValidatePayload {
  return {
    question: {
      exam_position: 'auxiliar_administrativo_estado',
      exam_source:
        'Examen Auxiliar Administrativo Estado - OEP 2024-2025 - Convocatoria 23 mayo 2026 - Primera parte',
      exam_date: '2026-05-23',
      is_official_exam: true,
      lifecycle_state: 'draft',
      primary_article_id: '550e8400-e29b-41d4-a716-446655440000',
      ...overrides.question,
    },
    qoe: {
      exam_date: '2026-05-23',
      exam_source:
        'Examen Auxiliar Administrativo Estado - OEP 2024-2025 - Convocatoria 23 mayo 2026 - Primera parte',
      exam_part: 'Primera parte',
      oposicion_type: 'auxiliar-administrativo-estado',
      is_reserve: false,
      ...overrides.qoe,
    },
  }
}

describe('validateOfficialExamImport', () => {
  describe('caso happy path', () => {
    it('payload completo y válido devuelve ok:true', () => {
      const r = validateOfficialExamImport(basePayload(), CTX_AAE)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.warnings).toEqual([])
    })

    it('lifecycle_state ausente (default draft) también es válido', () => {
      const p = basePayload()
      delete p.question.lifecycle_state
      const r = validateOfficialExamImport(p, CTX_AAE)
      expect(r.ok).toBe(true)
    })
  })

  describe('regla 1-3: contexto contra config', () => {
    it('rechaza oposición que no existe en OPOSICIONES', () => {
      const r = validateOfficialExamImport(basePayload(), {
        ...CTX_AAE,
        oposicionSlug: 'oposicion-inventada',
      })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.errors[0]).toMatch(/CTX-1.*oposicion-inventada.*no existe/)
      }
    })

    it('rechaza convocatoria que no está declarada en officialExams', () => {
      const r = validateOfficialExamImport(basePayload(), {
        ...CTX_AAE,
        examDate: '2030-01-01',
      })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.errors[0]).toMatch(/CTX-2.*2030-01-01.*no declarada/)
        expect(r.errors[0]).toMatch(/Declaradas:/)
      }
    })

    it('rechaza parteId que no está en convocatoria.partes[]', () => {
      const r = validateOfficialExamImport(basePayload(), {
        ...CTX_AAE,
        parteId: 'cuarto-ejercicio', // no existe en 2026-05-23
      })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.errors.find((e) => e.includes('CTX-3'))).toMatch(
          /cuarto-ejercicio.*no declarado/
        )
      }
    })

    it('acepta parteId válido distinto de primera/segunda (caso Guardia Civil "unica")', () => {
      const gcConv = findGCConvocatoria()
      if (!gcConv) {
        return // skip si no hay GC
      }
      const gcCtx: ValidationContext = {
        oposicionSlug: 'guardia-civil',
        examDate: gcConv.date,
        parteId: gcConv.partes[0].id, // sea lo que sea: 'unica', etc.
      }
      // Solo testeamos que el contexto valide — el resto del payload puede no ser GC
      // por simplicidad. Si parteId está bien validado, los demás errores son del payload.
      const r = validateOfficialExamImport(basePayload(), gcCtx)
      if (!r.ok) {
        // No debe haber error CTX-3 (parteId)
        expect(r.errors.some((e) => e.startsWith('[CTX-3]'))).toBe(false)
      }
    })
  })

  describe('regla 4: exam_position (PREVIENE BUG 23/05/2026)', () => {
    it('rechaza exam_position con guion cuando MAP espera underscore', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            exam_position: 'auxiliar-administrativo-estado', // ← bug 23/05
          } as unknown as ValidatePayload['question'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) {
        const err = r.errors.find((e) => e.startsWith('[Q-4]'))
        expect(err).toBeDefined()
        expect(err).toMatch(/EXAM_POSITION_MAP/)
        expect(err).toMatch(/auxiliar_administrativo_estado/)
      }
    })

    it('acepta variantes válidas del MAP (legacy "auxiliar administrativo" con espacio)', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            exam_position: 'auxiliar administrativo del estado',
          } as unknown as ValidatePayload['question'],
        }),
        CTX_AAE
      )
      // Solo verificamos que no falla por Q-4 (puede fallar por otra cosa irrelevante)
      const q4Error = r.ok
        ? undefined
        : r.errors.find((e) => e.startsWith('[Q-4]'))
      expect(q4Error).toBeUndefined()
    })
  })

  describe('regla 5: QOE.oposicion_type es slug (PREVIENE confusión guion/underscore)', () => {
    it('rechaza QOE.oposicion_type con underscore (positionType)', () => {
      const r = validateOfficialExamImport(
        basePayload({
          qoe: {
            oposicion_type: 'auxiliar_administrativo_estado', // ← underscore
          } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) {
        const err = r.errors.find((e) => e.startsWith('[QOE-5]'))
        expect(err).toMatch(/positionType.*underscore/)
        expect(err).toMatch(/SLUG con guion/)
      }
    })

    it('rechaza QOE.oposicion_type completamente distinto al slug del contexto', () => {
      const r = validateOfficialExamImport(
        basePayload({
          qoe: {
            oposicion_type: 'otra-oposicion-cualquiera',
          } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) {
        const err = r.errors.find((e) => e.startsWith('[QOE-5]'))
        expect(err).toMatch(/no coincide/)
      }
    })
  })

  describe('regla 6-7: consistencia entre question y QOE', () => {
    it('rechaza exam_date distinto entre question y QOE', () => {
      const r = validateOfficialExamImport(
        basePayload({
          qoe: { exam_date: '2026-05-24' } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.find((e) => e.startsWith('[CONS-6]'))).toBeDefined()
    })

    it('rechaza exam_source distinto entre question y QOE', () => {
      const r = validateOfficialExamImport(
        basePayload({
          qoe: {
            exam_source: 'Texto diferente',
          } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.find((e) => e.startsWith('[CONS-7]'))).toBeDefined()
    })

    it('rechaza exam_date con formato no ISO', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            exam_date: '23/05/2026',
          } as unknown as ValidatePayload['question'],
          qoe: {
            exam_date: '23/05/2026',
          } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
    })
  })

  describe('regla 8: lifecycle_state inicial (PREVIENE ANTI-PATRÓN MADRID 18/05/2026)', () => {
    it('rechaza lifecycle_state="approved" al INSERT', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            lifecycle_state: 'approved',
          } as unknown as ValidatePayload['question'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) {
        const err = r.errors.find((e) => e.startsWith('[Q-8]'))
        expect(err).toMatch(/anti-patrón Madrid 18\/05\/2026/i)
      }
    })

    it('rechaza lifecycle_state="tech_approved" al INSERT', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            lifecycle_state: 'tech_approved',
          } as unknown as ValidatePayload['question'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
    })

    it('acepta lifecycle_state="draft"', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            lifecycle_state: 'draft',
          } as unknown as ValidatePayload['question'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(true)
    })
  })

  describe('regla 9: is_official_exam', () => {
    it('rechaza is_official_exam=false', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            is_official_exam: false,
          } as unknown as ValidatePayload['question'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.find((e) => e.startsWith('[Q-9]'))).toBeDefined()
    })
  })

  describe('regla 10: Supuesto práctico requiere exam_case_id (TRIGGER BD)', () => {
    it('rechaza "Supuesto práctico" sin exam_case_id', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            exam_source:
              'Examen Auxilio Judicial - Segunda parte - Supuesto práctico 1',
            exam_case_id: null,
          } as unknown as ValidatePayload['question'],
          qoe: {
            exam_source:
              'Examen Auxilio Judicial - Segunda parte - Supuesto práctico 1',
          } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) {
        const err = r.errors.find((e) => e.startsWith('[Q-10]'))
        expect(err).toMatch(/exam_case_id/)
        expect(err).toMatch(/Trigger BD/)
      }
    })

    it('acepta "Supuesto práctico" con exam_case_id UUID válido', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            exam_source:
              'Examen Auxilio Judicial - Segunda parte - Supuesto práctico 1',
            exam_case_id: '550e8400-e29b-41d4-a716-446655440000',
          } as unknown as ValidatePayload['question'],
          qoe: {
            exam_source:
              'Examen Auxilio Judicial - Segunda parte - Supuesto práctico 1',
          } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      // No error Q-10 (puede haber otros warnings)
      const q10 = r.ok ? undefined : r.errors.find((e) => e.startsWith('[Q-10]'))
      expect(q10).toBeUndefined()
    })

    it('acepta acento ausente "Supuesto practico" (sin tilde)', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            exam_source: 'Examen ... - Supuesto practico - sin tilde',
            exam_case_id: null,
          } as unknown as ValidatePayload['question'],
          qoe: {
            exam_source: 'Examen ... - Supuesto practico - sin tilde',
          } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      // Debería fallar igual aunque no tenga tilde
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.errors.find((e) => e.startsWith('[Q-10]'))).toBeDefined()
      }
    })
  })

  describe('regla 11: UUIDs válidos', () => {
    it('rechaza primary_article_id no-UUID', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            primary_article_id: 'not-a-uuid',
          } as unknown as ValidatePayload['question'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.find((e) => e.startsWith('[Q-11]'))).toBeDefined()
    })

    it('acepta primary_article_id ausente (null) — pregunta sin artículo aún', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            primary_article_id: null,
          } as unknown as ValidatePayload['question'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(true)
    })
  })

  describe('warnings (no bloquean)', () => {
    it('avisa si exam_source no tiene marcador de parte conocido', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            exam_source: 'Examen XXXX 2024 — texto raro sin marcador',
          } as unknown as ValidatePayload['question'],
          qoe: {
            exam_source: 'Examen XXXX 2024 — texto raro sin marcador',
          } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      // El warning aparece en `warnings` independientemente de si hay errors
      expect(r.warnings.find((w) => w.startsWith('[W-EXAMSOURCE]'))).toBeDefined()
    })
  })

  describe('errores múltiples', () => {
    it('acumula varios errores en un mismo payload', () => {
      const r = validateOfficialExamImport(
        basePayload({
          question: {
            exam_position: 'guion-malo',
            lifecycle_state: 'approved',
          } as unknown as ValidatePayload['question'],
          qoe: {
            oposicion_type: 'auxiliar_administrativo_estado',
          } as unknown as ValidatePayload['qoe'],
        }),
        CTX_AAE
      )
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.errors.length).toBeGreaterThanOrEqual(3)
      }
    })
  })
})

describe('getValidParteIds (helper)', () => {
  it('devuelve los parteIds declarados para una convocatoria existente', () => {
    const ids = getValidParteIds('auxiliar-administrativo-estado', '2026-05-23')
    expect(ids).toContain('primera')
    expect(ids).toContain('segunda')
  })

  it('devuelve [] para oposición/convocatoria no existente', () => {
    expect(getValidParteIds('xxx', '2026-05-23')).toEqual([])
    expect(getValidParteIds('auxiliar-administrativo-estado', '1900-01-01')).toEqual([])
  })
})

describe('findConvocatoria (helper)', () => {
  it('devuelve el objeto convocatoria si existe', () => {
    const c = findConvocatoria('auxiliar-administrativo-estado', '2026-05-23')
    expect(c).toBeTruthy()
    expect(c?.date).toBe('2026-05-23')
    expect(c?.partes.length).toBeGreaterThan(0)
  })

  it('devuelve null si no existe', () => {
    expect(findConvocatoria('xxx', '2026-05-23')).toBeNull()
    expect(findConvocatoria('auxiliar-administrativo-estado', '1900-01-01')).toBeNull()
  })
})
