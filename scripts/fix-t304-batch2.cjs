const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const correctIds = [
  '191d6f41-d820-4297-b743-4978a0db7982',
  '3749425e-b462-44c4-bf04-54f983c82d9e',
  '4d290c11-234c-4238-8855-5a5e0c78fd66',
  'cf3a84a9-f2d2-4cfe-a989-f1e26ea9822b',
  '8574007f-2342-4bd8-8d8c-83057e4aabd6',
  '137219ca-6e4c-4b48-906c-80bb465e173b',
  'a04cd1b2-1b16-4d23-9cfe-2e258dac0b73',
  'b51de5ef-0817-4189-92df-e7f49592be4a',
  'b624d139-8c9e-4f6e-b0ae-8c1d3847952a',
  '0aaf34b4-97c6-4638-b288-36e55db9411d',
  '55789177-198b-48b7-9918-1d777b422b3c',
  'e63b5989-3248-4210-b3d7-ce2a6da9acb3',
  '9a32d056-39d5-4696-acdd-f7b70b14ca85',
  '2a9a73c1-57eb-4a83-ad75-a894903b8a77',
  '61c3add1-a88a-4a2e-b3fa-5dca8f28a93b',
  '6b360723-114c-4a59-9eee-65c717f50f15',
  '555f2e84-6f68-4f76-9546-58e5d3201779',
  '3fd1a2a9-09ae-409c-ad4f-f6bac6e5b229',
  'fd0fb806-e487-40ca-84e7-2ad55a132238',
  'bb845709-b33f-41db-b1c6-1fa3991e24ff',
  'd10f4f84-8b98-459c-b096-2795b3105a49',
  'ae684a91-9559-438c-b30d-4a09840fe5fd',
  'eeb27d15-6778-43c0-94e9-cbeefbd9ef13',
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
