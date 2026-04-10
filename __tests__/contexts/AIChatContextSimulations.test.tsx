// __tests__/contexts/AIChatContextSimulations.test.tsx
//
// Simulaciones end-to-end del flujo completo del chat IA tras el refactor
// de AIChatContext (commit 73b8be02). Cada test reproduce un escenario
// realista y verifica el comportamiento observable.
//
// Estos tests son más pesados que los unitarios: montan un árbol React
// realista con providers anidados, simulan clicks y cambios de estado,
// y verifican el comportamiento final observable (NO detalles internos).
//
// Escenarios cubiertos (8):
//   1. Flujo feliz desde un botón tipo TestLayout con contexto completo
//   2. Regresión del race condition: questionContext via evento sin haber
//      llamado setQuestionContext previamente
//   3. Apertura del chat sin mensaje (Header pattern)
//   4. Dos clicks rápidos: at-most-once delivery y último gana
//   5. Drain diferido cuando el widget está "ocupado"
//   6. Componente fuera del provider: fallback no-op, no crashea
//   7. Pregunta psicotécnica con contentData completo
//   8. Limpieza automática de pendingRequest tras el consumo

import React, { useState, useEffect, useRef } from 'react'
import { render, fireEvent, act, waitFor } from '@testing-library/react'
import {
  AIChatProvider,
  useAIChat,
  type OpenAIChatOptions,
} from '@/contexts/AIChatContext'

// ============================================
// Mock Widget: réplica simplificada de AIChatWidget
//
// Reproduce la lógica esencial del widget real:
// - Lee pendingRequest del context
// - Cuando isOpen && pendingRequest && !isLoading, captura el snapshot,
//   llama a clearPendingRequest() y "envía" el mensaje via una prop
//   onSend que el test observa.
// - Mantiene un flag isLoading interno para simular un envío en curso.
// ============================================

interface MockWidgetProps {
  onSend?: (msg: string, suggestion: string | undefined, qc: any) => void
  /** Si true, simula que el widget está ocupado (no drena) durante N ms */
  busyDurationMs?: number
}

function MockWidget({ onSend, busyDurationMs = 0 }: MockWidgetProps) {
  const { isOpen, pendingRequest, clearPendingRequest } = useAIChat()
  const [isLoading, setIsLoading] = useState(false)
  const sentCountRef = useRef(0)

  useEffect(() => {
    if (isOpen && pendingRequest && !isLoading) {
      // Captura snapshot ANTES de limpiar
      const { message, suggestion, questionContext } = pendingRequest
      clearPendingRequest()
      if (message && onSend) {
        sentCountRef.current++
        onSend(message, suggestion, questionContext)
      }
      if (busyDurationMs > 0) {
        setIsLoading(true)
        setTimeout(() => setIsLoading(false), busyDurationMs)
      }
    }
  }, [isOpen, pendingRequest, isLoading, clearPendingRequest, onSend, busyDurationMs])

  return (
    <div>
      <span data-testid="widget-open">{String(isOpen)}</span>
      <span data-testid="widget-loading">{String(isLoading)}</span>
      <span data-testid="widget-sent-count">{sentCountRef.current}</span>
    </div>
  )
}

// ============================================
// Mock caller: componente que dispara openChatWith con contexto completo
// ============================================

interface ExplainButtonProps {
  questionId: string
  questionText: string
  correct: number
}

function ExplainButton({ questionId, questionText, correct }: ExplainButtonProps) {
  const { openChatWith } = useAIChat()
  return (
    <button
      onClick={() =>
        openChatWith({
          message: `Explícame por qué la respuesta correcta es la ${correct} en: "${questionText}"`,
          suggestion: 'explicar_respuesta',
          questionContext: {
            id: questionId,
            question_text: questionText,
            option_a: 'A',
            option_b: 'B',
            option_c: 'C',
            option_d: 'D',
            correct,
            explanation: 'Porque sí',
            law: 'CE',
            article_number: '14',
          },
        })
      }
    >
      {`Explícame ${questionId}`}
    </button>
  )
}

// ============================================
// Helper: render del stack completo con un callback de envío
// ============================================

function renderStack(
  caller: React.ReactElement,
  opts: { busyDurationMs?: number } = {},
) {
  const sends: Array<{ message: string; suggestion: string | undefined; questionContext: any }> = []
  const onSend = (message: string, suggestion: string | undefined, questionContext: any) => {
    sends.push({ message, suggestion, questionContext })
  }

  const result = render(
    <AIChatProvider>
      {caller}
      <MockWidget onSend={onSend} busyDurationMs={opts.busyDurationMs} />
    </AIChatProvider>,
  )

  return { ...result, sends }
}

// ============================================
// ESCENARIO 1: Flujo feliz desde botón con contexto completo
// ============================================

