// scripts/update-explanation.js
// Script para actualizar la explicación de la pregunta de gráfico de barras
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateExplanation() {
  try {
    console.log('🔄 Updating explanation for bar chart question...')

    const newExplanation = `**Estrategia rápida sin calculadora:**

1. **Observación visual clave**: En TODOS los años, Verduras siempre > Frutas
2. **Cálculo mental por diferencias**:
   - 2019: Verduras 20 - Frutas 15 = +5
   - 2020: Verduras 20 - Frutas 20 = 0  
   - 2021: Verduras 15 - Frutas 10 = +5
   - 2022: Verduras 10 - Frutas 5 = +5
3. **Suma rápida**: 5 + 0 + 5 + 5 = 15 kg/mes
4. **Descarte de opciones**: 5 y 10 muy bajas, 20 muy alta

**Respuesta: B) 15 kg/mes**

**Técnica clave**: Busca patrones visuales y calcula diferencias año por año, no totales.`

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ explanation: newExplanation })
      .eq('question_text', '¿Cuál sería la diferencia por persona entre el total de frutas y verduras consumida?')
      .eq('question_subtype', 'bar_chart')
      .select()

    if (error) {
      console.error('❌ Error updating explanation:', error)
      return
    }

    if (data && data.length > 0) {
      console.log('✅ Explanation updated successfully!')
      console.log('📋 Updated question ID:', data[0].id)
      console.log('📝 New explanation length:', newExplanation.length, 'characters')
    } else {
      console.log('⚠️ No question found to update')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
updateExplanation()