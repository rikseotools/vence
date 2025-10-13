// scripts/add-private-clinics-revenue-question.js
// Añadir pregunta psicotécnica de clínicas privadas - ingresos por consultas niños

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addPrivateClinicsRevenueQuestion() {
  console.log('🏥 Añadiendo pregunta de ingresos clínicas privadas...')

  // Primero obtenemos el section_id de "graficos" en "capacidad-administrativa"
  const { data: section, error: sectionError } = await supabase
    .from('psychometric_sections')
    .select('id, section_key, category_id, psychometric_categories(id, category_key)')
    .eq('section_key', 'graficos')
    .eq('psychometric_categories.category_key', 'capacidad-administrativa')
    .single()

  if (sectionError || !section) {
    console.error('❌ Error obteniendo sección de gráficos:', sectionError)
    return
  }

  console.log(`✅ Sección encontrada: ${section.id} (${section.section_key})`)
  console.log(`✅ Categoría ID: ${section.category_id}`)

  const questionData = {
    category_id: section.category_id,
    section_id: section.id,
    question_text: 'Las Clínicas privadas cobran de media por consulta, a niños entre 1 mes y 14 años, 30 euros. ¿Qué cantidad total habrán obtenido en este rango de población atendida en sus consultas?',
    content_data: {
      chart_type: 'line_chart',
      chart_title: 'Personas atendidas por rango de edad / lugar de la atención',
      subtitle: '(en miles) al mes',
      description: 'Observa el siguiente gráfico de líneas que muestra la distribución de pacientes por edad y tipo de centro:',
      age_groups: [
        {label: '0-1 años', values: [95, 30, 70, 30]},
        {label: '15-26 años', values: [30, 20, 30, 20]}, 
        {label: '27-59 años', values: [70, 60, 50, 25]},
        {label: '60+ años', values: [100, 100, 90, 50]}
      ],
      categories: ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas'],
      x_axis_label: 'Tipo de centro',
      y_axis_label: 'Número de personas (miles)',
      target_group: '0-1 años',
      target_center: 'Clínicas privadas',
      target_value: 30,
      price_per_consultation: 30,
      total_revenue: 900000,
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de extraer datos específicos de gráficos de líneas y realizar cálculos económicos con multiplicaciones de grandes números."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Paso 1: Localizar el dato específico en el gráfico\\n• Buscar la línea '0-1 años' (niños de 1 mes a 14 años)\\n• Seguir hasta la columna 'Clínicas privadas'\\n• Leer el valor: 30 (miles de personas) = 30.000 personas\\n\\n📋 Paso 2: Aplicar el precio por consulta\\n• Precio por consulta: 30 euros\\n• Número de pacientes: 30.000 personas\\n\\n📋 Paso 3: Calcular el ingreso total\\n• Fórmula: Pacientes × Precio por consulta\\n• Cálculo: 30.000 × 30€ = 900.000€\\n• Resultado: Novecientos mil euros"
        },
        {
          title: "⚡ TÉCNICAS DE CÁLCULO RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Simplificación numérica\\n• 30.000 × 30 = 30 × 1.000 × 30\\n• = 30 × 30 × 1.000 = 900 × 1.000\\n• = 900.000 euros\\n\\n📊 Método 2: Factorización\\n• 30.000 × 30 = 3 × 10.000 × 3 × 10\\n• = 3 × 3 × 10.000 × 10\\n• = 9 × 100.000 = 900.000\\n\\n💡 Método 3: Estimación y verificación\\n• ~30.000 personas × ~30€ ≈ 900.000\\n• Entre las opciones, hay que buscar ~900 mil\\n\\n🚨 Método 4: Descarte por orden de magnitud\\n• 30.000 pacientes es un número moderado\\n• 30€ por consulta es precio razonable\\n• El resultado debe estar cerca de 1 millón"
        }
      ]
    },
    option_a: 'Un millón de euros.',
    option_b: 'Un millón y medio de euros.',
    option_c: '900.000 euros.',
    option_d: 'Dos millones de euros',
    correct_option: 2, // C = 900.000 euros (30.000 × 30€)
    explanation: "Para calcular el ingreso total: 30.000 niños (0-1 años) × 30€ por consulta = 900.000€.",
    difficulty: 'medium',
    time_limit_seconds: 180, // 3 minutos
    cognitive_skills: ['mathematical_reasoning', 'chart_reading', 'data_extraction', 'multiplication', 'economic_calculation'],
    question_subtype: 'line_chart',
    is_active: true,
    is_verified: true
  }

  try {
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de clínicas privadas añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: Un millón y medio de euros (50.000 × 30€)`)

    // Verificar que se insertó correctamente
    const { data: verification, error: verifyError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', data[0].id)
      .single()

    if (verifyError) {
      console.error('❌ Error verificando pregunta:', verifyError)
      return
    }

    console.log('\n🔍 Verificación exitosa - la pregunta está en la base de datos')
    console.log('🎯 La pregunta aparecerá en los tests de Capacidad Administrativa > Gráficos')
    console.log('🆕 Usa el componente LineChartQuestion para gráficos de líneas')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
addPrivateClinicsRevenueQuestion()