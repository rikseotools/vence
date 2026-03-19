/**
 * Fase 3: Importar preguntas verificadas de Tema 5 a BD
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '30210e71-02ef-4012-8931-99063d1db546';
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

async function main() {
  console.log('=== Importando Tema 5: La Unión Europea ===\n');

  const questions = JSON.parse(fs.readFileSync('/tmp/tema5-ready-to-import.json', 'utf8'));
  console.log('Preguntas a importar:', questions.length);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const q of questions) {
    // Check duplicate by question text
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('question_text', q.question)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Build tags
    const tags = [
      'Tema 5',
      q.subtema || 'La Unión Europea',
      'Tramitación Procesal',
      'IA-Verified'
    ];

    // Skip if no article (primary_article_id is NOT NULL)
    if (!q.verified_article_id) {
      skipped++;
      continue;
    }

    // Insert question
    const { error } = await supabase
      .from('questions')
      .insert({
        question_text: q.question,
        option_a: q.options?.find(o => o.letter === 'A')?.text || '',
        option_b: q.options?.find(o => o.letter === 'B')?.text || '',
        option_c: q.options?.find(o => o.letter === 'C')?.text || '',
        option_d: q.options?.find(o => o.letter === 'D')?.text || '',
        correct_option: LETTER_TO_INDEX[q.correctAnswer] ?? 0,
        explanation: q.explanation || '',
        primary_article_id: q.verified_article_id,
        difficulty: 'medium',
        is_active: true,
        topic_review_status: 'perfect',
        verification_status: 'verified',
        tags: tags
      });

    if (error) {
      console.error('Error:', error.message);
      errors++;
    } else {
      imported++;
      if (imported % 50 === 0) console.log(`  Importadas: ${imported}...`);
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log(`✅ Importadas: ${imported}`);
  console.log(`⏭️  Omitidas (duplicadas): ${skipped}`);
  console.log(`❌ Errores: ${errors}`);
}

main().catch(console.error);
