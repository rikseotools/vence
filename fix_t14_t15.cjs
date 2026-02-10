const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // 1. Obtener el ID del artículo 21 de la Resolución 2014
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .ilike('short_name', '%Res. 20/01/2014%')
    .single();

  if (!law) {
    console.log('❌ No se encontró la Resolución de 2014');
    return;
  }

  const { data: article21 } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', law.id)
    .eq('article_number', '21')
    .single();

  if (!article21) {
    console.log('❌ No se encontró el artículo 21');
    return;
  }

  console.log('✅ Artículo 21 encontrado:', article21.id);
  console.log('   Título:', article21.title);

  // 2. Actualizar las 4 preguntas

  // Pregunta 1 (T14) - FALSO POSITIVO - marcar como perfect
  const q1Id = '0fd2387a-fde6-4ef1-8de9-ff79de26afc7';
  const { error: e1 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .like('id', '0fd2387a%');

  if (e1) console.log('❌ Error pregunta 1:', e1.message);
  else console.log('✅ Pregunta 1 (0fd2387a) actualizada a perfect');

  // Pregunta 2 (T14) - FALSO POSITIVO - marcar como perfect
  const { error: e2 } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .like('id', 'd2957254%');

  if (e2) console.log('❌ Error pregunta 2:', e2.message);
  else console.log('✅ Pregunta 2 (d2957254) actualizada a perfect');

  // Pregunta 3 (T15) - Corregir artículo vinculado
  const { error: e3 } = await supabase
    .from('questions')
    .update({
      primary_article_id: article21.id,
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .like('id', 'bb0cffb2%');

  if (e3) console.log('❌ Error pregunta 3:', e3.message);
  else console.log('✅ Pregunta 3 (bb0cffb2) actualizada: artículo corregido a Art. 21 Res. 2014');

  // Pregunta 4 (T15) - Corregir artículo vinculado
  const { error: e4 } = await supabase
    .from('questions')
    .update({
      primary_article_id: article21.id,
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .like('id', '0ed295e1%');

  if (e4) console.log('❌ Error pregunta 4:', e4.message);
  else console.log('✅ Pregunta 4 (0ed295e1) actualizada: artículo corregido a Art. 21 Res. 2014');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESUMEN:');
  console.log('  - T14: 2 falsos positivos corregidos');
  console.log('  - T15: 2 artículos corregidos (Ley 47/2003 Art.1 → Res. 2014 Art.21)');
  console.log('═══════════════════════════════════════════════════════════════');
})();
