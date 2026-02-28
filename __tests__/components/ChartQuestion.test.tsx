import { render, fireEvent } from '@testing-library/react'
import ChartQuestion from '@/components/ChartQuestion'

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user', user_metadata: { full_name: 'Test User' } } })
}))

// Mock PsychometricQuestionEvolution (renderiza nada)
jest.mock('@/components/PsychometricQuestionEvolution', () => {
  return function MockEvolution() { return null }
})

// Mock MarkdownExplanation
jest.mock('@/components/MarkdownExplanation', () => {
  return function MockMarkdown({ content }: { content: string }) {
    return <div data-testid="markdown">{content}</div>
  }
})

const mockQuestion = {
  id: 'q1',
  question_text: '¿Cuál es el valor máximo?',
  option_a: 'Opción A',
  option_b: 'Opción B',
  option_c: 'Opción C',
  option_d: 'Opción D',
  explanation: 'La respuesta es B porque...',
}

describe('ChartQuestion', () => {
  describe('renderizado inicial', () => {
    test('muestra el texto de la pregunta', () => {
      const { getByText } = render(
        <ChartQuestion question={mockQuestion} onAnswer={jest.fn()} selectedAnswer={null} showResult={false} isAnswering={false} />
      )
      expect(getByText('¿Cuál es el valor máximo?')).toBeTruthy()
    })

    test('muestra las 4 opciones', () => {
      const { getByText } = render(
        <ChartQuestion question={mockQuestion} onAnswer={jest.fn()} selectedAnswer={null} showResult={false} isAnswering={false} />
      )
      expect(getByText('Opción A')).toBeTruthy()
      expect(getByText('Opción B')).toBeTruthy()
      expect(getByText('Opción C')).toBeTruthy()
      expect(getByText('Opción D')).toBeTruthy()
    })

    test('muestra botones rápidos A/B/C/D', () => {
      const { container } = render(
        <ChartQuestion question={mockQuestion} onAnswer={jest.fn()} selectedAnswer={null} showResult={false} isAnswering={false} />
      )
      const quickButtons = container.querySelectorAll('.w-14.h-14')
      expect(quickButtons).toHaveLength(4)
    })
  })

  describe('interacción', () => {
    test('llama onAnswer al hacer clic en una opción', () => {
      const onAnswer = jest.fn()
      const { getByText } = render(
        <ChartQuestion question={mockQuestion} onAnswer={onAnswer} selectedAnswer={null} showResult={false} isAnswering={false} />
      )
      fireEvent.click(getByText('Opción B'))
      expect(onAnswer).toHaveBeenCalledWith(1) // index 1 = B
    })

    test('no llama onAnswer si isAnswering=true', () => {
      const onAnswer = jest.fn()
      const { getByText } = render(
        <ChartQuestion question={mockQuestion} onAnswer={onAnswer} selectedAnswer={null} showResult={false} isAnswering={true} />
      )
      fireEvent.click(getByText('Opción A'))
      expect(onAnswer).not.toHaveBeenCalled()
    })

    test('no llama onAnswer si showResult=true', () => {
      const onAnswer = jest.fn()
      const { getByText } = render(
        <ChartQuestion question={mockQuestion} onAnswer={onAnswer} selectedAnswer={0} showResult={true} isAnswering={false} verifiedCorrectAnswer={1} />
      )
      fireEvent.click(getByText('Opción C'))
      expect(onAnswer).not.toHaveBeenCalled()
    })
  })

  describe('resultado', () => {
    test('oculta botones rápidos después de responder', () => {
      const { container } = render(
        <ChartQuestion question={mockQuestion} onAnswer={jest.fn()} selectedAnswer={0} showResult={true} isAnswering={false} verifiedCorrectAnswer={1} />
      )
      const quickButtons = container.querySelectorAll('.w-14.h-14')
      expect(quickButtons).toHaveLength(0)
    })

    test('marca la respuesta correcta en verde', () => {
      const { container } = render(
        <ChartQuestion question={mockQuestion} onAnswer={jest.fn()} selectedAnswer={0} showResult={true} isAnswering={false} verifiedCorrectAnswer={1} />
      )
      const buttons = container.querySelectorAll('button')
      // El botón con index 1 (B) debe tener clase verde
      const correctBtn = buttons[1]
      expect(correctBtn?.className).toContain('border-green-500')
    })

    test('marca la respuesta incorrecta en rojo', () => {
      const { container } = render(
        <ChartQuestion question={mockQuestion} onAnswer={jest.fn()} selectedAnswer={0} showResult={true} isAnswering={false} verifiedCorrectAnswer={1} />
      )
      const buttons = container.querySelectorAll('button')
      const wrongBtn = buttons[0]
      expect(wrongBtn?.className).toContain('border-red-500')
    })

    test('muestra mensaje motivador tras responder', () => {
      const { container } = render(
        <ChartQuestion question={mockQuestion} onAnswer={jest.fn()} selectedAnswer={0} showResult={true} isAnswering={false} verifiedCorrectAnswer={1} />
      )
      // Buscar el mensaje motivador (contiene el nombre del usuario)
      expect(container.textContent).toContain('Test')
    })

    test('muestra explicación verificada cuando existe', () => {
      const { getByTestId } = render(
        <ChartQuestion
          question={mockQuestion}
          onAnswer={jest.fn()}
          selectedAnswer={0}
          showResult={true}
          isAnswering={false}
          verifiedCorrectAnswer={1}
          verifiedExplanation="Explicación verificada"
        />
      )
      expect(getByTestId('markdown').textContent).toBe('Explicación verificada')
    })
  })

  describe('componente gráfico', () => {
    test('renderiza chartComponent cuando se proporciona', () => {
      const chart = <div data-testid="test-chart">Mi gráfico</div>
      const { getByTestId } = render(
        <ChartQuestion question={mockQuestion} onAnswer={jest.fn()} selectedAnswer={null} showResult={false} isAnswering={false} chartComponent={chart} />
      )
      expect(getByTestId('test-chart')).toBeTruthy()
    })
  })
})
