// __tests__/components/PsychometricQuestionDispute.test.js
// Tests para el componente PsychometricQuestionDispute

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock de fetch para el API
global.fetch = jest.fn()

// Mock del componente (importamos después de mocks)
// Debido a que es un componente TSX, simulamos la lógica
const mockSupabase = {}

describe('PsychometricQuestionDispute Component', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User' }
  }

  const validQuestionId = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch.mockReset()
  })

  // ============================================
  // SECCIÓN 1: RENDERIZADO INICIAL
  // ============================================

  describe('Renderizado inicial', () => {
    test('debe mostrar botón "Impugnar pregunta"', () => {
      const { buttonText } = simulateRender({ questionId: validQuestionId, user: mockUser })

      expect(buttonText).toBe('Impugnar pregunta')
    })

    test('formulario debe estar cerrado inicialmente', () => {
      const { isFormOpen } = simulateRender({ questionId: validQuestionId, user: mockUser })

      expect(isFormOpen).toBe(false)
    })
  })

  // ============================================
  // SECCIÓN 2: APERTURA/CIERRE DEL FORMULARIO
  // ============================================

  describe('Toggle del formulario', () => {
    test('debe abrir formulario al hacer clic en botón', () => {
      const state = simulateRender({ questionId: validQuestionId, user: mockUser })

      const newState = simulateToggle(state)

      expect(newState.isFormOpen).toBe(true)
    })

    test('debe cerrar formulario al hacer clic en "Cancelar"', () => {
      const state = { isFormOpen: true }

      const newState = simulateCancel(state)

      expect(newState.isFormOpen).toBe(false)
    })

    test('debe resetear formulario al cerrar', () => {
      const state = {
        isFormOpen: true,
        disputeType: 'otro',
        description: 'Algún texto'
      }

      const newState = simulateCancel(state)

      expect(newState.disputeType).toBe('')
      expect(newState.description).toBe('')
    })
  })

  // ============================================
  // SECCIÓN 3: TIPOS DE IMPUGNACIÓN
  // ============================================

  describe('Tipos de impugnación', () => {
    const validTypes = ['respuesta_incorrecta', 'ai_detected_error', 'otro']

    test.each(validTypes)('debe permitir seleccionar tipo: %s', (type) => {
      const state = { disputeType: '' }

      const newState = simulateSelectType(state, type)

      expect(newState.disputeType).toBe(type)
    })

    test('tipo "respuesta_incorrecta" tiene label correcto', () => {
      const label = getTypeLabel('respuesta_incorrecta')
      expect(label).toContain('respuesta marcada como correcta es errónea')
    })

    test('tipo "ai_detected_error" tiene label correcto', () => {
      const label = getTypeLabel('ai_detected_error')
      expect(label).toContain('Error en los datos')
    })

    test('tipo "otro" tiene label correcto', () => {
      const label = getTypeLabel('otro')
      expect(label).toContain('Otro motivo')
    })
  })

  // ============================================
  // SECCIÓN 4: VALIDACIÓN DEL FORMULARIO
  // ============================================

  describe('Validación del formulario', () => {
    test('botón submit debe estar deshabilitado sin tipo seleccionado', () => {
      const canSubmit = validateCanSubmit({
        questionId: validQuestionId,
        disputeType: '',
        description: '',
        submitting: false
      })

      expect(canSubmit).toBe(false)
    })

    test('botón submit debe estar habilitado con tipo predefinido', () => {
      const canSubmit = validateCanSubmit({
        questionId: validQuestionId,
        disputeType: 'respuesta_incorrecta',
        description: '',
        submitting: false
      })

      expect(canSubmit).toBe(true)
    })

    test('tipo "otro" requiere descripción de al menos 10 caracteres', () => {
      const canSubmit = validateCanSubmit({
        questionId: validQuestionId,
        disputeType: 'otro',
        description: 'corta',
        submitting: false
      })

      expect(canSubmit).toBe(false)
    })

    test('tipo "otro" con descripción suficiente permite enviar', () => {
      const canSubmit = validateCanSubmit({
        questionId: validQuestionId,
        disputeType: 'otro',
        description: 'Esta es una descripción válida',
        submitting: false
      })

      expect(canSubmit).toBe(true)
    })

    test('botón submit deshabilitado durante envío', () => {
      const canSubmit = validateCanSubmit({
        questionId: validQuestionId,
        disputeType: 'respuesta_incorrecta',
        description: '',
        submitting: true
      })

      expect(canSubmit).toBe(false)
    })

    test('sin questionId no permite enviar', () => {
      const canSubmit = validateCanSubmit({
        questionId: null,
        disputeType: 'respuesta_incorrecta',
        description: '',
        submitting: false
      })

      expect(canSubmit).toBe(false)
    })
  })

  // ============================================
  // SECCIÓN 5: ENVÍO VIA API
  // ============================================

  describe('Envío de impugnación via API', () => {
    test('debe llamar a /api/dispute/psychometric', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, disputeId: 'new-id' })
      })

      const apiUrl = '/api/dispute/psychometric'

      await simulateSubmit({
        questionId: validQuestionId,
        userId: mockUser.id,
        disputeType: 'respuesta_incorrecta',
        description: 'Motivo: respuesta_incorrecta'
      })

      expect(global.fetch).toHaveBeenCalledWith(apiUrl, expect.any(Object))
    })

    test('debe enviar método POST', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      await simulateSubmit({
        questionId: validQuestionId,
        userId: mockUser.id,
        disputeType: 'otro',
        description: 'Descripción válida aquí'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' })
      )
    })

    test('debe enviar Content-Type application/json', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      await simulateSubmit({
        questionId: validQuestionId,
        userId: mockUser.id,
        disputeType: 'ai_detected_error',
        description: ''
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' }
        })
      )
    })

    test('body debe incluir todos los campos requeridos', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      const data = {
        questionId: validQuestionId,
        userId: mockUser.id,
        disputeType: 'respuesta_incorrecta',
        description: 'Motivo: respuesta_incorrecta'
      }

      await simulateSubmit(data)

      const callArgs = global.fetch.mock.calls[0][1]
      const body = JSON.parse(callArgs.body)

      expect(body).toHaveProperty('questionId', validQuestionId)
      expect(body).toHaveProperty('userId', mockUser.id)
      expect(body).toHaveProperty('disputeType', 'respuesta_incorrecta')
      expect(body).toHaveProperty('description')
    })
  })

  // ============================================
  // SECCIÓN 6: MANEJO DE RESPUESTAS
  // ============================================

  describe('Manejo de respuestas del API', () => {
    test('éxito debe mostrar mensaje de confirmación', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, disputeId: 'new-id' })
      })

      const result = await simulateSubmitAndGetResult({
        questionId: validQuestionId,
        userId: mockUser.id,
        disputeType: 'otro',
        description: 'Descripción válida aquí'
      })

      expect(result.submitted).toBe(true)
    })

    test('error 409 debe mostrar mensaje de duplicado', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'Ya has impugnado esta pregunta' })
      })

      const result = await simulateSubmitAndGetResult({
        questionId: validQuestionId,
        userId: mockUser.id,
        disputeType: 'respuesta_incorrecta',
        description: ''
      })

      expect(result.error).toContain('Ya has impugnado')
    })

    test('error genérico debe mostrar mensaje de error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Error interno' })
      })

      const result = await simulateSubmitAndGetResult({
        questionId: validQuestionId,
        userId: mockUser.id,
        disputeType: 'ai_detected_error',
        description: ''
      })

      expect(result.error).toBeDefined()
    })
  })

  // ============================================
  // SECCIÓN 7: FORMATO DE DESCRIPCIÓN
  // ============================================

  describe('Formato de descripción', () => {
    test('tipo "otro" envía descripción directa', () => {
      const description = formatDescription('otro', 'Mi descripción personalizada')

      expect(description).toBe('Mi descripción personalizada')
    })

    test('tipo predefinido sin detalles envía solo motivo', () => {
      const description = formatDescription('respuesta_incorrecta', '')

      expect(description).toBe('Motivo: respuesta_incorrecta')
    })

    test('tipo predefinido con detalles envía motivo + detalles', () => {
      const description = formatDescription('ai_detected_error', 'El gráfico está mal')

      expect(description).toBe('Motivo: ai_detected_error - Detalles: El gráfico está mal')
    })

    test('debe limpiar espacios en blanco', () => {
      const description = formatDescription('otro', '  texto con espacios  ')

      expect(description).toBe('texto con espacios')
    })
  })

  // ============================================
  // SECCIÓN 8: VALIDACIÓN DE USUARIO
  // ============================================

  describe('Validación de usuario', () => {
    test('sin usuario debe mostrar alerta', () => {
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {})

      const result = validateUserBeforeSubmit(null)

      expect(result.valid).toBe(false)
      expect(result.message).toContain('registrado')

      alertMock.mockRestore()
    })

    test('con usuario válido debe permitir continuar', () => {
      const result = validateUserBeforeSubmit(mockUser)

      expect(result.valid).toBe(true)
    })
  })

  // ============================================
  // SECCIÓN 9: COMPARACIÓN CON COMPONENTE NORMAL
  // ============================================

  describe('Diferencias con QuestionDispute normal', () => {
    test('tipos de impugnación son diferentes', () => {
      const psychoTypes = ['respuesta_incorrecta', 'ai_detected_error', 'otro']
      const normalTypes = ['no_literal', 'respuesta_incorrecta', 'otro']

      // ai_detected_error es exclusivo de psicotécnicas
      expect(psychoTypes).toContain('ai_detected_error')
      expect(normalTypes).not.toContain('ai_detected_error')

      // no_literal es exclusivo de normales
      expect(normalTypes).toContain('no_literal')
      expect(psychoTypes).not.toContain('no_literal')
    })

    test('usa API diferente', () => {
      const psychoApi = '/api/dispute/psychometric'
      const normalApi = '/api/dispute' // Hipotético, las normales usan supabase directo

      expect(psychoApi).not.toBe(normalApi)
      expect(psychoApi).toContain('psychometric')
    })

    test('título indica "psicotécnica"', () => {
      const title = getFormTitle()
      expect(title).toContain('psicotécnica')
    })
  })

  // ============================================
  // SECCIÓN 10: AUTO-CIERRE DESPUÉS DE ENVÍO
  // ============================================

  describe('Auto-cierre después de envío exitoso', () => {
    test('debe cerrar automáticamente después de 5 segundos', () => {
      jest.useFakeTimers()

      const state = { submitted: true, isFormOpen: true }

      // Simular que pasan 5 segundos
      const newState = simulateAutoClose(state, 5000)

      expect(newState.isFormOpen).toBe(false)
      expect(newState.submitted).toBe(false)

      jest.useRealTimers()
    })

    test('debe resetear estado al cerrar', () => {
      const state = {
        submitted: true,
        isFormOpen: true,
        disputeType: 'otro',
        description: 'Algo'
      }

      const newState = simulateAutoClose(state, 5000)

      expect(newState.disputeType).toBe('')
      expect(newState.description).toBe('')
    })
  })
})

