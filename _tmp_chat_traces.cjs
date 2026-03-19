const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const msgIds = [
    'a5a892ad-57f5-4a4e-a25f-8b2dac30c8e0',
    'e4e49c3c-32c3-4ec5-b516-69e4f619d822',
  ];

  const { data } = await s.from('ai_chat_logs')
    .select('id,had_discrepancy,ai_suggested_answer,db_answer,reanalysis_response')
    .in('id', msgIds);

  for (const m of data) {
    console.log('='.repeat(60));
    console.log('ID:', m.id);
    console.log('Discrepancy:', m.had_discrepancy);
    console.log('AI suggested:', m.ai_suggested_answer);
    console.log('DB answer:', m.db_answer);
    console.log('Reanalysis:', (m.reanalysis_response || '').substring(0, 500));
  }
})();
