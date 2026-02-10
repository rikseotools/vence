require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Get all active questions
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, exam_source, is_official_exam, tags')
    .eq('is_active', true)
    .order('question_text');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by question_text
  const textMap = new Map();
  data.forEach(q => {
    const normalized = q.question_text.trim().toLowerCase();
    if (!textMap.has(normalized)) {
      textMap.set(normalized, []);
    }
    textMap.get(normalized).push(q);
  });

  // Find clean duplicates (same options, just shuffled)
  const toDeactivate = [];

  for (const [text, questions] of textMap) {
    if (questions.length < 2) continue;

    // Check if options are the same (just shuffled)
    const q1 = questions[0];
    const opts1 = [q1.option_a, q1.option_b, q1.option_c, q1.option_d]
      .map(o => (o || '').trim().toLowerCase())
      .sort();

    // Check all pairs
    for (let i = 1; i < questions.length; i++) {
      const q2 = questions[i];
      const opts2 = [q2.option_a, q2.option_b, q2.option_c, q2.option_d]
        .map(o => (o || '').trim().toLowerCase())
        .sort();

      // Check if same options (shuffled)
      const opts2Sorted = [...opts2].sort();
      const isSameOptions = opts1.every((o, idx) => o === opts2Sorted[idx]);

      if (!isSameOptions) continue; // Skip if different options

      // Check correct answer text matches
      const correctText1 = [q1.option_a, q1.option_b, q1.option_c, q1.option_d][q1.correct_option];
      const correctText2 = [q2.option_a, q2.option_b, q2.option_c, q2.option_d][q2.correct_option];
      const sameCorrect = (correctText1 || '').trim().toLowerCase() === (correctText2 || '').trim().toLowerCase();

      if (!sameCorrect) continue; // Skip if different correct answer

      // Determine which to keep
      // Priority: official > non-official, then first by ID
      let keepQ, removeQ;

      if (q1.is_official_exam && !q2.is_official_exam) {
        keepQ = q1;
        removeQ = q2;
      } else if (q2.is_official_exam && !q1.is_official_exam) {
        keepQ = q2;
        removeQ = q1;
      } else {
        // Both same status, keep first
        keepQ = q1;
        removeQ = q2;
      }

      toDeactivate.push({
        removeId: removeQ.id,
        keepId: keepQ.id,
        reason: removeQ.is_official_exam === keepQ.is_official_exam
          ? `Duplicado de ${keepQ.id.substring(0, 8)}`
          : `Duplicado de oficial ${keepQ.id.substring(0, 8)}`,
        questionText: removeQ.question_text.substring(0, 60),
        currentTags: removeQ.tags || []
      });
    }
  }

  console.log('=== DUPLICADOS A DESACTIVAR ===');
  console.log('Total:', toDeactivate.length);
  console.log('');

  // Deactivate each
  let success = 0;
  let failed = 0;

  for (const item of toDeactivate) {
    const newTags = [...item.currentTags, `DESACTIVADA: ${item.reason}`];

    const { error: updateError } = await supabase
      .from('questions')
      .update({
        is_active: false,
        tags: newTags
      })
      .eq('id', item.removeId);

    if (updateError) {
      console.error('Error desactivando', item.removeId, ':', updateError.message);
      failed++;
    } else {
      console.log('✅ Desactivada:', item.removeId.substring(0, 8) + '...', '-', item.reason);
      success++;
    }
  }

  console.log('');
  console.log('=== RESULTADO ===');
  console.log('Desactivadas correctamente:', success);
  console.log('Errores:', failed);
})();
