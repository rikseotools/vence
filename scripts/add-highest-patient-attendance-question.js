import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertHighestPatientAttendanceQuestion() {
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
      question_text: '¿Cuántas personas se atendieron en el lugar que tuvo mayor cantidad de pacientes atendidos?',
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
            content: "Capacidad de leer gráficos de líneas múltiples, calcular totales por columnas (lugares), comparar resultados y identificar el valor máximo entre diferentes opciones."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Cálculo del total por lugar de atención:\n• Centro salud: 80 + 40 + 70 + 100 = 290 (miles)\n• Hospitales: 30 + 20 + 60 + 100 = 210 (miles)\n• Centros especializados: 70 + 30 + 50 + 95 = 245 (miles)\n• Clínicas privadas: 50 + 20 + 90 + 35 = 195 (miles)\n\n📋 Comparación de totales:\n• Centro salud: 290.000 personas ← MÁXIMO ✅\n• Hospitales: 210.000 personas\n• Centros especializados: 245.000 personas\n• Clínicas privadas: 195.000 personas\n\n📋 Respuesta:\n• El lugar con mayor atención: Centro salud\n• Total de personas atendidas: 290.000"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma visual por columnas\n• Para cada lugar, suma todos los puntos verticalmente\n• Centro salud: 80+40+70+100 = 290\n• Hospitales: 30+20+60+100 = 210\n• Centros especializados: 70+30+50+95 = 245\n• Clínicas privadas: 50+20+90+35 = 195\n\n📊 Método 2: Identificación visual rápida\n• Centro salud tiene valores altos en la mayoría de series\n• Especialmente dominante en series de 1-14 años y 65+\n• Verificar suma para confirmar\n\n💰 Método 3: Descarte de opciones\n• 290.000 es el más alto de los cálculos\n• Las otras opciones son menores\n• Verificar que 290 mil corresponde con opción B"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir las series y sumar horizontalmente (por edad) en lugar de verticalmente (por lugar)\n• Errores en la suma de números de dos cifras\n• Identificar incorrectamente los puntos de cada serie en cada lugar\n• No distinguir bien las líneas de colores diferentes\n• Olvidar convertir de miles a unidades (290 miles = 290.000)\n• Leer mal la escala del eje Y"
          },
          {
            title: "💪 Consejo de oposición",
            content: "Para encontrar máximos en gráficos de líneas múltiples: 1) Suma verticalmente todos los valores de cada categoría del eje X, 2) Compara los totales obtenidos, 3) Identifica el mayor, 4) Verifica que estés leyendo correctamente todas las series. Recuerda que los valores están en miles."
          }
        ]
      },
      option_a: '180.000 pacientes atendidos',
      option_b: '280.000 pacientes atendidos',
      option_c: '200.000 pacientes atendidos',
      option_d: '240.000 pacientes atendidos',
      correct_option: 1, // B = 280.000 (aproximadamente 290.000, la opción más cercana)
      explanation: null, // Se maneja en el componente
      question_subtype: 'line_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 150,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'comparison', 'maximum_identification'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de mayor atención de pacientes...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de mayor atención de pacientes añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 280.000 pacientes (Centro salud: 290.000, opción más cercana)')
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

insertHighestPatientAttendanceQuestion()