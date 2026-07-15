const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '45b9727b-66ba-4d05-8a1b-7cc955e7914c'; // Tema 204 - Protección Datos

(async () => {
  // Obtener preguntas problemáticas
  const { data: problems } = await supabase
    .from('ai_verification_results')
    .select(`
      id,
      question_id,
      article_ok,
      answer_ok,
      explanation_ok,
      explanation,
      article_quote,
      correct_option_should_be,
      explanation_fix,
      questions!inner(
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation,
        primary_article_id,
        articles:primary_article_id(
          article_number,
          title,
          content,
          laws:law_id(short_name)
        )
      )
    `)
    .or('answer_ok.eq.false,explanation_ok.eq.false')
    .order('verified_at', { ascending: false })
    .limit(10);

  console.log('=== PREGUNTAS PROBLEMÁTICAS (TEMA 204) ===');
  console.log('Total encontradas:', problems?.length);

  for (const p of problems || []) {
    const q = p.questions;
    const correctLetter = ['A', 'B', 'C', 'D'][q.correct_option];
    const art = q.articles;

    console.log('\n' + '='.repeat(100));
    console.log('ID:', p.question_id);
    console.log('Artículo:', art?.laws?.short_name, 'Art.', art?.article_number, '-', art?.title);
    console.log('\nPREGUNTA:', q.question_text);
    console.log('A)', q.option_a);
    console.log('B)', q.option_b);
    console.log('C)', q.option_c);
    console.log('D)', q.option_d);
    console.log('\nRESPUESTA MARCADA:', correctLetter);
    console.log('article_ok:', p.article_ok);
    console.log('answer_ok:', p.answer_ok);
    console.log('explanation_ok:', p.explanation_ok);

    if (!p.answer_ok) {
      console.log('\n>>> DEBERÍA SER:', p.correct_option_should_be);
    }

    console.log('\nANÁLISIS IA:', p.explanation);

    if (p.article_quote) {
      console.log('\nCITA DEL ARTÍCULO:', p.article_quote.substring(0, 500));
    }

    if (p.explanation_fix) {
      console.log('\nEXPLICACIÓN SUGERIDA:', p.explanation_fix);
    }

    console.log('\nCONTENIDO COMPLETO DEL ARTÍCULO:');
    console.log(art?.content?.substring(0, 800) || 'N/A');
  }
})();
