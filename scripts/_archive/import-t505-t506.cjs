const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// IDs de leyes
const LAWS = {
  'LGP': 'effe3259-8168-43a0-9730-9923452205c4',      // Ley 47/2003
  'LGS': '09c18214-a630-4ae8-9f63-a742919f7f4c',      // Ley 38/2003
  'LCSP': '4f605392-8137-4962-9e66-ca5f275e93ee',     // Ley 9/2017
  'RD_887': '1fddac22-1045-4369-b566-f38f1058cb1e'    // RD 887/2006
};

function detectLawAndArticle(text) {
  text = text.toLowerCase();
  let lawId = null;
  let lawName = null;

  // Detectar ley
  if (text.includes('47/2003') || text.includes('ley general presupuestaria') || text.includes('lgp')) {
    lawId = LAWS.LGP;
    lawName = 'LGP';
  } else if (text.includes('38/2003') || text.includes('ley general de subvenciones') || text.includes('lgs')) {
    lawId = LAWS.LGS;
    lawName = 'LGS';
  } else if (text.includes('9/2017') || text.includes('contratos del sector público') || text.includes('lcsp')) {
    lawId = LAWS.LCSP;
    lawName = 'LCSP';
  } else if (text.includes('887/2006') || text.includes('reglamento') && text.includes('subvenciones')) {
    lawId = LAWS.RD_887;
    lawName = 'RD 887/2006';
  }

  // Detectar artículo
  let articleNumber = null;
  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (artMatch) {
    articleNumber = artMatch[1];
  } else {
    const artMatch2 = text.match(/art\.\s*(\d+)/i);
    if (artMatch2) articleNumber = artMatch2[1];
  }

  return { lawId, lawName, articleNumber };
}

async function importTopic(basePath, tema, bloque, defaultLawId) {
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  console.log(`\n=== Importando ${tema} ===\n`);
  let totalImported = 0, totalSkipped = 0, totalNoArticle = 0;

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(basePath, fileName), 'utf8');
    const data = JSON.parse(content);
    const tag = fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 25);

    for (const q of data.questions) {
      // Verificar si ya existe
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('question_text', q.question);

      if (count > 0) {
        totalSkipped++;
        continue;
      }

      const text = (q.explanation || '') + ' ' + (q.question || '');
      const { lawId, lawName, articleNumber } = detectLawAndArticle(text);

      let articleId = null;
      const usedLawId = lawId || defaultLawId;

      if (articleNumber && usedLawId) {
        const { data: article } = await supabase
          .from('articles')
          .select('id')
          .eq('law_id', usedLawId)
          .eq('article_number', articleNumber)
          .eq('is_active', true)
          .single();

        if (article) articleId = article.id;
      }

      // Si no encontramos artículo específico, buscar por contenido
      if (!articleId && usedLawId) {
        // Intentar con artículo 1 como fallback genérico
        const { data: fallback } = await supabase
          .from('articles')
          .select('id')
          .eq('law_id', usedLawId)
          .eq('article_number', '1')
          .eq('is_active', true)
          .single();

        if (fallback) articleId = fallback.id;
      }

      if (!articleId) {
        console.log('  ⚠️ Sin artículo:', q.question.substring(0, 50) + '...');
        totalNoArticle++;
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
        primary_article_id: articleId,
        difficulty: 'medium',
        is_active: true,
        is_official_exam: false,
        tags: [tag.trim(), tema, bloque]
      });

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('content_hash')) {
          totalSkipped++;
        } else {
          console.log('  ❌ Error:', error.message.substring(0, 50));
        }
      } else {
        totalImported++;
        console.log('  ✅ ' + q.question.substring(0, 50) + '...');
      }
    }
  }

  console.log(`\n${tema} RESUMEN: ✅ ${totalImported} ⏭️ ${totalSkipped} ⚠️ ${totalNoArticle}`);
  return { imported: totalImported, skipped: totalSkipped, noArticle: totalNoArticle };
}

(async () => {
  const T505_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_5,_Gastos_para_la_compra_de_bienes_y_servicios,_de_inversión,_de_transferencias_y_pagos';
  const T506_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_6,_Gestión_económica_y_financiera_de_los_contratos_del_sector_público_y_de_las_subvenciones';

  // T505 - Default: Ley 47/2003 LGP
  const r1 = await importTopic(T505_PATH, 'T505', 'Bloque V', LAWS.LGP);

  // T506 - Default: Ley 38/2003 LGS (subvenciones)
  const r2 = await importTopic(T506_PATH, 'T506', 'Bloque V', LAWS.LGS);

  console.log('\n=== RESUMEN FINAL ===');
  console.log('T505:', r1.imported, 'importadas,', r1.skipped, 'omitidas,', r1.noArticle, 'sin artículo');
  console.log('T506:', r2.imported, 'importadas,', r2.skipped, 'omitidas,', r2.noArticle, 'sin artículo');

  // Verificar totales
  for (const tema of ['T505', 'T506']) {
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .contains('tags', [tema])
      .eq('is_active', true);
    console.log(`Total ${tema} en BD:`, count);
  }
})();
