const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: questions } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      explanation,
      primary_article_id,
      articles!primary_article_id (
        article_number,
        content,
        laws!inner (short_name)
      )
    `)
    .or('tags.cs.{T111},tags.cs.{T207}')
    .eq('is_active', true)
    .not('primary_article_id', 'is', null);

  let correct = 0, incorrect = 0, uncertain = 0;
  const incorrectList = [];

  console.log('=== Verificación de artículos vinculados ===\n');

  for (const q of questions || []) {
    const art = q.articles;
    if (!art) continue;

    const exp = q.explanation || '';
    const artNum = art.article_number;
    const lawName = art.laws?.short_name || '';

    // Buscar el artículo mencionado en la explicación
    const artInExp = exp.match(/art[íi]culo\s+(\d+)/i);
    const mentionedArt = artInExp ? artInExp[1] : null;

    // Verificar coincidencia
    const matches = mentionedArt === artNum;

    if (matches) {
      correct++;
      console.log('✅', lawName, 'Art.', artNum, '-', q.question_text.substring(0, 50) + '...');
    } else if (mentionedArt) {
      incorrect++;
      incorrectList.push({ id: q.id, lawName, artNum, mentionedArt, question: q.question_text });
      console.log('❌', lawName, 'Art.', artNum, '(debería ser', mentionedArt + ') -', q.question_text.substring(0, 40) + '...');
    } else {
      uncertain++;
      console.log('❓', lawName, 'Art.', artNum, '-', q.question_text.substring(0, 50) + '...');
    }
  }

  console.log('\n=== Resumen ===');
  console.log('✅ Correctos:', correct);
  console.log('❌ Incorrectos:', incorrect);
  console.log('❓ Sin artículo en explicación:', uncertain);
  console.log('Total verificadas:', correct + incorrect + uncertain);

  if (incorrectList.length > 0) {
    console.log('\n=== Preguntas con artículo incorrecto ===');
    for (const item of incorrectList) {
      console.log('\nID:', item.id);
      console.log('Vinculado:', item.lawName, 'Art.', item.artNum);
      console.log('Correcto:', item.lawName, 'Art.', item.mentionedArt);
      console.log('Pregunta:', item.question.substring(0, 100));
    }
  }
})();
