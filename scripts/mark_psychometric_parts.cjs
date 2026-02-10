/**
 * Script para marcar preguntas psicotécnicas con su parte (segunda)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== MARCANDO PARTES DE PREGUNTAS PSICOTÉCNICAS ===');
  console.log('');

  // Obtener preguntas psicotécnicas del examen
  const { data, error } = await supabase
    .from('psychometric_questions')
    .select('id, question_text, exam_source')
    .eq('exam_date', '2024-07-09')
    .eq('is_active', true)
    .eq('is_official_exam', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Preguntas psicotécnicas:', data.length);

  // Filtrar las que no tienen parte marcada
  const sinParte = data.filter(q =>
    q.exam_source &&
    !q.exam_source.includes('Primera parte') &&
    !q.exam_source.includes('Segunda parte')
  );

  console.log('Sin parte marcada:', sinParte.length);
  console.log('');

  if (sinParte.length === 0) {
    console.log('✅ Todas las preguntas ya tienen parte marcada');
    return;
  }

  // Las preguntas psicotécnicas son siempre segunda parte
  const updates = sinParte.map(q => ({
    id: q.id,
    newSource: q.exam_source + ' - Segunda parte'
  }));

  console.log('Ejemplos:');
  updates.slice(0, 3).forEach(u => {
    console.log('  ', u.newSource.substring(0, 80) + '...');
  });

  if (process.argv.includes('--apply')) {
    console.log('');
    console.log('=== APLICANDO ===');

    for (const u of updates) {
      const { error: updateError } = await supabase
        .from('psychometric_questions')
        .update({ exam_source: u.newSource })
        .eq('id', u.id);

      if (updateError) {
        console.error('Error:', updateError);
      }
    }

    console.log('✅ Actualizadas', updates.length, 'preguntas');
  } else {
    console.log('');
    console.log('Para aplicar, ejecuta con --apply');
  }
}

main();
