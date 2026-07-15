const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LAWS = {
  'RDL 5/2015': 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',
  'RD 462/2002': 'fe0200cf-4de9-4c0d-863c-113c91bec5d8',
  'Ley 47/2003': 'effe3259-8168-43a0-9730-9923452205c4'
};
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_4,_Las_retribuciones_de_los_funcionarios_públicos_y_del_personal_laboral_al_servicio_de_la_Admi';
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  console.log('=== IMPORTANDO T504: Retribuciones e Indemnizaciones ===\n');
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

      // Determinar ley según contenido
      let lawId = LAWS['RDL 5/2015']; // TREBEP por defecto (retribuciones)
      if (text.includes('462/2002') || text.includes('indemnizacion') || fileName.includes('indemniza')) {
        lawId = LAWS['RD 462/2002'];
      } else if (text.includes('47/2003') || fileName.includes('Nóminas') || text.includes('nómina')) {
        lawId = LAWS['Ley 47/2003'];
      }

      // Intentar encontrar artículo en la ley seleccionada, luego en otras
      let article = null;
      const { data: art } = await supabase.from('articles').select('id').eq('law_id', lawId).eq('article_number', artMatch[1]).single();
      if (art) {
        article = art;
      } else {
        // Fallback: buscar en otras leyes
        for (const otherId of Object.values(LAWS)) {
          if (otherId === lawId) continue;
          const { data: otherArt } = await supabase.from('articles').select('id').eq('law_id', otherId).eq('article_number', artMatch[1]).single();
          if (otherArt) { article = otherArt; break; }
        }
      }
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
        tags: [tag.trim(), 'T504', 'Bloque V']
      });

      if (error && (error.message.includes('duplicate') || error.message.includes('content_hash'))) fileSkipped++;
      else if (!error) fileImported++;
    }

    console.log('  ✅', fileImported, fileSkipped > 0 ? '⏭️' + fileSkipped : '', fileNoArticle > 0 ? '⚠️' + fileNoArticle : '');
    totalImported += fileImported; totalSkipped += fileSkipped; totalNoArticle += fileNoArticle;
  }

  console.log('\nRESUMEN T504: ✅', totalImported, '⏭️', totalSkipped, '⚠️', totalNoArticle);
  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', ['T504']).eq('is_active', true);
  console.log('Total T504 en BD:', count);
})();
