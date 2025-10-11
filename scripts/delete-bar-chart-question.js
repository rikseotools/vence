// scripts/delete-bar-chart-question.js
// Script para borrar la pregunta de gráfico de barras que creé
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function deleteBarChartQuestion() {
  try {
    console.log('🗑️ Deleting bar chart question...')

    // Borrar la pregunta específica que creé
    const { data, error } = await supabase
      .from('psychometric_questions')
      .delete()
      .eq('id', 'c0a4375f-9933-4ed6-8a4e-e0d32c540618')
      .select()

    if (error) {
      console.error('❌ Error deleting question:', error)
      return
    }

    if (data && data.length > 0) {
      console.log('✅ Question deleted successfully!')
      console.log('📋 Deleted question ID:', data[0].id)
      console.log('📝 Question text:', data[0].question_text)
    } else {
      console.log('⚠️ No question found with that ID (maybe already deleted)')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
deleteBarChartQuestion()