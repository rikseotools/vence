import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSumaMedallasBronceQuestion() {
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
      question_text: 'Si sumásemos la cantidad total de medallas de bronce de los cinco países, ¿Qué cantidad de medallas resultaría?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'MEDALLAS OLÍMPICAS - SUMA TOTAL DE BRONCE',
        question_context: 'Suma todas las medallas de bronce de los cinco países presentados:',
        tables: [
          {
            title: 'Participación y Medallas obtenidas - JJ.OO de verano',
            headers: ['País', 'Participación JJ.OO verano', 'Participación JJ.OO invierno', 'Oro', 'Plata', 'Bronce', 'Total Medallas'],
            rows: [
              ['Alemania', '17', '12', '239', '267', '291', '797'],
              ['Francia', '29', '24', '231', '256', '285', '772'],
              ['España', '24', '21', '48', '72', '49', '169'],
              ['Italia', '28', '24', '222', '195', '215', '632'],
              ['Grecia', '29', '19', '36', '45', '41', '122']
            ],
            highlighted_columns: [5], // Resaltar columna Bronce
            footer_note: 'Sumar todas las medallas de bronce: 291 + 285 + 49 + 215 + 41'
          }
        ],
        operation_type: 'column_sum',
        evaluation_description: 'Capacidad de sumar todos los valores de una columna específica en una tabla de datos deportivos',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de operaciones aritméticas básicas con datos tabulares. Evalúa la habilidad para sumar múltiples valores de una columna específica y obtener un total consolidado."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar la columna objetivo\n• Localizar la columna 'Bronce'\n• Ignorar: Oro, Plata, Total Medallas\n\n📋 PASO 2: Extraer todos los valores\n• Alemania: 291 medallas de bronce\n• Francia: 285 medallas de bronce\n• España: 49 medallas de bronce\n• Italia: 215 medallas de bronce\n• Grecia: 41 medallas de bronce\n\n🔢 PASO 3: Realizar la suma total\n• 291 + 285 + 49 + 215 + 41\n• = 576 + 49 + 215 + 41\n• = 625 + 215 + 41\n• = 840 + 41 = 881 ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Agrupación por aproximación\n• Alemania + Francia: ~290 + ~285 = ~575\n• España + Italia + Grecia: ~50 + ~215 + ~40 = ~305\n• Total: ~575 + ~305 = ~880\n\n📊 Método 2: Suma progresiva\n• 291 + 285 = 576\n• 576 + 49 = 625\n• 625 + 215 = 840\n• 840 + 41 = 881\n\n💰 Método 3: Verificación por estimación\n• Números grandes: 291, 285, 215 (≈ 790)\n• Números pequeños: 49, 41 (≈ 90)\n• Total aproximado: 790 + 90 = 880"
          }
        ]
      },
      option_a: '861',
      option_b: '881', 
      option_c: '891',
      option_d: '781',
      correct_option: 1, // B - 881 medallas
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de suma medallas bronce...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de suma medallas bronce añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b, '← CORRECTA');
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 881 medallas (291+285+49+215+41)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addSumaMedallasBronceQuestion();