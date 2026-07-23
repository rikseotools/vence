import { render, screen, fireEvent } from '@testing-library/react'
import SupportButton from '@/components/SupportButton'

// SupportButton: dentro de un test (pregunta viva en contexto) abre el modal AQUÍ (no navega,
// no pierde el test); fuera navega a /soporte. Aislamos la LÓGICA: FeedbackModal va stubeado
// (su comportamiento real lo cubre FeedbackModalDisputeGuard.test.tsx).

jest.mock('@/components/FeedbackModal', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="support-modal">modal</div> : null),
}))

let mockCtx: { currentQuestionContext: { id: string } | null } = { currentQuestionContext: null }
jest.mock('@/contexts/QuestionContext', () => ({ useQuestionContext: () => mockCtx }))

let mockActiveTestId: string | null = null
jest.mock('@/hooks/useActiveTestId', () => ({ useActiveTestId: () => mockActiveTestId }))

const Q = { id: 'dcc3a220-8b99-4071-92f8-38c7686f7f4e' }

beforeEach(() => { mockCtx = { currentQuestionContext: null }; mockActiveTestId = null })

function renderBtn() {
  return render(<SupportButton className="x" aria-label="Contactar soporte">💬 Soporte</SupportButton>)
}

describe('SupportButton', () => {
  it('siempre es un enlace a /soporte (SEO, teclado, abrir en pestaña nueva)', () => {
    renderBtn()
    const link = screen.getByRole('link', { name: /Contactar soporte/i })
    expect(link.getAttribute('href')).toBe('/soporte')
  })

  it('FUERA de un test: el click deja navegar a /soporte y NO abre el modal', () => {
    renderBtn()
    const link = screen.getByRole('link')
    const notPrevented = fireEvent.click(link) // fireEvent devuelve false si se hizo preventDefault
    expect(notPrevented).toBe(true) // navegación NO prevenida
    expect(screen.queryByTestId('support-modal')).not.toBeInTheDocument()
  })

  it('DENTRO de un test: el click abre el modal aquí y NO navega (no pierde el test)', () => {
    mockCtx = { currentQuestionContext: Q }
    renderBtn()
    const link = screen.getByRole('link')
    expect(link.getAttribute('aria-haspopup')).toBe('dialog') // avisa que abre diálogo
    const notPrevented = fireEvent.click(link)
    expect(notPrevented).toBe(false) // navegación prevenida
    expect(screen.getByTestId('support-modal')).toBeInTheDocument()
  })

  it('DENTRO de un EXAMEN (active_test_id, sin pregunta actual): abre el modal, no navega (no pierde el examen)', () => {
    // Modo examen no fija currentQuestionContext (muestra todas las preguntas), pero marca
    // active_test_id → igualmente hay que abrir en sitio para no perder el examen en curso.
    mockActiveTestId = 'exam-123'
    renderBtn()
    const link = screen.getByRole('link')
    const notPrevented = fireEvent.click(link)
    expect(notPrevented).toBe(false)
    expect(screen.getByTestId('support-modal')).toBeInTheDocument()
  })

  it('DENTRO de un test pero con ctrl/cmd (abrir en pestaña nueva): deja navegar, no abre modal', () => {
    mockCtx = { currentQuestionContext: Q }
    renderBtn()
    const link = screen.getByRole('link')
    const notPrevented = fireEvent.click(link, { ctrlKey: true })
    expect(notPrevented).toBe(true)
    expect(screen.queryByTestId('support-modal')).not.toBeInTheDocument()
  })
})
