const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const userId = '602de7cd-7c03-46d1-9290-21380f581c5f';

  const { data: user } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, nickname, created_at, plan_type')
    .eq('id', userId)
    .single();

  console.log('═'.repeat(80));
  console.log('USUARIO QUE REPORTÓ EL PROBLEMA');
  console.log('═'.repeat(80));
  console.log('Email:', user.email);
  console.log('Nombre:', user.full_name);
  console.log('Nickname:', user.nickname);
  console.log('Plan:', user.plan_type);
  console.log('Registrado:', new Date(user.created_at).toLocaleString('es-ES'));
  console.log('');

  console.log('═'.repeat(80));
  console.log('PROBLEMA REPORTADO (19 enero 2026):');
  console.log('═'.repeat(80));
  console.log('Contestando correctamente a todas las preguntas de un test me');
  console.log('sale como que debo hacer repasos urgentes porque me aparece');
  console.log('como que no las he contestado bien.');
  console.log('');

  // Ver tests recientes del usuario
  const { data: tests } = await supabase
    .from('tests')
    .select('id, started_at, is_completed, score')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(10);

  console.log('═'.repeat(80));
  console.log('TESTS RECIENTES DEL USUARIO:');
  console.log('═'.repeat(80));
  console.log('Total tests (últimos 10):', tests ? tests.length : 0);
  console.log('');

  if (tests && tests.length > 0) {
    tests.forEach((t, i) => {
      console.log(`${i+1}. Test ID: ${t.id.substring(0, 8)}...`);
      console.log(`   Fecha: ${new Date(t.started_at).toLocaleString('es-ES')}`);
      console.log(`   Completado: ${t.is_completed ? 'Sí' : 'No'}`);
      console.log(`   Score: ${t.score !== null ? t.score + '%' : 'N/A'}`);
      console.log('');
    });
  }

  // TRACKING EVENTS - Lo más importante
  console.log('═'.repeat(80));
  console.log('EVENTOS DE TRACKING (últimos 50):');
  console.log('═'.repeat(80));
  console.log('');

  const { data: events } = await supabase
    .from('test_interaction_tracking')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  console.log('Total eventos encontrados:', events ? events.length : 0);
  console.log('');

  if (events && events.length > 0) {
    events.slice(0, 20).forEach((e, i) => {
      console.log(`${i+1}. ${new Date(e.created_at).toLocaleString('es-ES')}`);
      console.log(`   Test: ${e.test_id ? e.test_id.substring(0, 8) + '...' : 'N/A'}`);
      console.log(`   Pregunta: ${e.question_id ? e.question_id.substring(0, 8) + '...' : 'N/A'}`);
      console.log(`   Acción: ${e.action}`);
      console.log(`   Es correcta: ${e.is_correct !== null ? (e.is_correct ? 'Sí' : 'No') : 'N/A'}`);
      if (e.metadata) {
        console.log(`   Metadata:`, JSON.stringify(e.metadata));
      }
      console.log('');
    });
  }

  // Ver respuestas detalladas para encontrar el problema
  const { data: answers } = await supabase
    .from('detailed_answers')
    .select('test_id, question_id, user_answer, is_correct, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  console.log('═'.repeat(80));
  console.log('RESPUESTAS DETALLADAS (últimas 30):');
  console.log('═'.repeat(80));
  console.log('Total respuestas:', answers ? answers.length : 0);
  console.log('');

  if (answers && answers.length > 0) {
    // Agrupar por test
    const testStats = {};
    answers.forEach(a => {
      if (!testStats[a.test_id]) {
        testStats[a.test_id] = { correct: 0, incorrect: 0, total: 0, date: a.created_at };
      }
      testStats[a.test_id].total++;
      if (a.is_correct) {
        testStats[a.test_id].correct++;
      } else {
        testStats[a.test_id].incorrect++;
      }
    });

    console.log('Estadísticas por test:');
    console.log('');
    Object.entries(testStats).slice(0, 5).forEach(([testId, stats]) => {
      const pct = Math.round((stats.correct / stats.total) * 100);
      console.log(`Test: ${testId.substring(0, 8)}...`);
      console.log(`  Fecha: ${new Date(stats.date).toLocaleString('es-ES')}`);
      console.log(`  Correctas: ${stats.correct}/${stats.total} (${pct}%)`);
      console.log('');
    });
  }
})();
