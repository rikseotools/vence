const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // T3 - Falsos positivos (excluyendo 2 dudosos)
  const t3Data = require('./t3_errors.json');
  const t3Dudosos = ['b16c33ba', '0a08371a'];

  const t3FP = t3Data
    .filter(q => !t3Dudosos.some(d => q.id.startsWith(d)))
    .map(q => q.id);

  console.log('T3: Actualizando', t3FP.length, 'preguntas a perfect...');

  const { error: e3 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .in('id', t3FP);

  if (e3) console.log('❌ T3 Error:', e3.message);
  else console.log('✅ T3:', t3FP.length, 'preguntas actualizadas');

  // T8 - Falsos positivos (excluyendo 9 dudosos)
  const t8Data = require('./t8_errors.json');
  const t8Dudosos = [
    '0e3dd045', '328e88e1', '8aa9d55a', '5394fb15',
    'e5f758a1', '6113d37b', 'cd5d80ab', '101caf3b'
  ];

  const t8FP = t8Data
    .filter(q => !t8Dudosos.some(d => q.id.startsWith(d)))
    .map(q => q.id);

  console.log('T8: Actualizando', t8FP.length, 'preguntas a perfect...');

  const { error: e8 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .in('id', t8FP);

  if (e8) console.log('❌ T8 Error:', e8.message);
  else console.log('✅ T8:', t8FP.length, 'preguntas actualizadas');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESUMEN:');
  console.log('  T3:', t3FP.length, '→ 0 errores (', t3Dudosos.length, 'pendientes)');
  console.log('  T8:', t8FP.length, '→ 0 errores (', t8Dudosos.length, 'pendientes)');
  console.log('═══════════════════════════════════════════════════════════════');
})();
