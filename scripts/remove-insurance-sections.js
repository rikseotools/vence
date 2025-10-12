import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function removeInsuranceSections() {
  const questionId = '21eb8c08-4a18-4191-af9a-0704fc44632b';
  
  console.log('🗑️ Eliminando secciones especificadas de la pregunta de seguros...');
  
  // Obtener datos actuales
  const { data: currentData, error: fetchError } = await supabase
    .from('psychometric_questions')
    .select('content_data')
    .eq('id', questionId)
    .single();
    
  if (fetchError) {
    console.error('❌ Error obteniendo pregunta:', fetchError);
    return;
  }
  
  // Filtrar las secciones, eliminar las que contienen "Errores comunes" y "Consejo de oposición"
  const currentSections = currentData.content_data.explanation_sections || [];
  const filteredSections = currentSections.filter(section => {
    const title = section.title;
    return !title.includes('Errores comunes') && !title.includes('Consejo de oposición');
  });
  
  console.log(`📊 Secciones antes: ${currentSections.length}`);
  console.log(`📊 Secciones después: ${filteredSections.length}`);
  
  // Actualizar content_data
  const updatedContentData = {
    ...currentData.content_data,
    explanation_sections: filteredSections
  };
  
  const { data, error } = await supabase
    .from('psychometric_questions')
    .update({ 
      content_data: updatedContentData
    })
    .eq('id', questionId)
    .select();
    
  if (error) {
    console.error('❌ Error actualizando pregunta:', error);
  } else {
    console.log('✅ Secciones eliminadas exitosamente');
    console.log('📋 Secciones restantes:');
    filteredSections.forEach((section, index) => {
      console.log(`   ${index + 1}. ${section.title}`);
    });
    console.log('');
    console.log('🔗 Verificar:');
    console.log(`   http://localhost:3000/debug/question/${questionId}`);
  }
}

removeInsuranceSections().catch(console.error);