const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

(async () => {
  console.log('=== Importando preguntas pendientes T111 ===\n');

  // Obtener TFUE
  const { data: tfue } = await supabase.from('laws').select('id').eq('short_name', 'TFUE').single();
  const { data: tue } = await supabase.from('laws').select('id').eq('short_name', 'TUE').single();

  const dirPath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_11,_La_organización_de_la_Unión_Europea';
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

  let imported = 0;
  let skipped = 0;
  let errors = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    const data = JSON.parse(content);
    const subtema = data.subtema || file.replace(/_/g, ' ').replace('.json', '').substring(0, 30);

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
      let lawId = null;
      let articleNumber = null;

      // Buscar artículo en el texto
      const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
      if (artMatch) {
        articleNumber = artMatch[1];
        // Determinar si es TFUE o TUE
        if (text.toLowerCase().includes('tfue') || text.toLowerCase().includes('funcionamiento')) {
          lawId = tfue.id;
        } else if (text.toLowerCase().includes('tue') || text.toLowerCase().includes('tratado de la unión')) {
          lawId = tue.id;
        } else {
          // Por defecto TFUE
          lawId = tfue.id;
        }
      }

      if (!lawId || !articleNumber) {
        errors.push({ q: q.question.substring(0, 50), reason: 'Sin artículo detectado' });
        continue;
      }

      // Buscar el artículo
      const { data: art } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', lawId)
        .eq('article_number', articleNumber)
        .eq('is_active', true)
        .single();

      if (!art) {
        errors.push({ q: q.question.substring(0, 50), reason: `Art. ${articleNumber} no existe` });
        continue;
      }

      // Insertar pregunta
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
        tags: [subtema.trim(), 'T111', 'Bloque I']
      });

      if (!error) {
        imported++;
        console.log('✅ Importada:', q.question.substring(0, 50) + '...');
      }
    }
  }

  console.log('\n📊 Resultado:');
  console.log('  Importadas:', imported);
  console.log('  Omitidas (ya existían):', skipped);
  console.log('  Errores:', errors.length);

  if (errors.length > 0) {
    console.log('\n❌ Errores:');
    errors.forEach(e => console.log('  -', e.reason, ':', e.q));
  }

  // Total T111
  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', ['T111']).eq('is_active', true);
  console.log('\n📈 Total T111:', count);
})();
