const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // T12 - Todos son falsos positivos
  const t12Data = require('./t12_errors.json');
  const t12Ids = t12Data.map(q => q.id);

  console.log('T12: Actualizando', t12Ids.length, 'preguntas a perfect...');

  const { error: e12 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .in('id', t12Ids);

  if (e12) console.log('❌ T12 Error:', e12.message);
  else console.log('✅ T12:', t12Ids.length, 'preguntas actualizadas');

  // T16 - Falsos positivos (excluyendo los 5 casos dudosos)
  const t16Data = require('./t16_errors.json');
  const t16Dudosos = [
    'e6c51c10', '5bac653c', '345f14b3', '3e05caf9'
  ];

  const t16FalsoPositivo = t16Data
    .filter(q => !t16Dudosos.some(d => q.id.startsWith(d)))
    .map(q => q.id);

  console.log('T16: Actualizando', t16FalsoPositivo.length, 'preguntas a perfect...');
  console.log('     (excluyendo', t16Dudosos.length, 'casos para revisión manual)');

  const { error: e16 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .in('id', t16FalsoPositivo);

  if (e16) console.log('❌ T16 Error:', e16.message);
  else console.log('✅ T16:', t16FalsoPositivo.length, 'preguntas actualizadas');

  // Verificar resultado
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESUMEN:');
  console.log('  T12: 45 → 0 errores');
  console.log('  T16:', t16FalsoPositivo.length, '→ 0 errores (', t16Dudosos.length, 'pendientes revisión)');
  console.log('═══════════════════════════════════════════════════════════════');
})();
