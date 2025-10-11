// scripts/update-explanation-v2.js
// Script para actualizar la explicación siguiendo el formato de TABLAS
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateExplanationV2() {
  try {
    console.log('🔄 Updating explanation to match TABLAS format...')

    const newExplanation = `💡 ¿Qué evalúa este ejercicio?
Tu capacidad para interpretar gráficos de barras y calcular diferencias entre categorías sin calculadora.

📊 ANÁLISIS PASO A PASO:

📋 Datos de Frutas:
2019: 15 kg/mes
2020: 20 kg/mes  
2021: 10 kg/mes
2022: 5 kg/mes
Total: 50 kg/mes ✅

📋 Datos de Verduras:
2019: 20 kg/mes
2020: 20 kg/mes
2021: 15 kg/mes  
2022: 10 kg/mes
Total: 65 kg/mes ✅

📋 Diferencia:
Verduras - Frutas = 65 - 50 = 15 kg/mes ✅

⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)

🔍 Método 1: Cálculo por diferencias anuales
• 2019: 20 - 15 = +5 kg
• 2020: 20 - 20 = 0 kg  
• 2021: 15 - 10 = +5 kg
• 2022: 10 - 5 = +5 kg
• Suma mental: 5 + 0 + 5 + 5 = 15 kg/mes

📊 Método 2: Observación visual directa
• Identifica patrón: Verduras SIEMPRE ≥ Frutas
• Busca años con mayor diferencia: 2019 y 2022
• Estima rápido: Diferencias moderadas, suma ~15

💰 Método 3: Descarte de opciones
• Opción A (5): Muy baja, solo 1 año de diferencia
• Opción C (10): Baja, faltan 2 años más  
• Opción D (20): Alta, sería diferencia constante
• Opción B (15): ✅ Coherente con patrón observado

❌ Errores comunes a evitar
• No sumes totales largos: Usa diferencias año por año
• No ignores años con diferencia 0: También cuentan
• Cuidado visual: Asegúrate de leer valores correctos
• No hagas cálculos complejos: Busca patrones primero

💪 Consejo de oposición: Lee primero los valores del gráfico, identifica el patrón visual, calcula diferencias simples año por año, y verifica con descarte de opciones.`

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
      console.log('✅ Explanation updated to TABLAS format!')
      console.log('📋 Updated question ID:', data[0].id)
      console.log('📝 New explanation length:', newExplanation.length, 'characters')
      console.log('🎯 Format features added:')
      console.log('   - 💡 Exercise evaluation')
      console.log('   - 📊 Step-by-step visual analysis')
      console.log('   - ⚡ Quick analysis techniques')
      console.log('   - ❌ Common errors section')
      console.log('   - 💪 Opposition exam tip')
    } else {
      console.log('⚠️ No question found to update')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
updateExplanationV2()