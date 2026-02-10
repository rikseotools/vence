const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // T2 - Todos son falsos positivos
  const t2Data = require('./t2_errors.json');
  const t2Ids = t2Data.map(q => q.id);

  console.log('T2: Actualizando', t2Ids.length, 'preguntas a perfect...');

  const { error: e2 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .in('id', t2Ids);

  if (e2) console.log('❌ T2 Error:', e2.message);
  else console.log('✅ T2:', t2Ids.length, 'preguntas actualizadas');

  // T6 - Falsos positivos (excluyendo 4 dudosos)
  const t6Data = require('./t6_errors.json');
  const t6Dudosos = [
    '957a1254', '96d8147b', '25062798', '4b4d1241'
  ];

  const t6FalsoPositivo = t6Data
    .filter(q => !t6Dudosos.some(d => q.id.startsWith(d)))
    .map(q => q.id);

  console.log('T6: Actualizando', t6FalsoPositivo.length, 'preguntas a perfect...');
  console.log('     (excluyendo', t6Dudosos.length, 'casos para revisión manual)');

  const { error: e6 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .in('id', t6FalsoPositivo);

  if (e6) console.log('❌ T6 Error:', e6.message);
  else console.log('✅ T6:', t6FalsoPositivo.length, 'preguntas actualizadas');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESUMEN:');
  console.log('  T2:', t2Ids.length, '→ 0 errores');
  console.log('  T6:', t6FalsoPositivo.length, '→ 0 errores (', t6Dudosos.length, 'pendientes)');
  console.log('═══════════════════════════════════════════════════════════════');
})();
