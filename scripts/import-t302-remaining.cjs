const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LAWS = {
  'Ley 39/2015': '218452f5-b9f6-48f0-a25b-26df9cb19644',
  'Ley 40/2015': '95680d57-6e5d-4ff7-85a9-9d09fd21de64'
};

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Función mejorada - detecta todos los artículos de Ley 40/2015
function detectArticle(explanation, questionText) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();

  // Primero buscar en explicación el patrón "Artículo X" con número
  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (!artMatch) return null;

  const artNum = artMatch[1];

  // Si menciona Ley 40/2015 o LRJSP
  if (text.includes('40/2015') || text.includes('lrjsp') || text.includes('régimen jurídico del sector público')) {
    return { law: 'Ley 40/2015', articleNumber: artNum };
  }

  // Si menciona Ley 39/2015 o LPAC
  if (text.includes('39/2015') || text.includes('lpac') || text.includes('procedimiento administrativo común')) {
    return { law: 'Ley 39/2015', articleNumber: artNum };
  }

  // Por defecto, artículos 1-33 son de Ley 40/2015, 34+ de Ley 39/2015 para este tema
  const num = parseInt(artNum);
  if (num <= 33 || num === 41) {
    return { law: 'Ley 40/2015', articleNumber: artNum };
  }

  return { law: 'Ley 39/2015', articleNumber: artNum };
}

async function findArticle(law, articleNumber) {
  const lawId = LAWS[law];
  if (!lawId) return null;

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .single();

  return data;
}

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_2,_El_acto_administrativo';

  const files = [
    { name: 'El_acto_administrativo_Concepto,_clases_y_elementos..json', tags: ['Concepto y elementos', 'T302', 'Bloque III'] },
    { name: 'Notificación.json', tags: ['Notificación', 'T302', 'Bloque III'] }
  ];

  console.log('=== IMPORTANDO PREGUNTAS RESTANTES T302 ===\n');

  let totalImported = 0;

  for (const file of files) {
    const filePath = path.join(basePath, file.name);
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      const detected = detectArticle(q.explanation, q.question);
      if (!detected) continue;

      const article = await findArticle(detected.law, detected.articleNumber);
      if (!article) continue;

      const questionData = {
        question_text: q.question,
        option_a: q.options.find(o => o.letter === 'A')?.text || '',
        option_b: q.options.find(o => o.letter === 'B')?.text || '',
        option_c: q.options.find(o => o.letter === 'C')?.text || '',
        option_d: q.options.find(o => o.letter === 'D')?.text || '',
        correct_option: LETTER_TO_INDEX[q.correctAnswer],
        explanation: q.explanation || '',
        primary_article_id: article.id,
        difficulty: 'medium',
        is_active: true,
        is_official_exam: false,
        tags: file.tags
      };

      const { error } = await supabase.from('questions').insert(questionData);

      if (error) {
        if (!error.message.includes('duplicate') && !error.message.includes('content_hash')) {
          console.log('❌ Error:', error.message);
        }
      } else {
        totalImported++;
        console.log('✅ Importada:', q.question.substring(0, 50) + '...');
      }
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log('Importadas adicionales:', totalImported);

  // Verificar total
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T302'])
    .eq('is_active', true);

  console.log('Total preguntas T302:', count);
})();
