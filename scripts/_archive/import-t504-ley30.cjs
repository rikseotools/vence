const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LEY_30_1984_ID = '9f60b1b4-0aa1-49bf-8757-b71ab261108a';
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_4,_Las_retribuciones_de_los_funcionarios_públicos_y_del_personal_laboral_al_servicio_de_la_Admi';
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  console.log('=== IMPORTANDO preguntas Ley 30/1984 para T504 ===\n');
  let totalImported = 0, totalSkipped = 0, totalNoArticle = 0;

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(basePath, fileName), 'utf8');
    const data = JSON.parse(content);
    const tag = fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 25);

    let fileImported = 0;

    for (const q of data.questions) {
      const text = ((q.explanation || '') + ' ' + (q.question || '')).toLowerCase();

      // Solo preguntas que mencionan Ley 30/1984
      if (!text.includes('30/1984')) continue;

      const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
      if (!artMatch) { totalNoArticle++; continue; }

      const { data: article } = await supabase.from('articles').select('id').eq('law_id', LEY_30_1984_ID).eq('article_number', artMatch[1]).single();
      if (!article) {
        console.log('  Art ' + artMatch[1] + ' no existe en Ley 30/1984');
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
        primary_article_id: article.id,
        difficulty: 'medium', is_active: true, is_official_exam: false,
        tags: [tag.trim(), 'T504', 'Bloque V']
      });

      if (error && (error.message.includes('duplicate') || error.message.includes('content_hash'))) {
        totalSkipped++;
      } else if (!error) {
        fileImported++;
        totalImported++;
      }
    }

    if (fileImported > 0) console.log('--- ' + tag + ': ✅', fileImported);
  }

  console.log('\nRESUMEN: ✅', totalImported, '⏭️', totalSkipped, '⚠️', totalNoArticle);

  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', ['T504']).eq('is_active', true);
  console.log('Total T504 en BD:', count);
})();
