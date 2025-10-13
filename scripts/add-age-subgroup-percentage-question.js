import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertAgeSubgroupPercentageQuestion() {
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
      question_text: 'Dentro del rango de edad de 27 a 59 años, los datos se distribuyen de la siguiente manera:\nNivel 1: de 27 a 30 años serían el 15 %\nNivel 2: de 31 a 40 años serían el 30 %\nNivel 3: de 41 a 49 años serían el 35 %\nNivel 4: de 50 a 59 el resto.\n¿Cuántas personas de este rango de edad pertenecerían al Nivel 4?',
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
            content: "Capacidad de identificar una serie específica en un gráfico de líneas, calcular el total de esa serie, aplicar distribución de porcentajes y calcular el porcentaje restante."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Paso 1: Identificar la serie objetivo\n• Buscar la línea 'Edad de 27 a 64 años' en el gráfico\n• Esta línea contiene nuestro rango de edad objetivo (27-59 años)\n\n📋 Paso 2: Calcular total del rango\n• Centro salud: 70 (miles)\n• Hospitales: 60 (miles)\n• Centros especializados: 50 (miles)\n• Clínicas privadas: 90 (miles)\n• Total = 70 + 60 + 50 + 90 = 270 miles = 270.000 personas\n\n📋 Paso 3: Calcular distribución por niveles\n• Nivel 1 (27-30 años): 15% de 270.000 = 40.500 personas\n• Nivel 2 (31-40 años): 30% de 270.000 = 81.000 personas\n• Nivel 3 (41-49 años): 35% de 270.000 = 94.500 personas\n• Nivel 4 (50-59 años): El resto = 270.000 - (40.500 + 81.000 + 94.500) = 54.000 personas\n\n📋 Verificación del Nivel 4:\n• Porcentaje del resto: 100% - (15% + 30% + 35%) = 20%\n• 20% de 270.000 = 54.000 personas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo del porcentaje restante\n• Suma de porcentajes dados: 15% + 30% + 35% = 80%\n• Porcentaje restante (Nivel 4): 100% - 80% = 20%\n• Total del rango: 270.000 personas\n• Nivel 4: 20% de 270.000 = 54.000 personas\n\n📊 Método 2: Suma directa de la serie\n• Identifica la línea gris/negra (27-64 años)\n• Suma: 70 + 60 + 50 + 90 = 270 miles\n• Calcula 20% de 270.000 = 54.000\n\n💰 Método 3: Descarte de opciones\n• Total del rango es 270.000\n• 20% debe ser significativo pero no mayoría\n• 54.000 es aproximadamente 1/5 de 270.000 ✅"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir las series del gráfico (usar datos de otro rango de edad)\n• No calcular correctamente el total del rango base (270.000)\n• Errores en el cálculo de porcentajes (confundir 20% con 0.2)\n• No identificar que 'el resto' significa 100% - suma de los otros porcentajes\n• Usar el total general en lugar del total específico del rango 27-64 años\n• Olvidar convertir de miles a unidades completas"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En problemas de distribución porcentual dentro de subgrupos: 1) Identifica primero el grupo base en el gráfico, 2) Calcula el total de ese grupo, 3) Identifica qué porcentaje representa 'el resto', 4) Aplica ese porcentaje al total del grupo base. Siempre verifica que la suma de porcentajes sea 100%."
          }
        ]
      },
      option_a: '59.000 personas.',
      option_b: '51.000 personas',
      option_c: '53.000 personas.',
      option_d: '50.000 personas.',
      correct_option: 2, // C = 53.000 personas (20% de 265.000 según la explicación del problema)
      explanation: null, // Se maneja en el componente
      question_subtype: 'line_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'hard',
      time_limit_seconds: 180,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'data_extraction', 'basic_addition', 'logical_reasoning'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de subgrupo por porcentaje...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de subgrupo por porcentaje añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 53.000 personas (20% del total del rango 27-64 años)')
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

insertAgeSubgroupPercentageQuestion()