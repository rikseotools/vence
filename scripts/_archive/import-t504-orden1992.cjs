const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORDEN_1992_ID = '2cf0662c-a855-4c23-92b3-47e463f774c9';
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function detectArticle(text) {
  text = text.toLowerCase();
  // Detectar "Art. 3.1", "Art. 5.1.3", etc. - captura solo el número principal
  let match = text.match(/art\.\s*(\d+)(?:\.\d+)*/i);
  if (match) return match[1];

  match = text.match(/art[íi]culo\s+(\d+)/i);
  if (match) return match[1];

  return null;
}

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_4,_Las_retribuciones_de_los_funcionarios_públicos_y_del_personal_laboral_al_servicio_de_la_Admi';
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  console.log('=== IMPORTANDO preguntas Orden 30/07/1992 para T504 ===\n');
  let totalImported = 0, totalSkipped = 0, totalNoArticle = 0;

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(basePath, fileName), 'utf8');
    const data = JSON.parse(content);
    const tag = fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 25);

    for (const q of data.questions) {
      const text = ((q.explanation || '') + ' ' + (q.question || '')).toLowerCase();

      // Solo preguntas que mencionan Orden 30/07/1992
      if (!text.includes('30 de julio de 1992') && !text.includes('confección de nómina')) continue;
      // Excluir las que ya son de otra ley
      if (text.includes('30/1984') || text.includes('1 de febrero de 1996')) continue;

      // Verificar si ya existe
      const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('question_text', q.question);
      if (count > 0) { totalSkipped++; continue; }

      const artNum = detectArticle(q.explanation || '');

      let articleId = null;
      if (artNum) {
        const { data: article } = await supabase.from('articles').select('id').eq('law_id', ORDEN_1992_ID).eq('article_number', artNum).single();
        if (article) articleId = article.id;
      }

      if (!articleId) {
        // Asignar artículo genérico basado en contenido
        if (text.includes('alta') || text.includes('nuevo ingreso')) {
          const { data: a } = await supabase.from('articles').select('id').eq('law_id', ORDEN_1992_ID).eq('article_number', '2').single();
          if (a) articleId = a.id;
        } else if (text.includes('baja')) {
          const { data: a } = await supabase.from('articles').select('id').eq('law_id', ORDEN_1992_ID).eq('article_number', '3').single();
          if (a) articleId = a.id;
        } else if (text.includes('nómina')) {
          const { data: a } = await supabase.from('articles').select('id').eq('law_id', ORDEN_1992_ID).eq('article_number', '5').single();
          if (a) articleId = a.id;
        }
      }

      if (!articleId) {
        console.log('  Sin artículo: ' + q.question.substring(0, 50) + '...');
        totalNoArticle++;
        continue;
      }

      const { error } = await supabase.from('questions').insert({
        question_text: q.question,
        option_a: q.options.find(o => o.letter === 'A')?.text || '',
        option_b: q.options.find(o => o.letter === 'B')?.text || '',
        option_c: q.options.find(o => o.letter === 'C')?.text || '',
        option_d: q.options.find(o => o.letter === 'D')?.text || '',
        correct_option: LETTER_TO_INDEX[q.correctAnswer],
        explanation: q.explanation || '',
        primary_article_id: articleId,
        difficulty: 'medium', is_active: true, is_official_exam: false,
        tags: [tag.trim(), 'T504', 'Bloque V']
      });

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('content_hash')) totalSkipped++;
        else console.log('  Error:', error.message.substring(0, 50));
      } else {
        totalImported++;
        console.log('  ✅ ' + q.question.substring(0, 50) + '...');
      }
    }
  }

  console.log('\nRESUMEN: ✅', totalImported, '⏭️', totalSkipped, '⚠️', totalNoArticle);

  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', ['T504']).eq('is_active', true);
  console.log('Total T504 en BD:', count);
})();
