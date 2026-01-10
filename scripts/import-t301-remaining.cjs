const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs CORRECTOS de las leyes
const LAWS = {
  'CE': '6ad91a6c-41ec-431f-9c80-5f5566834941',
  'Código Civil': '899e61d1-e168-482b-9e86-4e7787eab6fc',
  'Ley 50/1997': '1ed89e01-ace0-4894-8bd4-fa00db74d34a',
  'Ley 39/2015': '218452f5-b9f6-48f0-a25b-26df9cb19644'
};

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Función mejorada para detectar ley y artículo
function detectArticle(explanation, questionText) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();

  // Detectar "Ley del Gobierno" como Ley 50/1997
  if (text.includes('ley del gobierno') || text.includes('ley 50/1997')) {
    // Buscar número de artículo
    const artMatches = text.match(/art[íi]culo\s+(\d+)/gi);
    if (artMatches) {
      for (const match of artMatches) {
        const num = match.match(/\d+/)[0];
        if (['22', '23', '24', '25', '26', '27', '28'].includes(num)) {
          return { law: 'Ley 50/1997', articleNumber: num };
        }
      }
      // Si no es específico, usar art 26 (procedimiento de elaboración)
      if (text.includes('procedimiento de elaboración') || text.includes('elaboración de normas')) {
        return { law: 'Ley 50/1997', articleNumber: '26' };
      }
      if (text.includes('plan anual normativo')) {
        return { law: 'Ley 50/1997', articleNumber: '25' };
      }
    }
    // Default a art 26 si habla de elaboración de normas
    if (text.includes('elaboración') || text.includes('anteproyecto')) {
      return { law: 'Ley 50/1997', articleNumber: '26' };
    }
  }

  // Detectar Ley 39/2015
  if (text.includes('ley 39/2015') || text.includes('lpac')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
    if (artMatch) {
      return { law: 'Ley 39/2015', articleNumber: artMatch[1] };
    }
  }

  // Detectar CE
  if (text.includes('constituci') || text.match(/\bce\b/)) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
    if (artMatch) {
      return { law: 'CE', articleNumber: artMatch[1] };
    }
  }

  // Detectar Código Civil
  if (text.includes('código civil') || text.includes('codigo civil')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
    if (artMatch) {
      return { law: 'Código Civil', articleNumber: artMatch[1] };
    }
    // Si habla de fuentes del derecho, es art 1
    if (text.includes('fuentes del derecho') || text.includes('ley, costumbre') || text.includes('costumbre y')) {
      return { law: 'Código Civil', articleNumber: '1' };
    }
  }

  // Si habla de fuentes sin especificar, probablemente es Código Civil art 1
  if (text.includes('fuentes del derecho') && !text.includes('constituci')) {
    return { law: 'Código Civil', articleNumber: '1' };
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

  console.log(`\n=== Importando: ${path.basename(filePath)} ===`);
  console.log(`Total preguntas: ${data.questions.length}`);

  let imported = 0;
  let skipped = 0;
  let noArticle = 0;
  const pendingQuestions = [];

  for (const q of data.questions) {
    // Detectar artículo con función mejorada
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
      pendingQuestions.push({
        question: q.question.substring(0, 60),
        explanation: (q.explanation || '').substring(0, 100)
      });
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
        console.log(`  ❌ Error: ${error.message}`);
      }
    } else {
      imported++;
    }
  }

  console.log(`  ✅ Importadas: ${imported}`);
  console.log(`  ⏭️ Duplicadas/existentes: ${skipped}`);
  console.log(`  ⚠️ Sin artículo: ${noArticle}`);

  if (pendingQuestions.length > 0 && pendingQuestions.length <= 10) {
    console.log('\n  Preguntas pendientes:');
    pendingQuestions.forEach((p, i) => {
      console.log(`    ${i+1}. "${p.question}..."`);
    });
  }

  return { imported, skipped, noArticle };
}

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
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('RESUMEN TOTAL:');
  console.log(`  ✅ Importadas: ${totalImported}`);
  console.log(`  ⏭️ Duplicadas/existentes: ${totalSkipped}`);
  console.log(`  ⚠️ Sin artículo: ${totalNoArticle}`);
})();
