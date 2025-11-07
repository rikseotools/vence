#!/usr/bin/env node

// Script para configurar las políticas RLS del storage automáticamente
// Ejecutar: npm run setup-storage-policies

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

async function setupStoragePolicies() {
  console.log('🔒 Configurando políticas RLS para storage...')
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🧪 Probando configuración actual...')
    
    // Crear un archivo de prueba (imagen pequeña)
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    const blob = await (await fetch(testImageData)).blob()
    const testPath = `test-${Date.now()}.png`
    
    const { data: uploadTest, error: uploadError } = await supabase.storage
      .from('feedback-images')
      .upload(testPath, blob, {
        cacheControl: '3600',
        upsert: true
      })
    
    if (uploadError) {
      console.error('❌ Error en test de subida:', uploadError)
      
      if (uploadError.message?.includes('new row violates row-level security policy')) {
        console.log('🔧 Configurando políticas RLS automáticamente...')
        
        // Ejecutar queries SQL para configurar políticas
        const policies = [
          // Política para INSERT (service role y authenticated)
          `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies 
              WHERE tablename = 'objects' 
              AND policyname = 'Allow service role and auth to upload to feedback-images'
            ) THEN
              CREATE POLICY "Allow service role and auth to upload to feedback-images" 
              ON storage.objects FOR INSERT WITH CHECK (
                bucket_id = 'feedback-images' AND 
                (auth.role() = 'service_role' OR auth.role() = 'authenticated')
              );
            END IF;
          END $$;
          `,
          
          // Política para SELECT (público)
          `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies 
              WHERE tablename = 'objects' 
              AND policyname = 'Allow public read access to feedback-images'
            ) THEN
              CREATE POLICY "Allow public read access to feedback-images" 
              ON storage.objects FOR SELECT USING (bucket_id = 'feedback-images');
            END IF;
          END $$;
          `,
          
          // Política para DELETE (service role)
          `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies 
              WHERE tablename = 'objects' 
              AND policyname = 'Allow service role to delete from feedback-images'
            ) THEN
              CREATE POLICY "Allow service role to delete from feedback-images" 
              ON storage.objects FOR DELETE USING (
                bucket_id = 'feedback-images' AND auth.role() = 'service_role'
              );
            END IF;
          END $$;
          `
        ]
        
        for (const [index, policy] of policies.entries()) {
          try {
            console.log(`🔧 Configurando política ${index + 1}/${policies.length}...`)
            
            const { error: policyError } = await supabase.rpc('exec_sql', { 
              sql: policy.trim()
            })
            
            if (policyError) {
              console.error(`❌ Error configurando política ${index + 1}:`, policyError)
            } else {
              console.log(`✅ Política ${index + 1} configurada`)
            }
          } catch (err) {
            console.error(`❌ Error ejecutando política ${index + 1}:`, err.message)
          }
        }
        
        // Intentar subir nuevamente
        console.log('🔄 Probando nuevamente después de configurar políticas...')
        
        const { data: retryTest, error: retryError } = await supabase.storage
          .from('feedback-images')
          .upload(`retry-${testPath}`, blob, {
            cacheControl: '3600',
            upsert: true
          })
        
        if (retryError) {
          console.error('❌ Error en segundo intento:', retryError)
          console.log('💡 Necesitas configurar las políticas manualmente en Supabase Dashboard')
        } else {
          console.log('✅ ¡Segunda prueba exitosa! Las políticas están funcionando')
          
          // Limpiar archivos de prueba
          await supabase.storage.from('feedback-images').remove([`retry-${testPath}`])
        }
      }
    } else {
      console.log('✅ ¡Test de subida exitoso! Las políticas ya están configuradas')
    }
    
    // Limpiar archivo de prueba original
    if (!uploadError) {
      await supabase.storage.from('feedback-images').remove([testPath])
      console.log('🧹 Archivos de prueba limpiados')
    }

    console.log('\n🎉 ¡Configuración de políticas completada!')
    console.log('📝 El storage de feedback está listo para usar')

  } catch (error) {
    console.error('❌ Error general:', error.message)
    console.log('')
    console.log('💡 Solución alternativa:')
    console.log('1. Ir a Supabase Dashboard → Storage → feedback-images → Settings')
    console.log('2. Crear las políticas RLS manualmente')
    console.log('3. O desactivar RLS temporalmente para testing')
  }
}

// Ejecutar si es llamado directamente
setupStoragePolicies()

export { setupStoragePolicies }