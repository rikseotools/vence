const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

(async () => {
  console.log('=== Verificando preguntas NO importadas ===\n');

  const dirs = fs.readdirSync(BASE_PATH).filter(d => {
    const stat = fs.statSync(path.join(BASE_PATH, d));
    return stat.isDirectory() && d !== 'ya subido';
  });

  let totalInFiles = 0;
  let totalNotInDB = 0;
  const notImported = [];

  for (const dir of dirs) {
    const dirPath = path.join(BASE_PATH, dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
      const data = JSON.parse(content);

      for (const q of data.questions || []) {
        totalInFiles++;

        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('question_text', q.question);

        if (count === 0) {
          totalNotInDB++;
          if (notImported.length < 10) {
            notImported.push({
              dir: dir.substring(0, 40),
              question: q.question.substring(0, 60)
            });
          }
        }
      }
    }
  }

  console.log('Total preguntas en archivos JSON:', totalInFiles);
  console.log('Preguntas NO en BD:', totalNotInDB);
  console.log('Preguntas YA en BD:', totalInFiles - totalNotInDB);

  if (notImported.length > 0) {
    console.log('\nEjemplos de preguntas NO importadas:');
    notImported.forEach((n, i) => {
      console.log(`${i + 1}. [${n.dir}]`);
      console.log(`   ${n.question}...`);
    });
  }
})();
