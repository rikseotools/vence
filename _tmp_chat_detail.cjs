const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const userId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd';
  const start = '2026-03-14T11:50:00+00:00';
  const end = '2026-03-14T12:05:00+00:00';

  // Get all messages in conversation
  const { data: msgs } = await s.from('ai_chat_logs')
    .select('id,message,full_response,suggestion_used,feedback,had_discrepancy,created_at,question_context_id')
    .eq('user_id', userId)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: true });

  for (const m of msgs) {
    console.log('='.repeat(80));
    console.log('ID:', m.id);
    console.log('Time:', m.created_at);
    console.log('Type:', m.suggestion_used || 'free');
    console.log('Feedback:', m.feedback);
    console.log('Q Context:', m.question_context_id);
    console.log('\nUSER:', m.message);
    console.log('\nAI:', (m.full_response || '').substring(0, 1500));
    console.log();
  }

  // Get traces for the first message (the initial explanation)
  if (msgs.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('TRACES for first message (initial explanation):');
    const { data: traces } = await s.from('ai_chat_traces')
      .select('sequence_number,trace_type,duration_ms,input_data,output_data,error_message')
      .eq('log_id', msgs[0].id)
      .order('sequence_number', { ascending: true });

    if (traces) {
      for (const t of traces) {
        console.log(`\n#${t.sequence_number} [${t.trace_type}] ${t.duration_ms}ms`);
        if (t.trace_type === 'routing') {
          console.log('Selected domain:', t.output_data?.selectedDomain);
          console.log('Evaluated:', JSON.stringify(t.input_data?.evaluatedDomains?.map(d => `${d.domain}:${d.canHandle}`)));
        }
        if (t.trace_type === 'llm_call') {
          console.log('Model:', t.input_data?.model);
          console.log('System prompt (first 500):', (t.input_data?.systemPrompt || '').substring(0, 500));
        }
      }
    }
  }
})();
