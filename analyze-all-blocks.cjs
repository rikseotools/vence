const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

async function analyzeAllDirectories() {
  const allDirs = fs.readdirSync(BASE_PATH).filter(f =>
    fs.statSync(path.join(BASE_PATH, f)).isDirectory() && f.startsWith('Tema_')
  );

  console.log('=== ANÁLISIS COMPLETO DE TODOS LOS BLOQUES ===\n');
  console.log('Total directorios:', allDirs.length);

  let grandTotalInFiles = 0;
  let grandTotalNotImported = 0;
  const notImportedByDir = {};

  for (const dir of allDirs) {
    const dirPath = path.join(BASE_PATH, dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    let totalInDir = 0;
    let notImportedInDir = 0;
    const samples = [];

    for (const fileName of files) {
      try {
        const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
        const data = JSON.parse(content);

        for (const q of data.questions) {
          totalInDir++;

          const { count } = await supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('question_text', q.question);

          if (count === 0) {
            notImportedInDir++;
            if (samples.length < 3) {
              samples.push({
                question: q.question.substring(0, 60),
                explanation: (q.explanation || '').substring(0, 80)
              });
            }
          }
        }
      } catch (e) {
        // Skip errors
      }
    }

    grandTotalInFiles += totalInDir;
    grandTotalNotImported += notImportedInDir;

    if (notImportedInDir > 0) {
      notImportedByDir[dir] = { count: notImportedInDir, samples };
      console.log('⚠️', dir.substring(0, 60));
      console.log('   En archivos:', totalInDir, '| Sin importar:', notImportedInDir);
    } else if (totalInDir > 0) {
      console.log('✅', dir.substring(0, 60), '- OK (' + totalInDir + ')');
    }
  }

  console.log('\n========================================');
  console.log('RESUMEN TOTAL:');
  console.log('  Preguntas en archivos:', grandTotalInFiles);
  console.log('  Preguntas sin importar:', grandTotalNotImported);
  console.log('========================================');

  if (grandTotalNotImported > 0) {
    console.log('\n=== DIRECTORIOS CON PREGUNTAS PENDIENTES ===\n');
    for (const [dir, info] of Object.entries(notImportedByDir)) {
      console.log('\n📁', dir.substring(0, 55));
      console.log('   Pendientes:', info.count);
      for (const s of info.samples) {
        console.log('   - Q:', s.question);
        console.log('     Exp:', s.explanation);
      }
    }
  }
}

analyzeAllDirectories();
