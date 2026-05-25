// components/ChatInterface.js - Interface de chat para feedback
'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

// Emoticonos populares para el chat
const EMOJIS = [
  '😀', '😂', '😊', '😍', '🤔', '😅', '😢', '😡', '😴', '🤗',
  '👍', '👎', '👏', '🙏', '💪', '👌', '✌️', '🤞', '🤝', '💯',
  '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '❓', '❗',
  '🎉', '🎊', '🔥', '💰', '📚', '✅', '❌', '⭐', '💡', '🚀'
]

export default function ChatInterface({ conversationId, onClose, feedbackData }) {
  const { user, supabase } = useAuth()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [conversation, setConversation] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploadedImages, setUploadedImages] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const [expandedImage, setExpandedImage] = useState(null) // Estado para modal de imagen expandida

  // Efecto para cerrar modal de imagen con ESC
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && expandedImage) {
        setExpandedImage(null)
      }
    }

    if (expandedImage) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [expandedImage])

  // Función para insertar emoji en el mensaje
  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current
    if (textarea) {
      const cursorPosition = textarea.selectionStart
      const currentValue = textarea.value
      const newValue = currentValue.slice(0, cursorPosition) + emoji + currentValue.slice(cursorPosition)
      setNewMessage(newValue)
      textarea.focus()
      textarea.setSelectionRange(cursorPosition + emoji.length, cursorPosition + emoji.length)
    }
    setShowEmojiPicker(false)
  }

  // Función para subir imagen desde usuario
  const handleImageUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    console.log('📸 [USER] Iniciando subida de imagen:', file.name)

    // Validar archivo
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede ser mayor a 5MB')
      return
    }

    setUploadingImage(true)

    try {
      // Usar la API para subir
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userPath', 'user-feedback-images')

      const response = await fetch('/api/upload-feedback-image', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Error subiendo imagen')
      }

      const result = await response.json()
      console.log('✅ [USER] Imagen subida:', result.url)

      // Insertar URL directamente en el mensaje donde está el cursor
      const textarea = textareaRef.current
      if (textarea) {
        const imageMarkdown = `\n${result.url}\n`
        const cursorPosition = textarea.selectionStart
        const currentValue = textarea.value
        const newValue = currentValue.slice(0, cursorPosition) + imageMarkdown + currentValue.slice(cursorPosition)
        setNewMessage(newValue)
        textarea.focus()
        textarea.setSelectionRange(cursorPosition + imageMarkdown.length, cursorPosition + imageMarkdown.length)
      }

    } catch (error) {
      console.error('❌ [USER] Error subiendo imagen:', error)
      alert('Error al subir la imagen')
    } finally {
      setUploadingImage(false)
      event.target.value = '' // Limpiar input file
    }
  }

  // Función para renderizar mensaje con imágenes incrustadas (estilo WhatsApp)
  const renderMessageWithImages = (messageText) => {
    if (!messageText) return ''
    
    console.log('🖼️ [USER CHAT] Procesando mensaje:', messageText.substring(0, 100) + '...')
    
    // Detectar URLs de imagen en el mensaje
    const imageUrlRegex = /(https?:\/\/[^\s\n]+\.(?:jpg|jpeg|png|gif|webp|JPG|JPEG|PNG|GIF|WEBP)(?:\?[^\s\n]*)?)/gi
    const urls = messageText.match(imageUrlRegex)
    
    console.log('🖼️ [USER CHAT] URLs encontradas:', urls)
    
    if (!urls || urls.length === 0) {
      // No hay imágenes, renderizar solo texto
      return <span style={{ whiteSpace: 'pre-wrap' }}>{messageText}</span>
    }
    
    // Dividir el texto por las URLs de imagen
    const parts = messageText.split(imageUrlRegex)
    
    return parts.map((part, index) => {
      // Resetear regex para cada test
      const testRegex = /(https?:\/\/[^\s\n]+\.(?:jpg|jpeg|png|gif|webp|JPG|JPEG|PNG|GIF|WEBP)(?:\?[^\s\n]*)?)/gi
      
      // Si es una URL de imagen, renderizar como imagen pequeña
      if (testRegex.test(part)) {
        console.log('🖼️ [USER CHAT] Renderizando imagen:', part)
        return (
          <div 
            key={index} 
            className="my-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
            style={{ userSelect: 'none' }}
          >
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">
              📸 Imagen adjunta - Click para expandir
            </div>
            <div 
              className="inline-block cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('🖼️ [USER CHAT] Click en imagen para expandir:', part)
                setExpandedImage(part)
              }}
            >
              <img
                src={part}
                alt="Imagen adjunta"
                className="max-w-48 max-h-36 rounded-lg border-2 border-blue-400 dark:border-blue-500 hover:opacity-80 hover:border-blue-600 transition-all object-cover shadow-lg pointer-events-none"
                onError={(e) => {
                  console.error('❌ [USER CHAT] Error cargando imagen:', part)
                  e.target.style.display = 'none'
                  // Mostrar link si la imagen no carga
                  const link = document.createElement('a')
                  link.href = part
                  link.target = '_blank'
                  link.className = 'text-blue-500 hover:underline text-sm font-medium'
                  link.textContent = '🖼️ Ver imagen (enlace directo)'
                  e.target.parentNode.appendChild(link)
                }}
                onLoad={() => {
                  console.log('✅ [USER CHAT] Imagen cargada exitosamente:', part)
                }}
                title="Click para expandir imagen"
                draggable={false}
              />
            </div>
          </div>
        )
      } else {
        // Si es texto normal, renderizar como texto con saltos de línea
        return (
          <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
            {part}
          </span>
        )
      }
    })
  }

  useEffect(() => {
    if (conversationId) {
      loadConversation()
      loadMessages()
      
      // Subscription para mensajes en tiempo real
      const subscription = supabase
        .channel(`feedback_messages:${conversationId}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'feedback_messages',
            filter: `conversation_id=eq.${conversationId}`
          }, 
          (payload) => {
            setMessages(prev => [...prev, payload.new])
            scrollToBottom()
          }
        )
        .subscribe()

      return () => subscription.unsubscribe()
    }
  }, [conversationId, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Función para auto-redimensionar textarea como WhatsApp
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      const maxHeight = 120 // Máximo ~6 líneas
      const minHeight = 44  // Mínimo ~2 líneas
      
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`
    }
  }

  // Auto-redimensionar cuando cambie el contenido
  useEffect(() => {
    autoResizeTextarea()
  }, [newMessage])

  // Función para insertar emoji en el mensaje
  const insertEmoji = (emoji) => {
    const currentMessage = newMessage
    const cursorPosition = textareaRef.current?.selectionStart || currentMessage.length
    const newMessageText = currentMessage.slice(0, cursorPosition) + emoji + currentMessage.slice(cursorPosition)
    setNewMessage(newMessageText)
    setShowEmojiPicker(false)
    
    // Mantener focus en el textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(cursorPosition + emoji.length, cursorPosition + emoji.length)
      }
    }, 10)
  }

  // Función para subir imagen
  const handleImageUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen')
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede ser mayor a 5MB')
      return
    }

    setUploadingImage(true)

    try {
      // Bloque 5 Fase A: el upload pasa por /api/upload-chat-attachment
      // (server-side), que usa el adapter `lib/storage` (S3 o Supabase
      // según STORAGE_PROVIDER). Antes el navegador hablaba directamente
      // con supabase.storage — no agnóstico.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch('/api/upload-chat-attachment', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      if (!uploadResponse.ok) {
        const err = await uploadResponse.json().catch(() => ({ error: 'upload failed' }))
        throw new Error(err.error || `upload failed (${uploadResponse.status})`)
      }

      const { url: publicUrl, path: filePath } = await uploadResponse.json()

      // Añadir imagen a la lista
      setUploadedImages(prev => [...prev, {
        id: Date.now(),
        url: publicUrl,
        name: file.name,
        path: filePath
      }])

    } catch (error) {
      console.error('Error subiendo imagen:', error)
      alert('Error al subir la imagen. Inténtalo de nuevo.')
    } finally {
      setUploadingImage(false)
      // Limpiar input
      event.target.value = ''
    }
  }

  // Función para eliminar imagen subida (server-side via adapter agnóstico)
  const removeImage = async (imageId, imagePath) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      await fetch(`/api/upload-chat-attachment?path=${encodeURIComponent(imagePath)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      // Eliminar de la lista local independientemente del resultado del DELETE:
      // si el objeto ya no existe, la UI debe reflejarlo igual.
      setUploadedImages(prev => prev.filter(img => img.id !== imageId))
    } catch (error) {
      console.error('Error eliminando imagen:', error)
    }
  }

  const loadConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      if (error) throw error
      setConversation(data)
    } catch (error) {
      console.error('Error cargando conversación:', error)
    }
  }

  const loadMessages = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('feedback_messages')
        .select(`
          *,
          sender:sender_id (
            full_name,
            email
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      // Preparar mensaje con imágenes
      let messageWithImages = newMessage.trim()
      if (uploadedImages.length > 0) {
        messageWithImages += '\n\n📸 Imágenes adjuntas:\n'
        uploadedImages.forEach((img, index) => {
          messageWithImages += `${index + 1}. ${img.name}: ${img.url}\n`
        })
      }

      const { error } = await supabase
        .from('feedback_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          is_admin: false,
          message: messageWithImages,
          attachments: uploadedImages.length > 0 ? JSON.stringify(uploadedImages) : null
        })

      if (error) throw error

      // Actualizar estado de conversación y resetear vista del admin para que vea la alerta
      // También limpiar closed_at para indicar que se ha reabierto
      await supabase
        .from('feedback_conversations')
        .update({
          status: 'waiting_admin',
          last_message_at: new Date().toISOString(),
          admin_viewed_at: null,  // Reset para que aparezca alerta de nuevo mensaje
          closed_at: null  // Limpiar fecha de cierre al reabrir
        })
        .eq('id', conversationId)

      // 🔄 Si el usuario responde a una conversación resuelta, reabrir el feedback asociado
      console.log('🔍 Verificando si feedback asociado necesita reabrirse...')
      
      // Obtener feedback_id desde la conversación
      const { data: conversationData } = await supabase
        .from('feedback_conversations')
        .select('feedback_id')
        .eq('id', conversationId)
        .single()
      
      if (conversationData?.feedback_id) {
        const { data: feedbackStatus } = await supabase
          .from('user_feedback')
          .select('status')
          .eq('id', conversationData.feedback_id)
          .single()
        
        if (feedbackStatus?.status === 'resolved' || feedbackStatus?.status === 'dismissed') {
          console.log('🔄 Usuario respondió a feedback resuelto - reabriendo...')
          const { error: feedbackError } = await supabase
            .from('user_feedback')
            .update({ 
              status: 'pending',
              resolved_at: null
            })
            .eq('id', conversationData.feedback_id)
          
          if (feedbackError) {
            console.error('❌ Error reabriendo feedback:', feedbackError)
          } else {
            console.log('✅ Feedback reabierto por respuesta del usuario')
          }
        }
      }

      setNewMessage('')
      setUploadedImages([])
      setShowEmojiPicker(false)
    } catch (error) {
      console.error('Error enviando mensaje:', error)
    } finally {
      setSending(false)
    }
  }

  const getStatusLabel = (status) => {
    const statuses = {
      'waiting_admin': '⏳ Esperando respuesta',
      'waiting_user': '💬 Tu turno',
      'open': '🔄 Conversación activa',
      'closed': '✅ Conversación cerrada'
    }
    return statuses[status] || status
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando conversación...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              💬 Conversación de Feedback
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {conversation && getStatusLabel(conversation.status)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Feedback original - ocultar si es conversación iniciada por soporte */}
        {feedbackData && !feedbackData.message?.startsWith('[Conversación iniciada') && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tu consulta:
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200">{feedbackData.message}</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_admin ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.is_admin 
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' 
                  : 'bg-blue-600 text-white'
              }`}>
                <div className="text-sm mb-1">
                  {message.is_admin ? (
                    <span className="font-medium">👨‍💼 Equipo Vence</span>
                  ) : (
                    <span className="font-medium">Tú</span>
                  )}
                </div>
                <div className="text-sm">{renderMessageWithImages(message.message)}</div>
                <div className="text-xs mt-1 opacity-70">
                  {new Date(message.created_at).toLocaleString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    timeZone: 'Europe/Madrid'
                  })}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input - siempre visible, incluso en cerradas para permitir reabrir */}
        <form onSubmit={sendMessage} className="p-4 border-t dark:border-gray-700">
            <div className="space-y-3">
              {/* Vista previa de imágenes subidas */}
              {uploadedImages.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    📸 Imágenes adjuntas ({uploadedImages.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {uploadedImages.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(image.id, image.path)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title={`Eliminar ${image.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input principal */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe tu mensaje... Usa el botón de imagen para adjuntar imagen si lo deseas."
                  disabled={sending}
                  rows={1}
                  className="w-full p-3 pr-20 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 resize-none overflow-hidden"
                  style={{ 
                    whiteSpace: 'pre-wrap', 
                    lineHeight: '1.4',
                    minHeight: '44px',
                    maxHeight: '120px'
                  }}
                  onKeyDown={(e) => {
                    // Enviar con Ctrl/Cmd + Enter
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault()
                      if (newMessage.trim()) {
                        sendMessage(e)
                      }
                    }
                  }}
                />
                
                {/* Botones de acción */}
                <div className="absolute bottom-2 right-2 flex gap-1">
                  {/* Botón de Subir Imagen */}
                  <label className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" title="Subir imagen">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    {uploadingImage ? (
                      <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </label>
                  
                  {/* Botón de Emojis */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                    title="Añadir emoji"
                  >
                    😊
                  </button>
                </div>
                
                {/* Selector de Emojis */}
                {showEmojiPicker && (
                  <div className="absolute bottom-12 right-0 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 z-50 w-64 max-h-40 overflow-y-auto">
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJIS.map((emoji, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="p-1 text-lg hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          title={`Insertar ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón enviar estilo WhatsApp */}
              <div className="flex items-end gap-3">
                <div className="flex-1"></div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="w-12 h-12 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                  title={sending ? "Enviando..." : "Enviar mensaje (Ctrl+Enter)"}
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <svg className="w-5 h-5 transform rotate-45" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </form>

        {/* Aviso de conversación cerrada - pero puede reabrir escribiendo */}
        {conversation?.status === 'closed' && (
          <div className="px-4 pb-2 -mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              ✅ Conversación cerrada. Escribe un mensaje si necesitas reabrir.
            </p>
          </div>
        )}
      </div>

      {/* Modal para expandir imagen (estilo WhatsApp) */}
      {expandedImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            {/* Botón de cerrar */}
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors border-2 border-white/30 hover:border-white/50"
              title="Cerrar (ESC)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Imagen expandida */}
            <img
              src={expandedImage}
              alt="Imagen expandida"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Botón para abrir en nueva pestaña */}
            <button
              onClick={() => window.open(expandedImage, '_blank')}
              className="absolute bottom-4 right-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              🔗 Abrir en nueva pestaña
            </button>
          </div>
        </div>
      )}
    </div>
  )
}