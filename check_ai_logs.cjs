require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Check ai_chat_logs
  const tables = ['ai_chat_logs', 'ai_logs'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      if (error.code !== '42P01') console.log('ERROR on', t, ':', error.message);
    } else {
      console.log('EXISTS:', t, '- columns:', data && data.length > 0 ? Object.keys(data[0]).join(', ') : '(empty)');
    }
  }

  // Get recent traces with errors
  const { data: traces } = await supabase
    .from('ai_chat_traces')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n=== Recent AI Chat Traces ===');
  console.log('Total:', traces?.length);
  for (const t of (traces || [])) {
    console.log(JSON.stringify({
      id: t.id,
      log_id: t.log_id,
      type: t.trace_type,
      success: t.success,
      error: t.error_message,
      created: t.created_at,
      duration: t.duration_ms
    }));
  }

  // Get the log_id to find the conversation
  if (traces && traces.length > 0) {
    const logIds = [...new Set(traces.map(t => t.log_id))];
    console.log('\n=== Unique log_ids ===');
    console.log(logIds);

    // Try to get log details
    for (const logId of logIds.slice(0, 3)) {
      const { data: logTraces } = await supabase
        .from('ai_chat_traces')
        .select('trace_type, success, error_message, duration_ms, input_data, output_data, created_at')
        .eq('log_id', logId)
        .order('sequence_number');

      console.log('\n=== Conversation', logId, '===');
      for (const t of (logTraces || [])) {
        const input = t.input_data ? JSON.stringify(t.input_data).substring(0, 200) : null;
        const output = t.output_data ? JSON.stringify(t.output_data).substring(0, 200) : null;
        console.log({
          type: t.trace_type,
          success: t.success,
          error: t.error_message,
          duration: t.duration_ms,
          input: input,
          output: output,
          created: t.created_at
        });
      }
    }
  }
})();
