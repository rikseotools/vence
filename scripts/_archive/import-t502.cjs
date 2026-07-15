const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LAWS = { 'Ley 47/2003': 'effe3259-8168-43a0-9730-9923452205c4' };
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_2,_El_presupuesto_del_Estado_en_España,_créditos_presupuestarios_y_sus_modificaciones';
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  console.log('=== IMPORTANDO T502: Presupuesto del Estado ===\n');
  let totalImported = 0, totalSkipped = 0, totalNoArticle = 0;

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(basePath, fileName), 'utf8');
    const data = JSON.parse(content);
    const tag = fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 25);
    console.log('--- ' + tag + ' (' + data.questions.length + ') ---');

    let fileImported = 0, fileSkipped = 0, fileNoArticle = 0;

    for (const q of data.questions) {
      const text = ((q.explanation || '') + ' ' + (q.question || '')).toLowerCase();
      const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
      if (!artMatch) { fileNoArticle++; continue; }

      const { data: article } = await supabase.from('articles').select('id').eq('law_id', LAWS['Ley 47/2003']).eq('article_number', artMatch[1]).single();
      if (!article) { fileNoArticle++; continue; }

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
        tags: [tag.trim(), 'T502', 'Bloque V']
      });

      if (error && (error.message.includes('duplicate') || error.message.includes('content_hash'))) fileSkipped++;
      else if (!error) fileImported++;
    }

    console.log('  ✅', fileImported, fileSkipped > 0 ? '⏭️' + fileSkipped : '', fileNoArticle > 0 ? '⚠️' + fileNoArticle : '');
    totalImported += fileImported; totalSkipped += fileSkipped; totalNoArticle += fileNoArticle;
  }

  console.log('\nRESUMEN T502: ✅', totalImported, '⏭️', totalSkipped, '⚠️', totalNoArticle);
  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', ['T502']).eq('is_active', true);
  console.log('Total T502 en BD:', count);
})();
