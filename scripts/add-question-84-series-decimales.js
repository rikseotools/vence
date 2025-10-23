import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addSeries22Question() {
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
      question_text: 'Indique el/los número/s que continuaría la siguiente serie: 22 - 11 - 5,5 - 2,75 - ?',
      content_data: {
        chart_type: 'sequence_numeric',
        sequence: ['22', '11', '5,5', '2,75', '?'],
        pattern_type: 'division',
        pattern_description: 'Cada número se divide por 2',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de reconocer patrones aritméticos en secuencias numéricas con números decimales y operaciones de división."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Secuencia: 22 → 11 → 5,5 → 2,75 → ?\n\n✅ Observación del patrón:\n• 22 ÷ 2 = 11\n• 11 ÷ 2 = 5,5\n• 5,5 ÷ 2 = 2,75\n• 2,75 ÷ 2 = 1,375\n\n📋 Patrón identificado: División consecutiva por 2"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Observación de la relación entre números consecutivos\n• Calcular 22 ÷ 11 = 2\n• Verificar: 11 ÷ 5,5 = 2\n• Confirmar: 5,5 ÷ 2,75 = 2\n• Aplicar: 2,75 ÷ 2 = 1,375\n\n📊 Método 2: Patrón de división constante\n• Reconocer que cada término es la mitad del anterior\n• Aplicar la regla directamente al último término conocido\n• 2,75 ÷ 2 = 1,375\n\n💰 Método 3: Descarte de opciones\n• Opción A: 1,375 ✅ (Resultado correcto de 2,75 ÷ 2)\n• Opción B: 2,6 ❌ (No sigue el patrón de división por 2)\n• Opción C: 1,47 ❌ (No es resultado de 2,75 ÷ 2)\n• Opción D: 2,70 ❌ (No sigue la progresión de división)"
          }
        ]
      },
      option_a: '1,375',
      option_b: '2,6', 
      option_c: '1,47',
      option_d: '2,70',
      correct_option: 0, // A
      explanation: null, // Se maneja en el componente
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['pattern_recognition', 'arithmetic_operations', 'decimal_operations'],
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

    console.log('✅ Pregunta 84 de series decimales añadida exitosamente');
    console.log(`📝 ID: ${data[0]?.id}`);
    console.log('✅ Respuesta correcta: 1,375 (división por 2)');
    console.log('♻️  Utiliza el componente SequenceNumericQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSeries22Question();