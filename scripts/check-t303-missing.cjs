const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const LAWS = {
  'Ley 39/2015': '218452f5-b9f6-48f0-a25b-26df9cb19644',
  'Ley 40/2015': '95680d57-feb1-41c0-bb27-236024815feb',
  'Ley 29/1998': '07daa1fe-7e8e-4e2d-9a33-6893229869e0'
};

async function main() {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_3,_Ley_392015,_Ley_402015_y_jurisdicción_contencioso-administrativa';

  const files = [
    'La_jurisdicción_contencioso-administrativa.json',
    'Los_recursos_administrativos.json',
    'Conceptos_generales_de_las_Leyes_del_Procedimiento_Administrativo_Común_de_las_Administraciones_Públ.json'
  ];

  const missingArticles = {};
  const questionsWithoutArticle = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(basePath, file), 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      const text = ((q.explanation || '') + ' ' + (q.question || '')).toLowerCase();
      const artMatch = text.match(/art[íi]culo\s+(\d+)/i);

      if (!artMatch) {
        questionsWithoutArticle.push({ file, question: q.question.substring(0, 60) });
        continue;
      }

      const artNum = artMatch[1];
      let law = 'Ley 39/2015';

      if (text.includes('29/1998') || text.includes('ljca') || text.includes('contencioso-administrativa') || text.includes('contencioso administrativa')) {
        law = 'Ley 29/1998';
      } else if (text.includes('40/2015') || text.includes('lrjsp')) {
        law = 'Ley 40/2015';
      }

      // Verificar si el artículo existe
      const { data: article } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', LAWS[law])
        .eq('article_number', artNum)
        .single();

      if (!article) {
        const key = law + ' Art.' + artNum;
        if (!missingArticles[key]) {
          missingArticles[key] = { count: 0, questions: [] };
        }
        missingArticles[key].count++;
        missingArticles[key].questions.push(q.question.substring(0, 50));
      }
    }
  }

  console.log('=== ARTÍCULOS FALTANTES EN BD ===\n');

  const sorted = Object.entries(missingArticles).sort((a, b) => b[1].count - a[1].count);
  sorted.forEach(([key, data]) => {
    console.log(data.count + 'x', key);
  });

  console.log('\n=== PREGUNTAS SIN MENCIÓN DE ARTÍCULO ===');
  console.log('Total:', questionsWithoutArticle.length);
}

main();
