// app/api/upload-feedback-image/route.js
// API endpoint para subir imágenes de feedback desde el lado del usuario.
//
// Bloque 5 Fase A (2026-05-25): migrado de supabase.storage directo al
// adapter agnóstico `lib/storage`. Provider se decide por env
// STORAGE_PROVIDER ('s3' | 'supabase'). El nombre lógico del bucket
// (feedback-images) lo entiende cualquier provider.

import { NextResponse } from 'next/server'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getStorage } from '@/lib/storage'

async function _POST(request) {
  try {
    console.log('📤 [API] Iniciando subida de imagen de feedback...')

    // Obtener datos del FormData
    const formData = await request.formData()
    const file = formData.get('file')
    const userPath = formData.get('userPath') || 'user-feedback-images'

    if (!file) {
      console.error('❌ [API] No se recibió archivo')
      return NextResponse.json(
        { error: 'No se recibió archivo' },
        { status: 400 }
      )
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      console.error('❌ [API] Tipo de archivo no válido:', file.type)
      return NextResponse.json(
        { error: 'Solo se permiten archivos de imagen' },
        { status: 400 }
      )
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.error('❌ [API] Archivo demasiado grande:', file.size, 'bytes')
      return NextResponse.json(
        { error: 'La imagen no puede ser mayor a 5MB' },
        { status: 400 }
      )
    }

    console.log('📝 [API] Archivo válido:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    // Crear nombre único para el archivo
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${userPath}/${fileName}`

    const storage = getStorage()
    console.log(`📤 [API] Subiendo (provider=${storage.provider}):`, filePath)

    // Convertir file a ArrayBuffer para el adapter
    const arrayBuffer = await file.arrayBuffer()

    const result = await storage.upload({
      bucket: 'feedback-images',
      path: filePath,
      data: arrayBuffer,
      contentType: file.type,
      cacheControl: '3600',
      upsert: true,
    })

    if (!result.success) {
      console.error('❌ [API] Error storage adapter:', result.error)
      return NextResponse.json(
        { error: `Error subiendo archivo: ${result.error}` },
        { status: 500 }
      )
    }

    console.log('✅ [API] Archivo subido exitosamente')
    console.log('🔗 [API] URL pública generada:', result.publicUrl)

    return NextResponse.json({
      success: true,
      url: result.publicUrl,
      path: filePath,
      fileName: file.name,
    })
  } catch (error) {
    console.error('❌ [API] Error general:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error.message}` },
      { status: 500 }
    )
  }
}

async function _DELETE(request) {
  try {
    console.log('🗑️ [API] Iniciando eliminación de imagen de feedback...')

    const { searchParams } = new URL(request.url)
    const imagePath = searchParams.get('path')

    if (!imagePath) {
      return NextResponse.json(
        { error: 'Path de imagen requerido' },
        { status: 400 }
      )
    }

    const storage = getStorage()
    console.log(`🗑️ [API] Eliminando (provider=${storage.provider}):`, imagePath)

    const result = await storage.remove({
      bucket: 'feedback-images',
      paths: [imagePath],
    })

    if (!result.success) {
      console.error('❌ [API] Error eliminando de storage:', result.error)
      return NextResponse.json(
        { error: `Error eliminando archivo: ${result.error}` },
        { status: 500 }
      )
    }

    console.log('✅ [API] Imagen eliminada exitosamente')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ [API] Error general eliminando:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error.message}` },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/upload-feedback-image', _POST)
export const DELETE = withErrorLogging('/api/upload-feedback-image', _DELETE)
