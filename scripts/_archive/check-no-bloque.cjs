require('dotenv').config({path:'.env.local'});
const{createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

(async()=>{
  const {count: total} = await s.from('questions')
    .select('*', {count: 'exact', head: true})
    .eq('is_active', true);

  console.log('Total preguntas activas:', total);

  // Get all questions in batches to check tags
  let offset = 0;
  const batchSize = 1000;
  let noBloqueCount = 0;
  let statusCounts = {};

  while(true) {
    const {data} = await s.from('questions')
      .select('tags, topic_review_status')
      .eq('is_active', true)
      .range(offset, offset + batchSize - 1);

    if(!data || data.length === 0) break;

    for(const q of data) {
      const tags = q.tags || [];
      const hasBloque = tags.some(t => t.startsWith('Bloque '));
      if(!hasBloque) {
        noBloqueCount++;
        const st = q.topic_review_status || 'null';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      }
    }

    offset += batchSize;
    if(data.length < batchSize) break;
  }

  console.log('\nPreguntas sin tag Bloque (otros contenidos):', noBloqueCount);
  if(noBloqueCount > 0) {
    console.log('Estados:', statusCounts);
  }

  // Also check for administrativo C1 specifically
  console.log('\n=== Preguntas Administrativo C1 (Bloque I-VI) ===');
  const bloques = ['Bloque I', 'Bloque II', 'Bloque III', 'Bloque IV', 'Bloque V', 'Bloque VI'];
  let c1Total = 0;
  for(const b of bloques) {
    const {count} = await s.from('questions')
      .select('*', {count: 'exact', head: true})
      .eq('is_active', true)
      .contains('tags', [b]);
    c1Total += count || 0;
  }
  console.log('Total Administrativo C1:', c1Total);
  console.log('Total otras preguntas:', total - c1Total);
})();
