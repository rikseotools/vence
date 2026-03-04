import { render, fireEvent } from '@testing-library/react'
import PsychometricAIHelpButton from '@/components/PsychometricAIHelpButton'

const baseQuestion = {
  question_text: '¿Cuál es el siguiente número?',
  option_a: '10',
  option_b: '12',
  option_c: '14',
  option_d: '16',
}

describe('PsychometricAIHelpButton', () => {
  test('renderiza texto "¿Necesitas ayuda?"', () => {
    const { getByText } = render(
      <PsychometricAIHelpButton question={baseQuestion} />
    )
    expect(getByText('¿Necesitas ayuda?')).toBeTruthy()
  })

  test('dispara CustomEvent openAIChat al click con detail correcto', () => {
    const handler = jest.fn()
    window.addEventListener('openAIChat', handler)

    const { getByText } = render(
      <PsychometricAIHelpButton question={baseQuestion} questionTypeLabel="Serie numérica" />
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail.suggestion).toBe('explicar_psico')
    expect(event.detail.message).toContain('Serie numérica')
    expect(event.detail.message).toContain('¿Cuál es el siguiente número?')
    expect(event.detail.message).toContain('A) 10')
    expect(event.detail.message).toContain('D) 16')

    window.removeEventListener('openAIChat', handler)
  })

  test('auto-detecta tipo por question_subtype', () => {
    const handler = jest.fn()
    window.addEventListener('openAIChat', handler)

    const q = { ...baseQuestion, question_subtype: 'sequence_letter' }
    const { getByText } = render(
      <PsychometricAIHelpButton question={q} />
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail.message).toContain('Serie alfabética')

    window.removeEventListener('openAIChat', handler)
  })

  test('incluye original_text para error_detection', () => {
    const handler = jest.fn()
    window.addEventListener('openAIChat', handler)

    const q = {
      ...baseQuestion,
      question_subtype: 'error_detection',
      content_data: { original_text: 'El perro corrio por el parque' }
    }
    const { getByText } = render(
      <PsychometricAIHelpButton question={q} />
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail.message).toContain('El perro corrio por el parque')

    window.removeEventListener('openAIChat', handler)
  })

  test('incluye datos de tabla para data_tables', () => {
    const handler = jest.fn()
    window.addEventListener('openAIChat', handler)

    const q = {
      ...baseQuestion,
      question_subtype: 'data_tables',
      content_data: {
        table_data: {
          title: 'Ventas anuales',
          headers: ['Mes', 'Total'],
          rows: [['Enero', '100'], ['Febrero', '200']]
        }
      }
    }
    const { getByText } = render(
      <PsychometricAIHelpButton question={q} />
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail.message).toContain('Ventas anuales')
    expect(event.detail.message).toContain('Enero | 100')

    window.removeEventListener('openAIChat', handler)
  })

  test('aplica className adicional', () => {
    const { container } = render(
      <PsychometricAIHelpButton question={baseQuestion} className="ml-auto mt-4" />
    )
    const button = container.querySelector('button')
    expect(button?.className).toContain('ml-auto')
    expect(button?.className).toContain('mt-4')
  })
})
