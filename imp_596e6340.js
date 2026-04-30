require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const disputeId = '596e6340-d95c-44d3-a6b8-3c88e2dd0de5';
  
  const { data: dispute } = await supabase
    .from('question_disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  console.log('=== DISPUTE ===');
  console.log(JSON.stringify(dispute, null, 2));

  const { data: question } = await supabase
    .from('questions')
    .select('*')
    .eq('id', dispute.question_id)
    .single();

  console.log('\n=== QUESTION ===');
  console.log(JSON.stringify(question, null, 2));

  const { data: ai } = await supabase
    .from('ai_verification_results')
    .select('*')
    .eq('question_id', dispute.question_id)
    .order('verified_at', { ascending: false })
    .limit(1)
    .single();

  console.log('\n=== AI VERIFICATION ===');
  console.log(JSON.stringify(ai, null, 2));
})();
