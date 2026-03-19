require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // All feedback IDs to close (everything except Ricardo P 4e0e788c)
  const idsToClose = [
    // Test accounts (3)
    '0b735b86-62f8-4b92-b753-29e89226122a',
    'ba492cd9-4f34-4712-b7d2-5fea186e8ab9',
    '18f8dbd3-cb40-46fc-80d8-be37454106a0',
    // Closed conv with admin response (17)
    '0c7ec0a4-bf98-4ac5-ba12-3dd1fda280b6',
    '635e05cd-b079-4291-9ec4-992deb8c8a11',
    '2f07f24c-dba7-4ab2-94b3-d751ae34b930',
    'fa4a06ba-379c-43fc-933a-856ddb215db8',
    '168df707-f15a-42f0-9548-f6fee6fa17e0',
    'f5d0b291-e005-4241-9bc7-7c96ee650214',
    'ec428e6e-38db-42b9-b6e6-16a0d2b5e4ce',
    '59a7a8a0-a4f4-4144-80a6-db772b8c33d7',
    'f722a9d8-8d7b-4dc8-8cfa-a770f7e4c305',
    '34fe56e2-e4e4-4b0c-b2f9-cdc89d6523a2',
    '69f1e652-098f-4456-9294-832eea81f038',
    '8db274c3-a19e-400a-95b3-ea5cb00da905',
    'e541abef-004a-458f-a997-84a263a5fe78',
    '11e8a975-5bdb-4c9a-9711-ba3ff4640bc5',
    '8eabed4e-6d1e-4ce1-8762-aff47206d236',
    'e3761200-f998-4b92-ba7c-6d46ad2b39a4',
    '304c8d42-44d7-443c-9070-220d68fad0f6',
    '6d928c53-f4a0-4776-a0c4-403a111da374',
    // Waiting user with admin response (7+1)
    '852ecdbd-cd8f-440e-95bd-75520a9482f8',
    '36ebc244-da30-45b5-b79e-1f4ffc1cfdee',
    '81446da7-ab4a-474a-ad89-ae32d6ceb3f5',
    'b7b68dd6-9b38-4b79-a833-07d279bb96d4',
    'b7ce8f0f-d49f-4631-bd1e-6a557b5aa0e3',
    '62771f80-8350-48d3-9c87-d60b91aa8cda',
    'de3a2a3f-ae68-4feb-b1ca-015fe5bb5ac7',
  ];

  console.log(`Cerrando ${idsToClose.length} feedbacks...`);

  // 1. Close feedback status
  const { data: fbResult, error: fbErr } = await supabase
    .from('user_feedback')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .in('id', idsToClose)
    .select('id');

  if (fbErr) {
    console.error('Error cerrando feedbacks:', fbErr);
    return;
  }
  console.log(`Feedbacks actualizados: ${fbResult.length}`);

  // 2. Close all associated conversations
  const { data: convs } = await supabase
    .from('feedback_conversations')
    .select('id, feedback_id, status')
    .in('feedback_id', idsToClose);

  if (convs && convs.length > 0) {
    const openConvIds = convs.filter(c => c.status !== 'closed').map(c => c.id);
    if (openConvIds.length > 0) {
      const { error: convErr } = await supabase
        .from('feedback_conversations')
        .update({ status: 'closed' })
        .in('id', openConvIds);

      if (convErr) {
        console.error('Error cerrando conversaciones:', convErr);
      } else {
        console.log(`Conversaciones cerradas: ${openConvIds.length}`);
      }
    } else {
      console.log('Todas las conversaciones ya estaban cerradas');
    }
  }

  // 3. Verify what's left open
  const { data: remaining } = await supabase
    .from('user_feedback')
    .select('id, status, message, email')
    .in('status', ['pending', 'in_progress', 'in_review']);

  console.log(`\nFeedbacks que quedan abiertos: ${remaining ? remaining.length : 0}`);
  if (remaining) {
    for (const r of remaining) {
      console.log(`  ${r.id} | ${r.status} | ${r.message.substring(0, 80)}`);
    }
  }
}

main().catch(console.error);
