const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs de las leyes
const LAWS = {
  'Ley 39/2015': '218452f5-b9f6-48f0-a25b-26df9cb19644',
  'Ley 40/2015': '95680d57-6e5d-4ff7-85a9-9d09fd21de64'
};

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Función para detectar ley y artículo
function detectArticle(explanation, questionText) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();

  // Detectar Ley 40/2015
  if (text.includes('40/2015') || text.includes('lrjsp')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
    if (artMatch) {
      return { law: 'Ley 40/2015', articleNumber: artMatch[1] };
    }
  }

  // Detectar Ley 39/2015 (LPAC) - más común para acto administrativo
  if (text.includes('39/2015') || text.includes('lpac') || text.includes('ley 39')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
    if (artMatch) {
      return { law: 'Ley 39/2015', articleNumber: artMatch[1] };
    }
  }

  // Si no especifica ley pero tiene artículo, asumir Ley 39/2015
  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (artMatch) {
    const artNum = parseInt(artMatch[1]);
    // Arts relevantes para acto administrativo en Ley 39/2015
    if (artNum >= 34 && artNum <= 52) {
      return { law: 'Ley 39/2015', articleNumber: artMatch[1] };
    }
  }

  return null;
}

async function findArticle(law, articleNumber) {
  const lawId = LAWS[law];
  if (!lawId) return null;

  const { data } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .single();

  return data;
}

async function importFile(filePath, tags) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  console.log('\n=== Importando: ' + path.basename(filePath).substring(0, 50) + ' ===');
  console.log('Total preguntas:', data.questions.length);
  console.log('Tags:', tags.join(', '));

  let imported = 0;
  let skipped = 0;
  let noArticle = 0;

  for (const q of data.questions) {
    const detected = detectArticle(q.explanation, q.question);
    let articleId = null;

    if (detected) {
      const article = await findArticle(detected.law, detected.articleNumber);
      if (article) {
        articleId = article.id;
      }
    }

    if (!articleId) {
      noArticle++;
      continue;
    }

    const questionData = {
      question_text: q.question,
      option_a: q.options.find(o => o.letter === 'A')?.text || '',
      option_b: q.options.find(o => o.letter === 'B')?.text || '',
      option_c: q.options.find(o => o.letter === 'C')?.text || '',
      option_d: q.options.find(o => o.letter === 'D')?.text || '',
      correct_option: LETTER_TO_INDEX[q.correctAnswer],
      explanation: q.explanation || '',
      primary_article_id: articleId,
      difficulty: 'medium',
      is_active: true,
      is_official_exam: false,
      tags: tags
    };

    const { error } = await supabase.from('questions').insert(questionData);

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('content_hash')) {
        skipped++;
      } else {
        console.log('  ❌ Error:', error.message);
      }
    } else {
      imported++;
    }
  }

  console.log('  ✅ Importadas:', imported);
  console.log('  ⏭️ Duplicadas:', skipped);
  console.log('  ⚠️ Sin artículo:', noArticle);

  return { imported, skipped, noArticle };
}

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_2,_El_acto_administrativo';

  const files = [
    { name: 'El_acto_administrativo_Concepto,_clases_y_elementos..json', tags: ['Concepto y elementos', 'T302', 'Bloque III'] },
    { name: 'Eficacia_y_validez_de_los_actos_administrativos.json', tags: ['Eficacia y validez', 'T302', 'Bloque III'] },
    { name: 'Notificación.json', tags: ['Notificación', 'T302', 'Bloque III'] },
    { name: 'Nulidad_y_anulabilidad.json', tags: ['Nulidad y anulabilidad', 'T302', 'Bloque III'] }
  ];

  let totalImported = 0;
  let totalSkipped = 0;
  let totalNoArticle = 0;

  for (const file of files) {
    const filePath = path.join(basePath, file.name);
    if (fs.existsSync(filePath)) {
      const result = await importFile(filePath, file.tags);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      totalNoArticle += result.noArticle;
    } else {
      console.log('❌ No existe:', file.name);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('RESUMEN TOTAL T302:');
  console.log('  ✅ Importadas:', totalImported);
  console.log('  ⏭️ Duplicadas:', totalSkipped);
  console.log('  ⚠️ Sin artículo:', totalNoArticle);
})();
