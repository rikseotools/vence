// scripts/add-hospital-60plus-population-question.js
// Añadir pregunta psicotécnica sobre población de 60+ años en hospitales

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addHospital60PlusPopulationQuestion() {
  console.log('🏥 Añadiendo pregunta de población 60+ años en hospitales...')

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
    question_text: 'De la población de 60 o más años, el 40% son mujeres y el resto hombres. ¿Qué cantidad de hombres fueron atendidos en el Hospital?',
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
          content: "Capacidad de extraer datos específicos de gráficos de líneas y aplicar cálculos de porcentajes para resolver problemas demográficos."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Paso 1: Identificar población 60+ años en hospitales\n• Observar la línea rosa (60+ años)\n• En la columna 'Hospitales' el valor es 100 (mil personas)\n• Total población 60+ en hospitales: 100.000 personas\n\n📋 Paso 2: Calcular distribución por género\n• Mujeres: 40% de la población 60+\n• Hombres: 100% - 40% = 60% de la población 60+\n\n📋 Paso 3: Calcular cantidad de hombres\n• Hombres = 60% × 100.000 personas\n• Hombres = 0.60 × 100.000 = 60.000 hombres"
        },
        {
          title: "⚡ TÉCNICAS DE CÁLCULO RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Porcentajes complementarios\n• Si mujeres = 40%, entonces hombres = 60%\n• 60% de 100.000 = 60.000\n• Cálculo rápido: 60 × 1.000 = 60.000\n\n📊 Método 2: Fraccionamiento\n• 60% = 6/10 = 3/5\n• 100.000 × 3/5 = 300.000/5 = 60.000\n\n💡 Método 3: Verificación por descarte\n• Total debe ser 100.000 personas\n• Si hombres = 60.000, mujeres = 40.000\n• Verificación: 60.000 + 40.000 = 100.000 ✅\n\n🚨 Método 4: Estimación rápida\n• 60% es más de la mitad pero menos de 2/3\n• Entre las opciones, solo 60.000 está en ese rango\n• 50.000 sería exactamente la mitad (50%)\n• 40.000 sería menos de la mitad (incorrecto)"
        }
      ]
    },
    option_a: '50.000',
    option_b: '40.000',
    option_c: '30.000',
    option_d: '60.000',
    correct_option: 3, // D = 60.000 hombres (60% de 100.000)
    explanation: "Para resolver: 1) Del gráfico obtenemos 100.000 personas de 60+ años en hospitales. 2) Si 40% son mujeres, entonces 60% son hombres. 3) 60% de 100.000 = 60.000 hombres.",
    difficulty: 'medium',
    time_limit_seconds: 180, // 3 minutos
    cognitive_skills: ['chart_reading', 'percentage_calculation', 'data_extraction', 'mathematical_reasoning', 'demographic_analysis'],
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

    console.log('✅ Pregunta de población 60+ años añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text.substring(0, 80)}...`)
    console.log(`   ✅ Respuesta correcta: 60.000 hombres (60% de 100.000)`)

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
addHospital60PlusPopulationQuestion()