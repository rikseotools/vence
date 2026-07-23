import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FeedbackModal from '@/components/FeedbackModal'

// FeedbackModal es el flujo de impugnación desde /soporte (y del header). Este test cubre el
// comportamiento correcto tras el fix del 21/07: la pregunta a impugnar viene SOLO del contexto
// vivo (o prop/URL), nunca de estado stale. Sin pregunta → guía al botón inline y NO envía.

// Refs ESTABLES: los hooks reales devuelven referencias estables entre renders. Si el mock
// crea un objeto nuevo por render, el efecto de reset (deps [isOpen,success,user]) bucle infinito.
const mockUser = { id: 'u1', email: 'u1@test.com' }
let mockCurrentQuestion: { id: string; questionText: string } | null = null

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/contexts/QuestionContext', () => ({ useQuestionContext: () => ({ currentQuestionContext: mockCurrentQuestion }) }))
jest.mock('@/lib/api/authHeaders', () => ({ getAuthHeaders: async () => ({ Authorization: 'Bearer x' }) }))
jest.mock('@/lib/observability/client', () => ({ emitClientEvent: jest.fn() }))
import { emitClientEvent } from '@/lib/observability/client'
const emitMock = emitClientEvent as jest.Mock

const ACERCA_DE = 'dcc3a220-8b99-4071-92f8-38c7686f7f4e'

let fetchMock: jest.Mock
beforeEach(() => {
  emitMock.mockClear()
  mockCurrentQuestion = null
  fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { id: 'd1' } }) }))
  ;(global as any).fetch = fetchMock
})

function selectImpugnacion() {
  fireEvent.click(screen.getByText('Impugnación'))
}

describe('FeedbackModal — impugnación desde /soporte SIN pregunta en contexto', () => {
  it('muestra el aviso "No se detectó ninguna pregunta" y NO el formulario', () => {
    render(<FeedbackModal isOpen onClose={() => {}} />)
    selectImpugnacion()
    expect(screen.getByText(/No se detectó ninguna pregunta/i)).toBeInTheDocument()
    expect(screen.queryByText(/Motivo de la impugnación/i)).not.toBeInTheDocument()
  })

  it('emite question_dispute_action action=no_question_context (observabilidad)', async () => {
    render(<FeedbackModal isOpen onClose={() => {}} />)
    selectImpugnacion()
    await waitFor(() =>
      expect(
        emitMock.mock.calls.some(
          ([c]) => c?.eventType === 'question_dispute_action' && c?.metadata?.action === 'no_question_context',
        ),
      ).toBe(true),
    )
  })

  it('nunca hace POST a /api/dispute sin pregunta (no cuelga de una stale)', () => {
    render(<FeedbackModal isOpen onClose={() => {}} />)
    selectImpugnacion()
    const disputeCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/dispute'))
    expect(disputeCalls).toHaveLength(0)
  })
})

// NOTA (honestidad, hallazgo del review): hoy FeedbackModal solo se monta en /soporte SIN
// pregunta, y allí el QuestionContext SIEMPRE es null (no hay test montado) → el flujo real de
// un usuario en /soporte es SIEMPRE la rama "No se detectó ninguna pregunta" (arriba). Este
// bloque cubre el camino de una pregunta EXPLÍCITA (prop/contexto vivo) — reachable si en el
// futuro el modal se abre en contexto de pregunta; NO implica que un usuario de /soporte vea texto.
describe('FeedbackModal — pregunta EXPLÍCITA en contexto (prop/futuro montaje en test)', () => {
  beforeEach(() => {
    mockCurrentQuestion = {
      id: ACERCA_DE,
      questionText: 'En Windows 11, ¿dónde se ve el nombre del dispositivo y la edición?',
    }
  })

  it('muestra el TEXTO de la pregunta (no un ID opaco)', () => {
    render(<FeedbackModal isOpen onClose={() => {}} />)
    selectImpugnacion()
    expect(screen.getByText(/Impugnando esta pregunta/i)).toBeInTheDocument()
    expect(screen.getByText(/nombre del dispositivo y la edición/i)).toBeInTheDocument()
    expect(screen.queryByText(/No se detectó ninguna pregunta/i)).not.toBeInTheDocument()
  })
})
