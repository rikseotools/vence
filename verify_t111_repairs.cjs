const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const letters = ['A', 'B', 'C', 'D'];

  // Muestra aleatoria de cada categoría
  const checks = [
    // Falsos positivos (verificar que están en tech_perfect)
    { id: '301c6cbd-b3b0-43ae-b4b8-97b988cfa74c', cat: 'FALSO_POSITIVO', expected_status: 'tech_perfect' },
    { id: '884c2b5f-79ad-4a93-9518-9da098ac708c', cat: 'FALSO_POSITIVO', expected_status: 'tech_perfect' },
    { id: 'a097958e-1cf8-4ee1-9c65-b6352ecf986c', cat: 'FALSO_POSITIVO', expected_status: 'tech_perfect' },
    { id: '623b0689-3b30-4bfe-b8d3-ed55ddb70aa3', cat: 'FALSO_POSITIVO', expected_status: 'tech_perfect' },
    { id: 'db1750b3-47d0-4fcc-85f8-83bedfaa11c1', cat: 'FALSO_POSITIVO', expected_status: 'tech_perfect' },
    // Correcciones de respuesta
    { id: '42425e28-0fcb-4d0b-86b9-23706de80579', cat: 'RESPUESTA_CORREGIDA', expected_option: 0, expected_status: 'tech_perfect' },
    { id: 'bbe2cfb8-d429-4244-98d0-b43def0e7057', cat: 'RESPUESTA_CORREGIDA', expected_option: 0, expected_status: 'tech_perfect' },
    { id: 'f383f6a8-c66e-48e2-a0c3-5800b6387681', cat: 'RESPUESTA_CORREGIDA', expected_option: 0, expected_status: 'tech_perfect' },
    { id: 'e3ce04ff-4718-4caf-b095-4ae376348ab4', cat: 'RESPUESTA_CORREGIDA', expected_option: 2, expected_status: 'tech_perfect' },
    { id: '8c01a2ed-2660-4596-9747-c6861837085f', cat: 'RESPUESTA_CORREGIDA', expected_option: 0, expected_status: 'tech_perfect' },
    { id: 'c09e805d-d949-4ab9-8f29-ef78f9b08f8e', cat: 'RESPUESTA_CORREGIDA', expected_option: 0, expected_status: 'tech_perfect' },
    // Correcciones de explicación
    { id: '65297931-d6cd-4c74-a035-b1a8d67525a1', cat: 'EXPLICACION_CORREGIDA', expected_status: 'tech_perfect' },
    { id: '8174b182-d47a-45a4-9715-689aafbd5fd9', cat: 'EXPLICACION_CORREGIDA', expected_status: 'tech_perfect' },
    // Texto de pregunta corregido
    { id: 'd7f53aba-1824-4d38-96dd-4dd1e9f11f88', cat: 'TEXTO_CORREGIDO', expected_status: 'tech_perfect' },
    { id: 'b9e56e90-0436-4304-adf0-9d7b38205fdd', cat: 'OPCION_CORREGIDA', expected_status: 'tech_perfect' },
    // Desactivadas
    { id: 'c9adf05e-44c1-447f-b352-dc28bb8f76d3', cat: 'DESACTIVADA', expected_active: false },
    { id: 'a89c31c1-9a19-4fe8-89a2-76fe51631784', cat: 'DESACTIVADA', expected_active: false },
  ];

  let ok = 0, fail = 0;

  for (const check of checks) {
    const { data: q, error } = await supabase
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, topic_review_status, verification_status, is_active, primary_article_id')
      .eq('id', check.id)
      .single();

    if (error || !q) {
      console.log(`❌ ${check.cat} ${check.id}: NO ENCONTRADA`);
      fail++;
      continue;
    }

    const problems = [];

    // Verificar status
    if (check.expected_status && q.topic_review_status !== check.expected_status) {
      problems.push(`status=${q.topic_review_status} (esperado: ${check.expected_status})`);
    }

    // Verificar correct_option
    if (check.expected_option !== undefined && q.correct_option !== check.expected_option) {
      problems.push(`correct_option=${q.correct_option} (esperado: ${check.expected_option})`);
    }

    // Verificar is_active
    if (check.expected_active !== undefined && q.is_active !== check.expected_active) {
      problems.push(`is_active=${q.is_active} (esperado: ${check.expected_active})`);
    }

    // Verificar que tiene explicación
    if (check.cat !== 'DESACTIVADA' && (!q.explanation || q.explanation.length < 20)) {
      problems.push(`explicación vacía o muy corta (${q.explanation?.length || 0} chars)`);
    }

    // Verificar que tiene artículo vinculado
    if (check.cat !== 'DESACTIVADA' && !q.primary_article_id) {
      problems.push('sin artículo vinculado');
    }

    if (problems.length === 0) {
      ok++;
      const correctLetter = letters[q.correct_option];
      const correctText = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option];
      console.log(`✅ ${check.cat} | ${check.id.substring(0,8)}`);
      console.log(`   Q: ${q.question_text.substring(0, 90)}...`);
      console.log(`   Respuesta: ${correctLetter} - ${correctText?.substring(0, 70)}`);
      console.log(`   Status: ${q.topic_review_status} | Active: ${q.is_active}`);
      if (check.cat === 'EXPLICACION_CORREGIDA' || check.cat === 'RESPUESTA_CORREGIDA') {
        console.log(`   Explicación: ${q.explanation?.substring(0, 100)}...`);
      }
      if (check.cat === 'TEXTO_CORREGIDO') {
        console.log(`   Texto completo: ${q.question_text}`);
      }
      if (check.cat === 'OPCION_CORREGIDA') {
        console.log(`   Opción D: ${q.option_d}`);
      }
      console.log('');
    } else {
      fail++;
      console.log(`❌ ${check.cat} | ${check.id.substring(0,8)} | PROBLEMAS: ${problems.join(', ')}`);
      console.log(`   Q: ${q.question_text?.substring(0, 80)}`);
      console.log('');
    }
  }

  // Verificar conteos globales
  console.log('\n=== VERIFICACIÓN GLOBAL ===');

  const { count: perfectCount } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', '385bb1d1-347e-4f25-9d95-c784dcac014c')
    .eq('is_active', true)
    .eq('topic_review_status', 'tech_perfect');

  const { count: errorCount } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', '385bb1d1-347e-4f25-9d95-c784dcac014c')
    .eq('is_active', true)
    .in('topic_review_status', [
      'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
      'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
      'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
    ]);

  const { count: totalActive } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', '385bb1d1-347e-4f25-9d95-c784dcac014c')
    .eq('is_active', true);

  const { count: deactivated } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', '385bb1d1-347e-4f25-9d95-c784dcac014c')
    .eq('is_active', false);

  console.log(`T111 - Preguntas activas: ${totalActive}`);
  console.log(`T111 - Con estado tech_perfect: ${perfectCount}`);
  console.log(`T111 - Con estados de error: ${errorCount}`);
  console.log(`T111 - Desactivadas: ${deactivated}`);

  console.log(`\n=== RESULTADO VERIFICACIÓN ===`);
  console.log(`✅ OK: ${ok}/${checks.length}`);
  console.log(`❌ FALLOS: ${fail}/${checks.length}`);
}

main().catch(console.error);
