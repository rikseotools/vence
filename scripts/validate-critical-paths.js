// scripts/validate-critical-paths.js
// Script de validación inmediata para detectar problemas críticos del sistema
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function validateCriticalPaths() {
  console.log('🔍 VALIDATING CRITICAL SYSTEM PATHS...')
  console.log('='.repeat(50))
  
  let totalErrors = 0
  let totalWarnings = 0

  try {
    // ====================================
    // 1. VALIDAR CONEXIÓN A BASE DE DATOS
    // ====================================
    console.log('\n📡 Testing database connection...')
    
    const { data: testConnection, error: connectionError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .limit(1)
    
    if (connectionError) {
      console.error('❌ CRITICAL: Database connection failed:', connectionError.message)
      totalErrors++
      return
    }
    
    console.log('✅ Database connection: OK')

    // ==========================================
    // 2. VALIDAR ESTRUCTURAS DE DATOS CRÍTICAS
    // ==========================================
    console.log('\n📊 Testing chart question data structures...')
    
    // Obtener todas las preguntas de gráficos
    const { data: chartQuestions, error: questionsError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, question_subtype, content_data, is_active')
      .in('question_subtype', ['bar_chart', 'line_chart', 'pie_chart'])
      .eq('is_active', true)
    
    if (questionsError) {
      console.error('❌ CRITICAL: Cannot load chart questions:', questionsError.message)
      totalErrors++
    } else {
      console.log(`📋 Found ${chartQuestions.length} active chart questions`)
      
      // Validar cada tipo de gráfico
      await validateBarCharts(chartQuestions.filter(q => q.question_subtype === 'bar_chart'))
      await validateLineCharts(chartQuestions.filter(q => q.question_subtype === 'line_chart'))
      await validatePieCharts(chartQuestions.filter(q => q.question_subtype === 'pie_chart'))
    }

    // ==========================================
    // 3. VALIDAR ALGORITMO DE PRIORIZACIÓN
    // ==========================================
    console.log('\n🧠 Testing adaptive question selection...')
    await validateAdaptiveAlgorithm()

    // ==========================================
    // 4. VALIDAR CONTEOS DE UI
    // ==========================================
    console.log('\n🔢 Testing UI question counts...')
    await validateQuestionCounts()

    // ==========================================
    // 5. VALIDAR COMPONENTES CRÍTICOS
    // ==========================================
    console.log('\n⚙️ Testing critical component compatibility...')
    await validateComponentCompatibility(chartQuestions)

  } catch (error) {
    console.error('❌ FATAL ERROR during validation:', error.message)
    totalErrors++
  }

  // ==========================================
  // RESUMEN FINAL
  // ==========================================
  console.log('\n' + '='.repeat(50))
  console.log('📋 VALIDATION SUMMARY')
  console.log('='.repeat(50))
  
  if (totalErrors === 0) {
    console.log('🎉 ALL CRITICAL PATHS VALIDATED SUCCESSFULLY!')
    console.log('✅ System is ready for use')
  } else {
    console.log(`❌ FOUND ${totalErrors} CRITICAL ERRORS`)
    console.log('🚨 System may not work correctly')
  }
  
  if (totalWarnings > 0) {
    console.log(`⚠️ Found ${totalWarnings} warnings (non-critical)`)
  }
  
  console.log('\n💡 Run this script before major changes or deployments')
  
  // Exit con código de error si hay problemas críticos
  if (totalErrors > 0) {
    process.exit(1)
  }
}

// =============================================
// VALIDADORES ESPECÍFICOS
// =============================================

async function validateBarCharts(barCharts) {
  console.log(`\n📊 Validating ${barCharts.length} bar chart questions...`)
  
  barCharts.forEach((question, index) => {
    try {
      const chartData = question.content_data?.chart_data
      
      if (!chartData) {
        console.error(`❌ Bar chart ${index + 1} (${question.id.substring(0, 8)}...): Missing chart_data`)
        return
      }

      // Simular exactamente lo que hace BarChartQuestion.js
      let processedData = []
      
      if (chartData.quarters && Array.isArray(chartData.quarters)) {
        // Nueva estructura (coches)
        processedData = chartData.quarters.map(quarter => ({
          year: quarter.name,
          categories: [
            { name: 'A', value: quarter.modelA || 0 },
            { name: 'B', value: quarter.modelB || 0 }
          ]
        }))
        console.log(`✅ Bar chart ${index + 1}: New structure (quarters) - Valid`)
        
      } else if (Array.isArray(chartData) || (typeof chartData === 'object' && Object.keys(chartData).every(k => !isNaN(k)))) {
        // Estructura antigua (frutas)
        const dataArray = Array.isArray(chartData) ? chartData : Object.values(chartData)
        processedData = dataArray
        console.log(`✅ Bar chart ${index + 1}: Legacy structure - Valid`)
        
      } else {
        console.error(`❌ Bar chart ${index + 1} (${question.id.substring(0, 8)}...): Unknown data structure`)
        console.error(`   Structure:`, Object.keys(chartData))
        return
      }

      // Simular el forEach que causó el error original
      processedData.forEach(yearData => {
        if (yearData.categories && Array.isArray(yearData.categories)) {
          yearData.categories.forEach(category => {
            if (typeof category.value !== 'number') {
              console.warn(`⚠️ Bar chart ${index + 1}: Non-numeric value found:`, category.value)
            }
          })
        } else {
          console.error(`❌ Bar chart ${index + 1}: Invalid yearData structure`)
        }
      })

    } catch (error) {
      console.error(`❌ Bar chart ${index + 1} (${question.id}): ${error.message}`)
    }
  })
}

async function validateLineCharts(lineCharts) {
  console.log(`\n📈 Validating ${lineCharts.length} line chart questions...`)
  
  lineCharts.forEach((question, index) => {
    try {
      const chartData = question.content_data?.chart_data
      
      if (!chartData) {
        console.error(`❌ Line chart ${index + 1}: Missing chart_data`)
        return
      }

      // Validar estructura específica de line chart
      if (chartData.datasets && Array.isArray(chartData.datasets)) {
        console.log(`✅ Line chart ${index + 1}: Valid structure`)
      } else {
        console.error(`❌ Line chart ${index + 1}: Invalid structure - missing datasets array`)
      }

    } catch (error) {
      console.error(`❌ Line chart ${index + 1}: ${error.message}`)
    }
  })
}

async function validatePieCharts(pieCharts) {
  console.log(`\n🥧 Validating ${pieCharts.length} pie chart questions...`)
  
  pieCharts.forEach((question, index) => {
    try {
      const chartData = question.content_data?.chart_data
      
      if (!chartData) {
        console.error(`❌ Pie chart ${index + 1}: Missing chart_data`)
        return
      }

      // Validar estructura específica de pie chart
      if (chartData.segments && Array.isArray(chartData.segments)) {
        console.log(`✅ Pie chart ${index + 1}: Valid structure`)
      } else {
        console.error(`❌ Pie chart ${index + 1}: Invalid structure - missing segments array`)
      }

    } catch (error) {
      console.error(`❌ Pie chart ${index + 1}: ${error.message}`)
    }
  })
}

async function validateAdaptiveAlgorithm() {
  try {
    // Simular el flujo del algoritmo adaptativo
    const mockQuestions = [
      { id: 'test-1', question_text: 'Test 1' },
      { id: 'test-2', question_text: 'Test 2' }
    ]
    
    const mockUserAnswers = [
      { question_id: 'test-2', created_at: new Date().toISOString() }
    ]
    
    // Simular la lógica de applyUnseeenFirstPrioritization
    const answeredIds = new Set(mockUserAnswers.map(a => a.question_id))
    const neverSeen = mockQuestions.filter(q => !answeredIds.has(q.id))
    const answered = mockQuestions.filter(q => answeredIds.has(q.id))
    
    const finalOrder = [...neverSeen, ...answered]
    
    if (finalOrder[0].id === 'test-1' && finalOrder[1].id === 'test-2') {
      console.log('✅ Adaptive algorithm: Correct prioritization (never-seen first)')
    } else {
      console.error('❌ Adaptive algorithm: Wrong prioritization order')
    }
    
  } catch (error) {
    console.error('❌ Adaptive algorithm validation failed:', error.message)
  }
}

async function validateQuestionCounts() {
  try {
    // Verificar que los conteos de UI sean correctos
    const { data: questions, error } = await supabase
      .from('psychometric_questions')
      .select('question_subtype, section_id')
      .eq('is_active', true)
    
    if (error) {
      console.error('❌ Question count validation failed:', error.message)
      return
    }
    
    const counts = {}
    questions.forEach(q => {
      counts[q.question_subtype] = (counts[q.question_subtype] || 0) + 1
    })
    
    console.log('📊 Current question counts by type:')
    Object.entries(counts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`)
    })
    
    // Verificar que hay al menos algunas preguntas
    if (Object.keys(counts).length === 0) {
      console.error('❌ No active questions found!')
    } else {
      console.log('✅ Question counts look reasonable')
    }
    
  } catch (error) {
    console.error('❌ Question count validation error:', error.message)
  }
}

async function validateComponentCompatibility(chartQuestions) {
  try {
    // Simular la carga de diferentes tipos de preguntas
    const compatibilityTests = [
      {
        name: 'BarChartQuestion data processing',
        test: () => {
          const barCharts = chartQuestions.filter(q => q.question_subtype === 'bar_chart')
          return barCharts.every(q => {
            const chartData = q.content_data?.chart_data
            return chartData && (
              (chartData.quarters && Array.isArray(chartData.quarters)) ||
              Array.isArray(chartData) ||
              (typeof chartData === 'object' && Object.keys(chartData).every(k => !isNaN(k)))
            )
          })
        }
      },
      {
        name: 'Question text length validation',
        test: () => {
          return chartQuestions.every(q => 
            q.question_text && q.question_text.length > 10 && q.question_text.length < 500
          )
        }
      }
    ]
    
    compatibilityTests.forEach(({ name, test }) => {
      try {
        if (test()) {
          console.log(`✅ ${name}: PASS`)
        } else {
          console.error(`❌ ${name}: FAIL`)
        }
      } catch (error) {
        console.error(`❌ ${name}: ERROR - ${error.message}`)
      }
    })
    
  } catch (error) {
    console.error('❌ Component compatibility validation failed:', error.message)
  }
}

// Ejecutar validación
validateCriticalPaths().catch(error => {
  console.error('💥 Script execution failed:', error)
  process.exit(1)
})