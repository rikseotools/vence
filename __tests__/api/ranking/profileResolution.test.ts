/**
 * Tests para resolucion de perfiles server-side
 *
 * Verifica la logica de prioridad de nombre, avatar y deteccion de novatos.
 */

// Mock del modulo db/client
jest.mock('../../../db/client', () => ({
  getDb: jest.fn(),
}))

import { getDb } from '../../../db/client'
import { resolveUserProfiles } from '../../../lib/api/ranking/queries'

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-03-05T14:30:00.000Z'))
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function createMockDbForProfiles(opts: {
  pubProfiles?: any[]
  upProfiles?: any[]
  avatarRows?: any[]
} = {}) {
  const { pubProfiles = [], upProfiles = [], avatarRows = [] } = opts

  let callCount = 0
  const results = [pubProfiles, upProfiles, avatarRows]

  const mockWhere = jest.fn().mockImplementation(() => {
    const idx = callCount++
    return Promise.resolve(results[idx] || [])
  })
  const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })

  const db = { select: mockSelect } as any
  return db
}

describe('resolveUserProfiles', () => {
  test('lista vacia devuelve Map vacio', async () => {
    const db = createMockDbForProfiles()
    const result = await resolveUserProfiles(db, [])
    expect(result.size).toBe(0)
  })

  test('prioridad 1: displayName de public_user_profiles', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [{ id: 'u1', displayName: 'Carlos Pro', ciudad: 'Madrid', avatarType: null, avatarEmoji: null, avatarColor: null, avatarUrl: null, createdAt: '2025-01-01T00:00:00Z' }],
      upProfiles: [{ id: 'u1', fullName: 'Carlos Garcia', email: 'carlos@test.com' }],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    expect(result.get('u1')?.name).toBe('Carlos Pro')
  })

  test('displayName "Usuario" se ignora, fallback a fullName', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [{ id: 'u1', displayName: 'Usuario', ciudad: null, avatarType: null, avatarEmoji: null, avatarColor: null, avatarUrl: null, createdAt: '2025-01-01T00:00:00Z' }],
      upProfiles: [{ id: 'u1', fullName: 'Maria Lopez Fernandez', email: 'maria@test.com' }],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    expect(result.get('u1')?.name).toBe('Maria')
  })

  test('sin displayName ni fullName, fallback a email limpio', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [],
      upProfiles: [{ id: 'u1', fullName: null, email: 'juan.perez123@gmail.com' }],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    // juan.perez123 -> "juan perez" -> "Juan perez"
    expect(result.get('u1')?.name).toBe('Juan perez')
  })

  test('sin ningun perfil -> Anonimo', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [],
      upProfiles: [],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    expect(result.get('u1')?.name).toBe('Anonimo')
  })

  test('avatar automatico tiene prioridad', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [{ id: 'u1', displayName: 'Test', ciudad: null, avatarType: 'predefined', avatarEmoji: '👨‍💻', avatarColor: 'from-blue-500', avatarUrl: null, createdAt: '2025-01-01T00:00:00Z' }],
      upProfiles: [],
      avatarRows: [{ userId: 'u1', currentEmoji: '🦊', currentProfile: 'fox' }],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    const avatar = result.get('u1')?.avatar
    expect(avatar?.type).toBe('automatic')
    expect(avatar?.emoji).toBe('🦊')
  })

  test('avatar predefinido cuando no hay automatico', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [{ id: 'u1', displayName: 'Test', ciudad: null, avatarType: 'predefined', avatarEmoji: '👨‍💻', avatarColor: 'from-blue-500 to-green-500', avatarUrl: null, createdAt: '2025-01-01T00:00:00Z' }],
      upProfiles: [],
      avatarRows: [],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    const avatar = result.get('u1')?.avatar
    expect(avatar?.type).toBe('predefined')
    expect(avatar?.emoji).toBe('👨‍💻')
    expect(avatar?.color).toBe('from-blue-500 to-green-500')
  })

  test('avatar uploaded', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [{ id: 'u1', displayName: 'Test', ciudad: null, avatarType: 'uploaded', avatarEmoji: null, avatarColor: null, avatarUrl: 'https://example.com/photo.jpg', createdAt: '2025-01-01T00:00:00Z' }],
      upProfiles: [],
      avatarRows: [],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    const avatar = result.get('u1')?.avatar
    expect(avatar?.type).toBe('uploaded')
    expect(avatar?.url).toBe('https://example.com/photo.jpg')
  })

  test('sin avatar -> null', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [{ id: 'u1', displayName: 'Test', ciudad: null, avatarType: null, avatarEmoji: null, avatarColor: null, avatarUrl: null, createdAt: '2025-01-01T00:00:00Z' }],
      upProfiles: [],
      avatarRows: [],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    expect(result.get('u1')?.avatar).toBeNull()
  })

  test('isNovato true para usuario registrado hace < 30 dias', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [{ id: 'u1', displayName: 'Nuevo', ciudad: null, avatarType: null, avatarEmoji: null, avatarColor: null, avatarUrl: null, createdAt: '2026-02-20T00:00:00Z' }],
      upProfiles: [],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    expect(result.get('u1')?.isNovato).toBe(true)
  })

  test('isNovato false para usuario registrado hace >= 30 dias', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [{ id: 'u1', displayName: 'Veterano', ciudad: null, avatarType: null, avatarEmoji: null, avatarColor: null, avatarUrl: null, createdAt: '2025-01-01T00:00:00Z' }],
      upProfiles: [],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    expect(result.get('u1')?.isNovato).toBe(false)
  })

  test('ciudad se resuelve desde public_user_profiles', async () => {
    const db = createMockDbForProfiles({
      pubProfiles: [{ id: 'u1', displayName: 'Test', ciudad: 'Barcelona', avatarType: null, avatarEmoji: null, avatarColor: null, avatarUrl: null, createdAt: '2025-01-01T00:00:00Z' }],
      upProfiles: [],
    })

    const result = await resolveUserProfiles(db, ['u1'])
    expect(result.get('u1')?.ciudad).toBe('Barcelona')
  })
})
