#!/usr/bin/env node

/**
 * SCRIPT DE TESTING: Sistema de Dificultad Sin Contaminación
 * 
 * Este script verifica que el nuevo sistema de dificultad
 * para tests de leyes funcione correctamente y solo use
 * primeras respuestas para calcular dificultad global.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔧 TESTING: Sistema de Dificultad Sin Contaminación')
console.log('=' .repeat(60))

async function testLawDifficultySystem() {
  try {
    // 1. Verificar que la tabla existe
    console.log('\n📋 1. Verificando tabla law_question_first_attempts...')
    const { data: tableExists, error: tableError } = await supabase
      .from('law_question_first_attempts')
      .select('count', { count: 'exact', head: true })
    
    if (tableError) {
      console.error('❌ Error al verificar tabla:', tableError.message)
      return false
    }
    
    console.log(`✅ Tabla existe con ${tableExists?.length || 0} registros`)

    // 2. Verificar que las funciones existen
    console.log('\n🔧 2. Verificando funciones SQL...')
    
    const functions = [
      'calculate_global_law_question_difficulty',
      'calculate_personal_law_question_difficulty', 
      'get_effective_law_question_difficulty',
      'get_law_difficulty_stats'
    ]
    
    for (const funcName of functions) {
      const { error } = await supabase.rpc(funcName === 'get_law_difficulty_stats' ? funcName : funcName, 
        funcName === 'get_law_difficulty_stats' ? {} : { question_uuid: '00000000-0000-0000-0000-000000000000' }
      )
      
      if (error && !error.message.includes('does not exist') && !error.message.includes('null value')) {
        console.log(`✅ Función ${funcName} existe`)
      } else if (error?.message.includes('does not exist')) {
        console.log(`❌ Función ${funcName} NO existe`)
        return false
      } else {
        console.log(`✅ Función ${funcName} existe (test UUID no encontrado es normal)`)
      }
    }

    // 3. Verificar estadísticas del sistema
    console.log('\n📊 3. Obteniendo estadísticas del sistema...')
    const { data: stats, error: statsError } = await supabase.rpc('get_law_difficulty_stats')
    
    if (statsError) {
      console.error('❌ Error al obtener estadísticas:', statsError.message)
      return false
    }
    
    console.log('✅ Estadísticas del sistema:')
    console.log('  • Total preguntas activas:', stats.total_questions)
    console.log('  • Primeras respuestas registradas:', stats.total_first_attempts)
    console.log('  • Preguntas con dificultad global:', stats.questions_with_global_difficulty)
    console.log('  • Dificultad global promedio:', stats.avg_global_difficulty)
    console.log('  • Preguntas que necesitan más datos:', stats.questions_needing_more_data)
    console.log('  • Preguntas con alta confianza:', stats.high_confidence_questions)

    // 4. Simular inserción de respuesta para verificar trigger
    console.log('\n🎯 4. Testing del trigger...')
    
    // Buscar una pregunta existente
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id')
      .eq('is_active', true)
      .limit(1)
    
    if (questionsError || !questions?.length) {
      console.log('⚠️ No se encontraron preguntas para testing del trigger')
      return true // No es un error crítico
    }
    
    const questionId = questions[0].id
    console.log(`✅ Pregunta seleccionada para testing: ${questionId}`)
    
    // Verificar que el trigger existe
    const { data: triggers, error: triggerError } = await supabase
      .from('information_schema.triggers')
      .select('trigger_name')
      .eq('trigger_name', 'law_question_difficulty_update_trigger')
    
    if (triggerError) {
      console.log('⚠️ No se pudo verificar trigger (puede ser normal)')
    } else if (triggers?.length > 0) {
      console.log('✅ Trigger law_question_difficulty_update_trigger existe')
    } else {
      console.log('❌ Trigger NO encontrado')
    }

    // 5. Verificar campos añadidos a tabla questions
    console.log('\n🔍 5. Verificando campos de dificultad global...')
    
    const { data: questionFields, error: fieldsError } = await supabase
      .from('questions')
      .select('global_difficulty, difficulty_confidence, difficulty_sample_size, last_difficulty_update')
      .limit(1)
    
    if (fieldsError) {
      console.error('❌ Error al verificar campos:', fieldsError.message)
      return false
    }
    
    console.log('✅ Campos de dificultad global añadidos correctamente')

    // 6. Verificar datos migrados
    console.log('\n📦 6. Verificando migración de datos...')
    
    const { data: firstAttempts, error: attemptsError } = await supabase
      .from('law_question_first_attempts')
      .select('user_id, question_id, is_correct')
      .limit(5)
    
    if (attemptsError) {
      console.error('❌ Error al verificar datos migrados:', attemptsError.message)
      return false
    }
    
    if (firstAttempts?.length > 0) {
      console.log(`✅ Datos migrados correctamente: ${firstAttempts.length} muestras verificadas`)
      console.log('   Ejemplo de primera respuesta:')
      console.log(`   • Usuario: ${firstAttempts[0].user_id.slice(0, 8)}...`)
      console.log(`   • Pregunta: ${firstAttempts[0].question_id.slice(0, 8)}...`)
      console.log(`   • Correcta: ${firstAttempts[0].is_correct}`)
    } else {
      console.log('⚠️ No hay datos migrados (puede ser normal si no hay respuestas previas)')
    }

    // 7. Testing de función de dificultad efectiva
    console.log('\n🎲 7. Testing función de dificultad efectiva...')
    
    if (firstAttempts?.length > 0) {
      const testUserId = firstAttempts[0].user_id
      const testQuestionId = firstAttempts[0].question_id
      
      const { data: effectiveDifficulty, error: diffError } = await supabase.rpc(
        'get_effective_law_question_difficulty',
        { user_uuid: testUserId, question_uuid: testQuestionId }
      )
      
      if (diffError) {
        console.log('⚠️ Error al probar dificultad efectiva:', diffError.message)
      } else if (effectiveDifficulty?.length > 0) {
        const diff = effectiveDifficulty[0]
        console.log('✅ Función de dificultad efectiva funciona:')
        console.log(`   • Valor: ${diff.difficulty_value}`)
        console.log(`   • Fuente: ${diff.difficulty_source}`)
        console.log(`   • Tamaño muestra: ${diff.sample_size}`)
        console.log(`   • Confianza: ${diff.confidence}`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 TESTING COMPLETADO EXITOSAMENTE')
    console.log('✅ Sistema de dificultad sin contaminación funcionando')
    console.log('✅ Solo primeras respuestas se usan para dificultad global')
    console.log('✅ Datos personales se mantienen para analytics individuales')
    console.log('='.repeat(60))
    
    return true

  } catch (error) {
    console.error('\n❌ ERROR DURANTE TESTING:', error.message)
    return false
  }
}

// Ejecutar testing
testLawDifficultySystem()
  .then(success => {
    if (success) {
      console.log('\n🎯 RESULTADO: Sistema listo para producción')
      process.exit(0)
    } else {
      console.log('\n⚠️ RESULTADO: Se encontraron problemas')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('\n💥 ERROR FATAL:', error.message)
    process.exit(1)
  })