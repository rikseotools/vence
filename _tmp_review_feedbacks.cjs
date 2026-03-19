require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 1. Get ALL non-closed feedbacks
  const { data: feedbacks, error: fbErr } = await supabase
    .from('user_feedback')
    .select('id, user_id, type, message, status, created_at, updated_at, admin_response, question_id, email')
    .in('status', ['pending', 'in_progress', 'in_review'])
    .order('created_at', { ascending: true });

  if (fbErr) { console.error('Error feedbacks:', fbErr); return; }

  console.log(`\n=== ${feedbacks.length} FEEDBACKS NO CERRADOS ===\n`);

  for (const fb of feedbacks) {
    // Get user info
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', fb.user_id)
      .single();

    const isTest = profile && profile.email && profile.email.indexOf('venceoposiciones') >= 0;

    // Get conversation
    const { data: conv } = await supabase
      .from('feedback_conversations')
      .select('id, status, created_at')
      .eq('feedback_id', fb.id)
      .single();

    let messages = [];
    if (conv) {
      const { data: msgs } = await supabase
        .from('feedback_messages')
        .select('id, sender_type, message, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      messages = msgs || [];
    }

    console.log('-------------------------------------------');
    console.log(`FB: ${fb.id}`);
    console.log(`Usuario: ${profile ? profile.full_name : 'N/A'} (${profile ? profile.email : 'N/A'})`);
    console.log(`TEST ACCOUNT: ${isTest ? 'SI' : 'NO'}`);
    console.log(`Tipo: ${fb.type} | Status: ${fb.status}`);
    console.log(`Fecha: ${fb.created_at}`);
    console.log(`Mensaje: ${fb.message}`);

    if (conv) {
      console.log(`\nConversacion: ${conv.id} (status: ${conv.status})`);
      console.log(`Mensajes (${messages.length}):`);
      for (const m of messages) {
        const sender = m.sender_type === 'admin' ? 'ADMIN' : 'USER';
        console.log(`  [${sender}] ${m.created_at}: ${m.message}`);
      }
    } else {
      console.log('\nSin conversacion');
    }
    console.log('');
  }
}

main().catch(console.error);
