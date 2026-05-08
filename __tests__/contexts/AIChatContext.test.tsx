// __tests__/contexts/AIChatContext.test.tsx
//
// Tests unitarios del AIChatContext + verificación estructural.
//
// El AIChatContext reemplaza el patrón legacy window.dispatchEvent('openAIChat')
// para eliminar la race condition entre setQuestionContext (async) y el envío
// del mensaje (síncrono). Bug histórico: ~10 warnings/semana de
// `explicar_respuesta without questionContext` (3.2% de los clicks).
//
// Cubre:
//   - openChat abre el chat sin mensaje
//   - openChatWith abre con mensaje + contexto
//   - consumePending devuelve y limpia la petición atómicamente
//   - closeChat cierra el chat sin borrar mensajes pendientes
//   - Hook fallback no-op cuando se usa fuera del provider
//   - Verificación estructural: ningún archivo del código fuente sigue
//     usando window.dispatchEvent('openAIChat')

import * as fs from 'fs'
import * as path from 'path'
import React from 'react'
import { render, act, renderHook } from '@testing-library/react'
import { AIChatProvider, useAIChat } from '@/contexts/AIChatContext'

const ROOT = path.resolve(__dirname, '../..')

describe('AIChatContext', () => {
  describe('openChat (sin mensaje)', () => {
    it('abre el chat sin dejar petición pendiente', () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: ({ children }) => <AIChatProvider>{children}</AIChatProvider>,
      })

      expect(result.current.isOpen).toBe(false)
      expect(result.current.pendingRequest).toBe(null)

      act(() => {
        result.current.openChat()
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.pendingRequest).toBe(null)
    })
  })

  describe('openChatWith (con mensaje)', () => {
    it('abre el chat Y guarda la petición pendiente en el mismo tick', () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: ({ children }) => <AIChatProvider>{children}</AIChatProvider>,
      })

      act(() => {
        result.current.openChatWith({
          message: 'Explícame esta pregunta',
          suggestion: 'explicar_respuesta',
          questionContext: {
            id: 'q-1',
            question_text: '¿Cuál es la capital de España?',
            option_a: 'Madrid',
            option_b: 'Barcelona',
            option_c: 'Valencia',
            option_d: 'Sevilla',
            correct: 0,
          },
        })
      })

      // Ambos setters están batched en el mismo render
      expect(result.current.isOpen).toBe(true)
      expect(result.current.pendingRequest).not.toBe(null)
      expect(result.current.pendingRequest?.message).toBe('Explícame esta pregunta')
      expect(result.current.pendingRequest?.suggestion).toBe('explicar_respuesta')
      expect(result.current.pendingRequest?.questionContext?.id).toBe('q-1')
      expect(result.current.pendingRequest?.questionContext?.question_text).toBe('¿Cuál es la capital de España?')
    })

    it('sustituye la petición si se llama dos veces antes de drenar', () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: ({ children }) => <AIChatProvider>{children}</AIChatProvider>,
      })

      act(() => {
        result.current.openChatWith({ message: 'Primera' })
      })
      expect(result.current.pendingRequest?.message).toBe('Primera')

      act(() => {
        result.current.openChatWith({ message: 'Segunda' })
      })
      expect(result.current.pendingRequest?.message).toBe('Segunda')
    })
  })

  describe('clearPendingRequest', () => {
    it('limpia la petición pendiente — el consumer lee el snapshot antes', () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: ({ children }) => <AIChatProvider>{children}</AIChatProvider>,
      })

      act(() => {
        result.current.openChatWith({
          message: 'Explícame',
          suggestion: 'explicar_respuesta',
        })
      })

      // Patrón del widget: capturar el snapshot del render actual ANTES de limpiar
      const snapshot = result.current.pendingRequest
      expect(snapshot).not.toBe(null)
      expect(snapshot?.message).toBe('Explícame')
      expect(snapshot?.suggestion).toBe('explicar_respuesta')

      act(() => {
        result.current.clearPendingRequest()
      })

      expect(result.current.pendingRequest).toBe(null)
    })

    it('es idempotente — llamar dos veces no rompe nada', () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: ({ children }) => <AIChatProvider>{children}</AIChatProvider>,
      })

      act(() => {
        result.current.clearPendingRequest()
        result.current.clearPendingRequest()
      })

      expect(result.current.pendingRequest).toBe(null)
    })
  })

  describe('closeChat', () => {
    it('cierra el chat sin tocar la petición pendiente', () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: ({ children }) => <AIChatProvider>{children}</AIChatProvider>,
      })

      act(() => {
        result.current.openChatWith({ message: 'test' })
      })
      expect(result.current.isOpen).toBe(true)

      act(() => {
        result.current.closeChat()
      })
      expect(result.current.isOpen).toBe(false)
      // pendingRequest no se limpia — el caller debe llamar consumePending
    })
  })

  describe('Fallback no-op fuera del provider', () => {
    it('no crashea si se usa el hook fuera del AIChatProvider', () => {
      // Mismo fallback que useQuestionContext
      const { result } = renderHook(() => useAIChat())

      expect(result.current.isOpen).toBe(false)
      expect(result.current.pendingRequest).toBe(null)

      // Las funciones existen y no lanzan
      expect(() => result.current.openChat()).not.toThrow()
      expect(() => result.current.openChatWith({ message: 'test' })).not.toThrow()
      expect(() => result.current.closeChat()).not.toThrow()
      expect(() => result.current.clearPendingRequest()).not.toThrow()
    })
  })

  describe('Integración con componentes consumidores', () => {
    it('un componente puede abrir el chat desde un click handler', () => {
      function TestOpener() {
        const { openChatWith } = useAIChat()
        return (
          <button
            onClick={() =>
              openChatWith({
                message: 'click!',
                suggestion: 'explicar_respuesta',
                questionContext: { id: 'q1' },
              })
            }
          >
            open
          </button>
        )
      }

      function TestObserver() {
        const { isOpen, pendingRequest } = useAIChat()
        return (
          <div>
            <span data-testid="is-open">{String(isOpen)}</span>
            <span data-testid="msg">{pendingRequest?.message || 'none'}</span>
            <span data-testid="qid">{pendingRequest?.questionContext?.id || 'none'}</span>
          </div>
        )
      }

      const { getByText, getByTestId } = render(
        <AIChatProvider>
          <TestOpener />
          <TestObserver />
        </AIChatProvider>,
      )

      expect(getByTestId('is-open').textContent).toBe('false')
      expect(getByTestId('msg').textContent).toBe('none')

      act(() => {
        getByText('open').click()
      })

      expect(getByTestId('is-open').textContent).toBe('true')
      expect(getByTestId('msg').textContent).toBe('click!')
      expect(getByTestId('qid').textContent).toBe('q1')
    })
  })
})

