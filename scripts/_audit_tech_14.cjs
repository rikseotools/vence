const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const IDS = [
  '360926e3-acc2-4d8b-a81f-3bb6b20530f6',
  '863fed5f-0770-46ae-8028-e8688255f9e5',
  '7d705a47-c1b7-4ce1-a710-8cd9a7875317',
  '86ad636f-19c6-49a1-ad92-22650fb4e11e',
  '71511aae-af4d-40f1-a557-f67ba9e44ddd',
  'b2101f92-49b7-40a8-b9c9-ea9ef9314a25',
  '0bd9cc75-fef3-44a2-9183-c4b4ab590c43',
  'b0a57f3f-1247-4db2-b564-616b0074612d',
  '6d734e64-4b25-4ea5-bd4d-5f0bde72e43e',
  'f758bed2-fb2b-45de-8af2-6b34f35df51f',
  '9b51a517-1bc9-40d7-a9b2-63bc526c43ba',
  '7ece8735-97b2-4687-8f2b-d67255b56a78',
  '9d1054ea-7e55-4524-a203-9a7f42ef8618',
  'c19a70ee-9092-4db3-8e3a-954c4ab084cf',
];

(async () => {
  const { data: qs, error: qe } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, is_active, is_official_exam, verification_status')
    .in('id', IDS);
  if (qe) { console.error('QE', qe); process.exit(1); }

  const { data: avs, error: ae } = await supabase
    .from('ai_verification_results')
    .select('*')
    .in('question_id', IDS);
  if (ae) { console.error('AE', ae); process.exit(1); }

  const out = IDS.map((id, i) => {
    const q = qs.find(x => x.id === id);
    const av = avs.filter(x => x.question_id === id);
    return { n: i+1, id, q, av };
  });
  console.log(JSON.stringify(out, null, 2));
})();
