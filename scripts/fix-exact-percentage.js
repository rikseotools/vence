import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixExactPercentage() {
  const questionId = '588c79ed-05fa-421a-8f32-23e4038b700b';
  
  console.log('🔧 CORRECCIÓN CON CÁLCULO EXACTO:');
  console.log('📊 Para 20,83% exacto: (50/240) × 100 = 20.8333...%');
  
  const updatedContentData = {
    exam_tip: 'En gráficos de líneas: 1) Identifica la serie correcta por color/leyenda, 2) Localiza el punto exacto, 3) Lee el valor con precisión, 4) Suma todos los valores de esa categoría.',
    subtitle: '(en miles) al mes',
    age_groups: [
      {label: '0-1 años', values: [95, 30, 70, 30]},
      {label: '15-26 años', values: [30, 20, 30, 20]}, 
      {label: '27-59 años', values: [70, 60, 50, 95]},
      {label: '60+ años', values: [100, 100, 90, 30]}
    ],
    categories: ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas'],
    chart_type: 'line_chart',
    chart_title: 'Personas atendidas por rango de edad / lugar de la atención',
    x_axis_label: 'Tipo de centro',
    y_axis_label: 'Número de personas (miles)',
    question_context: 'Observa el siguiente gráfico de líneas que muestra la distribución de pacientes por edad y tipo de centro:',
    target_group_value: 50,
    total_target_center: 240,
    evaluation_description: 'Tu capacidad para interpretar gráficos de líneas con múltiples series y calcular porcentajes específicos.',
    explanation_sections: [
      {
        title: '📊 ANÁLISIS PASO A PASO - GRÁFICO DE LÍNEAS:',
        content: '📋 Paso 1: Localizar la serie correcta en el gráfico\\n\\n• Buscar columna: "Centros de especialidades" (3ª columna)\\n• Buscar línea: "27-59 años" (línea correspondiente)\\n• Leer valor exacto donde se cruzan: 50 (miles de personas)\\n\\n\\n📋 Paso 2: Obtener total de pacientes en Centros de especialidades\\n\\n• 0-1 años: 70 mil\\n• 15-26 años: 30 mil\\n• 27-59 años: 50 mil\\n• 60+ años: 90 mil\\n• Total: 70 + 30 + 50 + 90 = 240 mil personas\\n\\n\\n📋 Paso 3: Calcular el porcentaje EXACTO\\n\\n• Fórmula: (Parte ÷ Total) × 100\\n• Aplicado: (50 ÷ 240) × 100\\n• Resultado: 20.8333333333... %\\n• Respuesta exacta: 20,83% ✅'
      },
      {
        title: '⚡ TÉCNICAS DE CÁLCULO MENTAL (Para oposiciones)',
        content: '🔍 Método 1: Fracción simplificada\\n\\n• 50 ÷ 240 = 5 ÷ 24\\n• 5 ÷ 24 = 0.208333...\\n• 0.208333... × 100 = 20,83% exacto\\n\\n\\n🧮 Método 2: Estimación visual\\n\\n• 50 de 240 es aproximadamente 1/5\\n• 1/5 = 20%, pero 5/24 es algo más\\n• 20,83% es el resultado exacto\\n\\n\\n💡 Método 3: Verificación inversa\\n\\n• 240 × 0.208333... = 50.0000...\\n• Confirmación matemática exacta\\n\\n\\n🚨 Método 4: Descarte por lógica\\n\\n• A) 22% - Algo alto para 5/24\\n• B) 23,8% - Muy alto\\n• C) 21,80% - Alto\\n• D) 20,83% - Cálculo exacto ✅'
      }
    ]
  };
  
  const { data, error } = await supabase
    .from('psychometric_questions')
    .update({ 
      content_data: updatedContentData,
      correct_option: 3
    })
    .eq('id', questionId)
    .select();
    
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Actualizado con cálculo EXACTO');
    console.log('📊 (50/240) × 100 = 20.8333333333...%');
    console.log('🎯 Respuesta: D) 20,83%');
    console.log('');
    console.log('🔗 Verificar:');
    console.log(`   http://localhost:3000/debug/question/${questionId}`);
  }
}

fixExactPercentage().catch(console.error);