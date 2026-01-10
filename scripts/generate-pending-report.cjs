const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

// Directorios de informática (excluir)
const INFORMATICA_DIRS = [
  'Tema_1._Informática_básica',
  'Tema_4._Procesadores_de_texto',
  'Tema_5._Hojas_de_cálculo',
  'Tema_6._Bases_de_datos',
  'Tema_7._Correo_electrónico',
  'Tema_8._La_Red_Internet'
];

// Patrones para detectar leyes
function detectLawReference(text) {
  const textLower = text.toLowerCase();
  const refs = [];

  // Constitución
  if (textLower.includes('constitución española') || textLower.match(/art[íi]culo\s+\d+.*c\.?e\.?/i)) {
    const artMatch = textLower.match(/art[íi]culo\s+(\d+)/i) || textLower.match(/art\.\s*(\d+)/i);
    refs.push({ law: 'Constitución Española', article: artMatch ? artMatch[1] : null });
  }

  // Leyes específicas
  const lawPatterns = [
    { pattern: /ley\s+39\/2015/i, name: 'Ley 39/2015 LPAC' },
    { pattern: /ley\s+40\/2015/i, name: 'Ley 40/2015 LRJSP' },
    { pattern: /ley\s+50\/1997/i, name: 'Ley 50/1997 Gobierno' },
    { pattern: /ley\s+7\/1985/i, name: 'Ley 7/1985 LBRL' },
    { pattern: /ley\s+19\/2013/i, name: 'Ley 19/2013 Transparencia' },
    { pattern: /ley\s+53\/1984/i, name: 'Ley 53/1984 Incompatibilidades' },
    { pattern: /ley\s+47\/2003/i, name: 'Ley 47/2003 LGP' },
    { pattern: /ley\s+30\/1984/i, name: 'Ley 30/1984' },
    { pattern: /ley\s+2\/2014/i, name: 'Ley 2/2014 Acción Exterior' },
    { pattern: /lo\s*6\/1985|ley\s+org[áa]nica\s+6\/1985/i, name: 'LO 6/1985 LOPJ' },
    { pattern: /trebep|rdl?\s*5\/2015/i, name: 'RDL 5/2015 TREBEP' },
    { pattern: /rd\s*364\/1995/i, name: 'RD 364/1995' },
    { pattern: /rd\s*365\/1995/i, name: 'RD 365/1995' },
    { pattern: /rd\s*208\/1996/i, name: 'RD 208/1996' },
    { pattern: /rd\s*349\/2001/i, name: 'RD 349/2001' },
    { pattern: /rdl?\s*670\/1987/i, name: 'RDL 670/1987 Clases Pasivas' },
    { pattern: /rdl?\s*1\/2013/i, name: 'RDL 1/2013 Discapacidad' },
    { pattern: /rdl?\s*6\/2023/i, name: 'RDL 6/2023' },
    { pattern: /orden\s+1\s+de\s+febrero\s+de\s+1996|orden\s+01\/02\/1996/i, name: 'Orden 01/02/1996' },
    { pattern: /orden\s+apu\/1461\/2002/i, name: 'Orden APU/1461/2002' },
    { pattern: /orden\s+hfp\/134\/2018/i, name: 'Orden HFP/134/2018' },
    { pattern: /tfue|tratado\s+de\s+funcionamiento/i, name: 'TFUE' },
    { pattern: /iv\s+convenio\s+[úu]nico/i, name: 'IV Convenio Único' }
  ];

  for (const { pattern, name } of lawPatterns) {
    if (pattern.test(textLower)) {
      const artMatch = textLower.match(/art[íi]culo\s+(\d+)/i) || textLower.match(/art\.\s*(\d+)/i);
      refs.push({ law: name, article: artMatch ? artMatch[1] : null });
    }
  }

  return refs.length > 0 ? refs : [{ law: 'NO DETECTADA', article: null }];
}

async function generateReport() {
  const allDirs = fs.readdirSync(BASE_PATH).filter(f =>
    fs.statSync(path.join(BASE_PATH, f)).isDirectory() &&
    f.startsWith('Tema_') &&
    !INFORMATICA_DIRS.includes(f)
  );

  const report = {
    generated: new Date().toISOString(),
    summary: { total: 0, byLaw: {} },
    questions: []
  };

  console.log('Analizando directorios (excluyendo informática)...\n');

  for (const dir of allDirs) {
    const dirPath = path.join(BASE_PATH, dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    for (const fileName of files) {
      try {
        const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
        const data = JSON.parse(content);

        for (const q of data.questions) {
          // Verificar si ya existe
          const { count } = await supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('question_text', q.question);

          if (count === 0) {
            const lawRefs = detectLawReference((q.explanation || '') + ' ' + (q.question || ''));

            report.questions.push({
              directory: dir,
              file: fileName,
              question: q.question,
              explanation: q.explanation || '',
              options: q.options,
              correctAnswer: q.correctAnswer,
              detectedLaws: lawRefs
            });

            report.summary.total++;

            for (const ref of lawRefs) {
              report.summary.byLaw[ref.law] = (report.summary.byLaw[ref.law] || 0) + 1;
            }
          }
        }
      } catch (e) {
        // Skip
      }
    }

    process.stdout.write('.');
  }

  console.log('\n\nGenerando informe...');

  // Guardar informe JSON
  fs.writeFileSync(
    '/home/manuel/Documentos/github/vence/docs/pending-questions-report.json',
    JSON.stringify(report, null, 2)
  );

  // Generar resumen legible
  let summary = `# Preguntas Pendientes de Importar\n\n`;
  summary += `Generado: ${report.generated}\n\n`;
  summary += `## Resumen\n\n`;
  summary += `**Total: ${report.summary.total} preguntas**\n\n`;
  summary += `### Por Ley Referenciada:\n\n`;

  const sortedLaws = Object.entries(report.summary.byLaw).sort((a, b) => b[1] - a[1]);
  for (const [law, count] of sortedLaws) {
    summary += `- ${law}: ${count}\n`;
  }

  summary += `\n## Preguntas por Directorio\n\n`;

  const byDir = {};
  for (const q of report.questions) {
    if (!byDir[q.directory]) byDir[q.directory] = [];
    byDir[q.directory].push(q);
  }

  for (const [dir, questions] of Object.entries(byDir)) {
    summary += `### ${dir}\n\n`;
    summary += `**${questions.length} preguntas pendientes**\n\n`;

    for (let i = 0; i < Math.min(5, questions.length); i++) {
      const q = questions[i];
      summary += `${i + 1}. **Q:** ${q.question.substring(0, 100)}...\n`;
      summary += `   **Ley:** ${q.detectedLaws.map(r => r.law + (r.article ? ' Art.' + r.article : '')).join(', ')}\n\n`;
    }

    if (questions.length > 5) {
      summary += `... y ${questions.length - 5} más\n\n`;
    }
  }

  fs.writeFileSync(
    '/home/manuel/Documentos/github/vence/docs/pending-questions-report.md',
    summary
  );

  console.log('\n✅ Informes generados:');
  console.log('   - docs/pending-questions-report.json (completo)');
  console.log('   - docs/pending-questions-report.md (resumen)');
  console.log('\nTotal preguntas pendientes:', report.summary.total);
  console.log('\nPor ley:');
  for (const [law, count] of sortedLaws.slice(0, 15)) {
    console.log(`  - ${law}: ${count}`);
  }
}

generateReport();
