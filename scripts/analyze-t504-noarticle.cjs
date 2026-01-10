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

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_4,_Las_retribuciones_de_los_funcionarios_públicos_y_del_personal_laboral_al_servicio_de_la_Admi';
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  let noMatch = [];
  let notFound = [];

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(basePath, fileName), 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      const text = ((q.explanation || '') + ' ' + (q.question || '')).toLowerCase();
      const artMatch = text.match(/art[íi]culo\s+(\d+)/i);

      if (!artMatch) {
        noMatch.push({ file: fileName, q: q.question.substring(0, 60), exp: (q.explanation || '').substring(0, 80) });
      } else {
        // Tiene artículo, verificar si existe
        let found = false;
        for (const lawId of Object.values(LAWS)) {
          const { data: art } = await supabase.from('articles').select('id').eq('law_id', lawId).eq('article_number', artMatch[1]).single();
          if (art) { found = true; break; }
        }
        if (!found) {
          notFound.push({ file: fileName, artNum: artMatch[1], q: q.question.substring(0, 60) });
        }
      }
    }
  }

  console.log('=== SIN MENCIÓN DE ARTÍCULO (' + noMatch.length + ') ===\n');
  noMatch.forEach((item, i) => {
    console.log((i+1) + '. [' + item.file.substring(0, 15) + ']');
    console.log('   Q: ' + item.q);
    console.log('   E: ' + item.exp);
    console.log();
  });

  console.log('\n=== ARTÍCULO NO ENCONTRADO EN BD (' + notFound.length + ') ===\n');
  notFound.forEach((item, i) => {
    console.log((i+1) + '. Art ' + item.artNum + ' [' + item.file.substring(0, 15) + ']');
    console.log('   Q: ' + item.q);
    console.log();
  });
})();
