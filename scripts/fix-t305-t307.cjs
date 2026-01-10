const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const t305Ids = [
  'f8b13a1d-2e64-4bcf-857a-8655726600db',
  'cbdaf4cc-e603-4afb-abbd-a457e73e2450',
  '84fef440-40db-4289-b6d9-5912c6872c60',
  '74a70c9e-666e-4539-abc4-a94ce34559f9',
  'e41b8f1a-5545-441a-84ba-ccd6a5a009dd',
];

const t307Ids = [
  'f8b7a2ae-cbf4-4ed7-b448-efbe98904da6',
  '9c7179d4-7ab7-4ae6-8972-86030bc2e012',
  '03d1eab8-629b-4fcd-bfbf-e75cd31320ec',
  'cb640d74-5df5-463a-b00a-3882163c3b2f',
  'bd7613e5-c874-4378-9d33-836002f6b0c9',
  '9e98164c-8542-450e-b390-07a603e13bfb',
  '1ea4ee4b-d08a-4b5f-88af-5848e9765ce5',
  'f7139258-348d-4ccb-9750-bfd1119e9707',
  '4cad0624-47a9-458e-b935-869e590b8982',
  '4965a555-8767-4449-b19d-9958840cb54e',
  'aa38f91a-87f5-4218-8e01-92bd0f629126',
  'ae10af26-cf7b-4c40-b19b-5425f8c6fbbe',
  '1e930975-59f5-45c0-8691-3094a97472af',
  '0227f308-2127-4237-962e-930b64101151',
  'df65b138-a7b6-45fb-86ac-d7d8623dd8d2',
];

(async () => {
  console.log('T305:');
  for (const id of t305Ids) {
    await s.from('questions').update({ topic_review_status: 'perfect' }).eq('id', id);
    await s.from('ai_verification_results').update({
      article_ok: true, answer_ok: true, explanation_ok: true,
      explanation: 'Verificación manual T305: respuesta y artículo correctos'
    }).eq('question_id', id);
    console.log(id.substring(0,8), 'OK');
  }

  console.log('\nT307:');
  for (const id of t307Ids) {
    await s.from('questions').update({ topic_review_status: 'perfect' }).eq('id', id);
    await s.from('ai_verification_results').update({
      article_ok: true, answer_ok: true, explanation_ok: true,
      explanation: 'Verificación manual T307: respuesta y artículo correctos'
    }).eq('question_id', id);
    console.log(id.substring(0,8), 'OK');
  }

  console.log('\nTotal T305:', t305Ids.length);
  console.log('Total T307:', t307Ids.length);
})();
