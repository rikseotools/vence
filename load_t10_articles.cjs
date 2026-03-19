const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

const TUE_ID = 'ddc2ffa9-d99b-4abc-b149-ab47916ab9da';
const TFUE_ID = 'eba370d3-73d9-44a9-9865-48d2effabaf4';

async function main() {
  // Get all laws in T10 scope
  const { data: scope } = await supabase
    .from('topic_scope')
    .select('law_id')
    .eq('topic_id', '9fa3e8bb-cd6b-4953-bdb5-d021ba921dd1');

  const allLawIds = [...new Set(scope.map(s => s.law_id))];
  let allArticles = [];

  for (const lawId of allLawIds) {
    const { data: law } = await supabase.from('laws').select('short_name').eq('id', lawId).single();
    const { data: arts } = await supabase
      .from('articles')
      .select('id, article_number, title, content, law_id')
      .eq('law_id', lawId)
      .order('article_number');

    if (arts && arts.length > 0) {
      allArticles.push(...arts);
      console.log(`${law?.short_name}: ${arts.length} artículos`);
    }
  }

  console.log('Total artículos en scope T10:', allArticles.length);

  const tueArticles = allArticles.filter(a => a.law_id === TUE_ID);
  const tfueArticles = allArticles.filter(a => a.law_id === TFUE_ID);
  const otherArticles = allArticles.filter(a => a.law_id !== TUE_ID && a.law_id !== TFUE_ID);

  fs.writeFileSync('t10_tue_articles.json', JSON.stringify(tueArticles, null, 2));
  fs.writeFileSync('t10_tfue_articles.json', JSON.stringify(tfueArticles, null, 2));
  fs.writeFileSync('t10_other_articles.json', JSON.stringify(otherArticles, null, 2));

  console.log('\nTUE:', tueArticles.length, 'arts');
  console.log('TFUE:', tfueArticles.length, 'arts');
  console.log('Otros:', otherArticles.length, 'arts');

  console.log('\n=== CATÁLOGO TUE ===');
  tueArticles.forEach(a => {
    console.log(`Art. ${a.article_number} | ${a.id} | ${(a.content || '').substring(0, 80)}`);
  });

  console.log('\n=== CATÁLOGO TFUE ===');
  tfueArticles.forEach(a => {
    console.log(`Art. ${a.article_number} | ${a.id} | ${(a.content || '').substring(0, 80)}`);
  });

  console.log('\n=== CATÁLOGO OTROS ===');
  otherArticles.forEach(a => {
    const { data: law } = { data: null }; // just use law_id
    console.log(`${a.law_id.substring(0,8)} Art. ${a.article_number} | ${a.id} | ${(a.content || '').substring(0, 80)}`);
  });
}

main().catch(console.error);