describe('Escenario 1: flujo feliz TestLayout-style', () => {
  it('click en ExplainButton → widget recibe mensaje con questionContext completo', async () => {
    const { getByText, getByTestId, sends } = renderStack(
      <ExplainButton questionId="q1" questionText="¿Cuál es la capital de España?" correct={0} />,
    )

    expect(getByTestId('widget-open').textContent).toBe('false')
    expect(sends).toHaveLength(0)

    fireEvent.click(getByText('Explícame q1'))

    await waitFor(() => {
      expect(getByTestId('widget-open').textContent).toBe('true')
      expect(sends).toHaveLength(1)
    })

    const sent = sends[0]
    expect(sent.message).toContain('¿Cuál es la capital de España?')
    expect(sent.suggestion).toBe('explicar_respuesta')
    expect(sent.questionContext).toBeDefined()
    expect(sent.questionContext.id).toBe('q1')
    expect(sent.questionContext.question_text).toBe('¿Cuál es la capital de España?')
    expect(sent.questionContext.option_a).toBe('A')
    expect(sent.questionContext.option_d).toBe('D')
    expect(sent.questionContext.correct).toBe(0)
    expect(sent.questionContext.law).toBe('CE')
    expect(sent.questionContext.article_number).toBe('14')
  })
})

// ============================================
// ESCENARIO 2: Regresión del race condition original
// ============================================

describe('Escenario 2: regresión race condition', () => {
  it('openChatWith funciona AUNQUE nadie haya llamado a setQuestionContext previamente', async () => {
    // CLAVE: No hay QuestionProvider en el árbol. El context del provider
    // vendría null. En el patrón viejo, el widget leía currentQuestionContext
    // del provider → null → warning en server.
    // En el patrón nuevo, el context viaja en el evento y el widget lo usa
    // directamente sin consultar el provider.
    const { getByText, sends } = renderStack(
      <ExplainButton questionId="q-race" questionText="Pregunta race" correct={2} />,
    )

    fireEvent.click(getByText('Explícame q-race'))

    await waitFor(() => {
      expect(sends).toHaveLength(1)
    })

    // El questionContext llega con todos los datos, NO null
    expect(sends[0].questionContext).toBeDefined()
    expect(sends[0].questionContext.id).toBe('q-race')
    expect(sends[0].questionContext.question_text).toBe('Pregunta race')
    expect(sends[0].questionContext.correct).toBe(2)
  })

  it('si openChatWith se llama antes de que React re-renderice, el consumer lo recibe en el siguiente tick', async () => {
    // Simular un caller que dispara openChatWith inmediatamente al montar
    // (caso extremo: el patrón viejo fallaba aquí porque setQuestionContext
    // aún no había propagado).
    function AutoOpener() {
      const { openChatWith } = useAIChat()
      useEffect(() => {
        openChatWith({
          message: 'auto',
          suggestion: 'explicar_respuesta',
          questionContext: { id: 'auto-id', question_text: 'auto text' },
        })
      }, [openChatWith])
      return null
    }

    const { sends } = renderStack(<AutoOpener />)

    await waitFor(() => {
      expect(sends).toHaveLength(1)
    })
    expect(sends[0].questionContext.id).toBe('auto-id')
  })
})

// ============================================
// ESCENARIO 3: Apertura del chat sin mensaje (Header)
// ============================================

describe('Escenario 3: apertura vacía desde Header', () => {
  it('openChat() abre el widget sin enviar ningún mensaje', async () => {
    function HeaderButton() {
      const { openChat } = useAIChat()
      return <button onClick={openChat}>Vence AI</button>
    }

    const { getByText, getByTestId, sends } = renderStack(<HeaderButton />)

    expect(getByTestId('widget-open').textContent).toBe('false')

    fireEvent.click(getByText('Vence AI'))

    await waitFor(() => {
      expect(getByTestId('widget-open').textContent).toBe('true')
    })

    // No se envía nada
    expect(sends).toHaveLength(0)
  })

  it('openChat seguido de openChatWith envía solo el segundo', async () => {
    function DualButton() {
      const { openChat, openChatWith } = useAIChat()
      return (
        <>
          <button onClick={openChat}>abrir</button>
          <button
            onClick={() =>
              openChatWith({
                message: 'después',
                questionContext: { id: 'd1' },
              })
            }
          >
            con-mensaje
          </button>
        </>
      )
    }

    const { getByText, sends } = renderStack(<DualButton />)

    fireEvent.click(getByText('abrir'))
    await waitFor(() => expect(sends).toHaveLength(0))

    fireEvent.click(getByText('con-mensaje'))
    await waitFor(() => expect(sends).toHaveLength(1))
    expect(sends[0].message).toBe('después')
  })
})

// ============================================
// ESCENARIO 4: Dos clicks rápidos, at-most-once y último gana
// ============================================

describe('Escenario 4: dos clicks rápidos antes del drain', () => {
  it('click A seguido de click B antes del drain → envía solo B (el último gana)', async () => {
    // El widget está "ocupado" 200ms tras cada envío para simular una
    // pequeña ventana donde los clicks se pueden acumular.
    const { getByText, sends } = renderStack(
      <>
        <ExplainButton questionId="qA" questionText="pregunta A" correct={0} />
        <ExplainButton questionId="qB" questionText="pregunta B" correct={1} />
      </>,
      { busyDurationMs: 300 },
    )

    // Click sincronizados en el mismo tick de React
    act(() => {
      fireEvent.click(getByText('Explícame qA'))
      fireEvent.click(getByText('Explícame qB'))
    })

    await waitFor(() => {
      expect(sends.length).toBeGreaterThanOrEqual(1)
    })

    // Con dos clicks sincronizados, el último openChatWith sustituye el
    // pendingRequest del primero ANTES de que el widget drene. Por tanto:
    // sends[0] debe ser qB, no qA.
    expect(sends[0].questionContext.id).toBe('qB')
    expect(sends[0].questionContext.correct).toBe(1)
  })
})

