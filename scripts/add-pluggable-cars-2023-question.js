import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertPluggableCars2023Question() {
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
      question_text: '¿Cuántos coches enchufables se vendieron en el 2023?',
      content_data: {
        chart_type: 'mixed_chart',
        chart_title: 'Ventas de coches',
        chart_subtitle: 'Comparación Año 2022 vs Año 2023',
        x_axis_label: 'Ventas por trimestre',
        y_axis_label: 'Miles de coches',
        chart_data: {
          type: 'bar_chart',
          title: 'Ventas de coches',
          quarters: [
            {
              name: '1º Trimestre',
              año2022: 89,
              año2023: 24
            },
            {
              name: '2º Trimestre', 
              año2022: 24,
              año2023: 37
            },
            {
              name: '3º Trimestre',
              año2022: 37,
              año2023: 63
            },
            {
              name: '4º Trimestre',
              año2022: 63,
              año2023: 89
            }
          ],
          legend: {
            año2022: 'Año 2022',
            año2023: 'Año 2023'
          }
        },
        pie_charts: [
          {
            title: "Porcentajes tipo de coche vendido: Año 2022",
            data: [
              {"label": "Diésel", "percentage": 40, "color": "#ff4444"},
              {"label": "Gasolina", "percentage": 30, "color": "#ffaa00"}, 
              {"label": "Híbridos", "percentage": 15, "color": "#44ff44"},
              {"label": "Enchufables", "percentage": 15, "color": "#4444ff"}
            ]
          },
          {
            title: "Porcentajes tipo de coche vendido: Año 2023", 
            data: [
              {"label": "Diésel", "percentage": 45, "color": "#ff4444"},
              {"label": "Gasolina", "percentage": 25, "color": "#ffaa00"},
              {"label": "Híbridos", "percentage": 15, "color": "#44ff44"},
              {"label": "Enchufables", "percentage": 15, "color": "#4444ff"}
            ]
          }
        ],
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de integrar información de múltiples gráficos (barras + sectores), calcular totales de series específicas y aplicar porcentajes sobre esos totales."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Paso 1: Calcular total de coches vendidos en 2023\\n• 1º Trimestre: 24 (miles)\\n• 2º Trimestre: 37 (miles)\\n• 3º Trimestre: 63 (miles)\\n• 4º Trimestre: 89 (miles)\\n• Total 2023 = 24 + 37 + 63 + 89 = 213 miles\\n\\n📋 Paso 2: Aplicar porcentaje de enchufables\\n• Del gráfico de sectores 2023: Enchufables = 15%\\n• 15% de 213.000 = 0,15 × 213.000 = 31.950 coches\\n\\n📋 Paso 3: Conversión a miles\\n• 31.950 coches = 31,95 miles ≈ 32.000 coches ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma y porcentaje directo\\n• Total 2023: 24+37+63+89 = 213 miles\\n• 15% de 213 = 213 × 0,15 = 31,95 miles\\n• Resultado: 32.000 coches ✅\\n\\n📊 Método 2: Cálculo por fracciones\\n• 15% = 15/100 = 3/20\\n• 213 ÷ 20 = 10,65, luego × 3 = 31,95 miles\\n• Aproximadamente 32.000 coches ✅\\n\\n💰 Método 3: Estimación rápida\\n• Total ≈ 210 miles (redondeo)\\n• 15% de 210 = 31,5 miles\\n• Cercano a 32.000 ✅"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Usar datos de 2022 en lugar de 2023\\n• Sumar incorrectamente los trimestres de 2023\\n• Confundir el porcentaje de enchufables (usar otro tipo de coche)\\n• Error en conversión de miles: 31,95 miles = 31.950, no 3.195\\n• No redondear adecuadamente el resultado final\\n• Leer mal los gráficos de sectores (usar datos de 2022)"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En problemas con gráficos mixtos: 1) Usa el gráfico de barras para obtener totales por período, 2) Usa el gráfico de sectores correcto (2023) para obtener el porcentaje, 3) Multiplica total × porcentaje, 4) Convierte unidades correctamente (miles a unidades)."
          }
        ]
      },
      option_a: '32.000',
      option_b: '25.000',
      option_c: '36.000',
      option_d: '30.000',
      correct_option: 0, // A = 32.000 (15% de 213.000)
      explanation: null, // Se maneja en el componente
      question_subtype: 'mixed_chart', // Tipo para gráfico mixto
      difficulty: 'hard',
      time_limit_seconds: 180,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'multi_chart_integration', 'basic_addition'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de coches enchufables 2023...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de coches enchufables 2023 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 32.000 coches (15% de 213.000)')
    console.log('♻️  Requiere componente para gráficos mixtos')
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

insertPluggableCars2023Question()