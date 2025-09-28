// components/AvatarChanger.js - CON ACTUALIZACIÓN AUTOMÁTICA DEL HEADER
'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 🎨 Avatares básicos para probar
const PREDEFINED_AVATARS = [
  { id: 'student', emoji: '🎓', name: 'Estudiante', color: 'from-blue-500 to-blue-600' },
  { id: 'lawyer', emoji: '⚖️', name: 'Abogado/a', color: 'from-gray-600 to-gray-700' },
  { id: 'admin', emoji: '👨‍💼', name: 'Administrativo', color: 'from-green-500 to-green-600' },
  { id: 'police', emoji: '👮‍♂️', name: 'Policía', color: 'from-blue-600 to-indigo-600' },
  { id: 'guard', emoji: '🛡️', name: 'Guardia Civil', color: 'from-green-600 to-green-700' },
  { id: 'judge', emoji: '👨‍⚖️', name: 'Juez/a', color: 'from-purple-500 to-purple-600' },
  { id: 'teacher', emoji: '👨‍🏫', name: 'Professor/a', color: 'from-teal-500 to-teal-600' },
  { id: 'doctor', emoji: '👨‍⚕️', name: 'Doctor/a', color: 'from-red-500 to-pink-500' },
  { id: 'cat', emoji: '🐱', name: 'Gato', color: 'from-orange-400 to-yellow-400' },
  { id: 'dog', emoji: '🐶', name: 'Perro', color: 'from-brown-400 to-yellow-600' },
  { id: 'lion', emoji: '🦁', name: 'León', color: 'from-yellow-500 to-orange-500' },
  { id: 'pizza', emoji: '🍕', name: 'Pizza', color: 'from-red-500 to-yellow-500' },
  { id: 'rocket', emoji: '🚀', name: 'Cohete', color: 'from-blue-600 to-purple-600' },
  { id: 'star', emoji: '⭐', name: 'Estrella', color: 'from-yellow-400 to-yellow-500' },
  { id: 'happy', emoji: '😄', name: 'Feliz', color: 'from-yellow-400 to-orange-400' },
  { id: 'cool', emoji: '😎', name: 'Genial', color: 'from-blue-500 to-purple-500' }
]

export default function AvatarChanger({ user, currentAvatar, onAvatarChange }) {
  const [isOpen, setIsOpen] = useState(false)

  // 🎨 Seleccionar avatar predefinido
  const handleSelectPredefinedAvatar = async (avatar) => {
    try {
      const avatarData = {
        type: 'predefined',
        emoji: avatar.emoji,
        color: avatar.color,
        name: avatar.name
      }

      // Actualizar en Supabase Auth user_metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          avatar_type: 'predefined',
          avatar_emoji: avatar.emoji,
          avatar_color: avatar.color,
          avatar_name: avatar.name
        }
      })

      if (error) throw error

      // 🔄 NUEVO: Forzar actualización del Header
      // Método 1: Disparar evento personalizado
      window.dispatchEvent(new CustomEvent('avatarChanged', {
        detail: { avatarData }
      }))

      // Método 2: Recargar datos del usuario en todos los componentes
      setTimeout(() => {
        window.location.reload()
      }, 100)

      // Callback para actualizar el componente padre
      onAvatarChange(avatarData)
      setIsOpen(false)

      console.log('✅ Avatar predefinido actualizado')
    } catch (error) {
      console.error('❌ Error actualizando avatar:', error)
    }
  }

  // 🔄 Resetear a inicial por defecto
  const handleResetToDefault = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          avatar_type: 'default',
          avatar_emoji: null,
          avatar_color: null,
          avatar_name: null
        }
      })

      if (error) throw error

      // 🔄 NUEVO: Forzar actualización del Header
      window.dispatchEvent(new CustomEvent('avatarChanged', {
        detail: { avatarData: { type: 'default' } }
      }))

      setTimeout(() => {
        window.location.reload()
      }, 100)

      onAvatarChange({
        type: 'default'
      })
      setIsOpen(false)

      console.log('✅ Avatar reseteado a inicial')
    } catch (error) {
      console.error('❌ Error reseteando avatar:', error)
    }
  }

  // 🎨 Renderizar avatar actual
  const renderCurrentAvatar = () => {
    const userInitial = user.user_metadata?.full_name?.charAt(0).toUpperCase() || 
                       user.email?.charAt(0).toUpperCase() || '?'

    if (currentAvatar?.type === 'predefined' && currentAvatar.emoji) {
      return (
        <div className={`w-24 h-24 bg-gradient-to-r ${currentAvatar.color} rounded-full flex items-center justify-center text-white text-4xl`}>
          {currentAvatar.emoji}
        </div>
      )
    }

    // Avatar por defecto (inicial)
    return (
      <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-3xl">
        {userInitial}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Avatar actual con botón para cambiar */}
      <div className="relative group cursor-pointer" onClick={() => setIsOpen(true)}>
        {renderCurrentAvatar()}
        
        {/* Overlay con cámara al hacer hover */}
        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-white text-2xl">🎨</span>
        </div>
        
        {/* Botón editar */}
        <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
          ✏️
        </button>
      </div>

      {/* Modal CORREGIDO */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999
          }}
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div 
            className="bg-white rounded-xl shadow-lg w-full max-w-2xl"
            style={{ 
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxHeight: '90vh',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">
                  🎨 Cambiar Avatar
                </h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  style={{ lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <h4 className="font-medium text-gray-800 mb-4">
                Selecciona un avatar (se actualizará automáticamente):
              </h4>
              <div className="grid grid-cols-4 gap-3">
                {PREDEFINED_AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => handleSelectPredefinedAvatar(avatar)}
                    className="group relative p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    title={avatar.name}
                  >
                    <div 
                      className={`w-16 h-16 bg-gradient-to-r ${avatar.color} rounded-full flex items-center justify-center text-white text-2xl hover:scale-105 transition-transform shadow-lg`}
                    >
                      {avatar.emoji}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 text-center">
                      {avatar.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <button
                  onClick={handleResetToDefault}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  🔄 Resetear a Inicial
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}