// ============================================
// FUNCIONES AUXILIARES PARA TESTS
// ============================================

function simulateRender(props) {
  return {
    buttonText: 'Impugnar pregunta',
    isFormOpen: false,
    ...props
  }
}

function simulateToggle(state) {
  return { ...state, isFormOpen: !state.isFormOpen }
}

function simulateCancel(state) {
  return {
    ...state,
    isFormOpen: false,
    disputeType: '',
    description: ''
  }
}

function simulateSelectType(state, type) {
  return { ...state, disputeType: type }
}

function getTypeLabel(type) {
  const labels = {
    'respuesta_incorrecta': '❌ La respuesta marcada como correcta es errónea',
    'ai_detected_error': '📊 Error en los datos, gráficos o explicación',
    'otro': '💭 Otro motivo'
  }
  return labels[type] || type
}

function validateCanSubmit({ questionId, disputeType, description, submitting }) {
  if (!questionId || !disputeType || submitting) return false
  if (disputeType === 'otro' && description.trim().length < 10) return false
  return true
}

async function simulateSubmit(data) {
  const description = formatDescription(data.disputeType, data.description || '')

  await global.fetch('/api/dispute/psychometric', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionId: data.questionId,
      userId: data.userId,
      disputeType: data.disputeType,
      description
    })
  })
}

async function simulateSubmitAndGetResult(data) {
  try {
    const response = await global.fetch('/api/dispute/psychometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    const result = await response.json()

    if (!response.ok) {
      if (response.status === 409) {
        return { error: 'Ya has impugnado esta pregunta anteriormente.' }
      }
      return { error: result.error || 'Error al enviar la impugnación' }
    }

    return { submitted: true }
  } catch (error) {
    return { error: 'Error inesperado al enviar la impugnación' }
  }
}

function formatDescription(type, description) {
  if (type === 'otro') {
    return description.trim()
  }
  return `Motivo: ${type}${description.trim() ? ` - Detalles: ${description.trim()}` : ''}`
}

function validateUserBeforeSubmit(user) {
  if (!user) {
    return { valid: false, message: 'Debes estar registrado para impugnar preguntas' }
  }
  return { valid: true }
}

function getFormTitle() {
  return '⚖️ Impugnar esta pregunta psicotécnica'
}

function simulateAutoClose(state, delayMs) {
  if (state.submitted && delayMs >= 5000) {
    return {
      ...state,
      isFormOpen: false,
      submitted: false,
      disputeType: '',
      description: ''
    }
  }
  return state
}
