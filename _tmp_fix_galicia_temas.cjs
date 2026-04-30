require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const T12_ID = '21d85099-b2ee-45a5-b4de-3042ac8708ed';
const LO_3_2007_LAW_ID = '6e59eacd-9298-4164-9d78-9e9343d9a900';

(async () => {
  // === 1) Sync description = epigrafe for all Galicia topics ===
  console.log('=== 1. Sincronizando description = epigrafe ===');
  const { data: topics } = await supabase
    .from('topics')
    .select('id, topic_number, title, description, epigrafe')
    .eq('position_type', 'auxiliar_administrativo_galicia');

  let synced = 0;
  for (const t of topics) {
    const d = (t.description || '').trim();
    const e = (t.epigrafe || '').trim();
    if (d === e || !e) continue;
    const { error } = await supabase.from('topics').update({ description: t.epigrafe }).eq('id', t.id);
    if (error) { console.error('❌ T' + t.topic_number + ':', error.message); continue; }
    console.log('  ✅ T' + t.topic_number + ' actualizado');
    synced++;
  }
  console.log('Sincronizados:', synced);

  // === 2) Remove LO 3/2007 from T12 scope (not in official program) ===
  console.log('\n=== 2. Eliminando LO 3/2007 del topic_scope T12 Galicia ===');
  console.log('(El epígrafe oficial solo cita Ley 7/2023. Las 6 preguntas siguen activas y accesibles desde otras oposiciones que sí incluyen LO 3/2007)');
  const { error: delErr } = await supabase
    .from('topic_scope')
    .delete()
    .eq('topic_id', T12_ID)
    .eq('law_id', LO_3_2007_LAW_ID);
  if (delErr) console.error('❌', delErr.message);
  else console.log('✅ LO 3/2007 eliminada del scope de T12 Galicia');

  // === 3) Final verification ===
  console.log('\n=== 3. Estado final topic_scope T12 ===');
  const { data: finalScope } = await supabase
    .from('topic_scope')
    .select('article_numbers, laws(short_name)')
    .eq('topic_id', T12_ID);
  for (const r of finalScope) {
    console.log(' -', r.laws.short_name, '→', r.article_numbers.length, 'arts');
  }

  // === 4) Verify description vs epigrafe match ===
  console.log('\n=== 4. Verificación final description vs epigrafe ===');
  const { data: afterSync } = await supabase
    .from('topics')
    .select('topic_number, description, epigrafe')
    .eq('position_type', 'auxiliar_administrativo_galicia')
    .order('topic_number');
  let diffsRemaining = 0;
  for (const t of afterSync) {
    if ((t.description || '').trim() !== (t.epigrafe || '').trim()) {
      console.log('  ⚠️ T' + t.topic_number + ' sigue desalineado');
      diffsRemaining++;
    }
  }
  console.log('Diferencias restantes:', diffsRemaining, '(debe ser 0)');

  // === 5) Status of empty topics T14, T17 and minimal-scope T15, T16 ===
  console.log('\n=== 5. Estado temas parte específica ===');
  for (const tn of ['14', '15', '16', '17']) {
    const { data: t } = await supabase.from('topics').select('id, title, epigrafe').eq('position_type', 'auxiliar_administrativo_galicia').eq('topic_number', tn).single();
    const { data: sc } = await supabase.from('topic_scope').select('article_numbers, laws(short_name, is_virtual)').eq('topic_id', t.id);
    const total = sc.reduce((n, r) => n + r.article_numbers.length, 0);
    const lawStrs = sc.map(r => r.laws.short_name + (r.laws.is_virtual ? '(v)' : '') + '(' + r.article_numbers.length + ')').join(', ');
    console.log('T' + tn + ': scope=' + total + ' arts [' + (lawStrs || '∅') + ']');
    console.log('     epigrafe:', (t.epigrafe || '').slice(0, 120));
  }
})();
