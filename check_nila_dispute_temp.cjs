require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Buscar la impugnación de Nila por descripción
  const { data: disputes } = await supabase
    .from('question_disputes')
    .select('*')
    .eq('status', 'pending')
    .ilike('description', '%figura%');

  const dispute = disputes?.[0];
  if (!dispute) {
    console.log('No se encontró la impugnación');
    return;
  }

  console.log('📋 IMPUGNACIÓN COMPLETA');
  console.log('='.repeat(70));
  console.log('ID:', dispute.id);
  console.log('Question ID:', dispute.question_id);
  console.log('Usuario ID:', dispute.user_id);
  console.log('Tipo:', dispute.dispute_type);
  console.log('Fecha:', dispute.created_at);
  console.log('Descripción:', dispute.description);

  // Obtener datos del usuario
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('nickname, full_name')
    .eq('id', dispute.user_id)
    .single();

  console.log('\nUsuario:', profile?.nickname || profile?.full_name);

  // Obtener la pregunta completa
  const { data: question } = await supabase
    .from('questions')
    .select('*')
    .eq('id', dispute.question_id)
    .single();

  console.log('\n' + '='.repeat(70));
  console.log('📝 PREGUNTA COMPLETA');
  console.log('='.repeat(70));
  console.log('ID:', question?.id);
  console.log('\nENUNCIADO:');
  console.log(question?.question_text);
  console.log('\nOPCIONES:');
  console.log('A)', question?.option_a);
  console.log('B)', question?.option_b);
  console.log('C)', question?.option_c);
  console.log('D)', question?.option_d);
  console.log('\nRESPUESTA CORRECTA:', ['A', 'B', 'C', 'D'][question?.correct_option]);
  console.log('\nEXPLICACIÓN:');
  console.log(question?.explanation);
  console.log('\nMETADATOS:');
  console.log('- is_official_exam:', question?.is_official_exam);
  console.log('- exam_source:', question?.exam_source);
  console.log('- difficulty:', question?.difficulty);
  console.log('- image_url:', question?.image_url);
  console.log('- primary_article_id:', question?.primary_article_id);
  console.log('- verified_at:', question?.verified_at);
  console.log('- verification_status:', question?.verification_status);

  // Obtener el artículo vinculado
  if (question?.primary_article_id) {
    const { data: article } = await supabase
      .from('articles')
      .select('article_number, title, content, law_id')
      .eq('id', question.primary_article_id)
      .single();

    if (article) {
      const { data: law } = await supabase
        .from('laws')
        .select('short_name, name')
        .eq('id', article.law_id)
        .single();

      console.log('\n' + '='.repeat(70));
      console.log('📜 ARTÍCULO VINCULADO');
      console.log('='.repeat(70));
      console.log('Ley:', law?.short_name, '-', law?.name);
      console.log('Artículo:', article.article_number, '-', article.title);
    }
  }
})();
