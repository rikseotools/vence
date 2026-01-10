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
  'CE': '6ad91a6c-41ec-431f-9c80-5f5566834941',
  'Código Civil': '899e61d1-e168-482b-9e86-4e7787eab6fc',
  'Ley 50/1997': '1ed89e01-da46-4714-90e1-f1dc9f7eb486',
  'Ley 39/2015': '218452f5-b9f6-48f0-a25b-26df9cb19644'
};

// Mapeo de letra a índice
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Función para detectar ley y artículo de la explicación
function detectArticle(explanation) {
  const exp = (explanation || '').toLowerCase();

  // Patrones para detectar artículos
  const patterns = [
    { regex: /art[íi]culo\s+(\d+(?:\.\d+)?)\s+(?:de\s+la\s+)?(?:ce|constituci[oó]n)/i, law: 'CE' },
    { regex: /art[íi]culo\s+(\d+(?:\.\d+)?)\s+(?:de\s+la\s+)?constituci[oó]n/i, law: 'CE' },
    { regex: /art[íi]culo\s+(\d+(?:\.\d+)?)\s+ce\b/i, law: 'CE' },
    { regex: /ce\s+art[íi]culo\s+(\d+)/i, law: 'CE' },
    { regex: /art[íi]culo\s+(\d+(?:\.\d+)?)\s+(?:del\s+)?c[oó]digo\s+civil/i, law: 'Código Civil' },
    { regex: /c[oó]digo\s+civil.*art[íi]culo\s+(\d+)/i, law: 'Código Civil' },
    { regex: /art[íi]culo\s+(\d+(?:\.\d+)?)\s+(?:de\s+la\s+)?ley\s+50\/1997/i, law: 'Ley 50/1997' },
    { regex: /ley\s+50\/1997.*art[íi]culo\s+(\d+)/i, law: 'Ley 50/1997' },
    { regex: /art[íi]culo\s+(\d+(?:\.\d+)?)\s+(?:de\s+la\s+)?ley\s+39\/2015/i, law: 'Ley 39/2015' },
    { regex: /ley\s+39\/2015.*art[íi]culo\s+(\d+)/i, law: 'Ley 39/2015' },
    { regex: /art[íi]culo\s+(\d+(?:\.\d+)?)\s+lpac/i, law: 'Ley 39/2015' },
  ];

  for (const pattern of patterns) {
    const match = exp.match(pattern.regex);
    if (match) {
      const articleNum = match[1].split('.')[0]; // Solo el número principal
      return { law: pattern.law, articleNumber: articleNum };
    }
  }

  // Si menciona CE sin artículo específico, buscar número
  if (exp.includes('constituci') || exp.includes(' ce ') || exp.includes(' ce.') || exp.includes(' ce,')) {
    const artMatch = exp.match(/art[íi]culo\s+(\d+)/i);
    if (artMatch) {
      return { law: 'CE', articleNumber: artMatch[1] };
    }
  }

  // Si menciona código civil
  if (exp.includes('código civil') || exp.includes('codigo civil')) {
    const artMatch = exp.match(/art[íi]culo\s+(\d+)/i);
    if (artMatch) {
      return { law: 'Código Civil', articleNumber: artMatch[1] };
    }
  }

  return null;
}

// Función para buscar el artículo en la BD
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

// Importar preguntas de un archivo
async function importFile(filePath, tags) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  console.log(`\n=== Importando: ${path.basename(filePath)} ===`);
  console.log(`Total preguntas: ${data.questions.length}`);
  console.log(`Tags: ${tags.join(', ')}`);

  let imported = 0;
  let skipped = 0;
  let noArticle = 0;

  for (const q of data.questions) {
    // Detectar artículo
    const detected = detectArticle(q.explanation);
    let articleId = null;

    if (detected) {
      const article = await findArticle(detected.law, detected.articleNumber);
      if (article) {
        articleId = article.id;
      }
    }

    if (!articleId) {
      noArticle++;
      console.log(`  ⚠️ Sin artículo: "${q.question.substring(0, 50)}..."`);
      continue;
    }

    // Preparar datos
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

    // Insertar
    const { error } = await supabase
      .from('questions')
      .insert(questionData);

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('content_hash')) {
        skipped++;
      } else {
        console.log(`  ❌ Error: ${error.message}`);
      }
    } else {
      imported++;
    }
  }

  console.log(`\n  ✅ Importadas: ${imported}`);
  console.log(`  ⏭️ Duplicadas: ${skipped}`);
  console.log(`  ⚠️ Sin artículo: ${noArticle}`);

  return { imported, skipped, noArticle };
}

// Main
(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_1,_Fuentes_del_derecho_administrativo';

  const files = [
    { name: 'Fuentes_del_derecho_administrativo._Jerarquía_de_las_fuentes.json', tags: ['Fuentes del derecho', 'T301', 'Bloque III'] },
    { name: 'La_Ley.json', tags: ['La Ley', 'T301', 'Bloque III'] },
    { name: 'El_Reglamento.json', tags: ['El Reglamento', 'T301', 'Bloque III'] },
    { name: 'Iniciativa_legislativa_y_potestad_reglamentaria_del_ejecutivo.json', tags: ['Iniciativa legislativa', 'T301', 'Bloque III'] }
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
      console.log(`\n❌ No existe: ${file.name}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('RESUMEN TOTAL:');
  console.log(`  ✅ Importadas: ${totalImported}`);
  console.log(`  ⏭️ Duplicadas: ${totalSkipped}`);
  console.log(`  ⚠️ Sin artículo: ${totalNoArticle}`);
})();
