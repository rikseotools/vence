require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const examDates = ['2024-07-09', '2023-01-20', '2021-05-26', '2019-06-14'];
  const oposicionPattern = '%Auxiliar Administrativo Estado%';

  console.log('=== Conteo REAL de preguntas en BD (tablas questions + psychometric_questions) ===\n');

  for (const examDate of examDates) {
    console.log(`\n=== Examen ${examDate} ===`);

    // Legislativas con exam_source LIKE pattern
    const { data: legislativas, error: legErr } = await supabase
      .from('questions')
      .select('id, exam_source')
      .eq('exam_date', examDate)
      .eq('is_official_exam', true)
      .eq('is_active', true)
      .ilike('exam_source', oposicionPattern);

    if (legErr) {
      console.log('Error legislativas:', legErr.message);
      continue;
    }

    // Psicotécnicas
    const { data: psicotecnicas, error: psyErr } = await supabase
      .from('psychometric_questions')
      .select('id, exam_source')
      .eq('exam_date', examDate)
      .eq('is_official_exam', true)
      .eq('is_active', true)
      .ilike('exam_source', oposicionPattern);

    if (psyErr) {
      console.log('Error psicotécnicas:', psyErr.message);
      continue;
    }

    // Clasificar por parte
    const legPrimera = legislativas.filter(q => q.exam_source?.includes('Primera parte')).length;
    const legSegunda = legislativas.filter(q => q.exam_source?.includes('Segunda parte')).length;
    const legSinParte = legislativas.filter(q => !q.exam_source?.includes('Primera parte') && !q.exam_source?.includes('Segunda parte')).length;

    const psyPrimera = psicotecnicas.filter(q => q.exam_source?.includes('Primera parte')).length;
    const psySegunda = psicotecnicas.filter(q => q.exam_source?.includes('Segunda parte')).length;
    const psySinParte = psicotecnicas.filter(q => !q.exam_source?.includes('Primera parte') && !q.exam_source?.includes('Segunda parte')).length;

    // Reservas
    const reservasPrimera = legislativas.filter(q => q.exam_source?.includes('Primera parte') && q.exam_source?.includes('Reserva')).length
      + psicotecnicas.filter(q => q.exam_source?.includes('Primera parte') && q.exam_source?.includes('Reserva')).length;
    const reservasSegunda = legislativas.filter(q => q.exam_source?.includes('Segunda parte') && q.exam_source?.includes('Reserva')).length;

    console.log('Primera parte:');
    console.log(`  - Legislativas: ${legPrimera} (${reservasPrimera > 0 ? `incluye ${legislativas.filter(q => q.exam_source?.includes('Primera parte') && q.exam_source?.includes('Reserva')).length} reservas` : 'sin reservas'})`);
    console.log(`  - Psicotécnicas: ${psyPrimera} (${psicotecnicas.filter(q => q.exam_source?.includes('Primera parte') && q.exam_source?.includes('Reserva')).length} reservas)`);
    console.log(`  - TOTAL PRIMERA: ${legPrimera + psyPrimera}`);

    console.log('Segunda parte:');
    console.log(`  - Legislativas: ${legSegunda} (${reservasSegunda} reservas)`);
    console.log(`  - TOTAL SEGUNDA: ${legSegunda}`);

    if (legSinParte > 0 || psySinParte > 0) {
      console.log(`⚠️ Sin parte definida: ${legSinParte} leg + ${psySinParte} psy`);
      // Mostrar ejemplos
      const ejemplos = [...legislativas, ...psicotecnicas]
        .filter(q => !q.exam_source?.includes('Primera parte') && !q.exam_source?.includes('Segunda parte'))
        .slice(0, 3);
      ejemplos.forEach(e => console.log(`     - "${e.exam_source?.substring(0, 80)}..."`));
    }

    console.log(`\n📊 UI dice: Primera=${examDate === '2024-07-09' ? 64 : examDate === '2023-01-20' ? 63 : examDate === '2021-05-26' ? 62 : 64}, Segunda=${examDate === '2024-07-09' ? 50 : examDate === '2023-01-20' ? 50 : examDate === '2021-05-26' ? 53 : 34}`);
  }
})();
