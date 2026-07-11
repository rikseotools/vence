const { createClient } = require('./lib/pg-agnostic-client.cjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

(async () => {
  console.log('=== Revisando preguntas pendientes (versión rápida) ===\n');

  const dirs = fs.readdirSync(BASE_PATH).filter(d => {
    const stat = fs.statSync(path.join(BASE_PATH, d));
    return stat.isDirectory() && d !== 'ya subido';
  });

  const results = [];

  for (const dir of dirs) {
    const dirPath = path.join(BASE_PATH, dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    // Recopilar todas las preguntas del directorio
    const allQuestions = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
      const data = JSON.parse(content);
      for (const q of data.questions || []) {
        allQuestions.push(q);
      }
    }

    if (allQuestions.length === 0) continue;

    // Verificar solo la primera y última pregunta como muestra
    const samplesToCheck = [
      allQuestions[0],
      allQuestions[Math.floor(allQuestions.length / 2)],
      allQuestions[allQuestions.length - 1]
    ];

    let notFound = 0;
    const pending = [];

    for (const q of samplesToCheck) {
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('question_text', q.question);

      if (count === 0) {
        notFound++;
        pending.push({
          q: q.question.substring(0, 60),
          exp: (q.explanation || '').substring(0, 60)
        });
      }
    }

    if (notFound > 0) {
      // Si encontramos alguna no importada en la muestra, contar todas
      let totalNotFound = 0;
      for (const q of allQuestions) {
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('question_text', q.question);
        if (count === 0) totalNotFound++;
      }

      if (totalNotFound > 0) {
        results.push({
          dir: dir.substring(0, 55),
          total: allQuestions.length,
          pending: totalNotFound,
          examples: pending.slice(0, 2)
        });
        console.log(`❌ ${dir.substring(0, 40)}: ${totalNotFound}/${allQuestions.length} pendientes`);
      }
    } else {
      console.log(`✅ ${dir.substring(0, 40)}: OK`);
    }
  }

  console.log('\n=== RESUMEN ===');
  if (results.length === 0) {
    console.log('✅ Todas las preguntas están importadas!');
  } else {
    let total = 0;
    console.log('\nDirectorios con preguntas pendientes:');
    for (const r of results) {
      console.log(`\n📁 ${r.dir}`);
      console.log(`   Pendientes: ${r.pending} de ${r.total}`);
      r.examples.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.q}...`);
        if (e.exp) console.log(`      ${e.exp}...`);
      });
      total += r.pending;
    }
    console.log(`\n📊 TOTAL pendientes: ${total}`);
  }
})();
