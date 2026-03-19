const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Prioridad: feedback negativo > discrepancias > chat libre > resto
  let { data } = await s.from('ai_chat_logs')
    .select('id,user_id,message,full_response,suggestion_used,feedback,had_discrepancy,had_error,created_at,question_context_id,question_context_law,user_oposicion')
    .is('reviewed_at', null)
    .eq('feedback', 'negative')
    .order('created_at', { ascending: true })
    .limit(1);

  if (!data || !data.length) {
    const r = await s.from('ai_chat_logs')
      .select('id,user_id,message,full_response,suggestion_used,feedback,had_discrepancy,had_error,created_at,question_context_id,question_context_law,user_oposicion')
      .is('reviewed_at', null)
      .eq('had_discrepancy', true)
      .order('created_at', { ascending: true })
      .limit(1);
    data = r.data;
  }

  if (!data || !data.length) {
    const r = await s.from('ai_chat_logs')
      .select('id,user_id,message,full_response,suggestion_used,feedback,had_discrepancy,had_error,created_at,question_context_id,question_context_law,user_oposicion')
      .is('reviewed_at', null)
      .is('suggestion_used', null)
      .order('created_at', { ascending: true })
      .limit(1);
    data = r.data;
  }

  if (!data || !data.length) {
    const r = await s.from('ai_chat_logs')
      .select('id,user_id,message,full_response,suggestion_used,feedback,had_discrepancy,had_error,created_at,question_context_id,question_context_law,user_oposicion')
      .is('reviewed_at', null)
      .order('created_at', { ascending: true })
      .limit(1);
    data = r.data;
  }

  if (!data || !data.length) {
    console.log('No hay chats sin revisar');
    return;
  }

  const m = data[0];
  console.log('ID:', m.id);
  console.log('User:', m.user_id);
  console.log('Fecha:', m.created_at);
  console.log('Oposicion:', m.user_oposicion);
  console.log('Suggestion:', m.suggestion_used);
  console.log('Feedback:', m.feedback);
  console.log('Discrepancy:', m.had_discrepancy);
  console.log('Error:', m.had_error);
  console.log('Q Context ID:', m.question_context_id);
  console.log('Q Context Law:', m.question_context_law);
  console.log('---MESSAGE---');
  console.log(m.message);
  console.log('---RESPONSE (first 2000 chars)---');
  console.log((m.full_response || '').substring(0, 2000));

  // Check for more messages in same conversation (same user, within 10 min)
  if (m.user_id) {
    const start = new Date(new Date(m.created_at).getTime() - 600000).toISOString();
    const end = new Date(new Date(m.created_at).getTime() + 600000).toISOString();
    const { data: conv } = await s.from('ai_chat_logs')
      .select('id,message,suggestion_used,feedback,created_at')
      .eq('user_id', m.user_id)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true });
    if (conv && conv.length > 1) {
      console.log('\n---CONVERSATION CONTEXT (' + conv.length + ' messages)---');
      for (const c of conv) {
        const marker = c.id === m.id ? ' <<<' : '';
        console.log(`[${c.created_at}] ${c.suggestion_used || 'free'}: ${c.message.substring(0, 100)}${marker}`);
      }
    }
  }
})();
