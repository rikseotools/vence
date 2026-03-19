const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

async function main() {
  const data = JSON.parse(fs.readFileSync('t10_errors.json', 'utf8'));
  const questions = data.filter(q => q.id !== 'c849b4f0-6038-4e6b-b26f-7096043063a4');
  console.log('Total preguntas T10 (sin desactivada):', questions.length);

  // Agrupar por ley vinculada
  const byLaw = {};
  questions.forEach(q => {
    const key = q.law_short_name || 'Sin ley';
    if (!byLaw[key]) byLaw[key] = [];
    byLaw[key].push(q);
  });

  console.log('\n=== DISTRIBUCIÓN POR LEY ===');
  Object.entries(byLaw).sort((a,b) => b[1].length - a[1].length).forEach(([law, qs]) => {
    const byStatus = {};
    qs.forEach(q => { byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1; });
    console.log(`${law}: ${qs.length} preguntas - ${JSON.stringify(byStatus)}`);
  });

  // Agrupar por artículo vinculado
  console.log('\n=== DISTRIBUCIÓN POR ARTÍCULO ===');
  const byArticle = {};
  questions.forEach(q => {
    const key = (q.law_short_name || '?') + ' Art.' + (q.article_number || '?');
    if (!byArticle[key]) byArticle[key] = { count: 0, statuses: {} };
    byArticle[key].count++;
    byArticle[key].statuses[q.topic_review_status] = (byArticle[key].statuses[q.topic_review_status] || 0) + 1;
  });

  Object.entries(byArticle).sort((a,b) => b[1].count - a[1].count).forEach(([art, info]) => {
    console.log(`  ${art}: ${info.count} - ${JSON.stringify(info.statuses)}`);
  });

  // Preparar lotes por ley para agentes
  // TUE (95) -> 5 lotes de ~19
  // TFUE (35) -> 2 lotes de ~18
  // Ley 19/2013 (4) + Reglamento Consejo UE (5) -> 1 lote de 9
  console.log('\n=== PLAN DE LOTES ===');
  const tueLots = byLaw['TUE'] || [];
  const tfueLots = byLaw['TFUE'] || [];
  const otherLots = [...(byLaw['Ley 19/2013'] || []), ...(byLaw['Reglamento Consejo UE'] || []), ...(byLaw['Reglamento PE 9ª'] || [])];

  console.log('TUE:', tueLots.length, '-> 5 lotes de ~' + Math.ceil(tueLots.length / 5));
  console.log('TFUE:', tfueLots.length, '-> 2 lotes de ~' + Math.ceil(tfueLots.length / 2));
  console.log('Otros:', otherLots.length, '-> 1 lote');

  // Write batches
  const batchSize = 19;

  // TUE batches
  for (let i = 0; i < 5; i++) {
    const batch = tueLots.slice(i * batchSize, (i + 1) * batchSize);
    fs.writeFileSync(`t10_tue_batch_${i+1}.json`, JSON.stringify(batch, null, 2));
    console.log(`t10_tue_batch_${i+1}.json: ${batch.length} preguntas`);
  }

  // TFUE batches
  const tfueBatchSize = Math.ceil(tfueLots.length / 2);
  for (let i = 0; i < 2; i++) {
    const batch = tfueLots.slice(i * tfueBatchSize, (i + 1) * tfueBatchSize);
    fs.writeFileSync(`t10_tfue_batch_${i+1}.json`, JSON.stringify(batch, null, 2));
    console.log(`t10_tfue_batch_${i+1}.json: ${batch.length} preguntas`);
  }

  // Other batch
  fs.writeFileSync('t10_other_batch.json', JSON.stringify(otherLots, null, 2));
  console.log(`t10_other_batch.json: ${otherLots.length} preguntas`);

  // Get all articles for TUE and TFUE with content for reference
  console.log('\n=== CARGANDO ARTÍCULOS DE REFERENCIA ===');

  const tueId = 'ddc2ffa9-6a3d-41c9-9a29-9a40fb82efa7';
  const tfueId = 'eba370d3-6dbe-46b0-8f00-c5c2af898b4b';

  // Get ALL articles for TUE
  const { data: tueArts } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', tueId)
    .order('article_number');

  console.log('TUE artículos en BD:', tueArts?.length);

  // Get ALL articles for TFUE
  const { data: tfueArts } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', tfueId)
    .order('article_number');

  console.log('TFUE artículos en BD:', tfueArts?.length);

  // Save article catalogs
  fs.writeFileSync('t10_tue_articles.json', JSON.stringify(tueArts, null, 2));
  fs.writeFileSync('t10_tfue_articles.json', JSON.stringify(tfueArts, null, 2));
  console.log('Catálogos guardados en t10_tue_articles.json y t10_tfue_articles.json');
}

main().catch(console.error);
