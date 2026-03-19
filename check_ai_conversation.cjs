require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Get the most recent conversation logs from user 2fc60bc8 (Manuel/you)
  const { data: logs } = await supabase
    .from('ai_chat_logs')
    .select('*')
    .eq('user_id', '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('=== Last 10 AI Chat Logs ===\n');
  for (const log of (logs || [])) {
    console.log('---');
    console.log('ID:', log.id);
    console.log('Time:', log.created_at);
    console.log('Message:', log.message);
    console.log('Response time:', log.response_time_ms, 'ms');
    console.log('Had error:', log.had_error);
    if (log.had_error) console.log('Error:', log.error_message);
    console.log('Question context law:', log.question_context_law);
    console.log('Detected laws:', log.detected_laws);
    console.log('Had discrepancy:', log.had_discrepancy);
    if (log.had_discrepancy) {
      console.log('AI suggested:', log.ai_suggested_answer);
      console.log('DB answer:', log.db_answer);
    }
    console.log('Response preview:', (log.response_preview || '').substring(0, 300));
    console.log('Full response:', (log.full_response || '').substring(0, 500));
    console.log('Sources:', log.sources_used);
  }
})();
