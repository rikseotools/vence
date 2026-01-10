const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Convertir ordinal español a número
const ORDINALS = {
  'primero': '1', 'primera': '1', 'primer': '1',
  'segundo': '2', 'segunda': '2',
  'tercero': '3', 'tercera': '3', 'tercer': '3',
  'cuarto': '4', 'cuarta': '4',
  'quinto': '5', 'quinta': '5',
  'sexto': '6', 'sexta': '6',
  'séptimo': '7', 'septimo': '7', 'séptima': '7', 'septima': '7',
  'octavo': '8', 'octava': '8',
  'noveno': '9', 'novena': '9',
  'décimo': '10', 'decimo': '10', 'décima': '10', 'decima': '10'
};

function detectArticle(text) {
  const textLower = text.toLowerCase();

  // Buscar artículo numérico primero
  const numMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (numMatch) return numMatch[1];

  // Buscar ordinal
  for (const [ordinal, num] of Object.entries(ORDINALS)) {
    const regex = new RegExp(`art[íi]culo\\s+${ordinal}`, 'i');
    if (regex.test(text)) return num;
  }

  // Buscar solo el ordinal al inicio de explicación (ej: "Tercero.3 Orden...")
  for (const [ordinal, num] of Object.entries(ORDINALS)) {
    const regex = new RegExp(`^${ordinal}[.\\d\\s]`, 'i');
    if (regex.test(text.trim())) return num;
  }

  return null;
}

(async () => {
  console.log('=== Importando T403 pendientes (Orden APU/1461/2002) ===\n');

  // Obtener la ley
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .ilike('short_name', '%APU/1461%')
    .single();

  if (!law) {
    console.log('Ley no encontrada');
    return;
  }

  console.log('Ley ID:', law.id);

  const dirPath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_3,_El_personal_funcionario_al_servicio_de_las_Administraciones_públicas';
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

  let imported = 0, skipped = 0, errors = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    const data = JSON.parse(content);
    const subtema = data.subtema || 'Personal funcionario interino';

    for (const q of data.questions || []) {
      // Verificar si ya existe
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('question_text', q.question);

      if (count > 0) {
        skipped++;
        continue;
      }

      // Detectar artículo
      const text = (q.explanation || '') + ' ' + q.question;
      const articleNumber = detectArticle(text);

      if (!articleNumber) {
        errors.push({ q: q.question.substring(0, 50), reason: 'Sin artículo' });
        continue;
      }

      // Buscar el artículo
      const { data: art } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', law.id)
        .eq('article_number', articleNumber)
        .eq('is_active', true)
        .single();

      if (!art) {
        errors.push({ q: q.question.substring(0, 50), reason: `Art. ${articleNumber} no existe` });
        continue;
      }

      // Insertar
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
        tags: [subtema.trim(), 'T403', 'Bloque IV']
      });

      if (!error) {
        imported++;
        console.log('✅ Art.', articleNumber, '-', q.question.substring(0, 50) + '...');
      }
    }
  }

  console.log('\n📊 Resultado:');
  console.log('  Importadas:', imported);
  console.log('  Omitidas:', skipped);
  console.log('  Errores:', errors.length);

  if (errors.length > 0) {
    console.log('\n❌ Errores:');
    errors.forEach(e => console.log('  -', e.reason, ':', e.q));
  }

  const { count: total } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T403'])
    .eq('is_active', true);

  console.log('\n📈 Total T403:', total);
})();
