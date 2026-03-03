// __tests__/components/QuestionDispute.test.js
// Tests para el componente unificado QuestionDispute.tsx

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// ============================================
// MOCKS
// ============================================

const mockUser = {
  id: 'user-123-uuid',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' },
}

const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: 'mock-token-123' } },
    }),
  },
}

let mockAuthReturn = { user: mockUser, supabase: mockSupabase }
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}))

jest.mock('../../lib/notifications/adminEmailNotifications', () => ({
  sendAdminDisputeNotification: jest.fn().mockResolvedValue({ success: true }),
}))

// Importar después de mocks
import QuestionDispute from '../../components/QuestionDispute'

// ============================================
// HELPERS
// ============================================

const VALID_QUESTION_ID = '550e8400-e29b-41d4-a716-446655440000'

function renderInline(props = {}) {
  const defaultProps = {
    questionId: VALID_QUESTION_ID,
    user: mockUser,
  }
  return render(<QuestionDispute {...defaultProps} {...props} />)
}

function renderModal(props = {}) {
  const defaultProps = {
    questionId: VALID_QUESTION_ID,
    user: mockUser,
    isOpen: true,
    onClose: jest.fn(),
  }
  return render(<QuestionDispute {...defaultProps} {...props} />)
}

// ============================================
// TESTS
// ============================================

