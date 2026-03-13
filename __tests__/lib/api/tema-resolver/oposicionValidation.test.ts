// __tests__/lib/api/tema-resolver/oposicionValidation.test.ts
// Tests para verificar que oposicionId inválidos (UUID custom, explorador, vacío)
// NUNCA llegan al TemaResolver como undefined positionType

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../../..')

// ============================================
// HELPERS: Replica la lógica de validación
// ============================================

// Simula ALL_OPOSICION_IDS (los IDs válidos del enum)
const ALL_OPOSICION_IDS = [
  'auxiliar_administrativo_estado',
  'administrativo_estado',
  'tramitacion_procesal',
  'auxiliar_administrativo_carm',
  'auxiliar_administrativo_cyl',
  'auxiliar_administrativo_andalucia',
  'auxiliar_administrativo_madrid',
  'auxiliar_administrativo_canarias',
  'auxiliar_administrativo_clm',
  'auxiliar_administrativo_extremadura',
  'auxiliar_administrativo_valencia',
  'auxiliar_administrativo_galicia',
  'auxiliar_administrativo_aragon',
  'auxiliar_administrativo_asturias',
  'auxiliar_administrativo_baleares',
  'auxilio_judicial',
]

// Simula OPOSICION_TO_POSITION_TYPE
const OPOSICION_TO_POSITION_TYPE: Record<string, string> = {
  'auxiliar_administrativo_estado': 'auxiliar_administrativo',
  'administrativo_estado': 'administrativo',
  'tramitacion_procesal': 'tramitacion_procesal',
}

// ============================================
// 1. insertTestAnswer: oposicionId validation
// ============================================
describe('insertTestAnswer — oposicionId validation', () => {

  /**
   * Replica la lógica CORREGIDA de insertTestAnswer (líneas 112-131)
   * Retorna el oposicionId que se pasará a resolveTemaNumber
   */
  function resolveOposicionId(
    reqOposicionId: string | null | undefined,
    userTargetOposicion: string | null | undefined,
  ): string {
    let oposicionId = reqOposicionId || ''

    // CORREGIDO: Validar SIEMPRE contra ALL_OPOSICION_IDS
    if (!oposicionId || !ALL_OPOSICION_IDS.includes(oposicionId) || oposicionId === 'explorador') {
      const userOposicion = userTargetOposicion
      oposicionId = (userOposicion && ALL_OPOSICION_IDS.includes(userOposicion) && userOposicion !== 'explorador')
        ? userOposicion
        : 'auxiliar_administrativo_estado'
    }

    return oposicionId
  }

  it('req.oposicionId válido se usa directamente', () => {
    expect(resolveOposicionId('tramitacion_procesal', 'auxiliar_administrativo_estado'))
      .toBe('tramitacion_procesal')
  })

  it('req.oposicionId como UUID custom → fallback al perfil', () => {
    // UUID de oposición custom NO está en ALL_OPOSICION_IDS
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    expect(resolveOposicionId(uuid, 'tramitacion_procesal'))
      .toBe('tramitacion_procesal')
  })

  it('req.oposicionId como UUID custom + perfil sin oposición → fallback a auxiliar', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    expect(resolveOposicionId(uuid, null))
      .toBe('auxiliar_administrativo_estado')
  })

  it('req.oposicionId vacío → usa perfil del usuario', () => {
    expect(resolveOposicionId('', 'administrativo_estado'))
      .toBe('administrativo_estado')
  })

  it('req.oposicionId null → usa perfil del usuario', () => {
    expect(resolveOposicionId(null, 'tramitacion_procesal'))
      .toBe('tramitacion_procesal')
  })

  it('req.oposicionId undefined → usa perfil del usuario', () => {
    expect(resolveOposicionId(undefined, 'auxiliar_administrativo_carm'))
      .toBe('auxiliar_administrativo_carm')
  })

  it('explorador en req → fallback al perfil', () => {
    expect(resolveOposicionId('explorador', 'tramitacion_procesal'))
      .toBe('tramitacion_procesal')
  })

  it('explorador en req + explorador en perfil → fallback a auxiliar', () => {
    expect(resolveOposicionId('explorador', 'explorador'))
      .toBe('auxiliar_administrativo_estado')
  })

  it('sin oposicionId + sin perfil → fallback a auxiliar', () => {
    expect(resolveOposicionId('', null))
      .toBe('auxiliar_administrativo_estado')
  })

  it('sin oposicionId + perfil con UUID custom → fallback a auxiliar', () => {
    expect(resolveOposicionId('', 'some-custom-uuid-value'))
      .toBe('auxiliar_administrativo_estado')
  })

  it('resultado SIEMPRE está en ALL_OPOSICION_IDS', () => {
    const testCases = [
      ['', null],
      ['', 'explorador'],
      ['explorador', null],
      ['a-random-uuid', null],
      ['a-random-uuid', 'another-uuid'],
      [null, null],
      [undefined, undefined],
      ['auxiliar_administrativo_estado', null],
      ['tramitacion_procesal', 'auxiliar_administrativo_estado'],
    ] as const

    for (const [reqId, profileId] of testCases) {
      const result = resolveOposicionId(reqId as any, profileId as any)
      expect(ALL_OPOSICION_IDS).toContain(result)
    }
  })
})

