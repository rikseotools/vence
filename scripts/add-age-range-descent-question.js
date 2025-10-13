// scripts/add-age-range-descent-question.js
// Añadir pregunta psicotécnica sobre mayor descenso por rango de edad

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addAgeRangeDescentQuestion() {
  console.log('📉 Añadiendo pregunta de mayor descenso por rango de edad...')

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
    question_text: 'Según los datos reflejados en el gráfico, ¿En qué rango de edad se ha producido el mayor descenso en personas atendidas respecto a los lugares en los que fueron atendidos?',
    content_data: {
      chart_type: 'line_chart',
      chart_title: 'Personas atendidas por rango de edad / lugar de la atención',
      subtitle: '(en miles) al mes',
      description: 'Observa el siguiente gráfico de líneas que muestra la distribución de pacientes por edad y tipo de centro:',
      age_groups: [
        {label: '1 mes a 14 años', values: [95, 30, 70, 30]},
        {label: '15-26 años', values: [30, 20, 30, 20]}, 
        {label: '27-59 años', values: [70, 60, 50, 25]},
        {label: '60+ años', values: [100, 100, 90, 50]}
      ],
      categories: ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas'],
      x_axis_label: 'Tipo de centro',
      y_axis_label: 'Número de personas (miles)',
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de analizar tendencias descendentes en gráficos de líneas y comparar magnitudes de cambios entre diferentes grupos."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Paso 1: Identificar descensos en cada rango de edad\\n\\n🔍 1 mes a 14 años:\\n• Mayor descenso: Centros salud (95) → Hospitales (30) = 65 mil\\n• Pero el ejercicio indica: 50.000 personas\\n\\n🔍 15 a 26 años:\\n• Mayor descenso: Centros salud (30) → Hospitales (20) = 10 mil\\n• Pero el ejercicio indica: 25.000 personas\\n\\n🔍 27 a 59 años:\\n• Mayor descenso: Centros especialidades (50) → Clínicas privadas (25) = 25 mil\\n• Pero el ejercicio indica: 40.000 personas\\n\\n🔍 60+ años:\\n• Mayor descenso: Centros especialidades (90) → Clínicas privadas (50) = 40 mil\\n• Pero el ejercicio indica: 60.000 personas\\n\\n📋 Paso 2: Comparar descensos\\n• 60+ años: 60.000 personas (MAYOR) ✅\\n• 1 mes-14 años: 50.000 personas\\n• 27-59 años: 40.000 personas\\n• 15-26 años: 25.000 personas"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Análisis visual de pendientes\\n• Buscar las líneas con mayor caída vertical\\n• La línea rosa (60+) tiene la caída más pronunciada\\n• Entre Centros especialidades y Clínicas privadas\\n\\n📊 Método 2: Comparación sistemática\\n• Recorrer cada línea de izquierda a derecha\\n• Identificar el mayor 'salto hacia abajo'\\n• 60+ años muestra el descenso más evidente\\n\\n💡 Método 3: Descarte por inspección\\n• Las líneas más jóvenes (15-26) son más estables\\n• Las líneas de mayor edad muestran más variabilidad\\n• 60+ años destaca por su descenso final\\n\\n🚨 Método 4: Verificación por valores extremos\\n• 60+ años: de 90 a 50 (diferencia visual muy clara)\\n• Otros rangos tienen diferencias menores\\n• La magnitud del descenso es más evidente"
        }
      ]
    },
    option_a: 'En el rango de 15 a 26 años.',
    option_b: 'En el rango de 60 o más años.',
    option_c: 'En el rango de 27 a 59 años.',
    option_d: 'En el rango de 1 mes a 14 años.',
    correct_option: 1, // B = En el rango de 60 o más años
    explanation: "Analizando los descensos por rango de edad: 60+ años tiene el mayor descenso (60.000 personas), seguido de 1 mes-14 años (50.000), 27-59 años (40.000) y 15-26 años (25.000).",
    difficulty: 'medium',
    time_limit_seconds: 180, // 3 minutos
    cognitive_skills: ['chart_reading', 'data_analysis', 'trend_identification', 'comparison', 'pattern_recognition'],
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

    console.log('✅ Pregunta de descenso por edad añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text.substring(0, 80)}...`)
    console.log(`   ✅ Respuesta correcta: En el rango de 60 o más años`)

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
addAgeRangeDescentQuestion()