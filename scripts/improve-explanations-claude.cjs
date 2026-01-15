// Script para mejorar explicaciones usando Claude API (suscripción Claude Code)
// Procesa las 205 preguntas de Auxilio Judicial una a una

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk').default;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

async function getAuxilioQuestions() {
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      primary_article_id,
      articles!primary_article_id (
        id,
        article_number,
        title,
        content,
        laws (
          id,
          name,
          short_name
        )
      )
    `)
    .like('exam_source', '%Auxilio Judicial%')
    .eq('is_active', true)
    .order('created_at');

  if (error) throw error;
  return data;
}

async function generateExplanationWithClaude(question) {
  const correctLetter = OPTION_LETTERS[question.correct_option];
  const correctOptionText = [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d
  ][question.correct_option];

  const article = question.articles;
  const articleNumber = article?.article_number || 'desconocido';
  const lawName = article?.laws?.name || 'la normativa aplicable';
  const lawShortName = article?.laws?.short_name || '';
  const articleContent = article?.content || '';

  const prompt = `Genera una explicación didáctica para esta pregunta de oposiciones de Auxilio Judicial.

PREGUNTA: ${question.question_text}

OPCIONES:
A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

RESPUESTA CORRECTA: ${correctLetter}) ${correctOptionText}

ARTÍCULO VINCULADO: Artículo ${articleNumber} de ${lawName}${lawShortName ? ` (${lawShortName})` : ''}
${articleContent ? `CONTENIDO DEL ARTÍCULO: ${articleContent.substring(0, 500)}` : ''}

INSTRUCCIONES:
- Empieza con "La respuesta correcta es ${correctLetter})."
- Usa el formato "Conforme al artículo X de [nombre completo de la ley]..."
- Explica por qué es correcta de forma clara y didáctica
- Si es relevante, menciona brevemente por qué las otras opciones son incorrectas
- Máximo 3-4 frases
- NO pegues el artículo textualmente, explícalo con tus palabras
- Tono profesional y educativo`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

async function updateQuestion(id, explanation) {
  const { error } = await supabase
    .from('questions')
    .update({
      explanation,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Iniciando mejora de explicaciones con Claude API');
  console.log('📋 Obteniendo preguntas de Auxilio Judicial...\n');

  const questions = await getAuxilioQuestions();
  const total = questions.length;

  console.log(`📊 Total: ${total} preguntas\n`);
  console.log('='.repeat(70));

  let processed = 0;
  let errors = 0;

  for (const q of questions) {
    processed++;
    const correctLetter = OPTION_LETTERS[q.correct_option];

    console.log(`\n📝 [${processed}/${total}] Procesando...`);
    console.log(`   Pregunta: ${q.question_text.substring(0, 80)}...`);
    console.log(`   Respuesta: ${correctLetter})`);

    try {
      const newExplanation = await generateExplanationWithClaude(q);
      await updateQuestion(q.id, newExplanation);

      console.log(`   ✅ Actualizada`);
      console.log(`   📖 ${newExplanation.substring(0, 120)}...`);

      // Pausa de 500ms entre preguntas para no saturar la API
      await sleep(500);

    } catch (error) {
      errors++;
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n🎉 Proceso completado!`);
  console.log(`   ✅ Procesadas: ${processed - errors}/${total}`);
  console.log(`   ❌ Errores: ${errors}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
