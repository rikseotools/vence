import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSeguroVida5000ClasificacionQuestion() {
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
      question_text: 'Aplicando las reglas de clasificación, ¿qué letra le corresponde al seguro de vida de 5000 EUROS contratado el 16/02/2017?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'CLASIFICACIÓN DE SEGUROS - REGLAS Y CASO VIDA 5000€',
        question_context: 'Aplica las reglas de clasificación al seguro de vida de alto valor:',
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
              ['Tipo de seguro', 'VIDA'],
              ['Cantidad asegurada', '5000 EUROS'],
              ['Fecha de contrato', '16/02/2017']
            ],
            highlighted_rows: [0, 1, 2]
          }
        ],
        operation_type: 'rule_application',
        evaluation_description: 'Capacidad de aplicar reglas de clasificación con valores límite y verificar criterios de inclusividad en rangos',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de aplicación de reglas con valores límite. Evalúa la comprensión de rangos inclusivos y la habilidad para determinar cuándo un valor está exactamente en el límite superior de un rango."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Datos del caso\n• Tipo: VIDA\n• Importe: 5000 EUROS\n• Fecha: 16/02/2017\n\n📋 PASO 2: Verificar Regla A\n• ¿Incendios o accidentes? → VIDA (NO cumple)\n• Regla A: ❌ DESCARTADA\n\n📋 PASO 3: Verificar Regla B\n• ¿Vida o accidentes? → VIDA ✓\n• ¿Hasta 3000€? → 5000€ (NO, supera límite)\n• Regla B: ❌ DESCARTADA\n\n📋 PASO 4: Verificar Regla C\n• ¿Incendios o vida? → VIDA ✓\n• ¿Entre 2000-5000€ inclusive? → 5000€ ✓ (límite superior inclusivo)\n• ¿Entre 10/02/2016 y 15/06/2017? → 16/02/2017 ✓\n• Regla C: ✅ CUMPLE TODOS LOS CRITERIOS\n\n✅ RESULTADO: Marque C"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Verificación de límites inclusivos\n• 5000€ está en el límite superior de regla C\n• 'Inclusive' significa que 5000€ SÍ cuenta\n• No supera el límite, lo alcanza exactamente\n\n📊 Método 2: Descarte por importe\n• 5000€ supera regla A (máximo 4500€)\n• 5000€ supera regla B (máximo 3000€)\n• 5000€ cumple regla C (máximo 5000€ inclusive)\n• Solo C es posible por importe\n\n💰 Método 3: Verificación por tipo\n• VIDA no cumple regla A (incendios/accidentes)\n• VIDA cumple regla B y C\n• Pero solo C cumple también el importe\n• Por tanto: C es la única opción"
          }
        ]
      },
      option_a: 'D',
      option_b: 'B', 
      option_c: 'A',
      option_d: 'C',
      correct_option: 3, // D = C (cumple criterio C)
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de clasificación seguro vida 5000€...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de clasificación seguro vida 5000€ añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d, '← CORRECTA');
    console.log('✅ Respuesta correcta: C (cumple criterio C: vida, 2000-5000€ inclusive, 10/02/2016-15/06/2017)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addSeguroVida5000ClasificacionQuestion();