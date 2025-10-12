import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixMathematicalError() {
  const questionId = '588c79ed-05fa-421a-8f32-23e4038b700b';
  
  console.log('🔧 CORRECCIÓN MATEMÁTICA EXACTA:');
  console.log('📊 Datos: 70 + 30 + 50 + 60 = 210 total');
  console.log('🧮 Cálculo: (50/210) × 100 = 23.809523809...%');
  console.log('✅ Respuesta correcta: B) 23,8%');
  console.log('❌ Era incorrecta: D) 20,83%');
  
  const updatedContentData = {
    exam_tip: 'En gráficos de líneas: 1) Identifica la serie correcta por color/leyenda, 2) Localiza el punto exacto, 3) Lee el valor con precisión, 4) Suma todos los valores de esa categoría.',
    subtitle: '(en miles) al mes',
    age_groups: [
      {label: '0-1 años', values: [95, 30, 70, 30]},
      {label: '15-26 años', values: [30, 20, 30, 20]}, 
      {label: '27-59 años', values: [70, 60, 50, 95]},
      {label: '60+ años', values: [100, 100, 60, 30]}
    ],
    categories: ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas'],
    chart_type: 'line_chart',
    chart_title: 'Personas atendidas por rango de edad / lugar de la atención',
    x_axis_label: 'Tipo de centro',
    y_axis_label: 'Número de personas (miles)',
    question_context: 'Observa el siguiente gráfico de líneas que muestra la distribución de pacientes por edad y tipo de centro:',
    target_group_value: 50,
    total_target_center: 210,
    evaluation_description: 'Tu capacidad para interpretar gráficos de líneas con múltiples series y calcular porcentajes específicos.',
    explanation_sections: [
      {
        title: '📊 ANÁLISIS PASO A PASO - GRÁFICO DE LÍNEAS:',
        content: '📋 Paso 1: Localizar la serie correcta en el gráfico\\n\\n• Buscar columna: "Centros de especialidades" (3ª columna)\\n• Buscar línea: "27-59 años" (línea correspondiente)\\n• Leer valor exacto donde se cruzan: 50 (miles de personas)\\n\\n\\n📋 Paso 2: Obtener total de pacientes en Centros de especialidades\\n\\n• 0-1 años: 70 mil\\n• 15-26 años: 30 mil\\n• 27-59 años: 50 mil\\n• 60+ años: 60 mil\\n• Total: 70 + 30 + 50 + 60 = 210 mil personas\\n\\n\\n📋 Paso 3: Calcular el porcentaje EXACTO\\n\\n• Fórmula: (Parte ÷ Total) × 100\\n• Aplicado: (50 ÷ 210) × 100\\n• Resultado: 23.809523809... %\\n• Respuesta exacta: 23,8% ✅'
      },
      {
        title: '⚡ TÉCNICAS DE CÁLCULO MENTAL (Para oposiciones)',
        content: '🔍 Método 1: Estimación visual rápida\\n\\n• 50 de 210 es aproximadamente 1/4 del total\\n• 1/4 = 25%, así que el resultado debe estar cerca del 25%\\n• Entre las opciones, 23,8% es la más cercana a 25%\\n\\n\\n🧮 Método 2: Simplificación por aproximación\\n\\n• 50 ÷ 210 ≈ 50 ÷ 200 = 1/4 = 25%\\n• Pero como 210 > 200, el resultado será algo menor que 25%\\n• 23,8% es coherente con esta lógica\\n\\n\\n💡 Método 3: Cálculo mental directo\\n\\n• 50 ÷ 210 = 5 ÷ 21\\n• 5 ÷ 20 = 0,25 = 25%\\n• Como 21 > 20, el resultado será menor: ~23,8%\\n\\n\\n🚨 Método 4: Descarte por lógica\\n\\n• A) 22% - Cerca pero algo bajo\\n• B) 23,8% - Es el cálculo exacto ✅\\n• C) 21,80% - Demasiado bajo para 50/210\\n• D) 20,83% - Muy bajo, matemáticamente incorrecto'
      }
    ]
  };
  
  const { data, error } = await supabase
    .from('psychometric_questions')
    .update({ 
      content_data: updatedContentData,
      correct_option: 1  // B = 23,8% (CORRECTO)
    })
    .eq('id', questionId)
    .select();
    
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ ERROR MATEMÁTICO CORREGIDO');
    console.log('📊 Cálculo correcto: (50/210) × 100 = 23.809...%');
    console.log('🎯 Respuesta correcta: B) 23,8%');
    console.log('');
    console.log('🔗 Verificar:');
    console.log(`   http://localhost:3000/debug/question/${questionId}`);
  }
}

fixMathematicalError().catch(console.error);