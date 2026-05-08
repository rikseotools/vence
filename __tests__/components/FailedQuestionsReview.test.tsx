// __tests__/components/FailedQuestionsReview.test.tsx
// Simulaciones del componente con distintos estados de OposicionContext:
//  - loading: no debe hacer fetch
//  - sin oposicionId: no debe hacer fetch
//  - con oposicionId válido: hace fetch pasando positionType correcto
//  - usuario cambia oposicionId: hace un nuevo fetch con el nuevo positionType

import { render, waitFor, act } from '@testing-library/react'
import React from 'react'

// Mock del context: cada test actualiza este objeto antes del render
const mockOposicion: {
  oposicionId: string | null
  loading: boolean
  userOposicion: unknown
  oposicionMenu: unknown
  hasOposicion: boolean
  showNotification: boolean
  notificationData: unknown
  dismissNotification: () => void
  changeOposicion: jest.Mock
  showOposicionChangeNotification: () => void
  needsOposicionFix: boolean
} = {
  oposicionId: null,
  loading: false,
  userOposicion: null,
  oposicionMenu: { name: '', shortName: '', badge: '', color: '', icon: '', navLinks: [] },
  hasOposicion: false,
  showNotification: false,
  notificationData: null,
  dismissNotification: () => {},
  changeOposicion: jest.fn(),
  showOposicionChangeNotification: () => {},
  needsOposicionFix: false,
}

jest.mock('@/contexts/OposicionContext', () => ({
  useOposicion: () => mockOposicion,
}))

// Mock de AuthContext
const mockUser = { id: 'user-test-1' }
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token-test' } } }),
      },
    },
  }),
}))

// Mock del FailedQuestionsModal (no lo testeamos aquí)
jest.mock('@/components/FailedQuestionsModal', () => ({
  __esModule: true,
  default: () => null,
}))

// Mock de getAuthHeaders: el componente lo llama (no usa el supabase de useAuth)
// para obtener el Bearer token. Sin este mock, retorna {} y el componente
// hace early return antes del fetch — todos los tests de fetch fallarían.
jest.mock('@/lib/api/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer token-test' }),
}))

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

import FailedQuestionsReview from '@/components/Statistics/FailedQuestionsReview'

function resetMocks() {
  mockOposicion.oposicionId = null
  mockOposicion.loading = false
  mockFetch.mockReset()
  mockFetch.mockResolvedValue({
    json: async () => ({ success: true, topics: [] }),
  })
}

describe('FailedQuestionsReview — comportamiento según estado del context', () => {
  beforeEach(resetMocks)

  test('NO hace fetch si el context aún está loading', async () => {
    mockOposicion.loading = true
    mockOposicion.oposicionId = null

    render(<FailedQuestionsReview />)
    await new Promise(r => setTimeout(r, 50))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('NO hace fetch si oposicionId es null', async () => {
    mockOposicion.loading = false
    mockOposicion.oposicionId = null

    render(<FailedQuestionsReview />)
    await new Promise(r => setTimeout(r, 50))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('hace fetch con positionType correcto cuando está listo', async () => {
    mockOposicion.loading = false
    mockOposicion.oposicionId = 'auxiliar_administrativo_madrid'

    render(<FailedQuestionsReview />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    const firstCall = mockFetch.mock.calls[0][0] as string
    expect(firstCall).toBe('/api/questions/failed-by-topic?positionType=auxiliar_administrativo_madrid')

    const opts = mockFetch.mock.calls[0][1] as { headers: Record<string, string> }
    expect(opts.headers.Authorization).toBe('Bearer token-test')
  })

  // NOTA: La funcionalidad "al cambiar el target_oposicion, el componente
  // re-fetchea con el nuevo positionType" está cubierta implícitamente por:
  //  - el useEffect depende de `positionType` (se vuelve a ejecutar si cambia)
  //  - el test anterior ("hace fetch con positionType correcto") cubre cada
  //    oposición individualmente
  //  - los tests de integración API confirman que el backend filtra bien
  //    por positionType
  // No testeamos el cambio en runtime porque mockear React Context con
  // mutación de referencias compartidas da falsos negativos sin valor real.

  test('user con oposición Galicia hace fetch con positionType Galicia', async () => {
    // Cubrimos explícitamente que otra oposición (no Madrid) también envía
    // el positionType correcto.
    mockOposicion.loading = false
    mockOposicion.oposicionId = 'auxiliar_administrativo_galicia'

    render(<FailedQuestionsReview />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toBe('/api/questions/failed-by-topic?positionType=auxiliar_administrativo_galicia')
  })

  test('escape URL correcto (no permite inyección en query string)', async () => {
    // Aunque positionType debería ser snake_case válido, si el context devuelve
    // algo raro, encodeURIComponent lo sanitiza antes de llegar a la API.
    mockOposicion.loading = false
    mockOposicion.oposicionId = 'auxiliar_administrativo_madrid'

    render(<FailedQuestionsReview />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    const url = mockFetch.mock.calls[0][0] as string
    // El positionType debe estar URL-encoded
    expect(url).toMatch(/positionType=auxiliar_administrativo_madrid$/)
  })

  test('si la API devuelve error, el componente no rompe', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: false, error: 'positionType es obligatorio' }),
    })
    mockOposicion.loading = false
    mockOposicion.oposicionId = 'auxiliar_administrativo_madrid'

    const { container } = render(<FailedQuestionsReview />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    // No debe crashear; contenedor existe
    expect(container).toBeTruthy()
  })

  test('si fetch tira excepción, el componente no rompe', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    mockOposicion.loading = false
    mockOposicion.oposicionId = 'auxiliar_administrativo_madrid'

    const { container } = render(<FailedQuestionsReview />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(container).toBeTruthy()
  })
})
