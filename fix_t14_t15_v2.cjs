const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // IDs completos de las preguntas (del archivo JSON)
  const questions = {
    q1: '0fd2387a-fde6-4ef1-8de9-ff79de26afc7', // T14 - TREBEP Art. 25
    q2: 'd2957254-9e23-4c6c-b5c5-3e1234567890', // T14 - Clases Pasivas Art. 33
    q3: 'bb0cffb2-0271-4096-b208-28a2d700de6d', // T15 - Res. 2014
    q4: '0ed295e1-83c3-40b9-a5ed-049308c92ae5'  // T15 - Res. 2014
  };

  // Obtener IDs reales buscando por prefijo usando text cast
  const { data: realQuestions } = await supabase
    .from('questions')
    .select('id')
    .or('id.eq.' + questions.q1 + ',id.eq.' + questions.q3 + ',id.eq.' + questions.q4);

  console.log('Preguntas encontradas:', realQuestions?.length || 0);

  // Buscar pregunta 2 por texto
  const { data: q2Search } = await supabase
    .from('questions')
    .select('id')
    .ilike('question_text', '%pensiones de jubilación o retiro de las Clases Pasivas%')
    .limit(1);

  const q2Id = q2Search?.[0]?.id;
  console.log('Pregunta 2 ID:', q2Id || 'no encontrada');

  // Obtener el ID del artículo 21 de la Resolución 2014
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .ilike('short_name', '%Res. 20/01/2014%')
    .single();

  const { data: article21 } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', law.id)
    .eq('article_number', '21')
    .single();

  console.log('Artículo 21 ID:', article21?.id);

  // Actualizar preguntas
  const updates = [
    { id: questions.q1, name: 'Pregunta 1 (T14)', changes: { topic_review_status: 'perfect', verified_at: new Date().toISOString(), verification_status: 'ok' }},
    { id: q2Id, name: 'Pregunta 2 (T14)', changes: { topic_review_status: 'perfect', verified_at: new Date().toISOString(), verification_status: 'ok' }},
    { id: questions.q3, name: 'Pregunta 3 (T15)', changes: { primary_article_id: article21.id, topic_review_status: 'perfect', verified_at: new Date().toISOString(), verification_status: 'ok' }},
    { id: questions.q4, name: 'Pregunta 4 (T15)', changes: { primary_article_id: article21.id, topic_review_status: 'perfect', verified_at: new Date().toISOString(), verification_status: 'ok' }}
  ];

  for (const u of updates) {
    if (!u.id) {
      console.log('⚠️', u.name, '- ID no encontrado');
      continue;
    }

    const { error } = await supabase
      .from('questions')
      .update(u.changes)
      .eq('id', u.id);

    if (error) {
      console.log('❌', u.name, '-', error.message);
    } else {
      console.log('✅', u.name, '- actualizada');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('T14 y T15 completados. Continuando con el resto del Bloque I...');
  console.log('═══════════════════════════════════════════════════════════════');
})();
