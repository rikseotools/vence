const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// IDs verificados manualmente como correctos
const correctIds = [
  'eedf0bb7-12f9-4370-bfd3-a5f23f0327b6', // P1 - Art. 110
  '9100309b-10bd-4f1a-a743-df19518cd1b9', // P2 - Art. 70 INCORRECTA
  'c5a327ac-d311-4039-a389-bf7890553c6c', // P3 - Art. 70 INCORRECTA duplicado
  'e038aa30-cf0f-4688-b34d-dc0a262d6f37', // P5 - Art. 124 reposición
  'dddf09e9-b180-482e-9fc9-a711c24a51d1', // P6 - Art. 81
];

(async () => {
  for (const id of correctIds) {
    await s.from('questions').update({ topic_review_status: 'perfect' }).eq('id', id);
    await s.from('ai_verification_results').update({
      article_ok: true, answer_ok: true, explanation_ok: true,
      explanation: 'Verificación manual T303: respuesta y artículo correctos'
    }).eq('question_id', id);
    console.log(id.substring(0,8), 'OK');
  }
  console.log('Total corregidas:', correctIds.length);
})();
