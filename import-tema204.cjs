require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const answerMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Función para extraer artículo de la explicación
function extractArticle(explanation, articles) {
  const exp = explanation.toLowerCase();

  // Buscar patrón "artículo X" o "art. X" o "art.X"
  const patterns = [
    /art(?:í|i)culo\s+(\d+)/gi,
    /art\.\s*(\d+)/gi
  ];

  for (const pattern of patterns) {
    const matches = [...exp.matchAll(pattern)];
    if (matches.length > 0) {
      const artNum = matches[0][1];
      // Determinar si es LO 3/2018 o RGPD
      if (exp.includes('3/2018') || exp.includes('lopdgdd') || exp.includes('ley orgánica')) {
        if (articles.lo[artNum]) return { id: articles.lo[artNum], ref: 'LO3-' + artNum };
      }
      if (exp.includes('2016/679') || exp.includes('rgpd') || exp.includes('reglamento')) {
        if (articles.rgpd[artNum]) return { id: articles.rgpd[artNum], ref: 'RGPD-' + artNum };
      }
      // Si no es claro, intentar LO primero, luego RGPD
      if (articles.lo[artNum]) return { id: articles.lo[artNum], ref: 'LO3-' + artNum };
      if (articles.rgpd[artNum]) return { id: articles.rgpd[artNum], ref: 'RGPD-' + artNum };
    }
  }

  // Fallback: Art. 1 de LO 3/2018
  return { id: articles.lo['1'], ref: 'LO3-1 (fallback)' };
}

async function main() {
  // Obtener artículos
  const loId = '146b7e50-e089-44a6-932c-773954f8d96b';
  const rgpdId = 'a227ef14-439f-4b94-9b3c-a161a3355ae5';

  const { data: loArts } = await supabase.from('articles').select('id, article_number').eq('law_id', loId);
  const { data: rgpdArts } = await supabase.from('articles').select('id, article_number').eq('law_id', rgpdId);

  const articles = {
    lo: {},
    rgpd: {}
  };

  loArts?.forEach(a => articles.lo[a.article_number] = a.id);
  rgpdArts?.forEach(a => articles.rgpd[a.article_number] = a.id);

  console.log('LO 3/2018:', Object.keys(articles.lo).length, 'artículos');
  console.log('RGPD:', Object.keys(articles.rgpd).length, 'artículos');

  // Archivos a importar
  const basePath = './preguntas-para-subir/Tema_4,_Protección_de_datos_personales/';
  const files = [
    { file: 'La_protección_de_datos_personales._Régimen_Jurídico.json', tag: 'Régimen Jurídico' },
    { file: 'Principios.json', tag: 'Principios' },
    { file: 'Derechos.json', tag: 'Derechos' },
    { file: 'Responsable_del_tratamiento,_encargado_del_tratamiento_y_delegado_de_protección_de_datos.json', tag: 'Responsable y DPD' },
    { file: 'Autoridades_de_protección_de_datos.json', tag: 'Autoridades' },
    { file: 'Garantía_de_los_derechos_digitales.json', tag: 'Derechos digitales' },
    { file: 'Breve_referencia_al_régimen_sancionador.json', tag: 'Régimen sancionador' }
  ];

  let totalImported = 0;
  let totalDuplicates = 0;

  for (const { file, tag } of files) {
    console.log('\n=== ' + tag + ' ===');
    const data = JSON.parse(fs.readFileSync(basePath + file));
    let imported = 0;
    let duplicates = 0;

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      const { id: articleId, ref } = extractArticle(q.explanation || '', articles);

      const { error } = await supabase.from('questions').insert({
        question_text: q.question,
        option_a: q.options[0]?.text || '',
        option_b: q.options[1]?.text || '',
        option_c: q.options[2]?.text || '',
        option_d: q.options[3]?.text || '',
        correct_option: answerMap[q.correctAnswer],
        explanation: (q.explanation || '').substring(0, 2000),
        primary_article_id: articleId,
        difficulty: 'medium',
        is_active: true,
        is_official_exam: false,
        tags: [tag, 'Tema 204', 'Bloque II']
      });

      if (error) {
        if (error.message.includes('duplicate')) {
          duplicates++;
        } else {
          console.log('P' + (i+1) + ' Error:', error.message);
        }
      } else {
        imported++;
        if (imported % 10 === 0) process.stdout.write('.');
      }
    }

    console.log('\n' + tag + ': ' + imported + ' importadas, ' + duplicates + ' duplicadas');
    totalImported += imported;
    totalDuplicates += duplicates;
  }

  console.log('\n=== TOTAL ===');
  console.log('Importadas:', totalImported);
  console.log('Duplicadas:', totalDuplicates);
}

main().catch(console.error);
