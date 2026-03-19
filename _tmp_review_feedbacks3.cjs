require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get ALL non-closed feedbacks from real users
  const { data: feedbacks } = await supabase
    .from('user_feedback')
    .select('id, user_id, type, message, status, admin_response, created_at, question_id, email')
    .in('status', ['pending', 'in_progress', 'in_review'])
    .order('created_at', { ascending: true });

  console.log(`\n=== REVISION A FONDO: ${feedbacks.length} FEEDBACKS ABIERTOS ===\n`);

  for (const fb of feedbacks) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', fb.user_id)
      .single();

    const isTest = profile && profile.email && profile.email.indexOf('venceoposiciones') >= 0;
    if (isTest) continue; // Skip test accounts

    // Get conversation
    const { data: conv } = await supabase
      .from('feedback_conversations')
      .select('id, status')
      .eq('feedback_id', fb.id)
      .single();

    let adminMsgs = [];
    let userMsgs = [];
    if (conv) {
      const { data: msgs } = await supabase
        .from('feedback_messages')
        .select('id, is_admin, message, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });

      if (msgs) {
        adminMsgs = msgs.filter(m => m.is_admin === true);
        userMsgs = msgs.filter(m => m.is_admin === false);
      }
    }

    const hasResponse = adminMsgs.length > 0 || (fb.admin_response && fb.admin_response.length > 0);

    console.log('='.repeat(60));
    console.log(`ID: ${fb.id}`);
    console.log(`Usuario: ${profile ? profile.full_name : 'N/A'} (${profile ? profile.email : fb.email || 'N/A'})`);
    console.log(`Tipo: ${fb.type} | Status FB: ${fb.status} | Status Conv: ${conv ? conv.status : 'SIN CONV'}`);
    console.log(`Fecha: ${fb.created_at}`);
    console.log(`Mensaje: ${fb.message}`);

    if (fb.admin_response) {
      console.log(`\n  [ADMIN_RESPONSE campo]: ${fb.admin_response}`);
    }

    if (adminMsgs.length > 0 || userMsgs.length > 0) {
      console.log(`\n  Conversacion (${adminMsgs.length} admin, ${userMsgs.length} user):`);
      const allMsgs = [...adminMsgs, ...userMsgs].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      for (const m of allMsgs) {
        const role = m.is_admin ? 'ADMIN' : 'USER';
        console.log(`    [${role}] ${m.created_at}: ${m.message.substring(0, 200)}`);
      }
    }

    if (!hasResponse) {
      console.log(`\n  >>> SIN NINGUNA RESPUESTA <<<`);
    }
    console.log('');
  }

  // Also check: are there feedback conversations from before the new system?
  // Some old feedbacks might have been responded to via email directly
  console.log('\n=== RESUMEN ===');
  const realFbs = feedbacks.filter(fb => {
    // Quick check - would need profile lookup but let's just count
    return true;
  });
  console.log(`Total feedbacks abiertos: ${feedbacks.length}`);
}

main().catch(console.error);
