require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

(async () => {
  // Cargar preguntas de JSONs
  const dir = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_7__Correo_electrónico';
  const jsonQuestions = new Set();

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  files.forEach(f => {
    const data = JSON.parse(fs.readFileSync(dir + '/' + f));
    data.questions.forEach(q => {
      jsonQuestions.add(normalizeText(q.question));
    });
  });

  console.log('📄 Preguntas únicas en JSONs:', jsonQuestions.size);

  // Cargar preguntas de BD
  const { data: law } = await supabase.from('laws').select('id').eq('short_name', 'Correo electrónico').single();
  const { data: articles } = await supabase.from('articles').select('id, article_number, title').eq('law_id', law.id).order('article_number');

  const articleIds = articles.map(a => a.id);
  const { data: dbQuestions } = await supabase
    .from('questions')
    .select('id, question_text, primary_article_id, created_at')
    .in('primary_article_id', articleIds);

  console.log('🗄️  Preguntas en BD:', dbQuestions.length);

  // Encontrar extras (en BD pero no en JSONs)
  const extras = [];
  dbQuestions.forEach(q => {
    const normalized = normalizeText(q.question_text);
    if (!jsonQuestions.has(normalized)) {
      const art = articles.find(a => a.id === q.primary_article_id);
      extras.push({
        question: q.question_text.substring(0, 60),
        article: art?.title || 'N/A',
        created: q.created_at.substring(0, 10)
      });
    }
  });

  console.log('\n🔍 Preguntas EXTRA en BD (no en JSONs):', extras.length);
  console.log('\n📊 Por artículo:');

  const byArticle = {};
  extras.forEach(e => {
    byArticle[e.article] = (byArticle[e.article] || 0) + 1;
  });
  Object.entries(byArticle).forEach(([art, count]) => {
    console.log('   -', art + ':', count);
  });

  console.log('\n📅 Por fecha de creación:');
  const byDate = {};
  extras.forEach(e => {
    byDate[e.created] = (byDate[e.created] || 0) + 1;
  });
  Object.entries(byDate).sort().forEach(([date, count]) => {
    console.log('   -', date + ':', count);
  });

  console.log('\n📝 Ejemplos de extras:');
  extras.slice(0, 5).forEach((e, i) => {
    console.log('  ', (i+1) + '.', e.question + '...');
    console.log('      Art:', e.article, '| Fecha:', e.created);
  });
})();
