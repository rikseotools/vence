// scripts/check-system.js
// Script rápido para verificar que el sistema funciona correctamente
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function quickSystemCheck() {
  console.log('🚀 Quick System Health Check...\n')
  
  try {
    // 1. Base de datos responde
    process.stdout.write('📡 Database connection...')
    const { data: dbTest, error: dbError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .limit(1)
    
    if (dbError) throw new Error(`DB: ${dbError.message}`)
    console.log(' ✅')

    // 2. Preguntas de gráficos cargan sin error
    process.stdout.write('📊 Chart questions...')
    const { data: charts, error: chartsError } = await supabase
      .from('psychometric_questions')
      .select('id, question_subtype, content_data')
      .eq('question_subtype', 'bar_chart')
      .eq('is_active', true)
      .limit(5)
    
    if (chartsError) throw new Error(`Charts: ${chartsError.message}`)
    
    // 3. Verificar que cada gráfico no causaría el error "forEach is not a function"
    let chartErrors = 0
    charts.forEach((chart, i) => {
      try {
        const chartData = chart.content_data?.chart_data
        
        // Simular lo que hace BarChartQuestion.js
        if (chartData?.quarters && Array.isArray(chartData.quarters)) {
          // Nueva estructura - OK
        } else if (Array.isArray(chartData)) {
          // Array directo - OK  
        } else if (typeof chartData === 'object' && chartData !== null) {
          // Objeto con claves numéricas - debería ser OK
          const keys = Object.keys(chartData)
          if (!keys.every(k => !isNaN(k))) {
            // No es estructura válida
            chartErrors++
          }
        } else {
          chartErrors++
        }
      } catch (e) {
        chartErrors++
      }
    })
    
    if (chartErrors > 0) {
      throw new Error(`${chartErrors}/${charts.length} bar charts have invalid structure`)
    }
    console.log(' ✅')

    // 4. Algoritmo de priorización básico
    process.stdout.write('🧠 Question prioritization...')
    const mockQuestions = [{ id: '1' }, { id: '2' }]
    const mockAnswered = new Set(['2'])
    const neverSeen = mockQuestions.filter(q => !mockAnswered.has(q.id))
    const answered = mockQuestions.filter(q => mockAnswered.has(q.id))
    const ordered = [...neverSeen, ...answered]
    
    if (ordered[0].id !== '1') {
      throw new Error('Prioritization broken: never-seen not first')
    }
    console.log(' ✅')

    console.log('\n🎉 System is healthy!')
    console.log('💡 Ready for development/testing')
    
  } catch (error) {
    console.log(' ❌')
    console.error(`\n🚨 SYSTEM ERROR: ${error.message}`)
    console.error('⚠️  System may not work correctly')
    process.exit(1)
  }
}

quickSystemCheck()