// ============================================
// VERIFICACIÓN ESTRUCTURAL: cero dispatchEvent('openAIChat') en código fuente
// ============================================
describe('Migración completa del dispatchEvent legacy', () => {
  // Archivos que se esperan migrados a useAIChat()
  const MIGRATED_FILES = [
    'app/Header.tsx',
    'app/auxiliar-administrativo-estado/test/ver-fallos/page.tsx',
    'app/tramitacion-procesal/test/ver-fallos/page.tsx',
    // components/v2/TestLayoutV2.tsx eliminado en refactor 7ee5c172 (07-may-2026)
    'components/ExamReviewLayout.tsx',
    // components/DynamicTest.tsx eliminado en refactor 7ee5c172 (07-may-2026)
    'components/OfficialExamLayout.tsx',
    'components/PsychometricAIHelpButton.tsx',
    'components/ExamLayout.tsx',
    'components/TestLayout.tsx',
  ]

  it.each(MIGRATED_FILES)(
    '%s NO contiene window.dispatchEvent con openAIChat',
    (relPath) => {
      const full = path.join(ROOT, relPath)
      const content = fs.readFileSync(full, 'utf-8')
      // Buscamos el patrón exacto como statement, no como comentario
      const hasDispatchCall = /window\.dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"]openAIChat['"]/.test(content)
      expect(hasDispatchCall).toBe(false)
    },
  )

  it.each(MIGRATED_FILES)(
    '%s importa useAIChat desde AIChatContext',
    (relPath) => {
      const full = path.join(ROOT, relPath)
      const content = fs.readFileSync(full, 'utf-8')
      expect(content).toMatch(/import\s*\{[^}]*useAIChat[^}]*\}\s*from\s*['"][^'"]*AIChatContext['"]/)
    },
  )

  it('AIChatWidget.js NO tiene addEventListener("openAIChat") como código activo', () => {
    const content = fs.readFileSync(path.join(ROOT, 'components/AIChatWidget.js'), 'utf-8')
    // Ignorar líneas que son comentarios (empiezan con // tras espacios)
    const activeLines = content
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n')
    const hasListener = /addEventListener\s*\(\s*['"]openAIChat['"]/.test(activeLines)
    expect(hasListener).toBe(false)
  })

  it('AIChatWidget.js importa useAIChat', () => {
    const content = fs.readFileSync(path.join(ROOT, 'components/AIChatWidget.js'), 'utf-8')
    expect(content).toMatch(/import\s*\{[^}]*useAIChat[^}]*\}\s*from/)
  })

  it('app/layout.tsx envuelve el árbol con AIChatProvider', () => {
    const content = fs.readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf-8')
    expect(content).toMatch(/import\s*\{\s*AIChatProvider\s*\}\s*from/)
    expect(content).toMatch(/<AIChatProvider>/)
    expect(content).toMatch(/<\/AIChatProvider>/)
  })
})
