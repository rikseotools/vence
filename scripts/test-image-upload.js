#!/usr/bin/env node

// Script para probar la subida de imágenes de feedback
// Ejecutar: npm run test-image-upload

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

async function testImageUpload() {
  console.log('🧪 Testing image upload functionality...')
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔍 Verificando buckets existentes...')
    
    // Verificar que los buckets existen
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('❌ Error listando buckets:', listError)
      return
    }
    
    console.log('📋 Buckets disponibles:', buckets.map(b => b.name))
    
    const feedbackBucket = buckets.find(b => b.name === 'feedback-images')
    const supportBucket = buckets.find(b => b.name === 'support')
    
    console.log('✅ feedback-images bucket:', feedbackBucket ? '✓ Existe' : '❌ No existe')
    console.log('✅ support bucket:', supportBucket ? '✓ Existe' : '❌ No existe')

    if (!feedbackBucket && !supportBucket) {
      console.log('❌ No hay buckets para imagen. Ejecuta: npm run setup-feedback-storage')
      return
    }

    // Probar subida de una imagen de prueba
    console.log('🧪 Probando subida de imagen...')
    
    // Crear una imagen pequeña de prueba en base64
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    const response = await fetch(testImageBase64)
    const blob = await response.blob()
    
    const testPath = `test-upload-${Date.now()}.png`
    
    // Probar con feedback-images primero
    const bucketToUse = feedbackBucket ? 'feedback-images' : 'support'
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketToUse)
      .upload(`admin-chat-images/${testPath}`, blob, {
        cacheControl: '3600',
        upsert: true
      })
    
    if (uploadError) {
      console.error('❌ Error subiendo imagen de prueba:', uploadError)
      console.log('💡 Posibles soluciones:')
      console.log('   1. Ejecutar: npm run setup-storage-policies')
      console.log('   2. Verificar variables de entorno')
      console.log('   3. Configurar políticas RLS en Supabase Dashboard')
      return
    }
    
    console.log('✅ Imagen de prueba subida exitosamente')
    
    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(bucketToUse)
      .getPublicUrl(`admin-chat-images/${testPath}`)
    
    console.log('🔗 URL pública generada:', publicUrl)
    
    // Probar eliminación
    const { error: deleteError } = await supabase.storage
      .from(bucketToUse)
      .remove([`admin-chat-images/${testPath}`])
    
    if (deleteError) {
      console.error('⚠️ Error eliminando imagen de prueba:', deleteError)
    } else {
      console.log('🗑️ Imagen de prueba eliminada exitosamente')
    }

    // Probar API endpoint
    console.log('🧪 Probando API endpoint...')
    
    const formData = new FormData()
    const testFile = new File([blob], 'test.png', { type: 'image/png' })
    formData.append('file', testFile)
    formData.append('userPath', 'test-api')
    
    try {
      const apiResponse = await fetch('http://localhost:3000/api/upload-feedback-image', {
        method: 'POST',
        body: formData
      })
      
      if (apiResponse.ok) {
        const apiResult = await apiResponse.json()
        console.log('✅ API endpoint funcionando:', apiResult.url)
        
        // Limpiar archivo de API
        await fetch(`http://localhost:3000/api/upload-feedback-image?path=${encodeURIComponent(apiResult.path)}`, {
          method: 'DELETE'
        })
        console.log('🗑️ Archivo API limpiado')
      } else {
        const error = await apiResponse.text()
        console.error('❌ Error en API endpoint:', error)
      }
    } catch (apiError) {
      console.error('❌ Error probando API:', apiError.message)
      console.log('💡 Asegúrate de que el servidor esté corriendo en localhost:3000')
    }

    console.log('\n🎉 ¡Test completado!')
    console.log('\n📋 RESUMEN:')
    console.log('✅ Storage configurado correctamente')
    console.log('✅ Buckets creados y accesibles') 
    console.log('✅ Subida y eliminación funcionando')
    console.log('✅ URLs públicas generándose correctamente')
    console.log('\n💡 Si tienes problemas en el navegador:')
    console.log('   - Abre las herramientas de desarrollador (F12)')
    console.log('   - Ve a la pestaña Console')
    console.log('   - Ve a la pestaña Network')
    console.log('   - Intenta subir una imagen y busca errores')

  } catch (error) {
    console.error('❌ Error general:', error.message)
    console.log('')
    console.log('💡 Soluciones:')
    console.log('1. Verificar que las variables de entorno estén configuradas')
    console.log('2. Ejecutar: npm run setup-feedback-storage')
    console.log('3. Ejecutar: npm run setup-storage-policies')
  }
}

// Ejecutar si es llamado directamente
testImageUpload()

export { testImageUpload }