/**
 * Script para importar preguntas verificadas del Tema 10 de Tramitación Procesal
 * Lee de /tmp/tema10-ready-to-import.json
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Necesitamos service role para inserts
);

const INPUT_FILE = '/tmp/tema10-ready-to-import.json';

function convertCorrectAnswer(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()] ?? 0;
}

async function importQuestions() {
  const questions = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`📋 ${questions.length} preguntas a importar`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const q of questions) {
    // Verificar que tiene article_id
    if (!q.verified_article_id) {
      console.log(`⏭️  Saltando pregunta ${q.id}: sin article_id`);
      totalSkipped++;
      continue;
    }

    // Verificar si ya existe (por texto similar)
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .ilike('question_text', q.question.substring(0, 50) + '%')
      .limit(1);

    if (existing?.length) {
      totalSkipped++;
      continue;
    }

    // Preparar pregunta
    const questionData = {
      question_text: q.question,
      option_a: q.options.find(o => o.letter === 'A')?.text || '',
      option_b: q.options.find(o => o.letter === 'B')?.text || '',
      option_c: q.options.find(o => o.letter === 'C')?.text || '',
      option_d: q.options.find(o => o.letter === 'D')?.text || '',
      correct_option: convertCorrectAnswer(q.correctAnswer),
      explanation: q.explanation || '',
      primary_article_id: q.verified_article_id,
      is_active: true,
      difficulty: 'medium',
      is_official_exam: false,
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      topic_review_status: 'perfect'
    };

    const { error } = await supabase
      .from('questions')
      .insert(questionData);

    if (error) {
      console.error(`❌ Error [${q.id}]: ${error.message}`);
      totalErrors++;
    } else {
      totalImported++;
      if (totalImported % 20 === 0) {
        console.log(`✅ Importadas: ${totalImported}...`);
      }
    }
  }

  console.log('\n========== RESUMEN ==========');
  console.log(`✅ Importadas: ${totalImported}`);
  console.log(`⏭️  Saltadas: ${totalSkipped}`);
  console.log(`❌ Errores: ${totalErrors}`);

  // Registrar en ai_verification_results
  if (totalImported > 0) {
    console.log('\n📊 Registrando verificación en ai_verification_results...');

    // Obtener IDs de preguntas recién importadas
    const { data: newQuestions } = await supabase
      .from('questions')
      .select('id, verified_at')
      .eq('topic_review_status', 'perfect')
      .eq('verification_status', 'verified')
      .order('verified_at', { ascending: false })
      .limit(totalImported);

    if (newQuestions?.length) {
      for (const nq of newQuestions) {
        await supabase.from('ai_verification_results').insert({
          question_id: nq.id,
          result: 'perfect',
          ai_model: 'claude-opus-4-5',
          verified_at: nq.verified_at,
          verification_details: {
            source: 'tema10-tramitacion-procesal',
            batch_import: true
          }
        });
      }
      console.log(`✅ Registradas ${newQuestions.length} verificaciones`);
    }
  }
}

importQuestions().catch(console.error);
