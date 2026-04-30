require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const all = JSON.parse(fs.readFileSync('galicia_t1_consolidated.json', 'utf8'));
  const now = new Date().toISOString();

  const perfectIds = all.filter(r => r.status === 'perfect').map(r => r.id);
  const errors = all.filter(r => r.status !== 'perfect');

  console.log('Total:', all.length);
  console.log('Perfect:', perfectIds.length);
  console.log('Errores:', errors.length);

  // 1) Update 349 perfect in batches of 100
  let updatedPerfect = 0;
  for (let i = 0; i < perfectIds.length; i += 100) {
    const chunk = perfectIds.slice(i, i + 100);
    const { error, count } = await supabase
      .from('questions')
      .update({
        topic_review_status: 'perfect',
        verification_status: 'ok',
        verified_at: now,
      }, { count: 'exact' })
      .in('id', chunk);
    if (error) { console.error('Error actualizando perfect:', error); break; }
    updatedPerfect += count || chunk.length;
    console.log(`  perfect chunk ${i/100 + 1}: ${chunk.length} updated`);
  }
  console.log('\n✅ Perfect actualizadas:', updatedPerfect);

  // 2) Update 17 errors one by one (each with its own status)
  let updatedErrors = 0;
  for (const e of errors) {
    const { error } = await supabase
      .from('questions')
      .update({
        topic_review_status: e.status,
        verification_status: 'problem',
        verified_at: now,
      })
      .eq('id', e.id);
    if (error) { console.error(`Error actualizando ${e.id}:`, error); continue; }
    updatedErrors++;
    console.log(`  ${e.id} → ${e.status}`);
  }
  console.log('\n✅ Errores actualizados:', updatedErrors);

  // 3) Verify final state
  console.log('\n=== VERIFICACIÓN FINAL ===');
  const allIds = all.map(r => r.id);
  const { data: finalState } = await supabase
    .from('questions')
    .select('id, is_active, topic_review_status, verification_status, deactivation_reason')
    .in('id', allIds);

  const stateStats = {};
  for (const q of finalState || []) {
    const key = `${q.topic_review_status} | active=${q.is_active}`;
    stateStats[key] = (stateStats[key] || 0) + 1;
  }
  console.log('\nEstado final:');
  Object.entries(stateStats).sort((a,b) => b[1]-a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  const activeCount = (finalState || []).filter(q => q.is_active).length;
  const inactiveCount = (finalState || []).filter(q => !q.is_active).length;
  console.log(`\n✅ Activas: ${activeCount}  |  Inactivas: ${inactiveCount}`);
})();
