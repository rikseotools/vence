// components/OposicionDetector.tsx - VERSIÓN CORREGIDA CON FIX RLS
// ========================================
// 🚨 FIX CRÍTICO: Error 403 Row-Level Security Policy Violation
// ========================================

'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getSupabaseClient } from '../lib/supabase' // 🔧 USAR SINGLETON

const supabase = getSupabaseClient()

interface OposicionData {
  id: string
  name: string
  categoria: 'C1' | 'C2'
  administracion: 'estado' | 'justicia' | 'autonomica'
  slug: string
}

// 📋 Mapeo URL → Oposición
const OPOSICION_DETECTION: Record<string, OposicionData> = {
  'auxiliar-administrativo-estado': {
    id: 'auxiliar_administrativo_estado',
    name: 'Auxiliar Administrativo del Estado',
    categoria: 'C2',
    administracion: 'estado',
    slug: 'auxiliar-administrativo-estado'
  },
  'administrativo-estado': {
    id: 'administrativo_estado',
    name: 'Administrativo del Estado',
    categoria: 'C1',
    administracion: 'estado',
    slug: 'administrativo-estado'
  },
  'tramitacion-procesal': {
    id: 'tramitacion_procesal',
    name: 'Tramitación Procesal y Administrativa',
    categoria: 'C1',
    administracion: 'justicia',
    slug: 'tramitacion-procesal'
  },
  'auxilio-judicial': {
    id: 'auxilio_judicial',
    name: 'Auxilio Judicial',
    categoria: 'C2',
    administracion: 'justicia',
    slug: 'auxilio-judicial'
  },
  'auxiliar-administrativo-carm': {
    id: 'auxiliar_administrativo_carm',
    name: 'Auxiliar Administrativo CARM (Murcia)',
    categoria: 'C2',
    administracion: 'autonomica',
    slug: 'auxiliar-administrativo-carm'
  },
  'auxiliar-administrativo-cyl': {
    id: 'auxiliar_administrativo_cyl',
    name: 'Auxiliar Administrativo de Castilla y León',
    categoria: 'C2',
    administracion: 'autonomica',
    slug: 'auxiliar-administrativo-cyl'
  },
  'auxiliar-administrativo-andalucia': {
    id: 'auxiliar_administrativo_andalucia',
    name: 'Auxiliar Administrativo Junta de Andalucía',
    categoria: 'C2',
    administracion: 'autonomica',
    slug: 'auxiliar-administrativo-andalucia'
  },
  'auxiliar-administrativo-madrid': {
    id: 'auxiliar_administrativo_madrid',
    name: 'Auxiliar Administrativo Comunidad de Madrid',
    categoria: 'C2',
    administracion: 'autonomica',
    slug: 'auxiliar-administrativo-madrid'
  },
  'gestion-procesal': {
    id: 'gestion_procesal',
    name: 'Gestión Procesal y Administrativa',
    categoria: 'C1',
    administracion: 'justicia',
    slug: 'gestion-procesal'
  }
}

export default function OposicionDetector() {
  const pathname = usePathname()

  useEffect(() => {
    let isDetecting = false

    const detectAndAssignOposicion = async () => {
      // Evitar múltiples ejecuciones
      if (isDetecting) {
        console.log('⚠️ Ya detectando oposición, evitando duplicación')
        return
      }

      isDetecting = true

      try {
        // 1. Verificar si hay usuario autenticado CON TIMEOUT
        console.log('👤 Verificando usuario autenticado...')

        const { data: { user }, error: userError } = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ])

        if (userError) {
          console.log('👤 Error verificando usuario:', userError.message)
          return
        }

        if (!user) {
          console.log('👤 Usuario no autenticado - no se asigna oposición')
          return
        }

        console.log('✅ Usuario autenticado:', user.email)

        // 2. Verificar si ya tiene oposición asignada
        console.log('🔍 Verificando oposición existente...')

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('target_oposicion, target_oposicion_data')
          .eq('id', user.id)
          .single()

        if (!profileError && profile?.target_oposicion) {
          console.log('✅ Usuario ya tiene oposición asignada:', profile.target_oposicion)
          return
        }

        // 3. Detectar oposición desde URL
        const detectedOposicion = detectOposicionFromUrl(pathname)

        if (!detectedOposicion) {
          console.log('🔍 No se detectó oposición en URL:', pathname)
          return
        }

        console.log('🎯 Oposición detectada:', detectedOposicion.name)

        // 4. Asignar automáticamente CON RETRY
        const success = await assignOposicionToUserWithRetry(user.id, detectedOposicion)

        if (success) {
          console.log('🎯 ¡Oposición asignada automáticamente!', detectedOposicion.name)

          // Mostrar notificación
          showAssignmentNotification(detectedOposicion.name)

          // Disparar evento para que otros componentes se actualicen
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('oposicionAssigned', {
              detail: { oposicion: detectedOposicion }
            }))
            window.dispatchEvent(new CustomEvent('profileUpdated'))
          }
        }

      } catch (error) {
        console.error('❌ Error en detección de oposición:', error)
      } finally {
        isDetecting = false
      }
    }

    // Solo ejecutar en páginas de test o temario
    if (!pathname || (!pathname.includes('/test/') && !pathname.includes('/temario/'))) {
      return
    }

    // Delay pequeño para evitar conflictos con otros componentes
    const timeoutId = setTimeout(() => {
      detectAndAssignOposicion()
    }, 1000)

    return () => clearTimeout(timeoutId)

  }, [pathname])

  // Este componente no renderiza nada
  return null
}

