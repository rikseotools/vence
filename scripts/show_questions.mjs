import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

const qIds = [
  '6230efe2-b0e4-4a49-8132-a45d2011b333',
  '1779e1ab-0b23-47b8-85ba-aaee6b63c9f6',
  '8d13ec26-6f44-4055-bbd8-e1916b50eeeb',
  '557ddc62-ab17-407b-9ecc-8b8e5b510126',
  '24b7dca8-7ea9-4b83-9143-c319e73369e1',
];

(async () => {
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
    .in('id', qIds);

  console.log('PREGUNTAS PARA VERIFICAR MANUAL:\n');
  questions?.forEach((q, idx) => {
    const opts = ['A', 'B', 'C', 'D'];
    console.log(`${idx + 1}. ${q.question_text}`);
    console.log(`   A) ${q.option_a}`);
    console.log(`   B) ${q.option_b}`);
    console.log(`   C) ${q.option_c}`);
    console.log(`   D) ${q.option_d}`);
    console.log(`   ✓ Respuesta: ${opts[q.correct_option]}`);
    console.log();
  });
})();
