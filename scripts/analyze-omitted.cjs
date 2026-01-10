const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Patrones para detectar leyes
const LAW_PATTERNS = [
  { pattern: /ley\s+30\/1984/i, name: 'Ley 30/1984' },
  { pattern: /ley\s+47\/2003/i, name: 'Ley 47/2003' },
  { pattern: /rdl?\s*5\/2015|trebep/i, name: 'RDL 5/2015' },
  { pattern: /rdl?\s*2\/2015|estatuto.*trabajadores/i, name: 'RDL 2/2015' },
  { pattern: /rdl?\s*8\/2015|seguridad\s+social/i, name: 'RDL 8/2015' },
  { pattern: /rd\s*462\/2002|indemnizacion/i, name: 'RD 462/2002' },
  { pattern: /orden.*30.*julio.*1992|confección.*nómina/i, name: 'Orden 30/07/1992' },
  { pattern: /orden.*1.*febrero.*1996|operatoria\s+contable/i, name: 'Orden 01/02/1996' },
  { pattern: /instrucción.*operatoria/i, name: 'Orden 01/02/1996' },
  { pattern: /ley\s+39\/2015|lpac/i, name: 'Ley 39/2015' },
  { pattern: /ley\s+40\/2015|lrjsp/i, name: 'Ley 40/2015' },
  { pattern: /ley\s+9\/2017|lcsp|contrat/i, name: 'Ley 9/2017' },
  { pattern: /ley\s+53\/1984|incompatibilidad/i, name: 'Ley 53/1984' },
  { pattern: /rdl?\s*4\/2000|clases\s+pasivas/i, name: 'RDL 4/2000' },
  { pattern: /rd\s*375\/2003|muface/i, name: 'RD 375/2003' },
  { pattern: /constitución|ce\b/i, name: 'CE' },
];

async function analyzeFolder(folderPath, tag) {
  if (!fs.existsSync(folderPath)) {
    console.log(`Carpeta no encontrada: ${folderPath}`);
    return;
  }

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`ANALIZANDO ${tag}`);
  console.log(`${'='.repeat(60)}`);

  const omitted = [];

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(folderPath, fileName), 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      // Verificar si ya existe en BD
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('question_text', q.question);

      if (count > 0) continue; // Ya importada

      const text = ((q.explanation || '') + ' ' + (q.question || '')).toLowerCase();

      // Detectar artículo
      const artMatch = text.match(/art[íi]culo\s+(\d+)/i) ||
                       text.match(/art\.\s*(\d+)/i) ||
                       text.match(/regla\s+(\d+)/i);

      // Detectar ley
      let detectedLaw = null;
      for (const lp of LAW_PATTERNS) {
        if (lp.pattern.test(text)) {
          detectedLaw = lp.name;
          break;
        }
      }

      omitted.push({
        file: fileName.substring(0, 30),
        question: q.question.substring(0, 60),
        article: artMatch ? artMatch[1] : null,
        law: detectedLaw,
        explanation: (q.explanation || '').substring(0, 80),
        fullQuestion: q
      });
    }
  }

  // Agrupar por ley detectada
  const byLaw = {};
  for (const item of omitted) {
    const key = item.law || 'SIN LEY DETECTADA';
    if (!byLaw[key]) byLaw[key] = [];
    byLaw[key].push(item);
  }

  console.log(`\nPreguntas omitidas: ${omitted.length}`);
  console.log('\nAgrupadas por ley:');
  for (const [law, items] of Object.entries(byLaw)) {
    console.log(`\n  ${law}: ${items.length} preguntas`);
    items.slice(0, 3).forEach((item, i) => {
      console.log(`    ${i+1}. Art ${item.article || '?'}: ${item.question}...`);
    });
    if (items.length > 3) console.log(`    ... y ${items.length - 3} más`);
  }

  return { tag, omitted, byLaw };
}

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

  // Analizar T504
  await analyzeFolder(
    path.join(basePath, 'Tema_4,_Las_retribuciones_de_los_funcionarios_públicos_y_del_personal_laboral_al_servicio_de_la_Admi'),
    'T504'
  );
})();
