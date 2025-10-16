import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSeguroIncendiosClasificacionQuestion() {
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
      question_text: 'Aplicando las reglas de clasificación, ¿qué letra le corresponde al seguro de incendios de 4000 EUROS contratado el 17/05/2017?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'CLASIFICACIÓN DE SEGUROS - REGLAS Y CASO INCENDIOS',
        question_context: 'Aplica las reglas de clasificación al seguro de incendios presentado:',
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
              ['Cantidad asegurada', '4000 EUROS'],
              ['Fecha de contrato', '17/05/2017']
            ],
            highlighted_rows: [0, 1, 2]
          }
        ],
        operation_type: 'rule_application',
        evaluation_description: 'Capacidad de aplicar reglas de clasificación verificando tipo de seguro, rango de importe y período de contratación',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de aplicación sistemática de reglas múltiples. Evalúa la habilidad para verificar criterios simultáneos y determinar la clasificación correcta cuando varias reglas pueden aplicar."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Datos del caso\n• Tipo: INCENDIOS\n• Importe: 4000 EUROS\n• Fecha: 17/05/2017\n\n📋 PASO 2: Verificar Regla A\n• ¿Incendios o accidentes? → INCENDIOS ✓\n• ¿Entre 1500-4500€? → 4000€ ✓\n• ¿Entre 15/03/2016 y 10/05/2017? → 17/05/2017 (NO, muy tarde)\n• Regla A: ❌ DESCARTADA\n\n📋 PASO 3: Verificar Regla B\n• ¿Vida o accidentes? → INCENDIOS (NO cumple)\n• Regla B: ❌ DESCARTADA\n\n📋 PASO 4: Verificar Regla C\n• ¿Incendios o vida? → INCENDIOS ✓\n• ¿Entre 2000-5000€? → 4000€ ✓\n• ¿Entre 10/02/2016 y 15/06/2017? → 17/05/2017 ✓\n• Regla C: ✅ CUMPLE TODOS LOS CRITERIOS\n\n✅ RESULTADO: Marque C"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Descarte por fecha\n• 17/05/2017 supera el límite de regla A (10/05/2017)\n• Pero está dentro del límite de regla C (15/06/2017)\n• Verificar si C cumple otros criterios\n\n📊 Método 2: Verificación por tipo\n• INCENDIOS cumple regla A (incendios/accidentes)\n• INCENDIOS NO cumple regla B (vida/accidentes)\n• INCENDIOS cumple regla C (incendios/vida)\n• Solo A y C son candidatas\n\n💰 Método 3: Análisis de rangos\n• Importe 4000€ cumple A (1500-4500€) y C (2000-5000€)\n• La fecha 17/05/2017 solo cumple C\n• Por tanto: C es la única que cumple todo"
          }
        ]
      },
      option_a: 'B',
      option_b: 'D', 
      option_c: 'C',
      option_d: 'A',
      correct_option: 2, // C - Cumple criterio C
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de clasificación seguro incendios...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de clasificación seguro incendios añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: C (cumple criterio C: incendios, 2000-5000€, 10/02/2016-15/06/2017)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addSeguroIncendiosClasificacionQuestion();