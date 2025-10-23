import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addSeries132Question() {
  try {
    const supabase = getSupabase();
    
    // Buscar la categoría "Series Numéricas"
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'series-numericas')
      .single();
    
    if (categoryError) {
      console.log('❌ Error al buscar categoría:', categoryError.message);
      return;
    }
    
    // Buscar la sección de series numéricas
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections') 
      .select('id, category_id')
      .eq('category_id', category.id)
      .eq('section_key', 'series-numericas')
      .single();
    
    if (sectionError) {
      console.log('❌ Error al buscar sección:', sectionError.message);
      return;
    }

    const questionData = {
      section_id: section.id,
      category_id: section.category_id,
      question_text: '¿Qué número seguiría en la siguiente serie lógica? 132 127 134 125 136 123 138 ¿?',
      content_data: {
        chart_type: 'sequence_numeric',
        sequence: ['132', '127', '134', '125', '136', '123', '138', '?'],
        pattern_type: 'alternating',
        pattern_description: 'Serie alternante: +2/-5 en posiciones alternas',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de reconocer patrones alternantes complejos en secuencias numéricas, donde existen dos operaciones diferentes aplicadas en posiciones alternas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Secuencia: 132 → 127 → 134 → 125 → 136 → 123 → 138 → ?\n\n✅ Análisis de posiciones pares e impares:\n\n📋 Posiciones impares (1ª, 3ª, 5ª, 7ª): 132, 134, 136, 138\n• 132 + 2 = 134\n• 134 + 2 = 136\n• 136 + 2 = 138\n• Patrón: +2 constante\n\n📋 Posiciones pares (2ª, 4ª, 6ª, 8ª): 127, 125, 123, ?\n• 127 - 2 = 125\n• 125 - 2 = 123\n• 123 - 2 = 121\n• Patrón: -2 constante"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Separar posiciones pares e impares\n• Escribir solo posiciones impares: 132, 134, 136, 138 (+2)\n• Escribir solo posiciones pares: 127, 125, 123, ? (-2)\n• La 8ª posición (par): 123 - 2 = 121\n\n📊 Método 2: Observar diferencias consecutivas\n• 132 → 127: -5\n• 127 → 134: +7\n• 134 → 125: -9\n• 125 → 136: +11\n• 136 → 123: -13\n• 123 → 138: +15\n• 138 → ?: -17 (138 - 17 = 121)\n\n💰 Método 3: Descarte de opciones\n• Opción A: 125 ❌ (Ya aparece en posición 4)\n• Opción B: 145 ❌ (Demasiado alto para el patrón)\n• Opción C: 121 ✅ (Resultado correcto de 123 - 2)\n• Opción D: 101 ❌ (Demasiado bajo para el patrón)"
          }
        ]
      },
      option_a: '125',
      option_b: '145', 
      option_c: '121',
      option_d: '101',
      correct_option: 2, // C
      explanation: null, // Se maneja en el componente
      difficulty: 'hard',
      time_limit_seconds: 180,
      cognitive_skills: ['pattern_recognition', 'alternating_sequences', 'logical_analysis'],
      question_subtype: 'sequence_numeric',
      is_active: true,
      is_verified: true
    };

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select();

    if (error) {
      console.log('❌ Error al insertar pregunta:', error.message);
      return;
    }

    console.log('✅ Pregunta 85 de series lógicas añadida exitosamente');
    console.log(`📝 ID: ${data[0]?.id}`);
    console.log('✅ Respuesta correcta: 121 (patrón alternante -2 en posiciones pares)');
    console.log('♻️  Utiliza el componente SequenceNumericQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSeries132Question();