// 🔍 Detectar oposición desde URL
function detectOposicionFromUrl(pathname: string | null): OposicionData | null {
  if (!pathname) return null

  for (const [pattern, oposicion] of Object.entries(OPOSICION_DETECTION)) {
    if (pathname.includes(pattern)) {
      return oposicion
    }
  }
  return null
}

// 💾 VERSIÓN CORREGIDA: Asignar oposición con manejo de errores RLS
async function assignOposicionToUserWithRetry(userId: string, oposicionData: OposicionData, maxRetries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`💾 Intento ${attempt}/${maxRetries} - Asignando oposición...`)

    const success = await assignOposicionToUser(userId, oposicionData)

    if (success) {
      return true
    }

    if (attempt < maxRetries) {
      console.log(`⏳ Reintentando en ${attempt} segundos...`)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000))
    }
  }

  console.error('❌ Falló asignación después de todos los intentos')
  return false
}

// ✅ FUNCIÓN CORREGIDA para evitar error RLS
async function assignOposicionToUser(userId: string, oposicionData: OposicionData): Promise<boolean> {
  try {
    console.log('💾 Asignando oposición con políticas RLS corregidas...')

    // ✅ VERIFICAR USUARIO AUTENTICADO PRIMERO
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('❌ Usuario no autenticado para asignación')
      return false
    }

    if (user.id !== userId) {
      console.error('❌ ID de usuario no coincide')
      return false
    }

    // ✅ MÉTODO 1: UPSERT con verificación previa
    console.log('📝 Intentando UPSERT...')

    const profileData = {
      id: userId, // ✅ CRÍTICO: Usar ID del usuario autenticado
      target_oposicion: oposicionData.id,
      target_oposicion_data: JSON.stringify(oposicionData),
      first_oposicion_detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: false
      })

    if (!upsertError) {
      console.log('✅ UPSERT exitoso')
      return true
    }

    console.warn('⚠️ UPSERT falló:', upsertError.message)

    // ✅ MÉTODO 2: INSERT directo como fallback
    console.log('📝 Intentando INSERT directo...')

    const { error: insertError } = await supabase
      .from('user_profiles')
      .insert(profileData)

    if (!insertError) {
      console.log('✅ INSERT directo exitoso')
      return true
    }

    console.warn('⚠️ INSERT directo falló:', insertError.message)

    // ✅ MÉTODO 3: UPDATE si el perfil ya existe
    console.log('📝 Intentando UPDATE...')

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        target_oposicion: oposicionData.id,
        target_oposicion_data: JSON.stringify(oposicionData),
        first_oposicion_detected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (!updateError) {
      console.log('✅ UPDATE exitoso')
      return true
    }

    console.error('❌ Todos los métodos fallaron')
    console.error('UPSERT error:', upsertError)
    console.error('INSERT error:', insertError)
    console.error('UPDATE error:', updateError)

    return false

  } catch (error) {
    console.error('❌ Error general en assignOposicionToUser:', error)
    return false
  }
}

// 🔔 Mostrar notificación de asignación
function showAssignmentNotification(oposicionName: string) {
  // Notificación discreta en consola
  console.log(`🎉 ¡Perfecto! Ahora estudias: ${oposicionName}`)

  // ✅ MEJORADO: Notificación visual temporal
  if (typeof window !== 'undefined') {
    // Crear notificación visual temporal
    const notification = document.createElement('div')
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10B981, #059669);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 600;
        max-width: 300px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">🎯</span>
          <div>
            <div>¡Oposición detectada!</div>
            <div style="font-size: 12px; opacity: 0.9; font-weight: normal;">
              ${oposicionName}
            </div>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(notification)

    // Animación de entrada
    setTimeout(() => {
      const el = notification.firstElementChild as HTMLElement | null
      if (el) el.style.transform = 'translateX(0)'
    }, 100)

    // Auto-remover después de 4 segundos
    setTimeout(() => {
      const el = notification.firstElementChild as HTMLElement | null
      if (el) el.style.transform = 'translateX(100%)'
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 4000)
  }

  // Guardar en localStorage para mostrar mensaje en header
  if (typeof window !== 'undefined') {
    localStorage.setItem('newOposicionAssigned', JSON.stringify({
      name: oposicionName,
      timestamp: Date.now()
    }))
  }
}
