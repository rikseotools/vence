// app/api/profile/avatar-settings/route.ts - API endpoint para configuración de avatares automáticos
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetAvatarSettingsRequest,
  safeParseUpdateAvatarSettingsRequest,
  safeParseCalculateProfileRequest,
  getAvatarSettings,
  updateAvatarSettings,
  calculateUserProfile,
  previewUserProfile,
  updateAvatarRotation
} from '@/lib/api/avatar-settings'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener configuración de avatar
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const preview = searchParams.get('preview') === 'true'

    // Validar request con Zod
    const parseResult = safeParseGetAvatarSettingsRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante' },
        { status: 400 }
      )
    }

    // Si es preview, calcular perfil sugerido
    if (preview) {
      try {
        const previewData = await previewUserProfile(parseResult.data.userId)
        return NextResponse.json({
          success: true,
          preview: previewData
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
      } catch (previewError) {
        console.error('❌ [API/avatar-settings] Error en preview:', previewError)
        return NextResponse.json(
          { success: false, error: 'Error al calcular preview de perfil' },
          { status: 500 }
        )
      }
    }

    // Obtener configuración normal
    const result = await getAvatarSettings(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ [API/avatar-settings] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// PUT: Actualizar configuración de avatar
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseUpdateAvatarSettingsRequest(body)
    if (!parseResult.success) {
      console.warn('⚠️ [API/avatar-settings] Validación fallida:', parseResult.error.issues)
      return NextResponse.json(
        { success: false, error: 'Datos de configuración inválidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Si se está cambiando a modo automático, calcular y asignar perfil
    if (parseResult.data.data.mode === 'automatic') {
      const profileResult = await calculateUserProfile({ userId: parseResult.data.userId })

      if (profileResult.success && profileResult.profile) {
        // Actualizar con el perfil calculado
        const updateResult = await updateAvatarSettings({
          userId: parseResult.data.userId,
          data: {
            mode: 'automatic',
            currentProfile: profileResult.profile.id,
            currentEmoji: profileResult.profile.emoji,
            currentName: profileResult.profile.nameEs
          }
        })

        if (!updateResult.success) {
          return NextResponse.json(updateResult, { status: 400 })
        }

        return NextResponse.json({
          ...updateResult,
          metrics: profileResult.metrics,
          matchedConditions: profileResult.matchedConditions
        })
      }
    }

    // Actualización normal
    const result = await updateAvatarSettings(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/avatar-settings] Error PUT:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// POST: Calcular perfil (para preview o recálculo manual)
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action

    // Acción: calcular perfil sin guardar
    if (action === 'calculate') {
      const parseResult = safeParseCalculateProfileRequest({ userId: body.userId })
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: 'userId inválido o faltante' },
          { status: 400 }
        )
      }

      const result = await calculateUserProfile(parseResult.data)
      return NextResponse.json(result)
    }

    // Acción: aplicar perfil calculado
    if (action === 'apply') {
      const parseResult = safeParseCalculateProfileRequest({ userId: body.userId })
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: 'userId inválido o faltante' },
          { status: 400 }
        )
      }

      // Calcular perfil
      const profileResult = await calculateUserProfile(parseResult.data)
      if (!profileResult.success || !profileResult.profile) {
        return NextResponse.json(profileResult, { status: 400 })
      }

      // Aplicar rotación
      const rotationSuccess = await updateAvatarRotation(
        parseResult.data.userId,
        profileResult.profile
      )

      if (!rotationSuccess) {
        return NextResponse.json(
          { success: false, error: 'Error al aplicar rotación de avatar' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        profile: profileResult.profile,
        metrics: profileResult.metrics,
        matchedConditions: profileResult.matchedConditions,
        rotationApplied: true
      })
    }

    return NextResponse.json(
      { success: false, error: 'Acción no reconocida. Usa "calculate" o "apply"' },
      { status: 400 }
    )

  } catch (error) {
    console.error('❌ [API/avatar-settings] Error POST:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// OPTIONS: CORS preflight
// ============================================

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