// ============================================
// ESCENARIO 5: Drain diferido cuando el widget está ocupado
// ============================================

describe('Escenario 5: drain diferido', () => {
  it('click durante envío previo → queda pendiente y se envía cuando se libera', async () => {
    jest.useFakeTimers()

    const sends: Array<any> = []
    const onSend = (message: string, suggestion: any, qc: any) => {
      sends.push({ message, suggestion, qc })
    }

    const { getByText, getByTestId } = render(
      <AIChatProvider>
        <ExplainButton questionId="q1" questionText="primera" correct={0} />
        <ExplainButton questionId="q2" questionText="segunda" correct={1} />
        <MockWidget onSend={onSend} busyDurationMs={500} />
      </AIChatProvider>,
    )

    // Primer click → envía q1 inmediatamente, widget queda isLoading
    act(() => {
      fireEvent.click(getByText('Explícame q1'))
    })
    expect(sends).toHaveLength(1)
    expect(sends[0].qc.id).toBe('q1')
    expect(getByTestId('widget-loading').textContent).toBe('true')

    // Segundo click → openChatWith setea pendingRequest pero el widget NO
    // drena porque isLoading=true
    act(() => {
      fireEvent.click(getByText('Explícame q2'))
    })
    // Todavía solo 1 envío
    expect(sends).toHaveLength(1)

    // Avanzar el tiempo para que el widget deje de estar ocupado
    act(() => {
      jest.advanceTimersByTime(600)
    })

    // Ahora el widget debe haber drenado q2
    expect(sends).toHaveLength(2)
    expect(sends[1].qc.id).toBe('q2')

    jest.useRealTimers()
  })
})

// ============================================
// ESCENARIO 6: Fuera del provider no crashea
// ============================================

describe('Escenario 6: fallback fuera del AIChatProvider', () => {
  it('ExplainButton renderizado sin AIChatProvider no crashea al hacer click', () => {
    // No envolvemos en AIChatProvider — el hook cae al fallback no-op
    const { getByText } = render(
      <ExplainButton questionId="orphan" questionText="huérfano" correct={0} />,
    )

    expect(() => {
      fireEvent.click(getByText('Explícame orphan'))
    }).not.toThrow()
  })
})

// ============================================
// ESCENARIO 7: Pregunta psicotécnica con contentData
// ============================================

describe('Escenario 7: pregunta psicotécnica', () => {
  function PsicoButton() {
    const { openChatWith } = useAIChat()
    return (
      <button
        onClick={() =>
          openChatWith({
            message: 'Explícame esta serie',
            suggestion: 'explicar_psico',
            questionContext: {
              id: 'psy-1',
              question_text: '2, 4, 8, ?',
              option_a: '10',
              option_b: '12',
              option_c: '16',
              option_d: '18',
              isPsicotecnico: true,
              questionSubtype: 'sequence_numeric',
              contentData: { series: [2, 4, 8], next_hint: 'doblando' },
            },
          })
        }
      >
        psico
      </button>
    )
  }

  it('propaga contentData, questionSubtype e isPsicotecnico al widget', async () => {
    const { getByText, sends } = renderStack(<PsicoButton />)

    fireEvent.click(getByText('psico'))

    await waitFor(() => {
      expect(sends).toHaveLength(1)
    })

    const qc = sends[0].questionContext
    expect(qc.isPsicotecnico).toBe(true)
    expect(qc.questionSubtype).toBe('sequence_numeric')
    expect(qc.contentData).toEqual({ series: [2, 4, 8], next_hint: 'doblando' })
    expect(sends[0].suggestion).toBe('explicar_psico')
  })
})

// ============================================
// ESCENARIO 8: Limpieza automática de pendingRequest tras consumo
// ============================================

describe('Escenario 8: limpieza automática post-drain', () => {
  it('tras enviar, pendingRequest queda null y un re-render no reenvía', async () => {
    const { getByText, sends, rerender } = renderStack(
      <ExplainButton questionId="once" questionText="solo una vez" correct={0} />,
    )

    fireEvent.click(getByText('Explícame once'))

    await waitFor(() => {
      expect(sends).toHaveLength(1)
    })

    // Forzar re-renders y verificar que NO hay reenvíos
    rerender(
      <AIChatProvider>
        <ExplainButton questionId="once" questionText="solo una vez" correct={0} />
        <MockWidget
          onSend={(m, s, q) => sends.push({ message: m, suggestion: s, questionContext: q })}
        />
      </AIChatProvider>,
    )

    // Esperar por si acaso algún useEffect dispara de más
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(sends).toHaveLength(1) // sigue siendo 1
  })
})
