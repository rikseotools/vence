require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1. All position types
  const { data: all } = await s.from('topics').select('position_type, is_active');
  const types = {};
  all.forEach(t => { types[t.position_type] = (types[t.position_type] || 0) + 1; });
  console.log('Position types:', JSON.stringify(types, null, 2));

  // 2. All active topics grouped by position_type
  const { data: topics, error: tErr } = await s.from('topics').select('id, title, topic_number, position_type, is_active').eq('is_active', true).order('position_type').order('topic_number');
  if (tErr) { console.log('Topics error:', tErr); return; }
  console.log('\nTotal active topics:', topics.length);

  let current = '';
  for (const t of topics) {
    if (t.position_type !== current) {
      current = t.position_type;
      console.log('\n=== ' + current + ' ===');
    }
    console.log('  T' + t.topic_number + ': ' + t.title);
  }

  // 3. topic_scope sample - how are laws/articles linked to topics
  console.log('\n\n=== TOPIC_SCOPE SAMPLE (first 5 of T1 aux admin) ===');
  const t1 = topics.find(t => t.topic_number === 1 && t.position_type === 'auxiliar_administrativo');
  if (t1) {
    const { data: scope } = await s.from('topic_scope').select('id, topic_id, law_id, article_numbers, section_name').eq('topic_id', t1.id);
    for (const sc of (scope || []).slice(0, 10)) {
      const { data: law } = await s.from('laws').select('short_name').eq('id', sc.law_id).single();
      console.log('  Law:', law ? law.short_name : sc.law_id, '| Arts:', JSON.stringify(sc.article_numbers), '| Section:', sc.section_name);
    }
  }

  // 4. How user profile links to oposicion
  console.log('\n\n=== M (daluamva) PROFILE ===');
  const { data: profile } = await s.from('user_profiles').select('id, full_name, email, target_oposicion, target_oposicion_data').eq('email', 'daluamva@gmail.com').single();
  console.log(JSON.stringify(profile, null, 2));

  // 5. Check oposicion_topics table
  console.log('\n=== OPOSICION_TOPICS (all) ===');
  const { data: ot } = await s.from('oposicion_topics').select('oposicion_id, topic_id');
  console.log('Total rows:', ot ? ot.length : 0);

  // 6. Laws available
  console.log('\n=== LAWS ===');
  const { data: laws } = await s.from('laws').select('id, short_name, full_name, is_active').eq('is_active', true).order('short_name');
  for (const l of laws) {
    console.log('  ' + l.id + ' | ' + l.short_name);
  }
}

main().catch(console.error);
