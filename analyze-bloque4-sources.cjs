const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

// Mapeo de directorios a temas del Bloque IV
const BLOQUE_IV_DIRS = [
  'Tema_3,_Ley_392015,_Ley_402015_y_jurisdicción_contencioso-administrativa',
  'Tema_5,_Procedimientos_y_formas_de_la_actividad_administrativa',
  'Tema_6,_La_responsabilidad_patrimonial_de_las_Administraciones_públicas',
  'Tema_4,_Contratos_del_sector_público'
];

async function analyzeDirectory(dirName) {
  const dirPath = path.join(BASE_PATH, dirName);

  if (!fs.existsSync(dirPath)) {
    console.log('❌ No existe:', dirName);
    return { total: 0, notImported: [] };
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  let totalQuestions = 0;
  const notImported = [];

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      totalQuestions++;

      // Verificar si existe en BD
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('question_text', q.question);

      if (count === 0) {
        notImported.push({
          question: q.question.substring(0, 60) + '...',
          file: fileName.substring(0, 30),
          explanation: (q.explanation || '').substring(0, 100)
        });
      }
    }
  }

  return { total: totalQuestions, notImported };
}

(async () => {
  console.log('=== Análisis de fuentes Bloque IV ===\n');

  let totalNotImported = [];

  for (const dir of BLOQUE_IV_DIRS) {
    console.log('📁', dir.substring(0, 60));
    const result = await analyzeDirectory(dir);
    console.log('   Total en archivo:', result.total);
    console.log('   Sin importar:', result.notImported.length);

    if (result.notImported.length > 0) {
      totalNotImported = totalNotImported.concat(result.notImported.map(q => ({...q, dir})));
    }
    console.log('');
  }

  console.log('\n=== PREGUNTAS NO IMPORTADAS ===');
  console.log('Total:', totalNotImported.length);

  if (totalNotImported.length > 0) {
    console.log('\nEjemplos:');
    for (const q of totalNotImported.slice(0, 10)) {
      console.log('\n  Q:', q.question);
      console.log('  Explicación:', q.explanation);
    }
  }
})();
