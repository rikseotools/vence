import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertLowestMedicalUsageQuestion() {
  try {
    console.log('🔍 Buscando sección de gráficos en capacidad administrativa...')
    
    // Buscar la categoría de capacidad administrativa
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('*')
      .eq('category_key', 'capacidad-administrativa')
      .single()

    if (categoryError) {
      console.error('❌ Error buscando categoría:', categoryError)
      return
    }

    console.log('✅ Categoría encontrada:', category.display_name)

    // Buscar la sección de gráficos
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('*')
      .eq('category_id', category.id)
      .eq('section_key', 'graficos')
      .single()

    if (sectionError) {
      console.error('❌ Error buscando sección:', sectionError)
      return
    }

    console.log('✅ Sección encontrada:', section.display_name)

    // Datos de la pregunta
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Según los datos del gráfico, ¿qué población fue la que menos utilizó los servicios médicos?',
      content_data: {
        chart_type: 'line_chart',
        chart_title: 'Personas atendidas por rango de edad / lugar de la atención (en miles) al mes',
        x_axis_label: 'Lugar de atención',
        y_axis_label: 'Personas atendidas (miles)',
        categories: ['Centro salud', 'Hospitales', 'Centros especializados', 'Clínicas privadas'],
        age_groups: [
          {
            label: 'Edad de 1 mes a 14 años',
            values: [80, 30, 70, 50]
          },
          {
            label: 'Edad de 15 a 39 años', 
            values: [40, 20, 30, 20]
          },
          {
            label: 'Edad de 27 a 64 años',
            values: [70, 60, 50, 90] 
          },
          {
            label: 'De 65 años en adelante',
            values: [100, 100, 95, 35]
          }
        ],
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de líneas múltiples, calcular totales por series (rangos de edad), comparar resultados y identificar el valor mínimo entre diferentes grupos poblacionales."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Cálculo del total por rango de edad:\\n• Edad 1-14 años: 80 + 30 + 70 + 50 = 230.000 personas\\n• Edad 15-39 años: 40 + 20 + 30 + 20 = 110.000 personas\\n• Edad 27-64 años: 70 + 60 + 50 + 90 = 270.000 personas\\n• Edad 65+ años: 100 + 100 + 95 + 35 = 330.000 personas\\n\\n📋 Comparación de totales:\\n• Edad 1-14 años: 230.000 personas\\n• Edad 15-39 años: 110.000 personas ← MÍNIMO ✅\\n• Edad 27-64 años: 270.000 personas\\n• Edad 65+ años: 330.000 personas\\n\\n📋 Resultado:\\n• El grupo que menos utilizó servicios médicos: De 15 años a 26 años (aproximadamente)"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma visual por series\\n• Para cada rango de edad, suma horizontalmente todos los lugares\\n• Edad 15-39: 40+20+30+20 = 110.000 ← Claramente el menor ✅\\n• Otros rangos son visiblemente mayores\\n\\n📊 Método 2: Identificación visual rápida\\n• La línea amarilla (15-39 años) está consistentemente baja\\n• Es la que tiene valores más pequeños en la mayoría de lugares\\n• Confirmar sumando para verificar\\n\\n💰 Método 3: Descarte de opciones\\n• Opción A: 60+ años - Línea rosa muy alta ❌\\n• Opción B: 1-14 años - Línea verde alta ❌\\n• Opción C: 27-59 años - Línea negra alta ❌\\n• Opción D: 15-26 años - Coincide con 15-39 años ✅"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir las series y sumar verticalmente (por lugar) en lugar de horizontalmente (por edad)\\n• No distinguir bien las líneas de colores diferentes\\n• Errores en la suma de números de dos cifras\\n• Leer mal la escala del eje Y\\n• Confundir los rangos de edad en las opciones\\n• No verificar visualmente que el resultado sea lógico"
          },
          {
            title: "💪 Consejo de oposición",
            content: "Para encontrar mínimos en gráficos de líneas múltiples: 1) Suma horizontalmente todos los valores de cada serie, 2) Compara los totales obtenidos, 3) Identifica el menor, 4) Verifica visualmente que esa línea sea la más baja en general. La línea amarilla (15-39 años) es claramente la más baja."
          }
        ]
      },
      option_a: 'De 60 años o más.',
      option_b: 'De 1 mes a 14 años.',
      option_c: 'De 27años a 59 años.',
      option_d: 'De 15 años a 26 años.',
      correct_option: 3, // D = De 15 años a 26 años (corresponde al rango 15-39 años con menor total)
      explanation: null, // Se maneja en el componente
      question_subtype: 'line_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'comparison', 'minimum_identification'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de menor uso de servicios médicos...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de menor uso de servicios médicos añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: De 15 años a 26 años (110.000 personas total)')
    console.log('♻️  Reutiliza el componente LineChartQuestion existente - no se necesitan cambios')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)
    console.log('')
    console.log('🔗 REVISAR DATOS JSON:')
    console.log(`   http://localhost:3000/api/debug/question/${data[0]?.id}`)

    return data[0]?.id

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

insertLowestMedicalUsageQuestion()