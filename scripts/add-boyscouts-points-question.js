import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertBoyscoutsQuestion() {
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

    // Primero verificar las columnas de la tabla
    console.log('🔍 Verificando estructura de la tabla...')
    const { data: existingQuestions } = await supabase
      .from('psychometric_questions')
      .select('*')
      .limit(1)

    console.log('📋 Columnas disponibles:', existingQuestions?.[0] ? Object.keys(existingQuestions[0]) : 'No hay preguntas existentes')

    // Datos de la pregunta (solo campos básicos que seguro existen)
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Un grupo de Boyscouts se va a Navacerrada pasar el verano y deciden hacer equipos para resolver un problema. Tenga en cuenta que el total de puntos que se pueden conseguir es de 500. Teniendo en cuenta que el equipo ganador es el que menos puntuación ha obtenido, ¿cuál es el equipo ganador?',
      content_data: {
        chart_data: [
          {"label": "EQUIPO 1", "value": 109, "percentage": 21.8},
          {"label": "EQUIPO 2", "value": 163.5, "percentage": 32.7},
          {"label": "EQUIPO 3", "value": 54.5, "percentage": 10.9},
          {"label": "EQUIPO 4", "value": 172.5, "percentage": 34.5}
        ],
        total_value: 500,
        chart_title: "PUNTOS CONSEGUIDOS",
        question_context: "A continuación se presenta un gráfico. Deberá contestar las preguntas que abarcan desde la 11 hasta la 16.",
        evaluation_description: "Interpretación de gráficos de sectores y comprensión de criterios de victoria inversos (menor puntuación gana)",
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de interpretar gráficos de sectores y aplicar lógica inversa donde el criterio de 'ganador' es el equipo con MENOR puntuación, no mayor."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos del gráfico:\n• Equipo 1: 21,8% = 109 puntos ❌\n• Equipo 2: 32,7% = 163,5 puntos ❌\n• Equipo 3: 10,9% = 54,5 puntos ✅ (MENOR)\n• Equipo 4: 34,5% = 172,5 puntos ❌\n\n📋 Criterio de victoria:\n• El enunciado dice: 'el equipo ganador es el que MENOS puntuación ha obtenido'\n• Equipo 3 tiene la menor puntuación: 10,9%"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Identificación visual directa\n• Buscar el sector MÁS PEQUEÑO del gráfico\n• Equipo 3 claramente tiene el sector menor\n• No necesitas calcular números exactos\n\n📊 Método 2: Lectura de porcentajes\n• Comparar solo los porcentajes mostrados\n• 10,9% < 21,8% < 32,7% < 34,5%\n• Equipo 3 = menor porcentaje = ganador\n\n💰 Método 3: Descarte de opciones\n• Opción A (Equipo 4): 34,5% - el MÁS ALTO ❌\n• Opción B (Equipo 2): 32,7% - segundo más alto ❌\n• Opción C (Equipo 3): 10,9% - el MÁS BAJO ✅\n• Opción D (Equipo 1): 21,8% - intermedio ❌"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Elegir el equipo con MÁS puntos (leer mal el enunciado)\n• Confundir 'ganador' con 'mayor puntuación'\n• No leer que es un 'problema' donde menos puntos = mejor\n• Calcular valores exactos cuando basta comparar porcentajes"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En gráficos de sectores, lee SIEMPRE dos veces el criterio de victoria. Palabras clave como 'menos', 'menor', 'problema' indican lógica inversa. Usa la inspección visual antes que los cálculos."
          }
        ]
      },
      option_a: 'El equipo 4.',
      option_b: 'El equipo 2.',
      option_c: 'El equipo 3.',
      option_d: 'El equipo 1.',
      correct_option: 2, // C = El equipo 3 (menor puntuación)
      explanation: null, // Se maneja en el componente
      question_subtype: 'pie_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_comparison', 'logical_reasoning'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de Boyscouts...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de Boyscouts añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: El equipo 3 (menor puntuación: 10,9%)')
    console.log('♻️  Reutiliza el componente PieChartQuestion existente - no se necesitan cambios')
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

insertBoyscoutsQuestion()