import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addMedallasOlimpicasQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección...');
    
    // 1. Buscar la categoría 'capacidad-administrativa'
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

    // 2. Buscar la sección 'tablas' dentro de la categoría
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

    // 3. Datos de la pregunta específica de medallas olímpicas
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Si utilizásemos el dato del total de medallas de oro y bronce, ¿qué país tendría la cantidad mayor?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'MEDALLAS OLÍMPICAS POR PAÍS',
        question_context: 'Observa la siguiente tabla de medallas olímpicas y calcula qué país tiene más medallas de oro y bronce combinadas:',
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
            highlighted_columns: [3, 5], // Resaltar columnas Oro y Bronce
            footer_note: 'Cálculo: Oro + Bronce por país'
          }
        ],
        operation_type: 'sum_calculation',
        evaluation_description: 'Capacidad de identificar columnas específicas en una tabla de datos y realizar operaciones aritméticas simples (suma) con los valores seleccionados',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de organización y manejo de datos tabulares. Evalúa la habilidad para localizar información específica en tablas complejas y realizar operaciones matemáticas básicas con los datos extraídos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar las columnas relevantes\n• 'Oro' (columna 4) y 'Bronce' (columna 6)\n• Ignorar: Participación, Plata, Total Medallas\n\n📋 PASO 2: Extraer datos por país\n• Alemania: 239 oro + 291 bronce\n• Francia: 231 oro + 285 bronce\n• España: 48 oro + 49 bronce\n• Italia: 222 oro + 215 bronce\n• Grecia: 36 oro + 41 bronce\n\n🔢 PASO 3: Calcular suma para cada país\n• Alemania: 239 + 291 = 530 medallas ✅\n• Francia: 231 + 285 = 516 medallas\n• España: 48 + 49 = 97 medallas\n• Italia: 222 + 215 = 437 medallas\n• Grecia: 36 + 41 = 77 medallas"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Identificación visual rápida\n• Localizar columnas 'Oro' y 'Bronce'\n• Ignorar datos irrelevantes (Plata, Participación)\n• Sumar mentalmente por filas\n\n📊 Método 2: Comparación por aproximación\n• Alemania: ~240 + ~290 = ~530 (el más alto)\n• Francia: ~230 + ~285 = ~515 (segundo)\n• Resto claramente menores\n\n💰 Método 3: Descarte de opciones\n• España y Grecia: números muy bajos, descartables\n• Italia vs Alemania vs Francia: Alemania tiene mayor oro Y mayor bronce\n• Opción C (Alemania): ✅ Correcta por tener ambos valores altos"
          }
        ]
      },
      option_a: 'Italia',
      option_b: 'Francia', 
      option_c: 'Alemania',
      option_d: 'Grecia',
      correct_option: 2, // C - Alemania (530 medallas)
      explanation: null, // Se maneja en componente
      question_subtype: 'data_tables',
      is_active: true
    };

    // 4. Insertar la pregunta
    console.log('📝 Insertando pregunta de medallas olímpicas...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de medallas olímpicas añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: Alemania (239+291 = 530 medallas de oro y bronce)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
addMedallasOlimpicasQuestion();