describe('QuestionDispute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockAuthReturn = { user: mockUser, supabase: mockSupabase }
    global.fetch = jest.fn()
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'mock-token-123' } },
    })
    // jsdom no implementa scrollIntoView
    Element.prototype.scrollIntoView = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ============================================
  // a) Renderizado inline
  // ============================================

  describe('Renderizado inline', () => {
    test('muestra botón "Impugnar pregunta" cerrado', () => {
      // GET para check existente → no existe
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderInline()
      expect(screen.getByText(/Impugnar pregunta/)).toBeInTheDocument()
      // Formulario no visible
      expect(screen.queryByText(/Motivo de la impugnación/)).not.toBeInTheDocument()
    })

    test('click abre el formulario con radio buttons', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderInline()
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      // Esperar a que termine el check
      await waitFor(() => {
        expect(screen.getByText(/no se ajusta exactamente al artículo/)).toBeInTheDocument()
      })
      expect(screen.getByText(/respuesta marcada como correcta es errónea/)).toBeInTheDocument()
      expect(screen.getByText(/Otro motivo/)).toBeInTheDocument()
    })

    test('submit deshabilitado sin tipo seleccionado', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderInline()
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Enviar impugnación/ })).toBeDisabled()
      })
    })

    test('submit deshabilitado sin questionId', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderInline({ questionId: null })
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      // Como no hay questionId, el check no se hace pero el formulario se muestra
      await waitFor(() => {
        const submitBtn = screen.getByRole('button', { name: /Enviar impugnación/ })
        expect(submitBtn).toBeDisabled()
      })
    })
  })

  // ============================================
  // b) Verificación previa (GET /api/dispute)
  // ============================================

  describe('Verificación previa (GET)', () => {
    test('al abrir, llama GET con Bearer token', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderInline()
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/dispute?questionId=${VALID_QUESTION_ID}`),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token-123',
            }),
          })
        )
      })
    })

    test('muestra spinner mientras carga', async () => {
      // Never resolve to keep it loading
      let resolveCheck
      global.fetch.mockImplementationOnce(() =>
        new Promise(resolve => { resolveCheck = resolve })
      )

      renderInline()
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      // Wait for the spinner to appear (the effect fires async)
      await waitFor(() => {
        expect(screen.getByText(/Verificando/)).toBeInTheDocument()
      })

      // Cleanup: resolve the fetch so the component settles
      await act(async () => {
        resolveCheck({ ok: true, json: async () => ({ success: true, data: null }) })
      })
      await waitFor(() => {
        expect(screen.queryByText(/Verificando/)).not.toBeInTheDocument()
      })
    })

    test('si ya existe impugnación, muestra estado + admin_response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'dispute-1',
            disputeType: 'no_literal',
            status: 'pending',
            createdAt: '2026-01-15T10:00:00Z',
            adminResponse: 'Revisaremos tu caso',
          },
        }),
      })

      renderInline()
      // Initially says "Impugnar pregunta"; GET resolves after open → shows existing
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      await waitFor(() => {
        expect(screen.getByText(/Ya impugnaste esta pregunta/)).toBeInTheDocument()
        expect(screen.getByText(/Pendiente de revisión/)).toBeInTheDocument()
        expect(screen.getByText(/Revisaremos tu caso/)).toBeInTheDocument()
      })
    })

    test('si no existe, muestra formulario normal', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderInline()
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      await waitFor(() => {
        expect(screen.getByText(/Motivo de la impugnación/)).toBeInTheDocument()
      })
    })

    test('si GET falla, muestra formulario (fallback graceful)', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'))

      renderInline()
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      await waitFor(() => {
        expect(screen.getByText(/Motivo de la impugnación/)).toBeInTheDocument()
      })
    })
  })

  // ============================================
  // c) Submit (POST /api/dispute)
  // ============================================

  describe('Submit (POST)', () => {
    async function openAndFillForm(type = 'no_literal', description = '') {
      // GET check → no existing
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderInline()
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      await waitFor(() => {
        expect(screen.getByText(/Motivo de la impugnación/)).toBeInTheDocument()
      })

      // Select type
      const labels = {
        no_literal: /no se ajusta exactamente al artículo/,
        respuesta_incorrecta: /respuesta marcada como correcta es errónea/,
        otro: /Otro motivo/,
      }
      fireEvent.click(screen.getByLabelText(labels[type]))

      if (description) {
        const textarea = screen.getByRole('textbox')
        fireEvent.change(textarea, { target: { value: description } })
      }
    }

    test('envía con Bearer token y body correcto', async () => {
      await openAndFillForm('no_literal')

      // POST → success
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: 'new-dispute-id', createdAt: '2026-01-15T10:00:00Z' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Enviar impugnación/ }))

      await waitFor(() => {
        const postCall = global.fetch.mock.calls.find(c => c[1]?.method === 'POST')
        expect(postCall).toBeTruthy()
        expect(postCall[1].headers['Authorization']).toBe('Bearer mock-token-123')
        const body = JSON.parse(postCall[1].body)
        expect(body.questionId).toBe(VALID_QUESTION_ID)
        expect(body.disputeType).toBe('no_literal')
        expect(body.description).toContain('Motivo: no_literal')
      })
    })

    test('descripción formateada para "no_literal" con detalles', async () => {
      await openAndFillForm('no_literal', 'No cita textualmente')

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'id-1', createdAt: '2026-01-15T10:00:00Z' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Enviar impugnación/ }))

      await waitFor(() => {
        const postCall = global.fetch.mock.calls.find(c => c[1]?.method === 'POST')
        const body = JSON.parse(postCall[1].body)
        expect(body.description).toBe('Motivo: no_literal - Detalles: No cita textualmente')
      })
    })

    test('descripción directa para "otro"', async () => {
      await openAndFillForm('otro', 'Pregunta ambigua y confusa')

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'id-2', createdAt: '2026-01-15T10:00:00Z' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Enviar impugnación/ }))

      await waitFor(() => {
        const postCall = global.fetch.mock.calls.find(c => c[1]?.method === 'POST')
        const body = JSON.parse(postCall[1].body)
        expect(body.description).toBe('Pregunta ambigua y confusa')
      })
    })

    test('200 → muestra éxito + auto-cierre a los 6s', async () => {
      await openAndFillForm('respuesta_incorrecta')

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'id-3', createdAt: '2026-01-15T10:00:00Z' },
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Enviar impugnación/ }))

      await waitFor(() => {
        expect(screen.getByText(/Impugnación enviada/)).toBeInTheDocument()
      })

      // Auto-cierre a los 6s
      act(() => { jest.advanceTimersByTime(6000) })
      await waitFor(() => {
        expect(screen.queryByText(/Impugnación enviada/)).not.toBeInTheDocument()
      })
    })

    test('409 → error inline "Ya has impugnado"', async () => {
      await openAndFillForm('no_literal')

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: 'Ya has impugnado esta pregunta anteriormente',
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Enviar impugnación/ }))

      await waitFor(() => {
        expect(screen.getByText(/Ya has impugnado/)).toBeInTheDocument()
      })
    })

    test('error genérico → error inline', async () => {
      await openAndFillForm('no_literal')

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Error interno del servidor',
        }),
      })

      fireEvent.click(screen.getByRole('button', { name: /Enviar impugnación/ }))

      await waitFor(() => {
        expect(screen.getByText(/Error interno del servidor/)).toBeInTheDocument()
      })
    })

    test('sin usuario → error inline', async () => {
      // GET check → no existing
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderInline({ user: null })
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      await waitFor(() => {
        expect(screen.getByText(/Motivo de la impugnación/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText(/no se ajusta exactamente al artículo/))
      fireEvent.click(screen.getByRole('button', { name: /Enviar impugnación/ }))

      await waitFor(() => {
        expect(screen.getByText(/Debes estar registrado/)).toBeInTheDocument()
      })
    })
  })

  // ============================================
  // d) Modo modal (isOpen/onClose)
  // ============================================

  describe('Modo modal', () => {
    test('no renderiza si isOpen=false', () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderModal({ isOpen: false })
      expect(screen.queryByText(/Impugnar Pregunta/)).not.toBeInTheDocument()
    })

    test('renderiza modal si isOpen=true', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderModal({ isOpen: true })
      await waitFor(() => {
        expect(screen.getByText(/Impugnar Pregunta/)).toBeInTheDocument()
      })
    })

    test('sin questionId → muestra warning "No se detectó pregunta"', async () => {
      renderModal({ questionId: null })
      await waitFor(() => {
        expect(screen.getByText(/No se detectó ninguna pregunta/)).toBeInTheDocument()
      })
    })

    test('onClose se llama al cancelar', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      const onClose = jest.fn()
      renderModal({ isOpen: true, onClose })

      await waitFor(() => {
        expect(screen.getByText(/Cancelar/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/Cancelar/))
      expect(onClose).toHaveBeenCalled()
    })
  })

  // ============================================
  // e) Token auth
  // ============================================

  describe('Token auth', () => {
    test('obtiene token via supabase.auth.getSession()', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })

      renderInline()
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      await waitFor(() => {
        expect(mockSupabase.auth.getSession).toHaveBeenCalled()
      })
    })

    test('si no hay sesión → error inline de auth', async () => {
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
      })

      renderInline()
      fireEvent.click(screen.getByText(/Impugnar pregunta/))

      // Debería mostrar formulario (check falla gracefully sin token)
      await waitFor(() => {
        expect(screen.getByText(/Motivo de la impugnación/)).toBeInTheDocument()
      })

      // Now try to submit
      fireEvent.click(screen.getByLabelText(/no se ajusta exactamente al artículo/))

      // Reset mock for the POST submit attempt
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
      })

      fireEvent.click(screen.getByRole('button', { name: /Enviar impugnación/ }))

      await waitFor(() => {
        expect(screen.getByText(/Error de autenticación/)).toBeInTheDocument()
      })
    })
  })
})

// ============================================
// TestLayout - Fix questionId fallback (preservado)
// ============================================

describe('TestLayout - Fix questionId fallback', () => {
  test('debe usar fallback cuando currentQuestionUuid es null', () => {
    const currentQuestionUuid = null
    const questions = [
      { id: 'question-uuid-1', text: 'Pregunta 1' },
      { id: 'question-uuid-2', text: 'Pregunta 2' },
    ]
    const currentQuestion = 0
    const resolvedQuestionId = currentQuestionUuid || questions[currentQuestion]?.id
    expect(resolvedQuestionId).toBe('question-uuid-1')
  })

  test('debe usar currentQuestionUuid cuando está disponible', () => {
    const currentQuestionUuid = 'saved-uuid-after-answer'
    const questions = [{ id: 'question-uuid-1', text: 'Pregunta 1' }]
    const currentQuestion = 0
    const resolvedQuestionId = currentQuestionUuid || questions[currentQuestion]?.id
    expect(resolvedQuestionId).toBe('saved-uuid-after-answer')
  })

  test('debe retornar undefined si no hay questions', () => {
    const currentQuestionUuid = null
    const questions = []
    const currentQuestion = 0
    const resolvedQuestionId = currentQuestionUuid || questions[currentQuestion]?.id
    expect(resolvedQuestionId).toBeUndefined()
  })

  test('debe manejar índice fuera de rango', () => {
    const currentQuestionUuid = null
    const questions = [{ id: 'only-question' }]
    const currentQuestion = 5
    const resolvedQuestionId = currentQuestionUuid || questions[currentQuestion]?.id
    expect(resolvedQuestionId).toBeUndefined()
  })
})
