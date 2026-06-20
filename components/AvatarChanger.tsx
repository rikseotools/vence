// components/AvatarChanger.tsx - CON ACTUALIZACIÓN AUTOMÁTICA DEL HEADER Y AVATARES POR COMPORTAMIENTO
'use client'
import { useState, useEffect, type ChangeEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/auth' // puerto agnóstico para auth.* (updateUser/getSession)

interface AvatarOption { id: string; emoji: string; name: string; color: string }
interface AvatarCategory { title: string; avatars: AvatarOption[] }

interface AvatarData {
  type: 'predefined' | 'custom' | 'default'
  emoji?: string
  color?: string
  name?: string
  url?: string
}

interface AvatarChangerUser {
  id: string
  email?: string | null
  user_metadata?: { full_name?: string | null } | null
}

interface AvatarChangerProps {
  user: AvatarChangerUser
  currentAvatar?: { type?: string | null; url?: string | null; emoji?: string | null; color?: string | null; name?: string | null } | null
  onAvatarChange: (avatarData: AvatarData) => void
}

// 🎨 Avatares organizados por categorías
const AVATAR_CATEGORIES: Record<string, AvatarCategory> = {
  animals: {
    title: '🐾 Animales',
    avatars: [
      { id: 'cat', emoji: '🐱', name: 'Gato', color: 'from-orange-400 to-yellow-400' },
      { id: 'dog', emoji: '🐶', name: 'Perro', color: 'from-yellow-600 to-orange-500' },
      { id: 'lion', emoji: '🦁', name: 'León', color: 'from-yellow-500 to-orange-500' },
      { id: 'tiger', emoji: '🐯', name: 'Tigre', color: 'from-orange-500 to-red-500' },
      { id: 'horse', emoji: '🐴', name: 'Caballo', color: 'from-brown-500 to-orange-600' },
      { id: 'unicorn', emoji: '🦄', name: 'Unicornio', color: 'from-pink-400 to-purple-500' },
      { id: 'cow', emoji: '🐮', name: 'Vaca', color: 'from-gray-500 to-pink-300' },
      { id: 'pig', emoji: '🐷', name: 'Cerdo', color: 'from-pink-400 to-pink-500' },
      { id: 'rabbit', emoji: '🐰', name: 'Conejo', color: 'from-gray-300 to-pink-300' },
      { id: 'bear', emoji: '🐻', name: 'Oso', color: 'from-brown-400 to-brown-500' },
      { id: 'panda', emoji: '🐼', name: 'Panda', color: 'from-gray-700 to-gray-400' },
      { id: 'koala', emoji: '🐨', name: 'Koala', color: 'from-gray-400 to-gray-500' },
      { id: 'monkey', emoji: '🐵', name: 'Mono', color: 'from-yellow-600 to-brown-500' },
      { id: 'chicken', emoji: '🐔', name: 'Pollo', color: 'from-yellow-300 to-orange-400' },
      { id: 'penguin', emoji: '🐧', name: 'Pingüino', color: 'from-gray-800 to-gray-600' },
      { id: 'bird', emoji: '🐦', name: 'Pájaro', color: 'from-blue-400 to-blue-500' },
      { id: 'eagle', emoji: '🦅', name: 'Águila', color: 'from-brown-600 to-yellow-600' },
      { id: 'duck', emoji: '🦆', name: 'Pato', color: 'from-yellow-400 to-green-400' },
      { id: 'owl', emoji: '🦉', name: 'Búho', color: 'from-brown-500 to-gray-500' },
      { id: 'flamingo', emoji: '🦩', name: 'Flamenco', color: 'from-pink-500 to-pink-400' },
      { id: 'peacock', emoji: '🦚', name: 'Pavo Real', color: 'from-blue-500 to-green-500' },
      { id: 'parrot', emoji: '🦜', name: 'Loro', color: 'from-green-500 to-red-500' },
      { id: 'frog', emoji: '🐸', name: 'Rana', color: 'from-green-400 to-green-500' },
      { id: 'turtle', emoji: '🐢', name: 'Tortuga', color: 'from-green-600 to-green-700' },
      { id: 'lizard', emoji: '🦎', name: 'Lagarto', color: 'from-green-500 to-yellow-500' },
      { id: 'snake', emoji: '🐍', name: 'Serpiente', color: 'from-green-600 to-green-800' },
      { id: 'dragon', emoji: '🐲', name: 'Dragón', color: 'from-red-500 to-purple-600' },
      { id: 'whale', emoji: '🐋', name: 'Ballena', color: 'from-blue-600 to-blue-700' },
      { id: 'dolphin', emoji: '🐬', name: 'Delfín', color: 'from-blue-400 to-blue-500' },
      { id: 'fish', emoji: '🐠', name: 'Pez', color: 'from-blue-400 to-yellow-400' },
      { id: 'octopus', emoji: '🐙', name: 'Pulpo', color: 'from-purple-500 to-pink-500' },
      { id: 'crab', emoji: '🦀', name: 'Cangrejo', color: 'from-red-500 to-orange-500' },
      { id: 'lobster', emoji: '🦞', name: 'Langosta', color: 'from-red-600 to-red-500' },
      { id: 'shrimp', emoji: '🦐', name: 'Camarón', color: 'from-orange-400 to-red-400' },
      { id: 'snail', emoji: '🐌', name: 'Caracol', color: 'from-brown-400 to-green-400' },
      { id: 'butterfly', emoji: '🦋', name: 'Mariposa', color: 'from-blue-400 to-purple-400' },
      { id: 'bee', emoji: '🐝', name: 'Abeja', color: 'from-yellow-400 to-black' },
      { id: 'ladybug', emoji: '🐞', name: 'Mariquita', color: 'from-red-500 to-black' },
      { id: 'spider', emoji: '🕷️', name: 'Araña', color: 'from-gray-800 to-gray-900' },
      { id: 'scorpion', emoji: '🦂', name: 'Escorpión', color: 'from-orange-600 to-brown-600' },
      { id: 'squirrel', emoji: '🐿️', name: 'Ardilla', color: 'from-orange-500 to-brown-500' },
      { id: 'wolf', emoji: '🐺', name: 'Lobo', color: 'from-gray-600 to-gray-700' },
      { id: 'zebra', emoji: '🦓', name: 'Cebra', color: 'from-gray-300 to-gray-800' },
      { id: 'giraffe', emoji: '🦒', name: 'Jirafa', color: 'from-yellow-500 to-orange-600' },
      { id: 'elephant', emoji: '🐘', name: 'Elefante', color: 'from-gray-500 to-gray-600' },
      { id: 'rhino', emoji: '🦏', name: 'Rinoceronte', color: 'from-gray-600 to-gray-700' },
      { id: 'hippo', emoji: '🦛', name: 'Hipopótamo', color: 'from-purple-400 to-gray-500' },
      { id: 'kangaroo', emoji: '🦘', name: 'Canguro', color: 'from-orange-400 to-brown-400' }
    ]
  },
  professions: {
    title: '💼 Profesiones',
    avatars: [
      { id: 'student', emoji: '🎓', name: 'Estudiante', color: 'from-blue-500 to-blue-600' },
      { id: 'lawyer', emoji: '⚖️', name: 'Abogado/a', color: 'from-gray-600 to-gray-700' },
      { id: 'admin', emoji: '👨‍💼', name: 'Administrativo', color: 'from-green-500 to-green-600' },
      { id: 'police', emoji: '👮', name: 'Policía', color: 'from-blue-600 to-indigo-600' },
      { id: 'guard', emoji: '🛡️', name: 'Guardia Civil', color: 'from-green-600 to-green-700' },
      { id: 'judge', emoji: '👨‍⚖️', name: 'Juez/a', color: 'from-purple-500 to-purple-600' },
      { id: 'teacher', emoji: '👨‍🏫', name: 'Profesor/a', color: 'from-teal-500 to-teal-600' },
      { id: 'doctor', emoji: '👨‍⚕️', name: 'Doctor/a', color: 'from-red-500 to-pink-500' },
      { id: 'nurse', emoji: '👩‍⚕️', name: 'Enfermero/a', color: 'from-pink-400 to-red-400' },
      { id: 'firefighter', emoji: '👨‍🚒', name: 'Bombero/a', color: 'from-red-500 to-orange-500' },
      { id: 'astronaut', emoji: '👨‍🚀', name: 'Astronauta', color: 'from-blue-700 to-purple-700' },
      { id: 'pilot', emoji: '👨‍✈️', name: 'Piloto', color: 'from-sky-500 to-blue-600' }
    ]
  },
  emojis: {
    title: '😊 Emociones',
    avatars: [
      { id: 'happy', emoji: '😄', name: 'Feliz', color: 'from-yellow-400 to-orange-400' },
      { id: 'cool', emoji: '😎', name: 'Genial', color: 'from-blue-500 to-purple-500' },
      { id: 'love', emoji: '😍', name: 'Enamorado', color: 'from-pink-400 to-red-400' },
      { id: 'wink', emoji: '😉', name: 'Guiño', color: 'from-yellow-400 to-orange-400' },
      { id: 'think', emoji: '🤔', name: 'Pensativo', color: 'from-gray-400 to-gray-500' },
      { id: 'nerd', emoji: '🤓', name: 'Estudioso', color: 'from-blue-400 to-blue-500' },
      { id: 'star-eyes', emoji: '🤩', name: 'Emocionado', color: 'from-yellow-400 to-pink-400' }
    ]
  },
  objects: {
    title: '🎯 Objetos',
    avatars: [
      { id: 'rocket', emoji: '🚀', name: 'Cohete', color: 'from-blue-600 to-purple-600' },
      { id: 'star', emoji: '⭐', name: 'Estrella', color: 'from-yellow-400 to-yellow-500' },
      { id: 'fire', emoji: '🔥', name: 'Fuego', color: 'from-red-500 to-orange-500' },
      { id: 'rainbow', emoji: '🌈', name: 'Arcoíris', color: 'from-purple-400 to-pink-400' },
      { id: 'sun', emoji: '☀️', name: 'Sol', color: 'from-yellow-400 to-orange-400' },
      { id: 'moon', emoji: '🌙', name: 'Luna', color: 'from-gray-600 to-blue-600' },
      { id: 'planet', emoji: '🪐', name: 'Planeta', color: 'from-orange-400 to-purple-500' },
      { id: 'diamond', emoji: '💎', name: 'Diamante', color: 'from-blue-400 to-cyan-400' },
      { id: 'crown', emoji: '👑', name: 'Corona', color: 'from-yellow-500 to-yellow-600' },
      { id: 'trophy', emoji: '🏆', name: 'Trofeo', color: 'from-yellow-500 to-yellow-600' }
    ]
  }
}

export default function AvatarChanger({ user, currentAvatar, onAvatarChange }: AvatarChangerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('animals')
  const [uploadingImage, setUploadingImage] = useState(false)
  const { supabase } = useAuth() // Obtener supabase del contexto

  // 🤖 Estado para avatar automático
  const [avatarMode, setAvatarMode] = useState('manual') // 'manual' | 'automatic'

  // 🔄 Cargar configuración de avatar automático
  useEffect(() => {
    if (user?.id) {
      loadAvatarSettings()
    }
  }, [user?.id])

  const loadAvatarSettings = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/profile/avatar-settings?userId=${user.id}`)
      const data = await response.json()
      if (data.success && data.data?.mode) {
        setAvatarMode(data.data.mode)
      }
    } catch (error) {
      console.error('Error cargando configuración de avatar:', error)
    }
  }

  // 🎨 Seleccionar avatar predefinido
  const handleSelectPredefinedAvatar = async (avatar: AvatarOption) => {
    try {
      // Si estaba en modo automático, cambiar a manual
      if (avatarMode === 'automatic') {
        await fetch('/api/profile/avatar-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            data: { mode: 'manual' }
          })
        })
        setAvatarMode('manual')
      }

      const avatarData: AvatarData = {
        type: 'predefined',
        emoji: avatar.emoji,
        color: avatar.color,
        name: avatar.name
      }

      // Actualizar en Supabase Auth user_metadata
      const updated = await auth.updateUser({
        data: {
          avatar_type: 'predefined',
          avatar_emoji: avatar.emoji,
          avatar_color: avatar.color,
          avatar_name: avatar.name
        }
      })

      if (!updated) throw new Error('No se pudo actualizar el avatar')

      // IMPORTANTE: También actualizar public_user_profiles para que se vea en el ranking
      // Usar UPDATE en lugar de UPSERT porque display_name es NOT NULL y el registro ya existe
      const { error: profileError } = await supabase
        .from('public_user_profiles')
        .update({
          avatar_type: 'predefined',
          avatar_emoji: avatar.emoji,
          avatar_color: avatar.color,
          avatar_name: avatar.name,
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (profileError) {
        console.warn('Error actualizando perfil público:', profileError)
      } else {
        console.log('✅ Avatar actualizado en public_user_profiles')
      }

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

  // 📸 Subir imagen propia
  const handleUploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const fileType = file.type.toLowerCase()

    if (!allowedTypes.includes(fileType)) {
      // Si es AVIF o HEIC, dar mensaje específico
      if (fileType === 'image/avif' || fileType === 'image/heic' || fileType === 'image/heif') {
        alert('Este formato de imagen aún no está soportado. Por favor usa JPG, PNG o GIF.')
      } else if (!fileType.startsWith('image/')) {
        alert('Por favor selecciona una imagen válida')
      } else {
        alert(`Formato no soportado (${fileType}). Por favor usa JPG, PNG o GIF.`)
      }
      return
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no debe superar los 2MB')
      return
    }

    setUploadingImage(true)
    try {
      // Bloque 5 Fase A: el upload pasa por /api/upload-avatar (server-side),
      // que usa el adapter agnóstico `lib/storage` (S3 o Supabase según
      // STORAGE_PROVIDER). El navegador ya NO habla con supabase.storage.
      const session = await auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch('/api/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: formData,
      })

      if (!uploadResponse.ok) {
        const err = await uploadResponse.json().catch(() => ({ error: 'upload failed' }))
        throw new Error(err.error || `upload failed (${uploadResponse.status})`)
      }

      const { url: publicUrl } = await uploadResponse.json()

      // Actualizar metadata del usuario
      const updated = await auth.updateUser({
        data: {
          avatar_type: 'custom',
          avatar_url: publicUrl
        }
      })

      if (!updated) throw new Error('No se pudo actualizar el avatar')

      // IMPORTANTE: También actualizar public_user_profiles para que se vea en el ranking
      // Usar UPDATE en lugar de UPSERT porque display_name es NOT NULL y el registro ya existe
      const { error: profileError } = await supabase
        .from('public_user_profiles')
        .update({
          avatar_type: 'uploaded',
          avatar_url: publicUrl,
          avatar_emoji: null,
          avatar_color: null,
          avatar_name: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (profileError) {
        console.warn('Error actualizando perfil público con imagen:', profileError)
      } else {
        console.log('✅ Imagen actualizada en public_user_profiles')
      }

      // Actualizar estado local
      const avatarData: AvatarData = {
        type: 'custom',
        url: publicUrl
      }

      window.dispatchEvent(new CustomEvent('avatarChanged', {
        detail: { avatarData }
      }))

      setTimeout(() => {
        window.location.reload()
      }, 100)

      onAvatarChange(avatarData)
      setIsOpen(false)

      console.log('✅ Imagen de avatar subida correctamente')
    } catch (error) {
      console.error('❌ Error subiendo imagen:', error)
      alert('Error al subir la imagen. Por favor intenta de nuevo.')
    } finally {
      setUploadingImage(false)
    }
  }

  // 🔄 Resetear a inicial por defecto
  const handleResetToDefault = async () => {
    try {
      const updated = await auth.updateUser({
        data: {
          avatar_type: 'default',
          avatar_emoji: null,
          avatar_color: null,
          avatar_name: null
        }
      })

      if (!updated) throw new Error('No se pudo restablecer el avatar')

      // IMPORTANTE: También resetear en public_user_profiles
      const { error: profileError } = await supabase
        .from('public_user_profiles')
        .upsert({
          id: user.id,
          avatar_type: null,
          avatar_url: null,
          avatar_emoji: null,
          avatar_color: null,
          avatar_name: null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.warn('Error reseteando avatar en perfil público:', profileError)
      } else {
        console.log('✅ Avatar reseteado en public_user_profiles')
      }

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

    // Avatar personalizado (imagen subida)
    if (currentAvatar?.type === 'custom' && currentAvatar.url) {
      return (
        <img
          src={currentAvatar.url}
          alt="Avatar personalizado"
          className="w-24 h-24 rounded-full object-cover"
        />
      )
    }

    // Avatar predefinido (emoji)
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
    <div className="relative inline-block">
      {/* Avatar actual con botón para cambiar */}
      <div className="relative group cursor-pointer" onClick={() => setIsOpen(true)}>
        {renderCurrentAvatar()}

        {/* Overlay con cámara al hacer hover */}
        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-white text-2xl">🎨</span>
        </div>

        {/* Botón editar - pegado al borde del avatar */}
        <button className="absolute bottom-0 right-0 w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors shadow-md text-sm">
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
            <div className="p-6">
              {/* Pestañas de categorías */}
              <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-3">
                {Object.entries(AVATAR_CATEGORIES).map(([key, category]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === key
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {category.title}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedCategory('upload')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === 'upload'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📸 Subir Imagen
                </button>
              </div>

              {/* Contenido de avatares o subida */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {selectedCategory === 'upload' ? (
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <div className="w-32 h-32 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        {uploadingImage ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        ) : (
                          <span className="text-4xl text-gray-400">📷</span>
                        )}
                      </div>
                    </div>
                    <h4 className="font-medium text-gray-800 mb-2">
                      Sube tu propia imagen
                    </h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Máximo 2MB • JPG, PNG o GIF
                    </p>
                    <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                      <span>Seleccionar imagen</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                    {AVATAR_CATEGORIES[selectedCategory]?.avatars.map((avatar) => (
                      <button
                        key={avatar.id}
                        onClick={() => handleSelectPredefinedAvatar(avatar)}
                        className="group relative p-2 rounded-lg hover:bg-gray-50 transition-colors"
                        title={avatar.name}
                      >
                        <div
                          className={`w-14 h-14 bg-gradient-to-r ${avatar.color} rounded-full flex items-center justify-center text-white text-2xl hover:scale-110 transition-transform shadow-lg`}
                        >
                          {avatar.emoji}
                        </div>
                        <div className="text-xs text-gray-600 mt-1 text-center truncate">
                          {avatar.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
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