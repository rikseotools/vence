const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  
  // Check pending tests (official exams)
  const { data: pending, error } = await supabase
    .from('tests')
    .select('id, is_completed, total_questions, created_at, detailed_analytics')
    .eq('user_id', userId)
    .eq('is_completed', false)
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Pending tests:', JSON.stringify(pending, null, 2));
  if (error) console.log('Error:', error);
}

check();
