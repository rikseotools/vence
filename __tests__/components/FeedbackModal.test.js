// __tests__/components/FeedbackModal.test.js
// Tests para el componente FeedbackModal (modal de solicitudes de soporte)

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// ============================================
// MOCKS
// ============================================

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

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
  sendAdminFeedbackNotification: jest.fn().mockResolvedValue({ success: true }),
}))

// Importar después de mocks
import FeedbackModal from '../../components/FeedbackModal'

// ============================================
// HELPERS
// ============================================

function renderModal(props = {}) {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  }
  return render(<FeedbackModal {...defaultProps} {...props} />)
}

/** Selecciona un tipo de feedback haciendo click en el botón del grid */
function selectType(labelFragment) {
  const buttons = screen.getAllByRole('button')
  const btn = buttons.find(b => b.textContent.includes(labelFragment))
  if (!btn) throw new Error(`No se encontró botón con texto "${labelFragment}"`)
  fireEvent.click(btn)
}

// ============================================
// TESTS
// ============================================

describe('FeedbackModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthReturn = { user: mockUser, supabase: mockSupabase }
    global.fetch = jest.fn()
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'mock-token-123' } },
    })
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: jest.fn(), setItem: jest.fn() },
      writable: true,
    })
  })

  // ============================================
  // RENDERIZADO Y UI
  // ============================================

  describe('Renderizado y UI', () => {
    test('no renderiza nada si isOpen=false', () => {
      const { container } = render(
        <FeedbackModal isOpen={false} onClose={jest.fn()} />
      )
      expect(container.innerHTML).toBe('')
    })

    test('muestra selector de tipo cuando no hay tipo seleccionado', () => {
      renderModal()
      expect(screen.getByText(/¿Qué tipo de solicitud/i)).toBeInTheDocument()
      expect(screen.getByText(/Sugerencia de Mejora/i)).toBeInTheDocument()
      expect(screen.getByText(/Impugnación/i)).toBeInTheDocument()
    })

    test('muestra confirmación de tipo + formulario cuando se selecciona tipo', () => {
      renderModal()
      selectType('Sugerencia')

      expect(screen.getByText(/Sugerencia de Mejora/i)).toBeInTheDocument()
      expect(screen.getByText(/Ideas para mejorar la app/i)).toBeInTheDocument()
      expect(screen.getByText(/Cambiar/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Describe tu solicitud/i)).toBeInTheDocument()
    })

    test('muestra advertencia si tipo=question_dispute sin questionId', () => {
      renderModal({ questionId: null })
      selectType('Impugnación')

      expect(screen.getByText(/No se detectó ninguna pregunta/i)).toBeInTheDocument()
    })

    test('muestra formulario de impugnación con questionId válido', () => {
      renderModal({ questionId: '550e8400-e29b-41d4-a716-446655440000' })
      selectType('Impugnación')

      expect(screen.getByText(/Pregunta detectada/i)).toBeInTheDocument()
      expect(screen.getByText(/Motivo de la impugnación/i)).toBeInTheDocument()
      // Radio buttons visibles
      expect(screen.getByLabelText(/no se ajusta exactamente al artículo/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/respuesta marcada como correcta es errónea/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Otro motivo/i)).toBeInTheDocument()
    })

    test('muestra estado de éxito tras envío correcto de feedback', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'fb-1', createdAt: new Date().toISOString() },
        }),
      })

      renderModal()
      selectType('Sugerencia')

      const textarea = screen.getByPlaceholderText(/Describe tu solicitud/i)
      fireEvent.change(textarea, { target: { value: 'Mi sugerencia de mejora' } })

      fireEvent.click(screen.getByText(/Enviar Solicitud/i))

      await waitFor(() => {
        expect(screen.getByText(/Solicitud Enviada/i)).toBeInTheDocument()
      })
    })

    test('permite cambiar tipo con botón Cambiar', () => {
      renderModal()
      selectType('Sugerencia')
      expect(screen.getByText(/Ideas para mejorar la app/i)).toBeInTheDocument()

      fireEvent.click(screen.getByText(/Cambiar/i))
      expect(screen.getByText(/¿Qué tipo de solicitud/i)).toBeInTheDocument()
    })
  })

  // ============================================
  // VALIDACIÓN DE FORMULARIO
  // ============================================

  describe('Validación de formulario', () => {
    test('dispute sin disputeType muestra error', async () => {
      renderModal({ questionId: '550e8400-e29b-41d4-a716-446655440000' })
      selectType('Impugnación')

      // Submit sin seleccionar disputeType (no hay radio seleccionado)
      const form = screen.getByText(/Enviar Impugnación/i).closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/selecciona un motivo/i)).toBeInTheDocument()
      })
    })

    test('dispute tipo "otro" sin mensaje muestra error', async () => {
      renderModal({ questionId: '550e8400-e29b-41d4-a716-446655440000' })
      selectType('Impugnación')

      const radioOtro = screen.getByLabelText(/Otro motivo/i)
      fireEvent.click(radioOtro)

      // Submit sin mensaje
      const form = screen.getByText(/Enviar Impugnación/i).closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/describe el problema/i)).toBeInTheDocument()
      })
    })

    test('dispute sin usuario muestra error', async () => {
      mockAuthReturn = { user: null, supabase: mockSupabase }
      renderModal({ questionId: '550e8400-e29b-41d4-a716-446655440000' })
      selectType('Impugnación')

      const radioIncorrecta = screen.getByLabelText(/respuesta marcada como correcta es errónea/i)
      fireEvent.click(radioIncorrecta)

      const form = screen.getByText(/Enviar Impugnación/i).closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/Debes estar registrado/i)).toBeInTheDocument()
      })
    })

    test('feedback sin mensaje tiene botón submit deshabilitado', () => {
      renderModal()
      selectType('Sugerencia')

      const submitBtn = screen.getByText(/Enviar Solicitud/i).closest('button')
      expect(submitBtn).toBeDisabled()
    })

    test('feedback con mensaje tiene botón submit habilitado', () => {
      renderModal()
      selectType('Sugerencia')

      const textarea = screen.getByPlaceholderText(/Describe tu solicitud/i)
      fireEvent.change(textarea, { target: { value: 'Mi feedback' } })

      const submitBtn = screen.getByText(/Enviar Solicitud/i).closest('button')
      expect(submitBtn).not.toBeDisabled()
    })
  })

  // ============================================
  // SUBMIT FEEDBACK (mock fetch /api/feedback)
  // ============================================

  describe('Submit feedback', () => {
    test('envía datos correctos al endpoint /api/feedback', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'fb-1', type: 'suggestion', createdAt: new Date().toISOString() },
        }),
      })

      renderModal()
      selectType('Sugerencia')

      const textarea = screen.getByPlaceholderText(/Describe tu solicitud/i)
      fireEvent.change(textarea, { target: { value: 'Necesito modo oscuro' } })

      fireEvent.click(screen.getByText(/Enviar Solicitud/i))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/feedback',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        )

        const callArgs = global.fetch.mock.calls[0]
        const body = JSON.parse(callArgs[1].body)
        expect(body.type).toBe('suggestion')
        expect(body.message).toContain('Necesito modo oscuro')
        expect(body.userId).toBe('user-123-uuid')
      })
    })

    test('envía type=bug para tipo Error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'fb-1', createdAt: new Date().toISOString() },
        }),
      })

      renderModal()
      selectType('Error')

      const textarea = screen.getByPlaceholderText(/Describe tu solicitud/i)
      fireEvent.change(textarea, { target: { value: 'Botón no funciona' } })

      fireEvent.click(screen.getByText(/Enviar Solicitud/i))

      await waitFor(() => {
        const body = JSON.parse(global.fetch.mock.calls[0][1].body)
        expect(body.type).toBe('bug')
      })
    })

    test('maneja respuesta exitosa mostrando estado de éxito', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'fb-1', createdAt: new Date().toISOString() },
        }),
      })

      renderModal()
      selectType('Sugerencia')

      fireEvent.change(screen.getByPlaceholderText(/Describe tu solicitud/i), {
        target: { value: 'Botón no funciona' },
      })
      fireEvent.click(screen.getByText(/Enviar Solicitud/i))

      await waitFor(() => {
        expect(screen.getByText(/Solicitud Enviada/i)).toBeInTheDocument()
      })
    })

    test('maneja error de API mostrando mensaje de error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          success: false,
          error: 'Error del servidor',
        }),
      })

      renderModal()
      selectType('Sugerencia')

      fireEvent.change(screen.getByPlaceholderText(/Describe tu solicitud/i), {
        target: { value: 'Mi sugerencia' },
      })
      fireEvent.click(screen.getByText(/Enviar Solicitud/i))

      await waitFor(() => {
        expect(screen.getByText(/Error del servidor/i)).toBeInTheDocument()
      })
    })
  })

  // ============================================
  // SUBMIT DISPUTE (mock fetch /api/dispute)
  // ============================================

  describe('Submit dispute', () => {
    test('envía datos correctos al endpoint /api/dispute con Bearer token', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'dispute-1', createdAt: new Date().toISOString() },
        }),
      })

      const qid = '550e8400-e29b-41d4-a716-446655440000'
      renderModal({ questionId: qid })
      selectType('Impugnación')

      const radioIncorrecta = screen.getByLabelText(/respuesta marcada como correcta es errónea/i)
      fireEvent.click(radioIncorrecta)

      const form = screen.getByText(/Enviar Impugnación/i).closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/dispute',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token-123',
            }),
          })
        )

        const callArgs = global.fetch.mock.calls[0]
        const body = JSON.parse(callArgs[1].body)
        expect(body.questionId).toBe(qid)
        expect(body.disputeType).toBe('respuesta_incorrecta')
        expect(body.description).toContain('respuesta_incorrecta')
      })
    })

    test('maneja 409 (duplicate) mostrando mensaje específico', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({
          success: false,
          error: 'Ya has impugnado esta pregunta anteriormente',
        }),
      })

      renderModal({ questionId: '550e8400-e29b-41d4-a716-446655440000' })
      selectType('Impugnación')

      fireEvent.click(screen.getByLabelText(/no se ajusta exactamente al artículo/i))

      const form = screen.getByText(/Enviar Impugnación/i).closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/Ya has impugnado esta pregunta anteriormente/i)).toBeInTheDocument()
      })
    })

    test('maneja éxito mostrando estado exitoso', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'dispute-1', createdAt: new Date().toISOString() },
        }),
      })

      renderModal({ questionId: '550e8400-e29b-41d4-a716-446655440000' })
      selectType('Impugnación')

      fireEvent.click(screen.getByLabelText(/no se ajusta exactamente al artículo/i))

      const form = screen.getByText(/Enviar Impugnación/i).closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/Solicitud Enviada/i)).toBeInTheDocument()
      })
    })

    test('envía descripción personalizada para tipo "otro"', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'dispute-1', createdAt: new Date().toISOString() },
        }),
      })

      renderModal({ questionId: '550e8400-e29b-41d4-a716-446655440000' })
      selectType('Impugnación')

      fireEvent.click(screen.getByLabelText(/Otro motivo/i))

      const textarea = screen.getByPlaceholderText(/Describe el problema/i)
      fireEvent.change(textarea, { target: { value: 'La pregunta tiene un error tipográfico' } })

      const form = screen.getByText(/Enviar Impugnación/i).closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        const body = JSON.parse(global.fetch.mock.calls[0][1].body)
        expect(body.description).toBe('La pregunta tiene un error tipográfico')
        expect(body.disputeType).toBe('otro')
      })
    })
  })

  // ============================================
  // IMAGE UPLOAD
  // ============================================

  describe('Image upload', () => {
    test('upload correcto llama a la API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          url: 'https://storage.example.com/image.png',
          fileName: 'image.png',
          path: 'user-feedback-images/image.png',
        }),
      })

      renderModal()
      selectType('Sugerencia')

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['pixels'], 'test.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 })

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/upload-feedback-image',
          expect.objectContaining({ method: 'POST' })
        )
      })
    })

    test('archivos >5MB son rechazados', async () => {
      renderModal()
      selectType('Sugerencia')

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['pixels'], 'huge.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 })

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText(/no puede ser mayor a 5MB/i)).toBeInTheDocument()
      })
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('archivos no-imagen son rechazados', async () => {
      renderModal()
      selectType('Sugerencia')

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText(/Solo se permiten archivos de imagen/i)).toBeInTheDocument()
      })
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // HANDLE CLOSE
  // ============================================

  describe('handleClose', () => {
    test('botón Cancelar se deshabilita durante loading', async () => {
      global.fetch = jest.fn().mockImplementation(
        () => new Promise(() => {}) // Nunca resuelve
      )

      const onClose = jest.fn()
      renderModal({ onClose })
      selectType('Sugerencia')

      fireEvent.change(screen.getByPlaceholderText(/Describe tu solicitud/i), {
        target: { value: 'Mensaje de test' },
      })
      fireEvent.click(screen.getByText(/Enviar Solicitud/i))

      const cancelBtn = screen.getByText(/Cancelar/i)
      expect(cancelBtn).toBeDisabled()
    })

    test('botón X del header cierra el modal', () => {
      const onClose = jest.fn()
      renderModal({ onClose })

      const allButtons = screen.getAllByRole('button')
      const xButton = allButtons.find(b => b.querySelector('svg path[d*="M6 18L18 6"]'))
      expect(xButton).toBeTruthy()

      fireEvent.click(xButton)
      expect(onClose).toHaveBeenCalled()
    })
  })

  // ============================================
  // CALLBACK onFeedbackSent
  // ============================================

  describe('onFeedbackSent callback', () => {
    test('se llama después de envío exitoso de feedback', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'fb-1', createdAt: new Date().toISOString() },
        }),
      })

      const onFeedbackSent = jest.fn()
      renderModal({ onFeedbackSent })
      selectType('Sugerencia')

      fireEvent.change(screen.getByPlaceholderText(/Describe tu solicitud/i), {
        target: { value: 'Mi sugerencia' },
      })
      fireEvent.click(screen.getByText(/Enviar Solicitud/i))

      await waitFor(() => {
        expect(onFeedbackSent).toHaveBeenCalled()
      })
    })

    test('se llama después de envío exitoso de impugnación', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'dispute-1', createdAt: new Date().toISOString() },
        }),
      })

      const onFeedbackSent = jest.fn()
      renderModal({ questionId: '550e8400-e29b-41d4-a716-446655440000', onFeedbackSent })
      selectType('Impugnación')

      fireEvent.click(screen.getByLabelText(/respuesta marcada como correcta es errónea/i))

      const form = screen.getByText(/Enviar Impugnación/i).closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(onFeedbackSent).toHaveBeenCalled()
      })
    })
  })
})
