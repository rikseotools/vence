import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import PsychometricAIHelpButton from '@/components/PsychometricAIHelpButton'
import { AIChatProvider, useAIChat, type OpenAIChatOptions } from '@/contexts/AIChatContext'

const baseQuestion = {
  question_text: '¿Cuál es el siguiente número?',
  option_a: '10',
  option_b: '12',
  option_c: '14',
  option_d: '16',
}

/**
 * Helper: envuelve el componente en AIChatProvider + un observer que expone
 * el `pendingRequest` como data-testid, para que los tests puedan verificar
 * el payload que el botón envió al chat.
 */
function renderWithChatObserver(ui: React.ReactElement) {
  let lastOptions: OpenAIChatOptions | null = null
  function Observer() {
    const { pendingRequest } = useAIChat()
    if (pendingRequest) lastOptions = pendingRequest
    return null
  }
  const result = render(
    <AIChatProvider>
      {ui}
      <Observer />
    </AIChatProvider>,
  )
  return { ...result, getLastOptions: () => lastOptions }
}

describe('PsychometricAIHelpButton', () => {
  test('renderiza texto "¿Necesitas ayuda?"', () => {
    const { getByText } = render(
      <AIChatProvider>
        <PsychometricAIHelpButton question={baseQuestion} />
      </AIChatProvider>,
    )
    expect(getByText('¿Necesitas ayuda?')).toBeTruthy()
  })

  test('llama a openChatWith al click con message + suggestion correctos', () => {
    const { getByText, getLastOptions } = renderWithChatObserver(
      <PsychometricAIHelpButton question={baseQuestion} questionTypeLabel="Serie numérica" />,
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    const opts = getLastOptions()
    expect(opts).not.toBe(null)
    expect(opts?.suggestion).toBe('explicar_psico')
    expect(opts?.message).toContain('Serie numérica')
    expect(opts?.message).toContain('¿Cuál es el siguiente número?')
    expect(opts?.message).toContain('A) 10')
    expect(opts?.message).toContain('D) 16')
  })

  test('auto-detecta tipo por question_subtype', () => {
    const q = { ...baseQuestion, question_subtype: 'sequence_letter' }
    const { getByText, getLastOptions } = renderWithChatObserver(
      <PsychometricAIHelpButton question={q} />,
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    expect(getLastOptions()?.message).toContain('Serie alfabética')
  })

  test('incluye original_text para error_detection', () => {
    const q = {
      ...baseQuestion,
      question_subtype: 'error_detection',
      content_data: { original_text: 'El perro corrio por el parque' },
    }
    const { getByText, getLastOptions } = renderWithChatObserver(
      <PsychometricAIHelpButton question={q} />,
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    expect(getLastOptions()?.message).toContain('El perro corrio por el parque')
  })

  test('incluye datos de tabla para data_tables', () => {
    const q = {
      ...baseQuestion,
      question_subtype: 'data_tables',
      content_data: {
        table_data: {
          title: 'Ventas anuales',
          headers: ['Mes', 'Total'],
          rows: [['Enero', '100'], ['Febrero', '200']],
        },
      },
    }
    const { getByText, getLastOptions } = renderWithChatObserver(
      <PsychometricAIHelpButton question={q} />,
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    const opts = getLastOptions()
    expect(opts?.message).toContain('Ventas anuales')
    expect(opts?.message).toContain('Enero | 100')
  })

  test('pasa questionContext cuando la question tiene id', () => {
    const q = {
      ...baseQuestion,
      id: 'q-123',
      question_subtype: 'sequence_numeric',
    }
    const { getByText, getLastOptions } = renderWithChatObserver(
      <PsychometricAIHelpButton question={q} />,
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    const opts = getLastOptions()
    expect(opts?.questionContext).toBeDefined()
    expect(opts?.questionContext?.id).toBe('q-123')
    expect(opts?.questionContext?.isPsicotecnico).toBe(true)
    expect(opts?.questionContext?.questionSubtype).toBe('sequence_numeric')
  })

  test('NO pasa questionContext cuando la question NO tiene id (fallback al provider)', () => {
    const { getByText, getLastOptions } = renderWithChatObserver(
      <PsychometricAIHelpButton question={baseQuestion} questionTypeLabel="Serie numérica" />,
    )
    fireEvent.click(getByText('¿Necesitas ayuda?'))

    expect(getLastOptions()?.questionContext).toBeUndefined()
  })

  test('aplica className adicional', () => {
    const { container } = render(
      <AIChatProvider>
        <PsychometricAIHelpButton question={baseQuestion} className="ml-auto mt-4" />
      </AIChatProvider>,
    )
    const button = container.querySelector('button')
    expect(button?.className).toContain('ml-auto')
    expect(button?.className).toContain('mt-4')
  })
})
