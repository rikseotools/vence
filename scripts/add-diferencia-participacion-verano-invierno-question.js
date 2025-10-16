import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addDiferenciaParticipacionVeranoInviernoQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección...');
    
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-administrativa')
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
      .eq('section_key', 'tablas')
      .single();

    if (sectionError || !section) {
      console.error('❌ Error al buscar sección:', sectionError);
      return;
    }

    console.log('✅ Sección encontrada:', section.display_name);

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'De los países que se le proponen, ¿Qué país tendría una mayor diferencia en la participación de los JJ.OO de verano respecto a los de invierno?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'PARTICIPACIÓN OLÍMPICA POR PAÍS - ANÁLISIS COMPARATIVO',
        question_context: 'Calcula la diferencia entre participaciones de verano e invierno para cada país:',
        tables: [
          {
            title: 'Participación y Medallas obtenidas - JJ.OO',
            headers: ['País', 'Participación JJ.OO verano', 'Participación JJ.OO invierno', 'Medallas obtenidas JJ.OO de verano', '', '', '', 'Total Medallas'],
            subheaders: ['', '', '', 'Oro', 'Plata', 'Bronce', ''],
            rows: [
              ['Alemania', '17', '12', '239', '267', '291', '797'],
              ['Francia', '29', '24', '231', '256', '285', '772'],
              ['España', '24', '21', '48', '72', '49', '169'],
              ['Italia', '28', '24', '222', '195', '215', '632'],
              ['Grecia', '29', '19', '36', '45', '41', '122']
            ],
            highlighted_columns: [1, 2], // Resaltar participación verano e invierno
            footer_note: 'Calcular: |JJ.OO verano - JJ.OO invierno| para cada país'
          }
        ],
        operation_type: 'difference_calculation',
        evaluation_description: 'Capacidad de calcular diferencias absolutas entre dos columnas de participación deportiva y comparar resultados',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis comparativo de datos deportivos. Evalúa la habilidad para calcular diferencias absolutas entre tipos de participación olímpica y determinar el valor máximo."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar columnas relevantes\n• JJ.OO verano: columna 2\n• JJ.OO invierno: columna 3\n• Calcular diferencia absoluta |Verano - Invierno|\n\n📋 PASO 2: Calcular diferencias por país\n• Alemania: |17 - 12| = 5\n• Francia: |29 - 24| = 5\n• España: |24 - 21| = 3\n• Italia: |28 - 24| = 4\n• Grecia: |29 - 19| = 10 ✅\n\n🏆 PASO 3: Comparar resultados\n• Grecia tiene la mayor diferencia: 10\n• Alemania y Francia empatan en segundo: 5\n• Italia tercero con 4, España último con 3"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Identificación visual rápida\n• Buscar países con mayor diferencia entre columnas\n• Grecia: 29-19 = 10 (claramente el mayor)\n• No necesitas calcular todos si Grecia ya supera 10\n\n📊 Método 2: Comparación directa\n• Grecia: 29 verano vs 19 invierno (gran diferencia)\n• Otros países tienen números más cercanos\n• 10 de diferencia es obviamente el mayor\n\n💰 Método 3: Estimación rápida\n• Grecia: ~30-~20 = ~10\n• Francia: ~30-~25 = ~5\n• Alemania: ~17-~12 = ~5\n• Grecia será el ganador claro"
          }
        ]
      },
      option_a: 'Italia',
      option_b: 'Alemania', 
      option_c: 'Grecia',
      option_d: 'España',
      correct_option: 2, // C - Grecia (diferencia de 10)
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de diferencia participación...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de diferencia participación añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: Grecia (|29-19| = 10)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addDiferenciaParticipacionVeranoInviernoQuestion();