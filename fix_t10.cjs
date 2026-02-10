const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const data = require('./t10_errors.json');
  const ids = data.map(q => q.id);

  console.log('Actualizando', ids.length, 'preguntas de T10 a perfect...');

  const { error, count } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .in('id', ids);

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Actualizadas', ids.length, 'preguntas a perfect');
  }

  // Verificar
  const { data: check } = await supabase
    .from('questions')
    .select('topic_review_status')
    .in('id', ids);

  const statuses = {};
  for (const q of check || []) {
    statuses[q.topic_review_status] = (statuses[q.topic_review_status] || 0) + 1;
  }
  console.log('Estados después de actualización:', statuses);
})();
