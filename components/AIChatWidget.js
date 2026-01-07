'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuestionContext } from '../contexts/QuestionContext'
import { useOposicion } from '../contexts/OposicionContext'
import { useAuth } from '../contexts/AuthContext'

export default function AIChatWidget() {
  const { currentQuestionContext } = useQuestionContext()
  const { userOposicion } = useOposicion()
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  // Estado para flujo de creación de test
  const [testFlowState, setTestFlowState] = useState(null) // null | 'asking' | 'selecting_laws'
  const [availableLaws, setAvailableLaws] = useState([])
  const [selectedLaws, setSelectedLaws] = useState([])
  const [suggestionUsed, setSuggestionUsed] = useState(null) // Para tracking de sugerencias
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)
  const lastScrollRef = useRef(0)
  const contentBufferRef = useRef('')
  const lastUpdateRef = useRef(0)

  // Scroll al último mensaje (throttled durante streaming)
  useEffect(() => {
    if (messagesEndRef.current) {
      const now = Date.now()
      // Durante streaming, solo scroll cada 300ms para no marear
      if (isStreaming) {
        if (now - lastScrollRef.current > 300) {
          lastScrollRef.current = now
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      } else {
        // Cuando termina, scroll final
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages, isStreaming])

  // Focus en input al abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Cancelar streaming si se cierra el chat
  useEffect(() => {
    if (!isOpen && abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [isOpen])

  const sendMessage = useCallback(async (messageOverride = null, suggestionLabel = null) => {
    const userMessage = (messageOverride || input).trim()
    if (!userMessage || isLoading || isStreaming) return

    const currentSuggestion = suggestionLabel || suggestionUsed
    setInput('')
    setError(null)
    setSuggestionUsed(null) // Resetear después de usar

    // Añadir mensaje del usuario y placeholder para respuesta
    const newMessages = [
      ...messages,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '', sources: [], isStreaming: true }
    ]
    setMessages(newMessages)
    setIsLoading(true)
    setIsStreaming(true)

    // Resetear refs para nueva conversación
    contentBufferRef.current = ''
    lastUpdateRef.current = 0

    // Crear AbortController para poder cancelar
    abortControllerRef.current = new AbortController()

    try {
      // Limpiar el contexto de pregunta - extraer SOLO valores primitivos
      let cleanQuestionContext = null
      if (currentQuestionContext) {
        try {
          cleanQuestionContext = {
            id: currentQuestionContext.id ? String(currentQuestionContext.id) : null,
            questionText: currentQuestionContext.questionText ? String(currentQuestionContext.questionText) : null,
            options: currentQuestionContext.options ? {
              a: currentQuestionContext.options.a ? String(currentQuestionContext.options.a) : '',
              b: currentQuestionContext.options.b ? String(currentQuestionContext.options.b) : '',
              c: currentQuestionContext.options.c ? String(currentQuestionContext.options.c) : '',
              d: currentQuestionContext.options.d ? String(currentQuestionContext.options.d) : ''
            } : null,
            correctAnswer: currentQuestionContext.correctAnswer ? String(currentQuestionContext.correctAnswer) : null,
            explanation: currentQuestionContext.explanation ? String(currentQuestionContext.explanation) : null,
            lawName: currentQuestionContext.lawName ? String(currentQuestionContext.lawName) : null,
            articleNumber: currentQuestionContext.articleNumber ? String(currentQuestionContext.articleNumber) : null,
            difficulty: currentQuestionContext.difficulty ? String(currentQuestionContext.difficulty) : null,
            source: currentQuestionContext.source ? String(currentQuestionContext.source) : null
          }
        } catch (e) {
          console.error('❌ Error limpiando questionContext:', e)
          cleanQuestionContext = null
        }
      }

      // Limpiar historial de mensajes
      const cleanHistory = messages.slice(-6).map(m => ({
        role: String(m.role || 'user'),
        content: String(m.content || '')
      }))

      // Construir body de forma segura
      const requestBody = {
        message: String(userMessage),
        history: cleanHistory,
        questionContext: cleanQuestionContext,
        userOposicion: userOposicion?.id ? String(userOposicion.id) : null,
        stream: true,
        userId: user?.id ? String(user.id) : null,
        suggestionUsed: currentSuggestion ? String(currentSuggestion) : null
      }

      // Serializar body
      const bodyString = JSON.stringify(requestBody)

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyString,
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al procesar tu pregunta')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let sources = []
      let potentialErrorDetected = false
      let questionId = null
      let suggestions = null
      let logId = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'meta') {
                sources = data.sources || []
              } else if (data.type === 'content') {
                fullContent += data.content
                contentBufferRef.current = fullContent

                // Actualizar UI solo cada 80ms para texto más gradual
                const now = Date.now()
                if (now - lastUpdateRef.current > 80) {
                  lastUpdateRef.current = now
                  const displayContent = contentBufferRef.current
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastIdx = updated.length - 1
                    if (updated[lastIdx]?.role === 'assistant') {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: displayContent,
                        sources,
                        isStreaming: true
                      }
                    }
                    return updated
                  })
                }
              } else if (data.type === 'done') {
                potentialErrorDetected = data.potentialErrorDetected
                questionId = data.questionId
                suggestions = data.suggestions || null
              } else if (data.type === 'logId') {
                logId = data.logId
              } else if (data.type === 'error') {
                throw new Error(data.error)
              }
            } catch (e) {
              // Ignorar líneas que no son JSON válido
              if (e.message !== 'Unexpected end of JSON input') {
                console.log('Error parsing SSE:', e)
              }
            }
          }
        }
      }

      // Finalizar mensaje con todas las propiedades
      setMessages(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: fullContent,
            sources,
            isStreaming: false,
            potentialErrorDetected,
            questionId,
            suggestions,
            logId,
            feedback: null // Para trackear si ya dio feedback
          }
        }
        return updated
      })

    } catch (err) {
      if (err.name === 'AbortError') {
        // Usuario canceló, eliminar mensaje vacío
        setMessages(prev => prev.filter(m => m.content !== '' || m.role === 'user'))
      } else {
        setError(err.message || 'Error de conexión. Inténtalo de nuevo.')
        // Eliminar mensaje vacío si hubo error
        setMessages(prev => prev.filter(m => m.content !== '' || m.role === 'user'))
      }
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [input, isLoading, isStreaming, messages, currentQuestionContext, userOposicion, user, suggestionUsed])

  // Helper para usar sugerencias predefinidas - envía directamente
  const useSuggestion = useCallback((text, label) => {
    sendMessage(text, label)
  }, [sendMessage])

  // Enviar feedback (pulgar arriba/abajo)
  const sendFeedback = useCallback(async (logId, feedback, msgIndex) => {
    try {
      const response = await fetch('/api/ai/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, feedback })
      })

      if (response.ok) {
        // Actualizar el mensaje para mostrar que ya dio feedback
        setMessages(prev => {
          const updated = [...prev]
          if (updated[msgIndex]) {
            updated[msgIndex] = {
              ...updated[msgIndex],
              feedback
            }
          }
          return updated
        })
      }
    } catch (err) {
      console.error('Error enviando feedback:', err)
    }
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setMessages([])
    setError(null)
    setIsLoading(false)
    setIsStreaming(false)
    setTestFlowState(null)
    setAvailableLaws([])
    setSelectedLaws([])
  }

  // Manejar click en "¿Te preparo un test?"
  const handleOfferTestClick = useCallback((laws) => {
    // Añadir mensaje del usuario aceptando
    setMessages(prev => [...prev, { role: 'user', content: '¡Sí, prepárame un test!' }])

    // Añadir respuesta del chat pidiendo seleccionar leyes
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Perfecto, ¿de qué leyes quieres el test? Selecciona una o varias:',
        isLawSelector: true
      }])
      setAvailableLaws(laws)
      setSelectedLaws([])
      setTestFlowState('selecting_laws')
    }, 300)
  }, [])

  // Manejar selección de ley
  const toggleLawSelection = useCallback((law) => {
    setSelectedLaws(prev =>
      prev.includes(law)
        ? prev.filter(l => l !== law)
        : [...prev, law]
    )
  }, [])

  // Crear test con las leyes seleccionadas
  const handleCreateTest = useCallback(() => {
    if (selectedLaws.length === 0) return

    // Añadir mensaje confirmando
    setMessages(prev => [...prev, {
      role: 'user',
      content: `Test de: ${selectedLaws.join(', ')}`
    }])

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '¡Abriendo test en nueva pestaña!'
      }])

      // Construir URL con parámetros como el sistema normal
      const params = new URLSearchParams({
        n: '25',
        selected_laws: JSON.stringify(selectedLaws),
        from_chat: 'true'
      })

      // Abrir en nueva pestaña
      const testUrl = `/test/desde-chat?${params.toString()}`
      window.open(testUrl, '_blank')
    }, 300)

    setTestFlowState(null)
    setSelectedLaws([])
    setAvailableLaws([])
  }, [selectedLaws])

  return (
    <>
      {/* Botón flotante con IA */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-24 right-4 z-50 px-4 h-12 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${
          isOpen
            ? 'bg-gray-700 hover:bg-gray-800'
            : 'bg-blue-900 hover:bg-blue-950 hover:scale-105'
        }`}
        aria-label={isOpen ? 'Minimizar chat' : 'Abrir IA de Vence'}
      >
        {isOpen ? (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <>
            {/* Icono de estrellitas IA (sparkles) */}
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5L9.5 2z"/>
              <path d="M18 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L14.5 11l2.5-1L18 8z"/>
              <path d="M9.5 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L6 18l2.5-1 1-2.5z"/>
            </svg>
            <span className="text-white font-semibold text-sm">IA</span>
          </>
        )}
      </button>

      {/* Panel de chat */}
      <div
        className={`fixed bottom-28 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{ height: '500px', maxHeight: 'calc(100vh - 140px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-900 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              {/* Icono de estrellitas IA (sparkles) */}
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5L9.5 2z"/>
                <path d="M18 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L14.5 11l2.5-1L18 8z"/>
                <path d="M9.5 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L6 18l2.5-1 1-2.5z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">IA de Vence</h3>
              {currentQuestionContext ? (
                <p className="text-green-200 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span>
                  Viendo pregunta del test
                </p>
              ) : (
                <p className="text-blue-100 text-xs">Pregunta sobre leyes y normativa</p>
              )}
            </div>
          </div>
          {/* Botón minimizar */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full transition"
            aria-label="Minimizar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100% - 130px)' }}>
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              {/* Icono de estrellitas IA (sparkles) */}
              <svg className="w-12 h-12 mx-auto mb-3 text-blue-800 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5L9.5 2z"/>
                <path d="M18 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L14.5 11l2.5-1L18 8z"/>
                <path d="M9.5 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L6 18l2.5-1 1-2.5z"/>
              </svg>
              <p className="text-sm font-medium">
                Hola{user?.user_metadata?.name ? <span className="text-blue-500 dark:text-blue-400"> {user.user_metadata.name.split(' ')[0]}</span> : ''}, soy la IA de Vence
              </p>
              <p className="text-xs mt-1">
                {currentQuestionContext
                  ? 'Puedo ayudarte con esta pregunta'
                  : 'Pregunta sobre cualquier ley o artículo'
                }
              </p>
              <div className="mt-4 space-y-2">
                {currentQuestionContext ? (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Sobre esta pregunta:</p>
                    <button
                      onClick={() => useSuggestion('Explícame esta pregunta y por qué la respuesta correcta es esa', 'explicar_respuesta')}
                      className="block w-full text-left px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition text-blue-700 dark:text-blue-300"
                    >
                      💡 Explícame la respuesta correcta
                    </button>
                    <button
                      onClick={() => useSuggestion('¿Qué artículo de la ley regula esto?', 'que_articulo')}
                      className="block w-full text-left px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition text-blue-700 dark:text-blue-300"
                    >
                      📖 ¿Qué artículo regula esto?
                    </button>
                    <button
                      onClick={() => useSuggestion('Dame un truco para recordar esto', 'truco_memoria')}
                      className="block w-full text-left px-3 py-2 text-xs bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition text-green-700 dark:text-green-300"
                    >
                      🧠 Dame un truco para recordarlo
                    </button>
                    <button
                      onClick={() => useSuggestion('¿Esta pregunta está correctamente formulada? Verifica si hay errores', 'verificar_errores')}
                      className="block w-full text-left px-3 py-2 text-xs bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition text-amber-700 dark:text-amber-300"
                    >
                      ⚠️ Verificar si hay errores
                    </button>

                    {/* Sugerencias específicas de la ley */}
                    {currentQuestionContext.lawName && (
                      <>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 mb-2">Sobre {currentQuestionContext.lawName}:</p>
                        <button
                          onClick={() => useSuggestion(`¿Cuáles son los plazos más importantes de la ${currentQuestionContext.lawName}?`, 'plazos_ley')}
                          className="block w-full text-left px-3 py-2 text-xs bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-purple-700 dark:text-purple-300"
                        >
                          ⏱️ Plazos de {currentQuestionContext.lawName}
                        </button>
                        <button
                          onClick={() => useSuggestion(`¿Qué artículos de la ${currentQuestionContext.lawName} han caído en exámenes oficiales?`, 'articulos_examen')}
                          className="block w-full text-left px-3 py-2 text-xs bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-purple-700 dark:text-purple-300"
                        >
                          📝 Artículos que caen en examen
                        </button>
                        <button
                          onClick={() => useSuggestion(`¿Qué tipo de preguntas suelen caer de la ${currentQuestionContext.lawName}?`, 'preguntas_tipicas')}
                          className="block w-full text-left px-3 py-2 text-xs bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-purple-700 dark:text-purple-300"
                        >
                          🎯 Preguntas típicas de examen
                        </button>
                      </>
                    )}

                    {/* Nota de capacidades avanzadas */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                        ✨ Tengo +170 leyes memorizadas. ¡Pregúntame lo que quieras!
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Pregúntame sobre:</p>
                    <button
                      onClick={() => useSuggestion('¿Qué dice el artículo 14 de la Constitución?', 'articulo_general')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      📜 Artículos de cualquier ley
                    </button>
                    <button
                      onClick={() => useSuggestion('¿Cuáles son los plazos del procedimiento administrativo en la Ley 39?', 'plazos_general')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      ⏱️ Plazos y términos
                    </button>
                    <button
                      onClick={() => useSuggestion('¿Cuáles son los derechos de los empleados públicos según el TREBEP?', 'derechos_general')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      👤 Derechos y deberes
                    </button>
                    <button
                      onClick={() => useSuggestion('Explícame las diferencias entre recurso de alzada y reposición', 'comparar_general')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      ⚖️ Comparar conceptos
                    </button>
                    <button
                      onClick={() => useSuggestion('Dame un resumen del Título I de la Constitución', 'resumen_general')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      📋 Resúmenes de títulos/capítulos
                    </button>
                    {/* Nota de capacidades avanzadas */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                        ✨ Tengo +170 leyes memorizadas: CE, Ley 39/2015, TREBEP, LGT...
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.potentialErrorDetected && (
                    <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded-lg">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Se ha detectado un posible error
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Si confirmas el error, puedes reportarlo con el botón de impugnar en la pregunta.
                      </p>
                    </div>
                  )}
                  {/* Oferta de test - NO mostrar si ya está en un test */}
                  {msg.suggestions?.offerTest && !msg.isStreaming && testFlowState !== 'selecting_laws' && !currentQuestionContext && (
                    <div className="mt-3">
                      <button
                        onClick={() => handleOfferTestClick(msg.suggestions.laws)}
                        className="text-xs px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60 border border-green-300 dark:border-green-700 transition-all"
                      >
                        📝 ¿Te preparo un test sobre esto?
                      </button>
                    </div>
                  )}
                  {/* Selector de leyes para test */}
                  {msg.isLawSelector && testFlowState === 'selecting_laws' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {availableLaws.map((law, i) => (
                          <button
                            key={i}
                            onClick={() => toggleLawSelection(law)}
                            className={`text-xs px-3 py-1.5 rounded-full transition-all border ${
                              selectedLaws.includes(law)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-500 hover:bg-gray-200 dark:hover:bg-gray-500'
                            }`}
                          >
                            {selectedLaws.includes(law) && '✓ '}{law}
                          </button>
                        ))}
                      </div>
                      {selectedLaws.length > 0 && (
                        <button
                          onClick={handleCreateTest}
                          className="w-full mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-all"
                        >
                          Crear test de {selectedLaws.length} {selectedLaws.length === 1 ? 'ley' : 'leyes'}
                        </button>
                      )}
                    </div>
                  )}
                  {msg.sources && msg.sources.length > 0 && !msg.isStreaming && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fuentes:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((s, i) => (
                          <span
                            key={i}
                            className="text-xs bg-white/20 dark:bg-gray-600 px-2 py-0.5 rounded"
                          >
                            {s.law} Art.{s.article}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Botones de feedback (pulgar arriba/abajo) */}
                  {msg.role === 'assistant' && msg.logId && !msg.isStreaming && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">¿Te ha sido útil?</span>
                      {msg.feedback ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          {msg.feedback === 'positive' ? (
                            <>
                              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                              </svg>
                              Gracias por tu feedback
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                              </svg>
                              Gracias, mejoraremos
                            </>
                          )}
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => sendFeedback(msg.logId, 'positive', idx)}
                            className="p-1.5 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group"
                            title="Respuesta útil"
                          >
                            <svg className="w-4 h-4 text-gray-400 group-hover:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => sendFeedback(msg.logId, 'negative', idx)}
                            className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group"
                            title="Respuesta no útil"
                          >
                            <svg className="w-4 h-4 text-gray-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && !isStreaming && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-2xl">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              disabled={isLoading || isStreaming}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading || isStreaming}
              className="w-10 h-10 bg-blue-900 hover:bg-blue-950 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition"
            >
              {/* Flecha apuntando a la derecha */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
