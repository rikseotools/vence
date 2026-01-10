const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LAWS = {
  'Ley 39/2015': '218452f5-b9f6-48f0-a25b-26df9cb19644',
  'Ley 40/2015': '95680d57-6e5d-4ff7-85a9-9d09fd21de64'
};

function detectArticle(explanation, questionText) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();

  if (text.includes('40/2015') || text.includes('lrjsp')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
    if (artMatch) {
      return { law: 'Ley 40/2015', articleNumber: artMatch[1] };
    }
  }

  if (text.includes('39/2015') || text.includes('lpac') || text.includes('ley 39')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
    if (artMatch) {
      return { law: 'Ley 39/2015', articleNumber: artMatch[1] };
    }
  }

  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (artMatch) {
    const artNum = parseInt(artMatch[1]);
    if (artNum >= 34 && artNum <= 52) {
      return { law: 'Ley 39/2015', articleNumber: artMatch[1] };
    }
  }

  return null;
}

async function findArticle(law, articleNumber) {
  const lawId = LAWS[law];
  if (!lawId) return null;

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .single();

  return data;
}

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_2,_El_acto_administrativo';
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  console.log('=== PREGUNTAS SIN ARTÍCULO T302 ===\n');

  let count = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(basePath, file), 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      const detected = detectArticle(q.explanation, q.question);
      let hasArticle = false;

      if (detected) {
        const article = await findArticle(detected.law, detected.articleNumber);
        hasArticle = !!article;
      }

      if (!hasArticle) {
        count++;
        console.log('=' .repeat(70));
        console.log('#' + count + ' - ' + file.substring(0, 30));
        console.log('PREGUNTA:', q.question.substring(0, 100) + '...');
        console.log('RESPUESTA:', q.correctAnswer);
        console.log('EXPLICACIÓN:', (q.explanation || '').substring(0, 200));
        console.log('');
      }
    }
  }

  console.log('\nTotal sin artículo:', count);
})();
