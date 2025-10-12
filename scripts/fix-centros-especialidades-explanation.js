import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixExplanation() {
  const questionId = '588c79ed-05fa-421a-8f32-23e4038b700b';
  
  console.log('🔍 Corrigiendo explicación de pregunta de centros especialidades...');
  
  // Datos corregidos según la imagen
  const updatedContentData = {
    exam_tip: 'En gráficos de líneas: 1) Identifica la serie correcta por color/leyenda, 2) Localiza el punto exacto, 3) Lee el valor con precisión, 4) Suma todos los valores de esa categoría.',
    subtitle: '(en miles) al mes',
    age_groups: [
      {label: '0-1 años', values: [95, 30, 70, 30]},
      {label: '15-26 años', values: [30, 20, 30, 20]}, 
      {label: '27-59 años', values: [70, 60, 50, 95]},
      {label: '60+ años', values: [100, 100, 90, 30]}  // Corregido: 60→90 para que sume 240
    ],
    categories: ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas'],
    chart_type: 'line_chart',
    chart_title: 'Personas atendidas por rango de edad / lugar de la atención',
    x_axis_label: 'Tipo de centro',
    y_axis_label: 'Número de personas (miles)',
    question_context: 'Observa el siguiente gráfico de líneas que muestra la distribución de pacientes por edad y tipo de centro:',
    target_group_value: 50,
    total_target_center: 240, // Corregido de 210 a 240
    evaluation_description: 'Tu capacidad para interpretar gráficos de líneas con múltiples series y calcular porcentajes específicos.',
    explanation_sections: [
      {
        title: '📊 ANÁLISIS PASO A PASO - GRÁFICO DE LÍNEAS:',
        content: '📋 Paso 1: Localizar la serie correcta en el gráfico\n\n• Buscar columna: "Centros de especialidades" (3ª columna)\n• Buscar línea: "27-59 años" (línea correspondiente)\n• Leer valor exacto donde se cruzan: 50 (miles de personas)\n\n\n📋 Paso 2: Obtener total de pacientes en Centros de especialidades\n\n• 0-1 años: 70 mil\n• 15-26 años: 30 mil\n• 27-59 años: 50 mil\n• 60+ años: 90 mil\n• Total: 70 + 30 + 50 + 90 = 240 mil personas\n\n\n📋 Paso 3: Calcular el porcentaje EXACTO\n\n• Fórmula: (Parte ÷ Total) × 100\n• Aplicado: (50 ÷ 240) × 100\n• Resultado: 20.83333... %\n• Respuesta exacta: 20,83% ✅'
      },
      {
        title: '⚡ TÉCNICAS DE CÁLCULO MENTAL (Para oposiciones)',
        content: '🔍 Método 1: Estimación visual rápida\n\n• 50 de 240 es aproximadamente 1/5 del total\n• 1/5 = 20%, así que el resultado debe estar cerca del 20%\n• Entre las opciones, 20,83% es la más cercana a 20%\n\n\n🧮 Método 2: Simplificación por aproximación\n\n• 50 ÷ 240 ≈ 50 ÷ 250 = 1/5 = 20%\n• Como 240 < 250, el resultado será algo mayor que 20%\n• 20,83% es coherente con esta lógica\n\n\n💡 Método 3: Cálculo mental directo\n\n• 50 ÷ 240 = 5 ÷ 24\n• 5 ÷ 25 = 0,20 = 20%\n• Como 24 < 25, el resultado será mayor: ~20,83%\n\n\n🚨 Método 4: Descarte por lógica\n\n• A) 22% - Algo alto para 50/240\n• B) 23,8% - Demasiado alto, claramente incorrecto\n• C) 21,80% - Cerca pero algo alto\n• D) 20,83% - Es el cálculo exacto ✅'
      }
    ]
  };
  
  const { data, error } = await supabase
    .from('psychometric_questions')
    .update({ 
      content_data: updatedContentData,
      correct_option: 3  // D = 20,83%
    })
    .eq('id', questionId)
    .select();
    
  if (error) {
    console.error('❌ Error actualizando pregunta:', error);
  } else {
    console.log('✅ Pregunta corregida exitosamente');
    console.log('📊 Cambios aplicados:');
    console.log('- Total centros especialidades: 210 → 240 mil (70+30+50+90)');
    console.log('- Porcentaje correcto: 23,8% → 20,83%');
    console.log('- Respuesta correcta: B → D');
    console.log('- Cálculo: (50/240) × 100 = 20.83%');
    console.log('');
    console.log('🔗 Verificar visualmente:');
    console.log(`   http://localhost:3000/debug/question/${questionId}`);
  }
}

fixExplanation().catch(console.error);