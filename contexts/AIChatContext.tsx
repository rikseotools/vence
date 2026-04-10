'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { QuestionContextData } from './QuestionContext'

// ============================================
// TIPOS
// ============================================

/**
 * Opciones para abrir el chat IA.
 *
 * Diseño clave: el `questionContext` se pasa DIRECTAMENTE en esta llamada,
 * no vía un provider asíncrono separado. Esto elimina la race condition
 * histórica (10/04/2026) donde `setQuestionContext` (React setState) no
 * se había propagado cuando el chat empezaba a enviar el mensaje, haciendo
 * que `explicar_respuesta` llegara al server con contexto vacío.
 *
 * Al viajar el contexto en el mismo objeto síncrono que el mensaje, el
 * widget lo lee en el siguiente render garantizado por React.
 */
export interface OpenAIChatOptions {
  /** Mensaje pre-rellenado que se envía automáticamente al abrir. */
  message?: string
  /** Clave de sugerencia (para tracking y para marcar el intent en el server). */
  suggestion?: string
  /**
   * Contexto de la pregunta actual. Misma forma que `QuestionContextData`
   * de `QuestionContext.tsx` para poder reutilizar el normalizer.
   */
  questionContext?: QuestionContextData
}

export interface AIChatContextValue {
  /** El widget está desplegado (expandido) en la UI. */
  isOpen: boolean
  /**
   * Petición pendiente: mensaje a enviar automáticamente al abrir + contexto
   * opcional. El widget la lee del render actual y llama a
   * `clearPendingRequest()` tras capturar los datos para evitar reenvíos.
   */
  pendingRequest: OpenAIChatOptions | null
  /** Abre el chat vacío (sin mensaje). Para uso del Header o accesos directos. */
  openChat: () => void
  /**
   * Abre el chat con un mensaje pre-rellenado, opcionalmente asociado a
   * una sugerencia y a un contexto de pregunta. El widget enviará el
   * mensaje en cuanto esté listo.
   */
  openChatWith: (opts: OpenAIChatOptions) => void
  /**
   * Cierra el chat. No borra el historial de mensajes — solo colapsa el
   * widget. Si se vuelve a abrir con `openChat()`, conserva los mensajes.
   */
  closeChat: () => void
  /**
   * Limpia la petición pendiente. El widget la llama tras capturar
   * `pendingRequest` del render actual y antes de enviar, para evitar
   * reenvíos en siguientes renders.
   */
  clearPendingRequest: () => void
}

// ============================================
// CONTEXT
// ============================================

const AIChatContext = createContext<AIChatContextValue | null>(null)

/**
 * Provider del chat IA. Debe envolver al `AIChatWidget` Y a todos los
 * componentes que quieran abrir el chat (tests, layouts, páginas de
 * review). Idealmente se coloca en `app/layout.tsx` al mismo nivel que
 * `QuestionProvider`.
 */
export function AIChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<OpenAIChatOptions | null>(null)

  const openChat = useCallback(() => {
    setIsOpen(true)
  }, [])

  const openChatWith = useCallback((opts: OpenAIChatOptions) => {
    // IMPORTANTE: ambos setters en la misma función → React los batcha en el
    // mismo render (automatic batching en React 18+). El widget ve `isOpen=true`
    // Y `pendingRequest={...}` en el mismo render, síncronamente. No hay
    // ventana de race condition posible.
    setPendingRequest(opts)
    setIsOpen(true)
  }, [])

  const closeChat = useCallback(() => {
    setIsOpen(false)
  }, [])

  const clearPendingRequest = useCallback(() => {
    setPendingRequest(null)
  }, [])

  return (
    <AIChatContext.Provider
      value={{
        isOpen,
        pendingRequest,
        openChat,
        openChatWith,
        closeChat,
        clearPendingRequest,
      }}
    >
      {children}
    </AIChatContext.Provider>
  )
}

/**
 * Hook para interactuar con el chat IA desde cualquier componente cliente.
 *
 * Fallback no-op si se usa fuera del provider (misma política que
 * `useQuestionContext` en `QuestionContext.tsx`). Esto evita crashes en
 * páginas de marketing o server components que monten algo que use el hook.
 */
export function useAIChat(): AIChatContextValue {
  const ctx = useContext(AIChatContext)
  if (!ctx) {
    return {
      isOpen: false,
      pendingRequest: null,
      openChat: () => {},
      openChatWith: () => {},
      closeChat: () => {},
      clearPendingRequest: () => {},
    }
  }
  return ctx
}
