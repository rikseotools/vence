import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesIntercaladaQuestion() {
  try {
    const supabase = getSupabase()

    console.log('🔍 Buscando categoría y sección...')
    
    // Buscar categoría Series Numéricas
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'series-numericas')
      .single()
    
    if (categoryError || !category) {
      console.log('❌ Error al encontrar categoría:', categoryError?.message)
      return
    }
    
    console.log('✅ Categoría encontrada:', category.display_name)
    
    // Buscar secciones disponibles en la categoría
    const { data: sections, error: sectionsError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
    
    if (sectionsError || !sections?.length) {
      console.log('❌ Error al encontrar secciones:', sectionsError?.message)
      return
    }
    
    console.log('📋 Secciones disponibles:')
    sections.forEach(s => console.log(`  - ${s.section_key}: ${s.display_name}`))
    
    // Usar la primera sección disponible
    const section = sections[0]
    
    console.log('✅ Sección encontrada:', section.display_name)

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '2, 11, 4, 11, 8, 11, ?',
      content_data: {
        chart_type: 'sequence_numeric',
        sequence: [2, 11, 4, 11, 8, 11, '?'],
        pattern_type: 'intercaladas',
        pattern_description: 'Series numéricas intercaladas',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de identificar patrones en series numéricas intercaladas donde se alternan dos secuencias independientes."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Secuencia: 2, 11, 4, 11, 8, 11, ?\n\nEl concepto de intercalado hace referencia al hecho de que la relación de los dígitos de la serie no es de uno en uno, sino que vamos saltando cifras.\n\nNormalmente, podemos encontrar dos series diferenciadas, donde cada una sigue un patrón diferente.\n\n✅ Serie A (posiciones 1,3,5,7): 2, 4, 8, ?\n• 2 × 2 = 4\n• 4 × 2 = 8  \n• 8 × 2 = 16\n\n✅ Serie B (posiciones 2,4,6,8): 11, 11, 11, 11\n• Constante: siempre 11\n\n📋 Patrón identificado: En esta serie se avanza duplicando el número anterior: 2, 4, 8, 16."
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Separar las dos series\n• Serie A (posiciones 1,3,5,7): 2, 4, 8, ?\n• Serie B (posiciones 2,4,6,8): 11, 11, 11, 11\n• Resultado: La serie A se duplica, entonces 8×2=16\n\n📊 Método 2: Observación visual\n• Los números 11 se repiten constantemente\n• Los otros números van creciendo: 2→4→8\n• Patrón claro de duplicación\n\n💰 Método 3: Descarte de opciones\n• Opción A: 16 ✅ (sigue patrón 2×2=4, 4×2=8, 8×2=16)\n• Opción B: 42 ❌ (demasiado grande para el patrón)\n• Opción C: 30 ❌ (no sigue duplicación)\n• Opción D: 17 ❌ (muy cerca de 16 pero incorrecta)"
          }
        ]
      },
      option_a: '16',
      option_b: '42', 
      option_c: '30',
      option_d: '17',
      correct_option: 0, // A = 16
      explanation: null, // Se maneja en explanation_sections
      difficulty: 'medium',
      time_limit_seconds: 90,
      question_subtype: 'sequence_numeric',
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta...')
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()
    
    if (error) {
      console.log('❌ Error al insertar pregunta:', error.message)
      return
    }
    
    console.log('✅ Pregunta de series intercaladas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('📊 Serie: 2, 11, 4, 11, 8, 11, ?')
    console.log('✅ Respuesta correcta: 16 (duplicación: 2→4→8→16)')
    console.log('♻️  Usa el componente SequenceNumericQuestion existente')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
  }
}

addSeriesIntercaladaQuestion()