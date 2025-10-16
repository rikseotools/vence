import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function checkOrthographyQuestionsLocation() {
  try {
    console.log('🔍 Verificando ubicación de preguntas de ortografía...');
    
    // Buscar todas las preguntas de detección de errores
    const { data: questions, error: questionsError } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        question_text,
        question_subtype,
        psychometric_sections!inner(
          section_key,
          display_name,
          psychometric_categories!inner(
            category_key,
            display_name
          )
        )
      `)
      .eq('question_subtype', 'error_detection');

    if (questionsError) {
      console.error('❌ Error al buscar preguntas:', questionsError);
      return;
    }

    console.log(`\n📊 Encontradas ${questions?.length || 0} preguntas de detección de errores:`);
    
    questions?.forEach((question, index) => {
      console.log(`\n${index + 1}. ID: ${question.id}`);
      console.log(`   Pregunta: ${question.question_text.substring(0, 80)}...`);
      console.log(`   Categoría: ${question.psychometric_sections.psychometric_categories.category_key} (${question.psychometric_sections.psychometric_categories.display_name})`);
      console.log(`   Sección: ${question.psychometric_sections.section_key} (${question.psychometric_sections.display_name})`);
    });

    // También verificar qué categorías y secciones existen
    console.log('\n🔍 Verificando estructura de categorías y secciones...');
    
    const { data: categories, error: categoriesError } = await supabase
      .from('psychometric_categories')
      .select(`
        category_key,
        display_name,
        psychometric_sections(
          section_key,
          display_name
        )
      `)
      .order('display_order');

    if (categoriesError) {
      console.error('❌ Error al buscar categorías:', categoriesError);
      return;
    }

    console.log('\n📋 Estructura completa de categorías:');
    categories?.forEach(category => {
      console.log(`\n📁 ${category.category_key} (${category.display_name})`);
      category.psychometric_sections?.forEach(section => {
        console.log(`   └── ${section.section_key} (${section.display_name})`);
      });
    });

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

checkOrthographyQuestionsLocation();