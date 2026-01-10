const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LEY_30_1984_ID = '9f60b1b4-0aa1-49bf-8757-b71ab261108a';
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Mapeo de números en texto a dígitos
const TEXT_TO_NUM = {
  'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
  'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
  'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14', 'quince': '15',
  'dieciséis': '16', 'dieciseis': '16', 'diecisiete': '17', 'dieciocho': '18', 'diecinueve': '19',
  'veinte': '20', 'veintiuno': '21', 'veintidós': '22', 'veintidos': '22', 'veintitrés': '23', 'veintitres': '23',
  'veinticuatro': '24', 'veinticinco': '25', 'veintiséis': '26', 'veintiseis': '26',
  'veintisiete': '27', 'veintiocho': '28', 'veintinueve': '29', 'treinta': '30',
  'primero': '1', 'segundo': '2', 'tercero': '3', 'cuarto': '4', 'quinto': '5',
  'sexto': '6', 'séptimo': '7', 'septimo': '7', 'octavo': '8', 'noveno': '9', 'décimo': '10', 'decimo': '10'
};

function detectArticle(text) {
  text = text.toLowerCase();

  // Patrón 1: "Artículo 23.3" o "Art. 24.1" - captura solo el número principal
  let match = text.match(/art[íi]culo\s+(\d+)(?:\.\d+)?/i) || text.match(/art\.\s*(\d+)(?:\.\d+)?/i);
  if (match) return match[1];

  // Patrón 2: "Artículo veintitrés" o "Artículo quince"
  match = text.match(/art[íi]culo\s+(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintid[oó]s|veintitr[eé]s|veinticuatro|veinticinco|veintis[eé]is|veintisiete|veintiocho|veintinueve|treinta|primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo)/i);
  if (match) {
    const num = TEXT_TO_NUM[match[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
    return num || null;
  }

  return null;
}

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_4,_Las_retribuciones_de_los_funcionarios_públicos_y_del_personal_laboral_al_servicio_de_la_Admi';
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  console.log('=== IMPORTANDO preguntas Ley 30/1984 para T504 (v2) ===\n');
  let totalImported = 0, totalSkipped = 0, totalNoArticle = 0;

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(basePath, fileName), 'utf8');
    const data = JSON.parse(content);
    const tag = fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 25);

    let fileImported = 0;

    for (const q of data.questions) {
      const text = ((q.explanation || '') + ' ' + (q.question || '')).toLowerCase();

      // Solo preguntas que mencionan Ley 30/1984
      if (!text.includes('30/1984')) continue;

      // Verificar si ya existe
      const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('question_text', q.question);
      if (count > 0) { totalSkipped++; continue; }

      const artNum = detectArticle(q.explanation || '');
      if (!artNum) {
        console.log('  Sin artículo: ' + q.question.substring(0, 50) + '...');
        totalNoArticle++;
        continue;
      }

      const { data: article } = await supabase.from('articles').select('id').eq('law_id', LEY_30_1984_ID).eq('article_number', artNum).single();
      if (!article) {
        console.log('  Art ' + artNum + ' no existe en Ley 30/1984');
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
        primary_article_id: article.id,
        difficulty: 'medium', is_active: true, is_official_exam: false,
        tags: [tag.trim(), 'T504', 'Bloque V']
      });

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('content_hash')) totalSkipped++;
        else console.log('  Error:', error.message.substring(0, 50));
      } else {
        fileImported++;
        totalImported++;
        console.log('  ✅ Art ' + artNum + ': ' + q.question.substring(0, 40) + '...');
      }
    }
  }

  console.log('\nRESUMEN: ✅', totalImported, '⏭️', totalSkipped, '⚠️', totalNoArticle);

  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', ['T504']).eq('is_active', true);
  console.log('Total T504 en BD:', count);
})();
