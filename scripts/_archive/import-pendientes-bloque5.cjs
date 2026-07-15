const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

const LAWS = {
  LGP: 'effe3259-8168-43a0-9730-9923452205c4',       // Ley 47/2003 General Presupuestaria
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941'
};

const TEMAS = [
  { dir: 'Tema_1,_Concepto_y_aspectos_generales_del_presupuesto', tag: 'T501', bloque: 'Bloque V' },
  { dir: 'Tema_2,_El_presupuesto_del_Estado_en_España', tag: 'T502', bloque: 'Bloque V' }
];

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // Ley 47/2003 - LGP
  if (textLower.includes('47/2003') || textLower.includes('ley 47') ||
      textLower.includes('ley general presupuestaria') || textLower.includes('lgp')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LGP', article: artMatch ? artMatch[1] : null };
  }

  // CE
  if (textLower.includes('constitución') || textLower.includes(' ce')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
  }

  return { lawKey: null, article: null };
}

async function importDir(dirPath, tag, bloque) {
  if (!fs.existsSync(dirPath)) return { imported: 0, skipped: 0, errors: [] };

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  let imported = 0, skipped = 0;
  const errors = [];

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
    const data = JSON.parse(content);
    const subtema = data.subtema || fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 30);

    for (const q of data.questions) {
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('question_text', q.question);

      if (count > 0) { skipped++; continue; }

      const text = (q.explanation || '') + ' ' + (q.question || '');
      const { lawKey, article } = detectLawAndArticle(text);

      if (!lawKey || !article) {
        errors.push({ q: q.question.substring(0, 40), reason: 'No detectado' });
        continue;
      }

      const lawId = LAWS[lawKey];
      if (!lawId) { errors.push({ q: q.question.substring(0, 40), reason: lawKey }); continue; }

      const { data: art } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', lawId)
        .eq('article_number', article)
        .eq('is_active', true)
        .single();

      if (!art) {
        errors.push({ q: q.question.substring(0, 40), reason: `${lawKey} Art.${article}` });
        continue;
      }

      const { error } = await supabase.from('questions').insert({
        question_text: q.question,
        option_a: q.options.find(o => o.letter === 'A')?.text || '',
        option_b: q.options.find(o => o.letter === 'B')?.text || '',
        option_c: q.options.find(o => o.letter === 'C')?.text || '',
        option_d: q.options.find(o => o.letter === 'D')?.text || '',
        correct_option: LETTER_TO_INDEX[q.correctAnswer],
        explanation: q.explanation || '',
        primary_article_id: art.id,
        difficulty: 'medium',
        is_active: true,
        is_official_exam: false,
        tags: [subtema.trim(), tag, bloque]
      });

      if (!error) {
        imported++;
        console.log('  ✅', lawKey, 'Art', article);
      }
    }
  }

  return { imported, skipped, errors };
}

(async () => {
  console.log('=== Importando temas pendientes Bloque V ===\n');

  for (const tema of TEMAS) {
    const dirPath = `/home/manuel/Documentos/github/vence/preguntas-para-subir/${tema.dir}`;
    console.log(`📁 ${tema.tag} - ${tema.dir.split(',')[1]?.trim() || ''}`);

    const result = await importDir(dirPath, tema.tag, tema.bloque);
    console.log(`   +${result.imported}, omitidas ${result.skipped}, errores ${result.errors.length}`);

    const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', [tema.tag]).eq('is_active', true);
    console.log(`   Total ${tema.tag}: ${count}\n`);
  }
})();
