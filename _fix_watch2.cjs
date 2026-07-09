require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const MINE = ['478c3681','6b88f54b'];
const startISO = new Date().toISOString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isRound = n => [30,40,50,60,75,100].includes(n);
(async () => {
  for (let i = 0; i < 50; i++) {            // ~50 min
    const { data: tests } = await supabase.from('tests')
      .select('id, total_questions, deploy_version, created_at, position_type')
      .gte('created_at', startISO).in('deploy_version', MINE).gte('total_questions', 40)
      .order('created_at', { ascending: false }).limit(20);
    for (const t of tests || []) {
      const { data: tq } = await supabase.from('test_questions').select('tema_number').eq('test_id', t.id);
      const temas = new Set((tq||[]).map(x=>x.tema_number));
      if (temas.size > 1) {
        console.log('PRUEBA_DEFINITIVA:', JSON.stringify({
          total: t.total_questions, redondo: isRound(t.total_questions),
          temasRespondidos: temas.size, build: t.deploy_version, pos: t.position_type, when: t.created_at,
        }));
        process.exit(0);
      }
    }
    await sleep(60000);
  }
  console.log('TIMEOUT ~50min: sin test multi-tema grande (>=40) en build nuevo todavía.');
})();
