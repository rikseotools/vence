require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Check all traces for the 4 conversation messages
  const logIds = [
    '2d2d889f-625d-466b-8ed4-2516ec35e664', // 1st: "Explícame por qué..."
    '35cb392a-8d47-45bb-b947-76b1b7328329', // 2nd: "y cual es esa ley?"
    '31e81237-064e-4033-86c8-a78030d7343c', // 3rd: "estas seguro?"
    'dbeb78e0-9759-4dc1-9a8d-e0b31eebb47e', // 4th: "y la renuncia por que no es?"
  ];

  for (const logId of logIds) {
    // Get the log
    const { data: log } = await supabase
      .from('ai_chat_logs')
      .select('message, question_context_id')
      .eq('id', logId)
      .single();

    // Get the traces for this log (specifically db_query which has the input/output)
    const { data: traces } = await supabase
      .from('ai_chat_traces')
      .select('trace_type, input_data, output_data')
      .eq('log_id', logId)
      .order('sequence_number');

    console.log('=== LOG:', logId.substring(0, 8), '===');
    console.log('Message:', log?.message?.substring(0, 60));
    console.log('Question context ID:', log?.question_context_id);

    for (const t of (traces || [])) {
      if (t.trace_type === 'routing') {
        const input = t.input_data;
        console.log('  [routing] userMessage:', input?.userMessage?.substring(0, 60));
        console.log('  [routing] questionContext.id:', input?.questionContext?.id || input?.questionContext?.questionId);
        console.log('  [routing] confidence:', input?.confidence);
      }
      if (t.trace_type === 'db_query') {
        const input = t.input_data;
        console.log('  [db_query] operation:', input?.operation);
        console.log('  [db_query] questionId:', input?.questionId);
        console.log('  [db_query] userMessage:', input?.userMessage?.substring(0, 60));
        // Check if history is in input_data
        if (input?.history) {
          console.log('  [db_query] history length:', input.history.length);
          for (const h of input.history) {
            console.log('    -', h.role + ':', (h.content || '').substring(0, 80));
          }
        } else {
          console.log('  [db_query] history: NOT IN TRACE DATA');
        }
      }
    }
    console.log('');
  }
})();
