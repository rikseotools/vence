'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { useQuestionContext } from '../contexts/QuestionContext'
import { useOposicion } from '../contexts/OposicionContext'
import { useAuth } from '../contexts/AuthContext'

export default function AIChatWidget() {
  const pathname = usePathname()
  const { currentQuestionContext } = useQuestionContext()
  const { oposicionId } = useOposicion()
  const { user, isPremium } = useAuth()

  // Detectar si estamos en psicotécnicos
  const isPsicotecnico = pathname?.startsWith('/psicotecnicos')

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
  const [showProgressMenu, setShowProgressMenu] = useState(false) // Menú expandible de progreso
  const [showExamMenu, setShowExamMenu] = useState(false) // Menú expandible de exámenes
  const [limitReached, setLimitReached] = useState(false) // Límite diario alcanzado (usuarios free)
  const [dynamicSuggestions, setDynamicSuggestions] = useState([]) // Sugerencias dinámicas desde BD
  const [lawContextSuggestions, setLawContextSuggestions] = useState([]) // Sugerencias contextuales de ley
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)
  const contentBufferRef = useRef('')
  const lastUpdateRef = useRef(0)

  // NO auto-scroll durante ni después del streaming
  // El usuario lee desde arriba a su ritmo, sin interrupciones
  // Solo se hace scroll al enviar mensaje (en sendMessage)

  // Focus en input al abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Cargar sugerencias dinámicas al abrir el chat (siempre fresco para CTR actualizado)
  useEffect(() => {
    if (isOpen) {
      const url = oposicionId
        ? `/api/ai/chat/suggestions?oposicionId=${oposicionId}`
        : '/api/ai/chat/suggestions'

      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.suggestions) {
            setDynamicSuggestions(data.suggestions)
          }
        })
        .catch(err => console.error('Error loading suggestions:', err))
    }
  }, [isOpen, oposicionId])

  // Cargar sugerencias contextuales de ley cuando hay una pregunta con ley
  useEffect(() => {
    const lawName = currentQuestionContext?.lawName
    if (isOpen && lawName) {
      const url = `/api/ai/chat/suggestions?contextType=law_context&lawName=${encodeURIComponent(lawName)}`

      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.suggestions) {
            setLawContextSuggestions(data.suggestions)
          }
        })
        .catch(err => console.error('Error loading law suggestions:', err))
    } else {
      setLawContextSuggestions([])
    }
  }, [isOpen, currentQuestionContext?.lawName])

  // Cancelar streaming si se cierra el chat
  useEffect(() => {
    if (!isOpen && abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [isOpen])

  // 🔄 Limpiar mensajes cuando cambia la pregunta (para evitar confusión con historial viejo)
  const previousQuestionIdRef = useRef(null)
  useEffect(() => {
    const currentQuestionId = currentQuestionContext?.id

    // Si cambió la pregunta y hay mensajes previos, limpiarlos
    if (previousQuestionIdRef.current !== null &&
        currentQuestionId !== previousQuestionIdRef.current &&
        messages.length > 0) {
      console.log('🔄 Pregunta cambiada, limpiando historial del chat')
      setMessages([])
    }

    previousQuestionIdRef.current = currentQuestionId
  }, [currentQuestionContext?.id]) // Solo depende del ID de la pregunta, no de messages

  // 🔔 Listener para abrir el chat desde otros componentes (ej: botón "Explícamela")
  const pendingMessageRef = useRef(null)
  useEffect(() => {
    const handleOpenChat = (event) => {
      const { message, suggestion } = event.detail || {}
      console.log('🔔 Evento openAIChat recibido:', { message, suggestion })

      // Abrir el chat
      setIsOpen(true)

      // Guardar el mensaje pendiente para enviarlo después de abrir
      if (message) {
        pendingMessageRef.current = { message, suggestion }
      }
    }

    window.addEventListener('openAIChat', handleOpenChat)
    return () => window.removeEventListener('openAIChat', handleOpenChat)
  }, [])

  // Enviar mensaje pendiente cuando se abra el chat
  // Nota: usamos sendMessageRef para evitar dependencia circular
  const sendMessageRef = useRef(null)
  useEffect(() => {
    if (isOpen && pendingMessageRef.current && !isLoading && !isStreaming && sendMessageRef.current) {
      const { message, suggestion } = pendingMessageRef.current
      pendingMessageRef.current = null

      // Pequeño delay para asegurar que el chat está listo
      setTimeout(() => {
        sendMessageRef.current(message, suggestion)
      }, 100)
    }
  }, [isOpen, isLoading, isStreaming])

  // Helper para formatear datos de psicotécnicos en texto legible para la IA
  const formatPsicotecnicoData = useCallback((questionContext) => {
    if (!questionContext?.contentData) return ''

    const { contentData, questionSubtype } = questionContext
    let dataDescription = ''

    // Formatear según el tipo de pregunta
    if (questionSubtype === 'line_chart' || questionSubtype === 'bar_chart' || questionSubtype === 'mixed_chart') {
      // Gráficos de líneas/barras
      if (contentData.chart_title) {
        dataDescription += `\n📊 Título: ${contentData.chart_title}`
      }
      if (contentData.categories && contentData.age_groups) {
        // Formato line_chart con age_groups
        dataDescription += `\n📈 Categorías (eje X): ${contentData.categories.join(', ')}`
        dataDescription += '\n📉 Datos por serie:'
        contentData.age_groups.forEach(group => {
          dataDescription += `\n  • ${group.label}: ${group.values.join(', ')}`
        })
      } else if (contentData.chart_data) {
        // Formato bar_chart/mixed_chart
        if (Array.isArray(contentData.chart_data)) {
          dataDescription += '\n📊 Datos del gráfico:'
          contentData.chart_data.forEach(item => {
            if (item.label && item.value !== undefined) {
              dataDescription += `\n  • ${item.label}: ${item.value}`
            } else if (item.category && item.values) {
              dataDescription += `\n  • ${item.category}: ${item.values.join(', ')}`
            }
          })
        }
      }
    } else if (questionSubtype === 'pie_chart') {
      // Gráfico circular
      if (contentData.chart_title) {
        dataDescription += `\n🥧 Título: ${contentData.chart_title}`
      }
      if (contentData.total_value) {
        dataDescription += `\n📊 Total: ${contentData.total_value}`
      }
      if (contentData.chart_data && Array.isArray(contentData.chart_data)) {
        dataDescription += '\n📊 Sectores:'
        contentData.chart_data.forEach(item => {
          dataDescription += `\n  • ${item.label || item.name}: ${item.value}${item.percentage ? ` (${item.percentage}%)` : ''}`
        })
      }
    } else if (questionSubtype === 'data_tables') {
      // Tablas de datos
      if (contentData.table_title) {
        dataDescription += `\n📋 Tabla: ${contentData.table_title}`
      }
      if (contentData.context) {
        dataDescription += `\n📝 Contexto: ${contentData.context}`
      }
      if (contentData.table_data) {
        dataDescription += '\n📊 Datos de la tabla:'
        if (Array.isArray(contentData.table_data)) {
          contentData.table_data.forEach((row, i) => {
            dataDescription += `\n  Fila ${i + 1}: ${JSON.stringify(row)}`
          })
        } else {
          dataDescription += `\n  ${JSON.stringify(contentData.table_data)}`
        }
      }
    } else if (questionSubtype === 'sequence_numeric' || questionSubtype === 'sequence_letter' || questionSubtype === 'sequence_alphanumeric') {
      // Series numéricas/letras
      if (contentData.pattern_type) {
        dataDescription += `\n🔢 Tipo de patrón: ${contentData.pattern_type}`
      }
      if (contentData.solution_method) {
        dataDescription += `\n💡 Método de solución: ${contentData.solution_method}`
      }
    } else if (questionSubtype === 'error_detection') {
      // Detección de errores
      if (contentData.original_text) {
        dataDescription += `\n📝 Texto original: ${contentData.original_text}`
      }
      if (contentData.error_count) {
        dataDescription += `\n❌ Número de errores: ${contentData.error_count}`
      }
    }

    return dataDescription
  }, [])

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

    // Scroll inmediato al enviar para ver el mensaje del usuario y el indicador de carga
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }, 50)

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
            source: currentQuestionContext.source ? String(currentQuestionContext.source) : null,
            // Campos de psicotécnicos
            isPsicotecnico: currentQuestionContext.isPsicotecnico || false,
            questionSubtype: currentQuestionContext.questionSubtype || null,
            questionTypeName: currentQuestionContext.questionTypeName || null,
            contentData: currentQuestionContext.contentData || null
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
        userOposicion: oposicionId || null,
        stream: true,
        userId: user?.id ? String(user.id) : null,
        suggestionUsed: currentSuggestion ? String(currentSuggestion) : null,
        isPremium: isPremium || false
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
        // Verificar si es error de límite diario
        if (errorData.limitReached) {
          setLimitReached(true)
          setIsLoading(false)
          setIsStreaming(false)
          // Eliminar el mensaje del usuario que acabamos de añadir
          setMessages(prev => prev.slice(0, -1))
          return
        }
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
  }, [input, isLoading, isStreaming, messages, currentQuestionContext, oposicionId, user, suggestionUsed, isPremium])

  // Actualizar ref para uso externo (evita dependencia circular)
  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  // Helper para usar sugerencias predefinidas - envía directamente y trackea click
  const useSuggestion = useCallback((text, suggestionKey) => {
    // Trackear click en background (no bloquear)
    fetch('/api/ai/chat/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestionKey,
        userId: user?.id || null
      })
    }).catch(() => {}) // Ignorar errores de tracking

    sendMessage(text, suggestionKey)
  }, [sendMessage, user?.id])

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

  // Manejar selección de ley (soporta objetos {shortName, name} y strings)
  const toggleLawSelection = useCallback((law) => {
    const lawId = typeof law === 'object' ? law.shortName : law
    setSelectedLaws(prev => {
      const isSelected = prev.some(s => (typeof s === 'object' ? s.shortName : s) === lawId)
      if (isSelected) {
        return prev.filter(s => (typeof s === 'object' ? s.shortName : s) !== lawId)
      } else {
        return [...prev, law]
      }
    })
  }, [])

  // Crear test con las leyes seleccionadas
  const handleCreateTest = useCallback(() => {
    if (selectedLaws.length === 0) return

    // Extraer shortNames para la URL y display
    const lawShortNames = selectedLaws.map(l => typeof l === 'object' ? l.shortName : l)

    // Añadir mensaje confirmando
    setMessages(prev => [...prev, {
      role: 'user',
      content: `Test de: ${lawShortNames.join(', ')}`
    }])

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '¡Abriendo test en nueva pestaña!'
      }])

      // Construir URL con parámetros (usar shortNames)
      const params = new URLSearchParams({
        n: '10',
        selected_laws: JSON.stringify(lawShortNames),
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
      {/* Panel de chat */}
      <div
        className={`fixed bottom-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transition-all duration-300 ${
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
              <h3 className="text-white font-semibold text-sm">Vence AI</h3>
              {currentQuestionContext ? (
                <p className="text-green-200 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span>
                  Viendo pregunta del test
                </p>
              ) : (
                <p className="text-blue-100 text-xs">
                  {isPsicotecnico ? 'Ayuda con psicotécnicos' : 'Pregunta sobre leyes y normativa'}
                </p>
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
            <div className="text-gray-500 dark:text-gray-400 py-2">
              {/* Layout horizontal: muñeca izquierda, texto derecha */}
              <div className="flex items-start gap-3 mb-3">
                {/* Muñeca pequeña */}
                <div className="flex-shrink-0 scale-[0.6] origin-top-left -ml-2 -mt-1">
                  <div className="flex flex-col items-center">
                    {/* Cabeza */}
                    <div className="relative">
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-b from-gray-800 via-gray-900 to-gray-800 rounded-full -z-10"></div>
                      <div className="absolute top-4 -left-0.5 w-2 h-6 bg-gray-900 rounded-full -z-10"></div>
                      <div className="absolute top-4 -right-0.5 w-2 h-6 bg-gray-900 rounded-full -z-10"></div>
                      <div className="relative w-9 h-9 bg-gradient-to-b from-amber-400 to-amber-500 rounded-full flex flex-col items-center justify-center shadow-md">
                        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-7 h-3 bg-gray-900 rounded-b-[50%]"></div>
                        <div className="flex gap-2 mt-1">
                          <div className="relative w-2 h-2.5 bg-gray-900 rounded-full">
                            <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full"></div>
                          </div>
                          <div className="relative w-2 h-2.5 bg-gray-900 rounded-full">
                            <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full"></div>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-1">
                          <div className="w-1.5 h-1.5 bg-pink-400/60 rounded-full"></div>
                          <div className="w-1.5 h-1.5 bg-pink-400/60 rounded-full"></div>
                        </div>
                        <div className="w-2.5 h-1 border-b border-pink-600 rounded-b-full"></div>
                      </div>
                    </div>
                    {/* Cuerpo delgado */}
                    <div className="relative">
                      <div className="w-2 h-1 bg-amber-400 mx-auto"></div>
                      <div className="w-7 h-3 bg-gradient-to-b from-blue-400 to-blue-500 rounded-t-md"></div>
                      <div className="w-9 h-5 bg-gradient-to-b from-blue-500 to-blue-600 rounded-b-[40%] -mt-0.5"></div>
                      <div className="absolute -left-1.5 top-0.5 w-2 h-4 bg-amber-400 rounded-full"></div>
                      <div className="absolute -right-3 -top-1 origin-bottom-left" style={{ animation: 'wave 1.5s ease-in-out infinite' }}>
                        <div className="w-2 h-5 bg-amber-400 rounded-full"></div>
                        <div className="text-xs -mt-0.5">👋🏽</div>
                      </div>
                    </div>
                    <div className="flex gap-1 -mt-0.5">
                      <div className="w-2 h-5 bg-amber-400 rounded-b-full"></div>
                      <div className="w-2 h-5 bg-amber-400 rounded-b-full"></div>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-2.5 h-1 bg-blue-700 rounded-full"></div>
                      <div className="w-2.5 h-1 bg-blue-700 rounded-full"></div>
                    </div>
                  </div>
                </div>
                {/* Texto de bienvenida */}
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hola{user?.user_metadata?.name ? <span className="text-blue-500 dark:text-blue-400"> {user.user_metadata.name.split(' ')[0]}</span> : ''}, soy <span className="font-semibold text-purple-600 dark:text-purple-400">Vence AI</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {currentQuestionContext
                      ? 'Puedo ayudarte con esta pregunta'
                      : isPsicotecnico
                        ? 'Te ayudo con series, razonamiento y más'
                        : 'Pregunta sobre cualquier ley o artículo'
                    }
                  </p>
                </div>
              </div>
              {/* Animación CSS para la mano */}
              <style jsx>{`
                @keyframes wave {
                  0%, 100% { transform: rotate(0deg); }
                  20% { transform: rotate(20deg); }
                  40% { transform: rotate(-5deg); }
                  60% { transform: rotate(20deg); }
                  80% { transform: rotate(-5deg); }
                }
              `}</style>
              <div className="mt-4 space-y-2">
                {currentQuestionContext ? (
                  currentQuestionContext.isPsicotecnico ? (
                    // Sugerencias para psicotécnicos con contexto de pregunta
                    <>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Sobre esta {currentQuestionContext.questionTypeName || 'pregunta'}:</p>
                      <button
                        onClick={() => {
                          const dataInfo = formatPsicotecnicoData(currentQuestionContext)
                          useSuggestion(`Explícame cómo resolver esta ${currentQuestionContext.questionTypeName || 'pregunta'}: "${currentQuestionContext.questionText}"\n\nLas opciones son:\nA) ${currentQuestionContext.options?.a}\nB) ${currentQuestionContext.options?.b}\nC) ${currentQuestionContext.options?.c}\nD) ${currentQuestionContext.options?.d}${dataInfo ? `\n\nDATOS DEL GRÁFICO/TABLA:${dataInfo}` : ''}`, 'explicar_psico')
                        }}
                        className="block w-full text-left px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition text-blue-700 dark:text-blue-300"
                      >
                        💡 Explícame cómo resolverla
                      </button>
                      <button
                        onClick={() => {
                          const dataInfo = formatPsicotecnicoData(currentQuestionContext)
                          useSuggestion(`Analiza los datos y dime cuál es la respuesta correcta para: "${currentQuestionContext.questionText}"\n\nOpciones:\nA) ${currentQuestionContext.options?.a}\nB) ${currentQuestionContext.options?.b}\nC) ${currentQuestionContext.options?.c}\nD) ${currentQuestionContext.options?.d}${dataInfo ? `\n\nDATOS:${dataInfo}` : ''}`, 'analizar_psico')
                        }}
                        className="block w-full text-left px-3 py-2 text-xs bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition text-green-700 dark:text-green-300"
                      >
                        🔍 Analiza los datos
                      </button>
                      <button
                        onClick={() => useSuggestion(`Dame un truco o técnica rápida para resolver este tipo de ${currentQuestionContext.questionTypeName || 'ejercicio'} en oposiciones`, 'truco_psico')}
                        className="block w-full text-left px-3 py-2 text-xs bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-purple-700 dark:text-purple-300"
                      >
                        ⚡ Dame un truco rápido
                      </button>

                      {/* Nota de capacidades */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                          ✨ Te ayudo con series, razonamiento y más
                        </p>
                      </div>
                    </>
                  ) : (
                    // Sugerencias para tests de leyes con contexto de pregunta
                    <>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Sobre esta pregunta:</p>
                      <button
                        onClick={() => useSuggestion(`Explícame por qué la respuesta correcta es "${currentQuestionContext.correctAnswer}" en la pregunta: "${currentQuestionContext.questionText?.substring(0, 100)}..."`, 'explicar_respuesta')}
                        className="block w-full text-left px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition text-blue-700 dark:text-blue-300"
                      >
                        💡 Explícame la respuesta correcta
                      </button>
                      {/* Sugerencias dinámicas de la ley */}
                      {currentQuestionContext.lawName && lawContextSuggestions.length > 0 && (
                        <>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 mb-2">Sobre {currentQuestionContext.lawName}:</p>
                          {lawContextSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              onClick={() => useSuggestion(suggestion.message, suggestion.suggestion_key)}
                              className="block w-full text-left px-3 py-2 text-xs bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-purple-700 dark:text-purple-300 mb-1"
                            >
                              {suggestion.emoji} {suggestion.label}
                            </button>
                          ))}
                        </>
                      )}

                      {/* 📝 Artículos de examen - Menú expandible cuando no hay ley */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        {/* Si no hay ley en el contexto, mostrar menú expandible */}
                        {!currentQuestionContext?.lawName && (
                          /* Si no hay ley, mostrar menú expandible */
                          <>
                            <button
                              onClick={() => setShowExamMenu(!showExamMenu)}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/50 transition text-orange-700 dark:text-orange-300"
                            >
                              <span>📝 Artículos que caen en exámenes</span>
                              <span className={`transform transition-transform ${showExamMenu ? 'rotate-180' : ''}`}>▼</span>
                            </button>

                            {showExamMenu && (
                              <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-orange-200 dark:border-orange-700">
                                <button
                                  onClick={() => { useSuggestion('¿Qué artículos de la Constitución Española han caído más en exámenes oficiales?', 'exam_ce'); setShowExamMenu(false); }}
                                  className="block w-full text-left px-3 py-1.5 text-xs bg-orange-50/50 dark:bg-orange-900/20 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40 transition text-orange-600 dark:text-orange-400"
                                >
                                  🏛️ Constitución Española
                                </button>
                                <button
                                  onClick={() => { useSuggestion('¿Qué artículos de la Ley 39/2015 (LPAC) han caído más en exámenes oficiales?', 'exam_lpac'); setShowExamMenu(false); }}
                                  className="block w-full text-left px-3 py-1.5 text-xs bg-orange-50/50 dark:bg-orange-900/20 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40 transition text-orange-600 dark:text-orange-400"
                                >
                                  📋 Ley 39/2015 (LPAC)
                                </button>
                                <button
                                  onClick={() => { useSuggestion('¿Qué artículos de la Ley 40/2015 (LRJSP) han caído más en exámenes oficiales?', 'exam_lrjsp'); setShowExamMenu(false); }}
                                  className="block w-full text-left px-3 py-1.5 text-xs bg-orange-50/50 dark:bg-orange-900/20 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40 transition text-orange-600 dark:text-orange-400"
                                >
                                  🏢 Ley 40/2015 (LRJSP)
                                </button>
                                <button
                                  onClick={() => { useSuggestion('¿Qué artículos del TREBEP han caído más en exámenes oficiales?', 'exam_trebep'); setShowExamMenu(false); }}
                                  className="block w-full text-left px-3 py-1.5 text-xs bg-orange-50/50 dark:bg-orange-900/20 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40 transition text-orange-600 dark:text-orange-400"
                                >
                                  👔 TREBEP
                                </button>
                                <button
                                  onClick={() => { useSuggestion('¿Cuáles son los artículos más preguntados en exámenes oficiales de todas las leyes?', 'exam_todas'); setShowExamMenu(false); }}
                                  className="block w-full text-left px-3 py-1.5 text-xs bg-orange-50/50 dark:bg-orange-900/20 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40 transition text-orange-600 dark:text-orange-400"
                                >
                                  📊 Todas las leyes
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* 📊 Mi progreso - Menú expandible */}
                      {user && (
                        <div className="mt-2">
                          <button
                            onClick={() => setShowProgressMenu(!showProgressMenu)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition text-green-700 dark:text-green-300"
                          >
                            <span>📊 Mi progreso</span>
                            <span className={`transform transition-transform ${showProgressMenu ? 'rotate-180' : ''}`}>▼</span>
                          </button>

                          {showProgressMenu && (
                            <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-green-200 dark:border-green-700">
                              <button
                                onClick={() => { useSuggestion('¿Cómo voy con mi preparación? Dame un resumen de mis estadísticas', 'como_voy'); setShowProgressMenu(false); }}
                                className="block w-full text-left px-3 py-1.5 text-xs bg-green-50/50 dark:bg-green-900/20 rounded hover:bg-green-100 dark:hover:bg-green-900/40 transition text-green-600 dark:text-green-400"
                              >
                                📈 ¿Cómo voy?
                              </button>
                              <button
                                onClick={() => { useSuggestion('¿En qué artículos fallo más? Dime mis puntos débiles', 'donde_fallo'); setShowProgressMenu(false); }}
                                className="block w-full text-left px-3 py-1.5 text-xs bg-green-50/50 dark:bg-green-900/20 rounded hover:bg-green-100 dark:hover:bg-green-900/40 transition text-green-600 dark:text-green-400"
                              >
                                ❌ ¿Dónde fallo más?
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Nota de capacidades avanzadas */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                          ✨ Estoy entrenada con +170 leyes, ¡espero serte útil!
                        </p>
                      </div>
                    </>
                  )
                ) : isPsicotecnico ? (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Pregúntame sobre:</p>
                    <button
                      onClick={() => useSuggestion('Explícame cómo resolver series numéricas', 'series_numericas')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      🔢 Series numéricas
                    </button>
                    <button
                      onClick={() => useSuggestion('Explícame cómo resolver series de letras', 'series_letras')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      🔤 Series de letras
                    </button>
                    <button
                      onClick={() => useSuggestion('Dame técnicas para resolver razonamiento verbal', 'razonamiento_verbal')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      📝 Razonamiento verbal
                    </button>
                    <button
                      onClick={() => useSuggestion('Explícame trucos para razonamiento numérico', 'razonamiento_numerico')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      🧮 Razonamiento numérico
                    </button>
                    <button
                      onClick={() => useSuggestion('¿Cómo mejorar mi velocidad en psicotécnicos?', 'velocidad_psico')}
                      className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      ⚡ Mejorar velocidad
                    </button>
                    {/* Nota de capacidades */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                        ✨ Te ayudo con series, razonamiento y más
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Pregúntame sobre:</p>
                    {dynamicSuggestions.length > 0 ? (
                      dynamicSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          onClick={() => useSuggestion(suggestion.message, suggestion.suggestion_key)}
                          className="block w-full text-left px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                        >
                          {suggestion.emoji} {suggestion.label}
                        </button>
                      ))
                    ) : (
                      // Fallback mientras cargan las sugerencias
                      <p className="text-xs text-gray-400 text-center py-2">Cargando sugerencias...</p>
                    )}
                    {/* Nota de capacidades avanzadas */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                        ✨ Estoy entrenada con +170 leyes, ¡espero serte útil!
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
                  {/* Indicador de "pensando" cuando está cargando */}
                  {msg.isStreaming && !msg.content ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Pensando</span>
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none
                      prose-p:my-1 prose-p:leading-relaxed
                      prose-strong:text-gray-900 prose-strong:dark:text-white prose-strong:font-semibold
                      prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5
                      prose-ol:my-1 prose-ol:pl-4
                      prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:dark:text-white
                      prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
                      prose-code:bg-gray-100 prose-code:dark:bg-gray-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                      prose-a:text-blue-600 prose-a:dark:text-blue-400 prose-a:no-underline prose-a:hover:underline
                    ">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
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
                  {/* Preguntas de seguimiento personalizadas */}
                  {msg.suggestions?.followUpQuestions && !msg.isStreaming && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Continuar con:</p>
                      {msg.suggestions.followUpQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => useSuggestion(q.text, q.label)}
                          className="block w-full text-left text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-700 transition-all"
                        >
                          → {q.text}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Selector de leyes para test */}
                  {msg.isLawSelector && testFlowState === 'selecting_laws' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {availableLaws.map((law, i) => {
                          // Manejar tanto objetos {shortName, name} como strings legacy
                          const lawId = typeof law === 'object' ? law.shortName : law
                          const lawDisplay = typeof law === 'object' ? law.shortName : law
                          const isSelected = selectedLaws.some(s =>
                            (typeof s === 'object' ? s.shortName : s) === lawId
                          )
                          return (
                            <button
                              key={i}
                              onClick={() => toggleLawSelection(law)}
                              className={`text-xs px-3 py-1.5 rounded-full transition-all border ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-500 hover:bg-gray-200 dark:hover:bg-gray-500'
                              }`}
                            >
                              {isSelected && '✓ '}{lawDisplay}
                            </button>
                          )
                        })}
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

        {/* Input o mensaje de límite */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-2xl">
          {limitReached ? (
            /* Mensaje de límite alcanzado para usuarios free */
            <div className="text-center py-2">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                  Has alcanzado el límite de 5 consultas diarias
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                  Para seguir usando el chat de IA sin límites, hazte Premium
                </p>
                <a
                  href="/premium?from=ai_chat_limit"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-medium rounded-full transition-all shadow-md hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Continuar sin límites
                </a>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </>
  )
}
