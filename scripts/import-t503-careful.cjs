const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

const DIR_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_3,_El_procedimiento_administrativo_de_ejecución_del_presupuesto_de_gasto';

// IDs de leyes
const LAWS = {
  'LO_2_1982': '190f387b-e1c8-4a04-99f4-28186cdf039e',      // Tribunal de Cuentas
  'LGP': 'effe3259-8168-43a0-9730-9923452205c4',            // Ley 47/2003
  'ORDEN_1996': '0f291234-06b8-42c7-972d-a769eab28725',     // Orden 01/02/1996
  'ORDEN_PRE': '3804306a-71d3-4ed9-a33b-502678097836'       // Orden PRE/1576/2002
};

// Convertir texto ordinal a número
function ordinalToNumber(text) {
  const ordinals = {
    'primero': '1', 'segundo': '2', 'tercero': '3', 'cuarto': '4', 'quinto': '5',
    'sexto': '6', 'séptimo': '7', 'septimo': '7', 'octavo': '8', 'noveno': '9',
    'décimo': '10', 'decimo': '10', 'undécimo': '11', 'duodécimo': '12',
    'decimotercero': '13', 'decimocuarto': '14', 'decimoquinto': '15',
    'decimosexto': '16', 'decimoséptimo': '17', 'decimoctavo': '18', 'decimonoveno': '19',
    'diez': '10', 'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14',
    'quince': '15', 'dieciséis': '16', 'dieciseis': '16', 'diecisiete': '17',
    'dieciocho': '18', 'diecinueve': '19',
    'veinte': '20', 'veintiuno': '21', 'veintiuna': '21', 'veintidos': '22', 'veintidós': '22',
    'veintitres': '23', 'veintitrés': '23', 'veinticuatro': '24', 'veinticinco': '25',
    'veintiseis': '26', 'veintiséis': '26', 'veintisiete': '27', 'veintiocho': '28', 'veintinueve': '29',
    'treinta': '30', 'treintayuno': '31', 'treintaydos': '32', 'treintaytres': '33'
  };
  return ordinals[text.toLowerCase()] || text;
}

// Detectar ley y artículo de la explicación
function detectLawAndArticle(explanation, question) {
  const text = (explanation + ' ' + question).toLowerCase();
  let lawId = null;
  let articleNumber = null;

  // Función auxiliar para extraer número de artículo
  function extractArticleNumber(txt) {
    // Intentar múltiples patrones
    // "Art. 24.2" -> 24
    let match = txt.match(/art\.\s*(\d+)/i);
    if (match) return match[1];

    // "artículo veintitrés" -> 23 (incluye acentos)
    match = txt.match(/art[íi]culo\s+([\wáéíóúñü]+)/i);
    if (match) return ordinalToNumber(match[1]);

    // "Artículo treinta y tres" -> 33
    match = txt.match(/art[íi]culo\s+(\w+)\s+y\s+(\w+)/i);
    if (match) {
      const tens = ordinalToNumber(match[1]);
      const units = ordinalToNumber(match[2]);
      if (!isNaN(tens) && !isNaN(units)) {
        return String(parseInt(tens) + parseInt(units));
      }
    }

    return null;
  }

  // 1. Detectar Orden PRE/1576/2002
  if (text.includes('pre/1576/2002') || text.includes('1576/2002')) {
    lawId = LAWS.ORDEN_PRE;
    articleNumber = extractArticleNumber(text);
    // Fallback: artículo 1 para esta orden
    if (!articleNumber) articleNumber = '1';
  }
  // 2. Detectar Orden 01/02/1996 (reglas)
  else if (text.includes('1 de febrero de 1996') || text.includes('operatoria contable') || text.includes('instrucción de operatoria')) {
    lawId = LAWS.ORDEN_1996;
    // Buscar regla específica
    const reglaMatch = text.match(/regla\s+(\d+)/i);
    if (reglaMatch) {
      articleNumber = reglaMatch[1];
    } else {
      // Fallback: regla 1
      articleNumber = '1';
    }
  }
  // 3. Detectar LO 2/1982 Tribunal de Cuentas
  else if (text.includes('2/1982') || text.includes('tribunal de cuentas')) {
    lawId = LAWS.LO_2_1982;
    articleNumber = extractArticleNumber(text);
  }
  // 4. Detectar Ley 47/2003 LGP
  else if (text.includes('47/2003') || text.includes('ley general presupuestaria') || text.includes('lgp')) {
    lawId = LAWS.LGP;
    articleNumber = extractArticleNumber(text);
  }

  return { lawId, articleNumber };
}

// Buscar artículo en BD
async function findArticle(lawId, articleNumber) {
  if (!lawId || !articleNumber) return null;

  const { data: article } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .eq('is_active', true)
    .single();

  return article?.id || null;
}

(async () => {
  console.log('=== Importación cuidadosa T503 ===\n');

  const files = fs.readdirSync(DIR_PATH).filter(f => f.endsWith('.json'));
  let totalImported = 0, totalSkipped = 0, totalNoArticle = 0;
  const noArticleQuestions = [];

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(DIR_PATH, fileName), 'utf8');
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

      const { lawId, articleNumber } = detectLawAndArticle(q.explanation || '', q.question || '');
      const articleId = await findArticle(lawId, articleNumber);

      if (!articleId) {
        // Guardar para análisis
        noArticleQuestions.push({
          question: q.question.substring(0, 60),
          explanation: (q.explanation || '').substring(0, 100),
          detectedLaw: lawId ? Object.keys(LAWS).find(k => LAWS[k] === lawId) : 'NONE',
          detectedArticle: articleNumber || 'NONE'
        });
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
        tags: [tag.trim(), 'T503', 'Bloque V']
      });

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('content_hash')) {
          totalSkipped++;
        } else {
          console.log('  ❌ Error:', error.message.substring(0, 50));
        }
      } else {
        totalImported++;
        console.log('  ✅', q.question.substring(0, 50) + '...');
      }
    }
  }

  console.log(`\nRESUMEN: ✅ ${totalImported} ⏭️ ${totalSkipped} ⚠️ ${totalNoArticle}`);

  if (noArticleQuestions.length > 0) {
    console.log('\n=== PREGUNTAS SIN ARTÍCULO DETECTADO ===\n');
    for (const q of noArticleQuestions) {
      console.log('Q:', q.question);
      console.log('Exp:', q.explanation);
      console.log('Ley detectada:', q.detectedLaw, '| Art:', q.detectedArticle);
      console.log('---');
    }
  }

  // Total T503
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T503'])
    .eq('is_active', true);
  console.log('\nTotal T503 en BD:', count);
})();
