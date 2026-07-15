const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

const LAWS = {
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941',
  LOREG: 'd69ff916-62c3-4a31-85f0-394a88cc8adf',
  RS: 'cfcb6187-8108-408c-9b03-653331932c4a' // Reglamento del Senado
};

const DIR_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_3,_Las_Cortes_Generales';

// Mapeo manual de las 8 preguntas pendientes
const manualMapping = [
  { start: '¿Entre cuántas provincias', law: 'LOREG', article: '162' },
  { start: 'Como señala la LOREG, ¿cuál es el mínimo', law: 'LOREG', article: '162' },
  { start: 'Como señala la LOREG, Ceuta y Melilla', law: 'LOREG', article: '162' },
  { start: 'En cuanto a las proposiciones de ley cuya iniciativa', law: 'RS', article: '108' },
  { start: '¿Quiénes constituyen la Junta de portavoces', law: 'RS', article: '43' },
  { start: '¿Es obligatoria la designación de vicepresidentes', law: 'RS', article: '5' },
  { start: 'No podrá procederse a la disolución', law: 'CE', article: '116' },
  // Esta no tiene ley en BD:
  { start: '¿Cuál es el mínimo de firmas acreditadas', law: null, article: null, skip: 'LO 3/1984 no existe' }
];

(async () => {
  const files = fs.readdirSync(DIR_PATH).filter(f => f.endsWith('.json'));
  let imported = 0, skipped = 0;
  const pending = [];

  console.log('=== Importando últimas preguntas de Cortes Generales ===\n');

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
        skipped++;
        continue;
      }

      // Buscar mapeo manual
      const mapping = manualMapping.find(m => q.question.startsWith(m.start));
      if (!mapping) continue; // No es una de las pendientes

      if (mapping.skip) {
        pending.push({ q: q.question.substring(0, 50), reason: mapping.skip });
        continue;
      }

      const lawId = LAWS[mapping.law];
      const { data: art } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', lawId)
        .eq('article_number', mapping.article)
        .eq('is_active', true)
        .single();

      if (!art) {
        pending.push({ q: q.question.substring(0, 50), reason: `${mapping.law} Art.${mapping.article} no existe` });
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
        primary_article_id: art.id,
        difficulty: 'medium',
        is_active: true,
        is_official_exam: false,
        tags: [tag.trim(), 'T103', 'Bloque I']
      });

      if (error && !error.message.includes('duplicate')) {
        pending.push({ q: q.question.substring(0, 50), reason: error.message.substring(0, 40) });
      } else if (!error) {
        imported++;
        console.log('  ✅', mapping.law, 'Art', mapping.article + ':', q.question.substring(0, 40) + '...');
      }
    }
  }

  console.log('\n=== RESUMEN FINAL ===');
  console.log('Importadas:', imported);
  console.log('Omitidas:', skipped);

  if (pending.length > 0) {
    console.log('\nPendientes (falta ley en BD):');
    for (const p of pending) {
      console.log('  -', p.q);
      console.log('    ', p.reason);
    }
  }

  // Total T103
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T103'])
    .eq('is_active', true);
  console.log('\n✅ Total T103 en BD:', count);
})();
