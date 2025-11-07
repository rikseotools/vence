#!/usr/bin/env node

// Script para configurar el storage de feedback automáticamente
// Ejecutar: npm run setup-feedback-storage

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

async function setupFeedbackStorage() {
  console.log('🗂️ Configurando storage para feedback images...')
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔍 Verificando buckets existentes...')
    
    // Verificar si existe el bucket
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('❌ Error listando buckets:', listError)
      return
    }
    
    console.log('📋 Buckets existentes:', buckets.map(b => b.name).join(', '))
    
    const feedbackBucketExists = buckets.some(bucket => bucket.name === 'feedback-images')
    
    if (!feedbackBucketExists) {
      console.log('🆕 Creando bucket feedback-images...')
      
      const { data: bucketData, error: bucketError } = await supabase.storage
        .createBucket('feedback-images', { 
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
          fileSizeLimit: 5242880 // 5MB
        })
      
      if (bucketError) {
        console.error('❌ Error creando bucket:', bucketError)
        return
      }
      
      console.log('✅ Bucket feedback-images creado exitosamente')
    } else {
      console.log('✅ Bucket feedback-images ya existe')
    }

    // Verificar bucket support (fallback)
    const supportBucketExists = buckets.some(bucket => bucket.name === 'support')
    
    if (!supportBucketExists) {
      console.log('🆕 Creando bucket support como fallback...')
      
      const { data: supportData, error: supportError } = await supabase.storage
        .createBucket('support', { 
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
          fileSizeLimit: 5242880 // 5MB
        })
      
      if (supportError) {
        console.error('❌ Error creando bucket support:', supportError)
      } else {
        console.log('✅ Bucket support creado exitosamente')
      }
    } else {
      console.log('✅ Bucket support ya existe')
    }

    console.log('🔒 Configurando políticas de acceso...')
    
    // Configurar RLS policies para feedback-images
    const policies = [
      // Política para que cualquier usuario autenticado pueda subir
      {
        name: 'Allow authenticated users to upload',
        definition: `
          CREATE POLICY "Allow authenticated users to upload" ON storage.objects
          FOR INSERT WITH CHECK (
            bucket_id = 'feedback-images' AND
            auth.role() = 'authenticated'
          );
        `
      },
      // Política para que cualquiera pueda ver las imágenes (públicas)
      {
        name: 'Allow public read access',
        definition: `
          CREATE POLICY "Allow public read access" ON storage.objects
          FOR SELECT USING (bucket_id = 'feedback-images');
        `
      },
      // Política para que service role pueda hacer todo
      {
        name: 'Allow service role full access',
        definition: `
          CREATE POLICY "Allow service role full access" ON storage.objects
          FOR ALL USING (
            bucket_id = 'feedback-images' AND
            auth.role() = 'service_role'
          );
        `
      }
    ]

    // Nota: Las políticas RLS de storage se gestionan directamente en Supabase Dashboard
    console.log('📋 Políticas recomendadas para configurar en Supabase Dashboard:')
    policies.forEach((policy, index) => {
      console.log(`\n${index + 1}. ${policy.name}:`)
      console.log(policy.definition.trim())
    })

    // Verificar configuración con un test de escritura
    console.log('\n🧪 Probando configuración...')
    
    const testContent = new Blob(['test'], { type: 'text/plain' })
    const testPath = `test-${Date.now()}.txt`
    
    const { data: uploadTest, error: uploadError } = await supabase.storage
      .from('feedback-images')
      .upload(testPath, testContent)
    
    if (uploadError) {
      console.error('❌ Error en test de subida:', uploadError)
      console.log('💡 Configura las políticas manualmente en Supabase Dashboard')
    } else {
      console.log('✅ Test de subida exitoso')
      
      // Limpiar archivo de test
      await supabase.storage
        .from('feedback-images')
        .remove([testPath])
      
      console.log('✅ Test file limpiado')
    }

    console.log('\n🎉 ¡Configuración de feedback storage completada!')
    console.log('📝 Ahora los usuarios pueden subir imágenes en /admin/feedback')

  } catch (error) {
    console.error('❌ Error general:', error.message)
    console.log('')
    console.log('💡 Solución alternativa:')
    console.log('1. Ir a Supabase Dashboard → Storage')
    console.log('2. Crear bucket "feedback-images" (público)')
    console.log('3. Configurar políticas RLS según las mostradas arriba')
  }
}

// Ejecutar si es llamado directamente
setupFeedbackStorage()

export { setupFeedbackStorage }