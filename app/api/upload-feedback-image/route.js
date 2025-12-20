// app/api/upload-feedback-image/route.js
// API endpoint para subir imágenes de feedback desde el lado del usuario

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    console.log('📤 [API] Iniciando subida de imagen de feedback...')
    
    // Crear cliente con service role para garantizar permisos
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

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

    console.log('📤 [API] Subiendo a Supabase Storage:', filePath)

    // Convertir file a ArrayBuffer para Supabase
    const arrayBuffer = await file.arrayBuffer()

    // Subir a Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('feedback-images')
      .upload(filePath, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      })

    if (uploadError) {
      console.error('❌ [API] Error de Supabase Storage:', uploadError)
      return NextResponse.json(
        { error: `Error subiendo archivo: ${uploadError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ [API] Archivo subido exitosamente')

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('feedback-images')
      .getPublicUrl(filePath)

    console.log('🔗 [API] URL pública generada:', publicUrl)

    // Responder con éxito
    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: filePath,
      fileName: file.name
    })

  } catch (error) {
    console.error('❌ [API] Error general:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function DELETE(request) {
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

    // Crear cliente con service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🗑️ [API] Eliminando imagen:', imagePath)

    // Eliminar de Supabase Storage
    const { error } = await supabase.storage
      .from('feedback-images')
      .remove([imagePath])

    if (error) {
      console.error('❌ [API] Error eliminando de storage:', error)
      return NextResponse.json(
        { error: `Error eliminando archivo: ${error.message}` },
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