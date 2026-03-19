require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

async function main() {
  const questions = JSON.parse(fs.readFileSync('/tmp/tema6-ready-to-import.json'));

  console.log('=== IMPORTANDO TEMA 6 ===');
  console.log('Preguntas a importar:', questions.length);

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  for (const q of questions) {
    // Verificar duplicado
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('question_text', q.question)
      .maybeSingle();

    if (existing) {
      duplicates++;
      continue;
    }

    // Preparar opciones
    const optionA = q.options.find(o => o.letter === 'A')?.text || '';
    const optionB = q.options.find(o => o.letter === 'B')?.text || '';
    const optionC = q.options.find(o => o.letter === 'C')?.text || '';
    const optionD = q.options.find(o => o.letter === 'D')?.text || '';

    // Insertar
    const { error } = await supabase.from('questions').insert({
      question_text: q.question,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_option: LETTER_TO_INDEX[q.correctAnswer],
      explanation: q.explanation,
      primary_article_id: q.verified_article_id,
      difficulty: 'medium',
      is_active: true,
      topic_review_status: 'perfect',
      verification_status: 'verified',
      tags: ['Tema 6', q.subtema || 'El Poder Judicial', 'Tramitación Procesal', 'IA-Verified']
    });

    if (error) {
      console.error('Error:', error.message);
      errors++;
    } else {
      imported++;
    }

    // Progreso cada 50
    if ((imported + duplicates + errors) % 50 === 0) {
      console.log('Progreso:', imported, 'importadas,', duplicates, 'duplicadas,', errors, 'errores');
    }
  }

  console.log('');
  console.log('=== RESULTADO FINAL ===');
  console.log('Importadas:', imported);
  console.log('Duplicadas (omitidas):', duplicates);
  console.log('Errores:', errors);
}

main().catch(console.error);
