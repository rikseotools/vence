// __tests__/api/oposicion-scope/changeTargetOposicion.test.ts
// Test e2e — FASE 6 del refactor oposicion-scope.
//
// Verifica que cambiar target_oposicion en user_profiles se refleja en el
// siguiente fetch sin necesidad de invalidación manual de caché. El helper
// getAllowedLawIds lee el perfil en cada llamada (no hay unstable_cache),
// por lo que la única condición real es que el mock devuelva el nuevo valor.

jest.mock('@/db/client', () => ({
  getDb: jest.fn(),
}))

import { getDb } from '@/db/client'
import { getAllowedLawIds } from '@/lib/api/oposicion-scope/queries'

type Scenario = {
  targetOposicion: string | null
  scopeRows: Array<{ lawId: string | null; lawShortName: string | null }>
}

function buildDb(scenario: Scenario) {
  const profileChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(
      scenario.targetOposicion !== null
        ? [{ targetOposicion: scenario.targetOposicion }]
        : []
    ),
  }
  const scopeChain: any = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(scenario.scopeRows),
  }
  return {
    select: jest.fn(() => profileChain),
    selectDistinct: jest.fn(() => scopeChain),
  }
}

describe('Cambio de target_oposicion refleja en la siguiente llamada', () => {
  beforeEach(() => jest.clearAllMocks())

  test('Aux Estado → Aux CyL: segunda llamada ya ve el nuevo scope', async () => {
    // Estado 1: Mar es Aux Estado, recibe leyes estatales.
    ;(getDb as jest.Mock).mockReturnValueOnce(
      buildDb({
        targetOposicion: 'auxiliar_administrativo_estado',
        scopeRows: [
          { lawId: 'law-ce', lawShortName: 'CE' },
          { lawId: 'law-trebep', lawShortName: 'TREBEP' },
        ],
      })
    )
    const first = await getAllowedLawIds({ userId: 'mar' })
    expect(first.positionType).toBe('auxiliar_administrativo_estado')
    expect(first.lawShortNames).toEqual(['CE', 'TREBEP'])

    // Estado 2: Mar cambia su target a Aux CyL. Siguiente llamada.
    ;(getDb as jest.Mock).mockReturnValueOnce(
      buildDb({
        targetOposicion: 'auxiliar_administrativo_cyl',
        scopeRows: [
          { lawId: 'law-ce', lawShortName: 'CE' },
          { lawId: 'law-reglamento-cortes', lawShortName: 'Reglamento Cortes CyL' },
        ],
      })
    )
    const second = await getAllowedLawIds({ userId: 'mar' })

    expect(second.positionType).toBe('auxiliar_administrativo_cyl')
    expect(second.lawShortNames).toContain('Reglamento Cortes CyL')
    expect(second.lawShortNames).not.toEqual(first.lawShortNames)
  })

  test('perfil se borra (null) entre llamadas → cae al fallback', async () => {
    ;(getDb as jest.Mock).mockReturnValueOnce(
      buildDb({
        targetOposicion: 'auxiliar_administrativo_cyl',
        scopeRows: [{ lawId: 'law-cyl', lawShortName: 'Reglamento Cortes CyL' }],
      })
    )
    const first = await getAllowedLawIds({
      userId: 'u',
      fallbackPositionType: 'auxiliar_administrativo_estado',
    })
    expect(first.positionType).toBe('auxiliar_administrativo_cyl')

    ;(getDb as jest.Mock).mockReturnValueOnce(
      buildDb({
        targetOposicion: null,
        scopeRows: [{ lawId: 'law-ce', lawShortName: 'CE' }],
      })
    )
    const second = await getAllowedLawIds({
      userId: 'u',
      fallbackPositionType: 'auxiliar_administrativo_estado',
    })
    expect(second.positionType).toBe('auxiliar_administrativo_estado')
  })
})
