// __tests__/api/oposicion-scope/queries.test.ts
// Tests del helper getAllowedLawIds — FASE 1 del refactor oposicion-scope.
//
// No hitea BD: mockea @/db/client para validar la lógica de derivación
// de positionType y la query al topic_scope.

jest.mock('@/db/client', () => ({
  getDb: jest.fn(),
}))

import { getDb } from '@/db/client'
import { getAllowedLawIds } from '@/lib/api/oposicion-scope/queries'

type ProfileRow = { targetOposicion: string | null }
type ScopeRow = { lawId: string | null; lawShortName?: string | null }

function makeDb(opts: {
  profile?: ProfileRow | null
  scope?: ScopeRow[]
  capture?: { profileArgs?: any[]; scopeArgs?: any[] }
}) {
  const profile = opts.profile !== undefined ? opts.profile : null
  const scope = opts.scope ?? []

  // Mock para la cadena fluent de drizzle:
  //   db.select(...).from(...).where(...).limit(...)
  //   db.selectDistinct(...).from(...).innerJoin(...).where(...)
  const profileChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockImplementation(() => Promise.resolve(profile ? [profile] : [])),
  }
  // selectDistinct ahora hace TWO innerJoin (topics + laws) y un where.
  const scopeChain: any = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation(() => Promise.resolve(scope)),
  }

  return {
    select: jest.fn(() => profileChain),
    selectDistinct: jest.fn(() => scopeChain),
    _profileChain: profileChain,
    _scopeChain: scopeChain,
  }
}

describe('getAllowedLawIds', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('sin userId → usa fallbackPositionType', async () => {
    const db = makeDb({ scope: [
      { lawId: 'law-1', lawShortName: 'CE' },
      { lawId: 'law-2', lawShortName: 'TREBEP' },
    ] })
    ;(getDb as jest.Mock).mockReturnValue(db)

    const result = await getAllowedLawIds({ fallbackPositionType: 'auxiliar_administrativo_cyl' })

    expect(result.positionType).toBe('auxiliar_administrativo_cyl')
    expect(result.lawIds).toEqual(['law-1', 'law-2'])
    expect(result.lawShortNames).toEqual(['CE', 'TREBEP'])
    // No debe haber consultado user_profiles
    expect(db.select).not.toHaveBeenCalled()
    expect(db.selectDistinct).toHaveBeenCalledTimes(1)
  })

  test('sin userId ni fallback → usa DEFAULT auxiliar_administrativo_estado', async () => {
    const db = makeDb({ scope: [{ lawId: 'law-x', lawShortName: 'CE' }] })
    ;(getDb as jest.Mock).mockReturnValue(db)

    const result = await getAllowedLawIds()

    expect(result.positionType).toBe('auxiliar_administrativo_estado')
    expect(result.lawIds).toEqual(['law-x'])
  })

  test('con userId y perfil con target_oposicion → sobrescribe fallback', async () => {
    const db = makeDb({
      profile: { targetOposicion: 'auxiliar_administrativo_carm' },
      scope: [{ lawId: 'law-carm-1', lawShortName: 'Ley 6/2003 CARM' }],
    })
    ;(getDb as jest.Mock).mockReturnValue(db)

    const result = await getAllowedLawIds({
      userId: 'user-1',
      fallbackPositionType: 'auxiliar_administrativo_estado',
    })

    expect(result.positionType).toBe('auxiliar_administrativo_carm')
    expect(result.lawIds).toEqual(['law-carm-1'])
    expect(db.select).toHaveBeenCalledTimes(1)
  })

  test('con userId pero perfil sin target_oposicion → cae al fallback', async () => {
    const db = makeDb({
      profile: { targetOposicion: null },
      scope: [{ lawId: 'law-fallback', lawShortName: 'LOPJ' }],
    })
    ;(getDb as jest.Mock).mockReturnValue(db)

    const result = await getAllowedLawIds({
      userId: 'user-2',
      fallbackPositionType: 'auxilio_judicial',
    })

    expect(result.positionType).toBe('auxilio_judicial')
    expect(result.lawIds).toEqual(['law-fallback'])
  })

  test('con userId pero target_oposicion es string vacío → fallback', async () => {
    const db = makeDb({
      profile: { targetOposicion: '   ' },
      scope: [],
    })
    ;(getDb as jest.Mock).mockReturnValue(db)

    const result = await getAllowedLawIds({
      userId: 'user-3',
      fallbackPositionType: 'auxiliar_administrativo_madrid',
    })

    expect(result.positionType).toBe('auxiliar_administrativo_madrid')
    expect(result.lawIds).toEqual([])
  })

  test('filtra lawIds null y devuelve solo strings', async () => {
    const db = makeDb({
      scope: [
        { lawId: 'law-a', lawShortName: 'CE' },
        { lawId: null, lawShortName: null },
        { lawId: 'law-b', lawShortName: 'TREBEP' },
      ],
    })
    ;(getDb as jest.Mock).mockReturnValue(db)

    const result = await getAllowedLawIds({ fallbackPositionType: 'auxiliar_administrativo_estado' })

    expect(result.lawIds).toEqual(['law-a', 'law-b'])
  })
})
