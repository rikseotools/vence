const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

(async () => {
  console.log('=== Revisando preguntas NO importadas por directorio ===\n');

  const dirs = fs.readdirSync(BASE_PATH).filter(d => {
    const stat = fs.statSync(path.join(BASE_PATH, d));
    return stat.isDirectory() && d !== 'ya subido';
  });

  const summary = [];

  for (const dir of dirs) {
    const dirPath = path.join(BASE_PATH, dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    let totalInFiles = 0;
    let notInDB = 0;
    const pendingQuestions = [];

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
          notInDB++;
          if (pendingQuestions.length < 3) {
            pendingQuestions.push({
              question: q.question.substring(0, 60),
              explanation: (q.explanation || '').substring(0, 80)
            });
          }
        }
      }
    }

    if (notInDB > 0) {
      summary.push({
        dir: dir.substring(0, 50),
        total: totalInFiles,
        pending: notInDB,
        examples: pendingQuestions
      });
    }
  }

  // Mostrar resumen
  if (summary.length === 0) {
    console.log('✅ Todas las preguntas están importadas!');
  } else {
    console.log(`❌ ${summary.length} directorios con preguntas pendientes:\n`);

    let totalPending = 0;
    for (const s of summary) {
      console.log(`📁 ${s.dir}`);
      console.log(`   Total: ${s.total}, Pendientes: ${s.pending}`);
      totalPending += s.pending;

      if (s.examples.length > 0) {
        console.log('   Ejemplos:');
        s.examples.forEach((e, i) => {
          console.log(`   ${i + 1}. ${e.question}...`);
          if (e.explanation) {
            console.log(`      Exp: ${e.explanation}...`);
          }
        });
      }
      console.log('');
    }

    console.log(`\n📊 TOTAL preguntas pendientes: ${totalPending}`);
  }
})();
