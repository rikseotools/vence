require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const openai = new OpenAI();

(async () => {
  const { data: law } = await supabase.from('laws').select('id').eq('short_name', 'La Red Internet').single();
  const { data: article } = await supabase.from('articles').select('id').eq('law_id', law.id).eq('article_number', '1').single();

  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation')
    .eq('primary_article_id', article.id)
    .eq('is_active', true);

  const conLinks = questions.filter(q => q.explanation?.includes('http') || q.explanation?.includes('www.'));
  console.log('📊 Preguntas con links:', conLinks.length);

  for (const q of conLinks) {
    console.log('\n📝', q.id.substring(0, 8), '-', q.question_text.substring(0, 50) + '...');

    const options = ['A', 'B', 'C', 'D'];
    const correctLetter = options[q.correct_option];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Genera una explicación breve (2-3 frases) para esta pregunta de oposiciones sobre Internet. NO incluyas links ni URLs.

Pregunta: ${q.question_text}
A) ${q.option_a}
B) ${q.option_b}
C) ${q.option_c}
D) ${q.option_d}
Respuesta correcta: ${correctLetter}

Solo responde con la explicación, sin prefijos.`
      }]
    });

    const newExplanation = response.choices[0].message.content.trim();
    console.log('   Nueva:', newExplanation.substring(0, 80) + '...');

    const { error } = await supabase
      .from('questions')
      .update({ explanation: newExplanation })
      .eq('id', q.id);

    console.log(error ? '   ❌ Error' : '   ✅ Actualizada');
  }

  console.log('\n✅ Completado');
})();
