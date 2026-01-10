const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Verificados manualmente como correctos
const correctIds = [
  'cf2606d2-04f3-4241-b8fb-79053bb19649', // P2 - Art. 111 garantías
  'a6dca6ba-28dc-469d-9d36-24d6426ee450', // P3 - Art. 99 no división lotes
  '6a23f73d-05d7-4e06-bf78-4b21386657e4', // P4 - Art. 121 pliegos
  'c52dbe71-cb28-4c20-9874-9dea6ef4449a', // P5 - Art. 262 modificación obras
  '4dbe847d-2195-4e12-804d-bc70a6e82b12', // P6 - Art. 301 pago suministros
  'e1a77bed-8cab-48cb-925a-1e9076fbf5d6', // P7 - Art. 307 3%
];

(async () => {
  for (const id of correctIds) {
    await s.from('questions').update({ topic_review_status: 'perfect' }).eq('id', id);
    await s.from('ai_verification_results').update({
      article_ok: true, answer_ok: true, explanation_ok: true,
      explanation: 'Verificación manual T304: respuesta y artículo correctos'
    }).eq('question_id', id);
    console.log(id.substring(0,8), 'OK');
  }
  console.log('Total corregidas:', correctIds.length);
})();
