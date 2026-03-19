const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Reactivate the question
  const { error: e1 } = await s.from('psychometric_questions')
    .update({ is_active: true })
    .eq('id', '82be4318-7308-45ce-9c51-f76a833284ca');

  if (e1) console.log('Error reactivating:', e1.message);
  else console.log('✅ Question reactivated');

  // Remove review marks
  const msgIds = [
    'a5a892ad-57f5-4a4e-a25f-8b2dac30c8e0',
    'e4e49c3c-32c3-4ec5-b516-69e4f619d822',
    '1f29e6e6-069e-421f-8d21-249b41522f60',
    '06067f94-4f77-4b51-a2c2-a118d2849d39',
  ];

  const { error: e2 } = await s.from('ai_chat_logs')
    .update({ reviewed_at: null, review_notes: null })
    .in('id', msgIds);

  if (e2) console.log('Error removing review:', e2.message);
  else console.log('✅ Review marks removed');
})();
