import { render } from '@testing-library/react'
import ExamLoadingIndicator from '@/components/ExamLoadingIndicator'

describe('ExamLoadingIndicator', () => {
  test('renderiza con valores por defecto', () => {
    const { container, getByText } = render(<ExamLoadingIndicator />)
    expect(getByText('Preparando test en modo examen')).toBeTruthy()
    expect(getByText('25')).toBeTruthy() // numQuestions default
  })

  test('muestra número de preguntas custom', () => {
    const { getByText } = render(<ExamLoadingIndicator numQuestions={40} />)
    expect(getByText('40')).toBeTruthy()
  })

  test('muestra número de temas', () => {
    const { getByText } = render(<ExamLoadingIndicator numThemes={3} />)
    expect(getByText('3 temas mezclados')).toBeTruthy()
  })

  test('muestra "1 tema" en singular', () => {
    const { getByText } = render(<ExamLoadingIndicator numThemes={1} />)
    expect(getByText('1 tema')).toBeTruthy()
  })

  test('muestra progreso real cuando se pasa progress', () => {
    const progress = {
      currentPhase: 'processing_laws',
      currentMapping: 3,
      totalMappings: 10,
      currentLaw: 'CE',
      questionsFound: 45,
      message: 'Buscando preguntas...',
    }
    const { getByText } = render(<ExamLoadingIndicator progress={progress} />)
    expect(getByText('Buscando preguntas disponibles')).toBeTruthy()
    expect(getByText('3/10')).toBeTruthy()
    expect(getByText('45')).toBeTruthy()
  })

  test('muestra fase de selección', () => {
    const progress = {
      currentPhase: 'selecting',
      currentMapping: 5,
      totalMappings: 5,
      currentLaw: '',
      questionsFound: 100,
      message: 'Seleccionando...',
    }
    const { getByText } = render(
      <ExamLoadingIndicator numQuestions={20} progress={progress} />
    )
    expect(getByText('Seleccionando preguntas proporcionalmente')).toBeTruthy()
    expect(getByText(/20 de 100/)).toBeTruthy()
  })

  test('tiene barra de progreso', () => {
    const { container } = render(<ExamLoadingIndicator />)
    const progressBar = container.querySelector('.bg-gradient-to-r')
    expect(progressBar).not.toBeNull()
  })

  test('muestra animación de actividad (3 dots)', () => {
    const { container } = render(<ExamLoadingIndicator />)
    const dots = container.querySelectorAll('.animate-pulse')
    expect(dots.length).toBe(3)
  })
})
