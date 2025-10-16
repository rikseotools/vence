import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSeguroIncendios1000ClasificacionQuestion() {
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
      question_text: 'Aplicando las reglas de clasificación, ¿qué letra le corresponde al seguro de incendios de 1000 EUROS contratado el 3/08/2017?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'CLASIFICACIÓN DE SEGUROS - CASO INCENDIOS 1000€',
        question_context: 'Aplica las reglas de clasificación al seguro de incendios de bajo valor:',
        tables: [
          {
            title: 'Reglas de Clasificación',
            headers: ['Regla', 'Descripción'],
            rows: [
              ['1. Marque A en la columna 1', 'Seguro de incendios o accidentes, desde 1500 a 4500 euros inclusive, contratado entre el 15 de marzo de 2016 y el 10 de mayo de 2017'],
              ['2. Marque B en la columna 2', 'Seguro de vida o de accidentes, hasta 3000 euros inclusive, contratado entre el 15 de octubre de 2016 y el 20 de agosto de 2017'],
              ['3. Marque C en la columna 3', 'Seguro de incendios o de vida, desde 2000 a 5000 euros inclusive, contratado entre el 10 de febrero de 2016 y el 15 de junio de 2017'],
              ['4. Marque D', 'Si no se cumple ninguna de las condiciones anteriores']
            ]
          },
          {
            title: 'Caso a Clasificar',
            headers: ['Característica', 'Valor'],
            rows: [
              ['Tipo de seguro', 'INCENDIOS'],
              ['Cantidad asegurada', '1000 EUROS'],
              ['Fecha de contrato', '3/08/2017']
            ],
            highlighted_rows: [0, 1, 2]
          }
        ],
        operation_type: 'rule_application',
        evaluation_description: 'Capacidad de aplicar reglas de clasificación cuando el caso no cumple los rangos mínimos de las reglas específicas',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de aplicación sistemática cuando ninguna regla específica se cumple. Evalúa la comprensión de que cuando un caso no encaja en criterios específicos, se aplica la regla general por defecto."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Datos del caso\n• Tipo: INCENDIOS\n• Importe: 1000 EUROS\n• Fecha: 3/08/2017\n\n📋 PASO 2: Verificar Regla A\n• ¿Incendios o accidentes? → INCENDIOS ✓\n• ¿Entre 1500-4500€? → 1000€ (NO, por debajo del mínimo)\n• Regla A: ❌ DESCARTADA (importe insuficiente)\n\n📋 PASO 3: Verificar Regla B\n• ¿Vida o accidentes? → INCENDIOS (NO cumple)\n• Regla B: ❌ DESCARTADA\n\n📋 PASO 4: Verificar Regla C\n• ¿Incendios o vida? → INCENDIOS ✓\n• ¿Entre 2000-5000€? → 1000€ (NO, por debajo del mínimo)\n• Regla C: ❌ DESCARTADA (importe insuficiente)\n\n✅ PASO 5: Aplicar Regla D\n• No cumple A, B, ni C → MARQUE D"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Verificación por importe\n• 1000€ está por debajo de todos los mínimos\n• Regla A: mínimo 1500€\n• Regla C: mínimo 2000€\n• Directamente → D\n\n📊 Método 2: Descarte inmediato\n• INCENDIOS no cumple regla B (vida/accidentes)\n• 1000€ < 1500€ (no cumple A)\n• 1000€ < 2000€ (no cumple C)\n• Solo queda D\n\n💰 Método 3: Identificación de limitante\n• El importe 1000€ es el factor limitante\n• Está por debajo de todos los rangos válidos\n• Sin verificar fechas: ya sabemos que es D"
          }
        ]
      },
      option_a: 'D',
      option_b: 'A', 
      option_c: 'C',
      option_d: 'B',
      correct_option: 0, // A = D (no cumple ninguna condición)
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de clasificación seguro incendios 1000€...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de clasificación seguro incendios 1000€ añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: D (no cumple ninguna condición - importe muy bajo)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addSeguroIncendios1000ClasificacionQuestion();