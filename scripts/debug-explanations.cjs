const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function esTextoArticulo(exp) {
  if (!exp) return false;
  return (
    /^Ley \d+\/\d{4}.*\nArtículo \d+/i.test(exp) ||
    (/^Artículo \d+(\.\d+)? de la Ley/i.test(exp) && /[a-z]\) |^\d+\. /m.test(exp))
  );
}

(async () => {
  // Revisar un ID específico de los afectados
  const testIds = [
    '74a45f5b-6bfa-4bc8-b15c-3d3a2ec64562',
    'fc2c3b33-8634-45ce-9626-d67e223d0be3'
  ];

  for (const id of testIds) {
    const { data: q } = await supabase
      .from('questions')
      .select('id, explanation, primary_article_id')
      .eq('id', id)
      .single();

    if (q) {
      console.log('ID:', q.id);
      console.log('primary_article_id:', q.primary_article_id);
      console.log('esTextoArticulo:', esTextoArticulo(q.explanation));
      console.log('Explicación (100 chars):', (q.explanation || '').substring(0, 100));
      console.log('---');
    }
  }
})();
