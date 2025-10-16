import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSeguroVidaClasificacionQuestion() {
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
      question_text: 'Aplicando las reglas de clasificación, ¿qué letra le corresponde al seguro de vida de 2000 EUROS contratado el 13/11/2017?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'CLASIFICACIÓN DE SEGUROS - REGLAS Y CASO',
        question_context: 'Aplica las reglas de clasificación al caso específico presentado:',
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
              ['Cantidad asegurada', '2000 EUROS'],
              ['Fecha de contrato', '13/11/2017']
            ],
            highlighted_rows: [0, 1, 2]
          }
        ],
        operation_type: 'rule_application',
        evaluation_description: 'Capacidad de aplicar reglas de clasificación sistemática verificando múltiples criterios (tipo, importe, fecha) contra un caso específico',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de aplicación sistemática de reglas de clasificación. Evalúa la habilidad para verificar múltiples criterios simultáneamente y determinar cuándo ninguna regla se cumple."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Datos del caso\n• Tipo: VIDA\n• Importe: 2000 EUROS\n• Fecha: 13/11/2017\n\n📋 PASO 2: Verificar Regla A\n• ¿Incendios o accidentes? → VIDA (NO cumple)\n• Regla A: ❌ DESCARTADA\n\n📋 PASO 3: Verificar Regla B\n• ¿Vida o accidentes? → VIDA ✓\n• ¿Hasta 3000€? → 2000€ ✓\n• ¿Entre 15/10/2016 y 20/08/2017? → 13/11/2017 (NO, muy tarde)\n• Regla B: ❌ DESCARTADA\n\n📋 PASO 4: Verificar Regla C\n• ¿Incendios o vida? → VIDA ✓\n• ¿Entre 2000-5000€? → 2000€ ✓\n• ¿Entre 10/02/2016 y 15/06/2017? → 13/11/2017 (NO, muy tarde)\n• Regla C: ❌ DESCARTADA\n\n✅ PASO 5: Aplicar Regla D\n• No cumple A, B, ni C → MARQUE D"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Verificación por fecha\n• 13/11/2017 es muy tardía para la mayoría de reglas\n• Solo la regla B llega hasta 20/08/2017\n• Pero 13/11/2017 > 20/08/2017 → Fuera de rango\n\n📊 Método 2: Descarte rápido\n• Regla A: pide incendios/accidentes (tenemos vida)\n• Regla B: fecha límite 20/08/2017 (tenemos 13/11/2017)\n• Regla C: fecha límite 15/06/2017 (tenemos 13/11/2017)\n• Solo queda D\n\n💰 Método 3: Identificar limitantes\n• Fecha 13/11/2017 es el factor limitante\n• Es posterior a todos los rangos de fechas\n• Directamente → Marque D"
          }
        ]
      },
      option_a: 'B',
      option_b: 'C', 
      option_c: 'A',
      option_d: 'D',
      correct_option: 3, // D - No cumple ninguna condición anterior
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de clasificación seguro vida...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de clasificación seguro vida añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d, '← CORRECTA');
    console.log('✅ Respuesta correcta: D (no cumple ninguna condición - fecha muy tardía)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addSeguroVidaClasificacionQuestion();