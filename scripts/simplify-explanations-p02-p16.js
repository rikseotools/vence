import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function simplifyExplanations() {
  try {
    const supabase = getSupabase();
    
    const questionIds = [
      '99bafb9a-b091-4ca9-85e6-a914a0bda188',  // P02
      '6bb7b707-f6ef-44b9-892a-dfd2ca1ed82b',  // P03
      'f4cd4939-fa46-47b7-a4ec-76612db865d6',  // P04
      '196ed971-d48c-4678-9cdf-2a61b8931164',  // P05
      'ce88154b-db5e-43e7-ac0d-ca6df6b5928c',  // P06
      '60dffa89-afaf-4eee-911c-51d2a0578bfb',  // P07
      '236b3b39-3579-4e82-82c7-02d949b0fbe8',  // P08
      'ca20f537-6944-4f0d-8f6a-ec2e84f6fe0a',  // P09
      '83dbe8ca-3110-4f81-9da6-5f2ec160516c',  // P11
      '42f65f2d-e0ba-45e4-adbc-6c87f8af8e87',  // P12
      'b5285e55-4bd7-49bf-be3f-fa5055834b3c',  // P14
      'd1d3e097-e367-41fa-8470-6f34d84bae3f',  // P15
      '1c09dab3-bd1c-43de-ad6c-4298de195117'   // P16
    ];

    for (const questionId of questionIds) {
      // Obtener la pregunta actual
      const { data: currentQuestion, error: fetchError } = await supabase
        .from('psychometric_questions')
        .select('content_data')
        .eq('id', questionId)
        .single();

      if (fetchError) {
        console.log(`❌ Error obteniendo pregunta ${questionId}:`, fetchError.message);
        continue;
      }

      // Extraer solo la segunda sección (ANÁLISIS PASO A PASO) y cambiarle el título
      const currentSections = currentQuestion.content_data?.explanation_sections || [];
      const analysisSection = currentSections.find(section => 
        section.title && section.title.includes('ANÁLISIS PASO A PASO')
      );

      if (!analysisSection) {
        console.log(`⚠️ No se encontró sección de análisis en ${questionId}`);
        continue;
      }

      // Crear nueva estructura simplificada
      const updatedContentData = {
        ...currentQuestion.content_data,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: analysisSection.content
          }
        ]
      };

      // Actualizar la pregunta
      const { error: updateError } = await supabase
        .from('psychometric_questions')
        .update({
          content_data: updatedContentData
        })
        .eq('id', questionId);

      if (updateError) {
        console.log(`❌ Error actualizando ${questionId}:`, updateError.message);
      } else {
        console.log(`✅ Pregunta ${questionId} simplificada`);
      }
    }

    console.log('');
    console.log('✅ Todas las explicaciones han sido simplificadas');
    console.log('🔗 Verificar en: http://localhost:3000/debug/batch');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

simplifyExplanations();