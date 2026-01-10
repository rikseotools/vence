const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

// Bloque IV para C1 Administrativo incluye:
// T401: Ley 39/2015 LPAC - Procedimiento administrativo común
// T402: Ley 40/2015 LRJSP - Régimen jurídico sector público
// T403: Recursos administrativos, revisión de oficio, jurisdicción contencioso-administrativa
// T404: Contratos del sector público
// T405: Procedimientos y formas de actividad administrativa (fomento, servicio público, etc.)
// T406: Responsabilidad patrimonial
// T407: Potestad sancionadora
// T408: Expropiación forzosa
// T409: Jurisdicción contencioso-administrativa

// Buscar TODOS los directorios que podrían ser Bloque IV
const POSSIBLE_BLOQUE_IV_KEYWORDS = [
  'procedimiento', 'administrativ', '39/2015', '392015', '40/2015', '402015',
  'contrat', 'sector público', 'responsabilidad', 'patrimonial', 'sancion',
  'expropiación', 'contencioso', '29/1998', 'fomento', 'servicio público',
  'recurso', 'alzada', 'reposición', 'revisión'
];

async function findAllBloqueIVDirs() {
  const allDirs = fs.readdirSync(BASE_PATH).filter(f =>
    fs.statSync(path.join(BASE_PATH, f)).isDirectory()
  );

  const bloqueIVDirs = [];

  for (const dir of allDirs) {
    const dirLower = dir.toLowerCase();
    for (const kw of POSSIBLE_BLOQUE_IV_KEYWORDS) {
      if (dirLower.includes(kw.toLowerCase())) {
        bloqueIVDirs.push(dir);
        break;
      }
    }
  }

  return bloqueIVDirs;
}

async function analyzeDirectory(dirName) {
  const dirPath = path.join(BASE_PATH, dirName);
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

  let totalInFile = 0;
  const notImported = [];

  for (const fileName of files) {
    try {
      const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
      const data = JSON.parse(content);

      for (const q of data.questions) {
        totalInFile++;

        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('question_text', q.question);

        if (count === 0) {
          notImported.push({
            question: q.question.substring(0, 80),
            explanation: (q.explanation || '').substring(0, 150),
            file: fileName
          });
        }
      }
    } catch (e) {
      console.log('  Error leyendo', fileName, e.message);
    }
  }

  return { totalInFile, notImported };
}

(async () => {
  console.log('=== ANÁLISIS COMPLETO BLOQUE IV ===\n');

  const dirs = await findAllBloqueIVDirs();
  console.log('Directorios encontrados que podrían ser Bloque IV:', dirs.length);
  console.log('');

  let grandTotalInFiles = 0;
  let grandTotalNotImported = [];

  for (const dir of dirs) {
    console.log('📁', dir.substring(0, 70));
    const result = await analyzeDirectory(dir);
    console.log('   En archivos:', result.totalInFile, '| Sin importar:', result.notImported.length);

    grandTotalInFiles += result.totalInFile;

    if (result.notImported.length > 0) {
      grandTotalNotImported = grandTotalNotImported.concat(
        result.notImported.map(q => ({ ...q, dir }))
      );
    }
  }

  console.log('\n========================================');
  console.log('RESUMEN TOTAL:');
  console.log('  Preguntas en archivos fuente:', grandTotalInFiles);
  console.log('  Preguntas NO importadas:', grandTotalNotImported.length);
  console.log('========================================\n');

  if (grandTotalNotImported.length > 0) {
    console.log('=== PREGUNTAS SIN IMPORTAR ===\n');

    // Agrupar por directorio
    const byDir = {};
    for (const q of grandTotalNotImported) {
      if (!byDir[q.dir]) byDir[q.dir] = [];
      byDir[q.dir].push(q);
    }

    for (const [dir, questions] of Object.entries(byDir)) {
      console.log('\n📁', dir.substring(0, 60));
      console.log('   Sin importar:', questions.length);

      for (const q of questions.slice(0, 5)) {
        console.log('\n   Q:', q.question);
        console.log('   Exp:', q.explanation);
      }

      if (questions.length > 5) {
        console.log('\n   ... y', questions.length - 5, 'más');
      }
    }
  } else {
    console.log('✅ TODAS las preguntas de Bloque IV están importadas');
  }
})();