// ============================================
// 2. resolveTemaByArticle: positionType never undefined
// ============================================
describe('resolveTemaByArticle — positionType never undefined', () => {

  /**
   * Replica la lógica CORREGIDA del TemaResolver (línea 102)
   */
  function resolvePositionType(oposicionId: string | undefined): string {
    return OPOSICION_TO_POSITION_TYPE[oposicionId || 'auxiliar_administrativo_estado']
      || OPOSICION_TO_POSITION_TYPE['auxiliar_administrativo_estado']
  }

  it('oposicionId válido → positionType correcto', () => {
    expect(resolvePositionType('auxiliar_administrativo_estado')).toBe('auxiliar_administrativo')
    expect(resolvePositionType('tramitacion_procesal')).toBe('tramitacion_procesal')
  })

  it('oposicionId como UUID desconocido → fallback a auxiliar_administrativo', () => {
    expect(resolvePositionType('a1b2c3d4-e5f6-7890-abcd-ef1234567890'))
      .toBe('auxiliar_administrativo')
  })

  it('oposicionId vacío → auxiliar_administrativo', () => {
    expect(resolvePositionType('')).toBe('auxiliar_administrativo')
  })

  it('oposicionId undefined → auxiliar_administrativo', () => {
    expect(resolvePositionType(undefined)).toBe('auxiliar_administrativo')
  })

  it('NUNCA devuelve undefined', () => {
    const testCases = [
      'auxiliar_administrativo_estado',
      'tramitacion_procesal',
      'administrativo_estado',
      '',
      undefined,
      'explorador',
      'random-uuid',
      'null',
    ]

    for (const id of testCases) {
      const result = resolvePositionType(id)
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    }
  })
})

// ============================================
// 3. SOURCE CODE VERIFICATION
// ============================================
describe('Source code — guards against undefined positionType', () => {
  const temaResolverContent = fs.readFileSync(
    path.join(ROOT, 'lib/api/tema-resolver/queries.ts'), 'utf-8'
  )

  it('resolveTemaByArticle tiene fallback para positionType', () => {
    // La línea debe tener || fallback para evitar undefined
    expect(temaResolverContent).toMatch(
      /OPOSICION_TO_POSITION_TYPE\[.*\]\s*\n?\s*\|\|\s*OPOSICION_TO_POSITION_TYPE\[/
    )
  })

  it('resolveTemasBatch tiene fallback para positionType', () => {
    // Contar cuántas veces aparece el fallback pattern
    const fallbacks = temaResolverContent.match(
      /\|\|\s*OPOSICION_TO_POSITION_TYPE\[/g
    )
    // Debe haber al menos 3: resolveTemaByArticle, resolveTemasBatch, resolveTemasBatchByQuestionIds
    expect(fallbacks).not.toBeNull()
    expect(fallbacks!.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Source code — insertTestAnswer validates oposicionId', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'lib/api/test-answers/queries.ts'), 'utf-8'
  )

  it('valida oposicionId contra ALL_OPOSICION_IDS siempre (no solo cuando vacío)', () => {
    // Debe tener una condición que verifica ALL_OPOSICION_IDS.includes ANTES de usar oposicionId
    expect(content).toMatch(/ALL_OPOSICION_IDS\.includes\(oposicionId\)/)
  })

  it('NO usa req.oposicionId directamente sin validar', () => {
    // El patrón peligroso era: if (!oposicionId) { ... } (solo verificaba vacío, no validez)
    // Ahora debe verificar: !oposicionId || !ALL_OPOSICION_IDS.includes(oposicionId)
    const lines = content.split('\n')
    const dangerousPattern = lines.find(line =>
      line.includes('if (!oposicionId)') &&
      !line.includes('ALL_OPOSICION_IDS')
    )
    expect(dangerousPattern).toBeUndefined()
  })

  it('importa ALL_OPOSICION_IDS', () => {
    expect(content).toMatch(/import.*ALL_OPOSICION_IDS.*from/)
  })
})

// ============================================
// 4. BUG ESCENARIO: UUID custom causa UNDEFINED_VALUE
// ============================================
describe('Bug scenario: UUID custom en oposicionId', () => {

  it('ANTES del fix: UUID custom → positionType undefined → UNDEFINED_VALUE', () => {
    const customUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    // Lógica ANTES del fix: si req.oposicionId tiene valor, se usa directamente
    const oposicionIdBeforeFix = customUuid // Se usa sin validar
    const positionType = OPOSICION_TO_POSITION_TYPE[oposicionIdBeforeFix]

    // undefined → causa UNDEFINED_VALUE en la query de Postgres
    expect(positionType).toBeUndefined()
  })

  it('DESPUÉS del fix: UUID custom → fallback → positionType definido', () => {
    const customUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    // Lógica DESPUÉS del fix en insertTestAnswer:
    // UUID custom no está en ALL_OPOSICION_IDS → busca en perfil → fallback
    const isValid = ALL_OPOSICION_IDS.includes(customUuid)
    expect(isValid).toBe(false) // UUID no es ID válido

    const oposicionIdAfterFix = isValid ? customUuid : 'auxiliar_administrativo_estado'

    // Lógica DESPUÉS del fix en TemaResolver:
    const positionType = OPOSICION_TO_POSITION_TYPE[oposicionIdAfterFix]
      || OPOSICION_TO_POSITION_TYPE['auxiliar_administrativo_estado']

    expect(positionType).toBe('auxiliar_administrativo')
    expect(positionType).toBeDefined()
  })

  it('DESPUÉS del fix (doble guardia): incluso si insertTestAnswer falla, TemaResolver no crashea', () => {
    // Supongamos que insertTestAnswer pasa un valor inesperado
    const unexpectedValue = 'algo_totalmente_inesperado'

    // El TemaResolver tiene su propio fallback
    const positionType = OPOSICION_TO_POSITION_TYPE[unexpectedValue]
      || OPOSICION_TO_POSITION_TYPE['auxiliar_administrativo_estado']

    expect(positionType).toBe('auxiliar_administrativo')
  })
})
