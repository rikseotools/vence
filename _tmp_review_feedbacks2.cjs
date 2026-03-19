require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get ALL non-closed feedbacks with admin_response
  const { data: feedbacks, error } = await supabase
    .from('user_feedback')
    .select('id, user_id, type, message, status, admin_response, created_at, question_id, email')
    .in('status', ['pending', 'in_progress', 'in_review'])
    .order('created_at', { ascending: true });

  if (error) { console.error('Error:', error); return; }

  // Separate test vs real
  const test = [];
  const real = [];

  for (const fb of feedbacks) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', fb.user_id)
      .single();

    const isTest = profile && profile.email && profile.email.indexOf('venceoposiciones') >= 0;
    const entry = { ...fb, profile_name: profile ? profile.full_name : 'N/A', profile_email: profile ? profile.email : 'N/A' };

    if (isTest) test.push(entry);
    else real.push(entry);
  }

  console.log(`\n=== CUENTAS TEST (${test.length}) - A CERRAR ===`);
  for (const t of test) {
    console.log(`  ${t.id} | ${t.message.substring(0, 50)}`);
  }

  console.log(`\n=== FEEDBACKS REALES (${real.length}) ===\n`);

  // Categorize
  const withAdminResp = real.filter(f => f.admin_response);
  const withoutAdminResp = real.filter(f => !f.admin_response);

  console.log(`Con admin_response: ${withAdminResp.length}`);
  console.log(`Sin admin_response: ${withoutAdminResp.length}\n`);

  // Check conversations for those without admin_response
  console.log('--- CON RESPUESTA ADMIN (probablemente ya gestionados) ---');
  for (const fb of withAdminResp) {
    console.log(`\n${fb.id}`);
    console.log(`  ${fb.profile_name} (${fb.profile_email}) | ${fb.type} | ${fb.status}`);
    console.log(`  Fecha: ${fb.created_at}`);
    console.log(`  MSG: ${fb.message.substring(0, 100)}`);
    console.log(`  ADMIN: ${fb.admin_response.substring(0, 150)}`);
  }

  console.log('\n\n--- SIN RESPUESTA ADMIN (necesitan atencion) ---');
  for (const fb of withoutAdminResp) {
    // Check conversation messages
    const { data: conv } = await supabase
      .from('feedback_conversations')
      .select('id, status')
      .eq('feedback_id', fb.id)
      .single();

    let msgCount = 0;
    let lastAdminMsg = null;
    if (conv) {
      const { data: msgs } = await supabase
        .from('feedback_messages')
        .select('sender_type, message, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false });

      msgCount = msgs ? msgs.length : 0;
      if (msgs) {
        lastAdminMsg = msgs.find(m => m.sender_type === 'admin');
      }
    }

    console.log(`\n${fb.id}`);
    console.log(`  ${fb.profile_name} (${fb.profile_email}) | ${fb.type} | ${fb.status}`);
    console.log(`  Fecha: ${fb.created_at}`);
    console.log(`  MSG: ${fb.message}`);
    console.log(`  Conv: ${conv ? conv.status : 'NONE'} | Msgs: ${msgCount}`);
    if (lastAdminMsg) {
      console.log(`  Last admin: ${lastAdminMsg.message.substring(0, 150)}`);
    } else {
      console.log(`  *** NO HAY RESPUESTA ADMIN ***`);
    }
  }
}

main().catch(console.error);
