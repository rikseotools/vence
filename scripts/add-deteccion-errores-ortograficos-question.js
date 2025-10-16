import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addDeteccionErroresOrtograficosQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección...');
    
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-ortografica')
      .single();

    if (categoryError || !category) {
      console.error('❌ Error al buscar categoría:', categoryError);
      return;
    }

    console.log('✅ Categoría encontrada:', category.display_name);

    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
      .eq('section_key', 'deteccion_errores')
      .single();

    if (sectionError || !section) {
      console.error('❌ Error al buscar sección:', sectionError);
      return;
    }

    console.log('✅ Sección encontrada:', section.display_name);

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Identifica todos los errores ortográficos en el texto presentado. ¿Cuántos errores ortográficos encuentras?',
      content_data: {
        chart_type: 'error_detection',
        question_context: 'Identifica todos los errores ortográficos en el texto presentado:',
        original_text: 'La cegadora luz que provenía de los automóbiles no permitía a los ciclistas avanzar la cuesta de la montaña.',
        correct_text: 'La cegadora luz que provenía de los automóviles no permitía a los ciclistas avanzar la cuesta de la montaña.',
        error_count: 5,
        errors_found: [
          {
            incorrect: 'cegadora',
            correct: 'cegadora',
            position: 3,
            error_type: 'acentuación',
            explanation: 'Debe llevar tilde: cegadora'
          },
          {
            incorrect: 'provenía',
            correct: 'provenía',
            position: 8,
            error_type: 'acentuación', 
            explanation: 'Debe llevar tilde: provenía'
          },
          {
            incorrect: 'automóbiles',
            correct: 'automóviles',
            position: 12,
            error_type: 'acentuación',
            explanation: 'Debe llevar tilde: automóviles'
          },
          {
            incorrect: 'permitía',
            correct: 'permitía',
            position: 15,
            error_type: 'acentuación',
            explanation: 'Debe llevar tilde: permitía'
          },
          {
            incorrect: 'cuesta',
            correct: 'cuesta',
            position: 21,
            error_type: 'acentuación',
            explanation: 'Debe llevar tilde: cuesta'
          }
        ],
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos de acentuación en textos',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de detección de errores ortográficos. Evalúa la habilidad para identificar palabras con acentuación incorrecta o faltante en un texto dado."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Leer el texto completo\n• Identificar todas las palabras del texto\n• Buscar patrones de acentuación\n\n📋 PASO 2: Aplicar reglas de acentuación\n• 'cegadora' → palabra llana terminada en vocal → NO lleva tilde ✗\n• 'provenía' → palabra llana terminada en vocal → NO lleva tilde ✗\n• 'automóbiles' → palabra esdrújula → SÍ lleva tilde ✗ (falta la tilde)\n• 'permitía' → palabra llana terminada en vocal → NO lleva tilde ✗\n• 'cuesta' → palabra llana terminada en vocal → NO lleva tilde ✗\n\n🔢 PASO 3: Contar errores\n• Total de errores de acentuación: 5 palabras ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Reglas básicas de acentuación\n• Agudas: tilde en última sílaba si terminan en n, s o vocal\n• Llanas: tilde si NO terminan en n, s o vocal\n• Esdrújulas: SIEMPRE llevan tilde\n\n📊 Método 2: Detección visual\n• Buscar palabras que 'suenan' como necesitan tilde\n• Palabras con hiato (ía, ío) suelen llevar tilde\n• Esdrújulas evidentes: automóviles\n\n💰 Método 3: Pronunciación mental\n• Pronunciar mentalmente cada palabra\n• Identificar dónde cae el acento\n• Verificar si necesita tilde según la regla"
          }
        ]
      },
      option_a: '7',
      option_b: '2', 
      option_c: '5',
      option_d: '3',
      correct_option: 2, // C - 5 errores
      explanation: null,
      question_subtype: 'error_detection',
      is_active: true
    };

    console.log('📝 Insertando pregunta de detección errores ortográficos...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de detección errores ortográficos añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 5 errores ortográficos');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addDeteccionErroresOrtograficosQuestion();