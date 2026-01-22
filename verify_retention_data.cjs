const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('═'.repeat(80));
  console.log('VERIFICACIÓN DE TRUE RETENTION RATE');
  console.log('═'.repeat(80));
  console.log('');

  // Obtener tests INICIADOS (como en la página de engagement)
  const { data: activeTests, error: testsError } = await supabase
    .from('tests')
    .select('user_id, started_at, is_completed')
    .not('started_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(10000);

  if (testsError) {
    console.error('❌ Error obteniendo tests:', testsError);
    return;
  }

  console.log(`📊 Tests obtenidos: ${activeTests.length}`);
  console.log(`   Más reciente: ${activeTests[0]?.started_at}`);
  console.log(`   Más antiguo: ${activeTests[activeTests.length - 1]?.started_at}`);
  console.log('');

  // Obtener usuarios
  const { data: users, error: usersError } = await supabase
    .from('user_profiles')
    .select('id, created_at, registration_source')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (usersError) {
    console.error('❌ Error obteniendo usuarios:', usersError);
    return;
  }

  console.log(`👥 Usuarios obtenidos: ${users.length}`);
  console.log(`   Más reciente: ${users[0]?.created_at}`);
  console.log('');

  // Filtrar tests válidos
  const existingUserIds = new Set(users.map(u => u.id));
  const validActiveTests = activeTests.filter(t => existingUserIds.has(t.user_id));

  console.log(`✅ Tests válidos (con usuario): ${validActiveTests.length}`);
  console.log('');

  // 🎯 TRUE RETENTION RATE (igual que en la página)
  console.log('═'.repeat(80));
  console.log('🎯 CALCULANDO TRUE RETENTION RATE');
  console.log('═'.repeat(80));
  console.log('');

  const now = new Date();
  const retentionAnalysis = [];

  // Analizar usuarios registrados en las últimas 4 semanas
  for (let weekOffset = 1; weekOffset <= 4; weekOffset++) {
    const weekStart = new Date(now.getTime() - weekOffset * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() - (weekOffset - 1) * 7 * 24 * 60 * 60 * 1000);

    const cohortUsers = users.filter(u => {
      const createdAt = new Date(u.created_at);
      return createdAt >= weekStart && createdAt < weekEnd;
    });

    console.log(`📅 Semana ${weekOffset} (${weekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')})`);
    console.log(`   Usuarios registrados: ${cohortUsers.length}`);

    if (cohortUsers.length === 0) {
      console.log('   ⚠️ No hay usuarios en esta semana\n');
      retentionAnalysis.push({
        week: `Semana ${weekOffset}`,
        registered: 0,
        day1Retention: 0,
        day7Retention: 0,
        day30Retention: 0
      });
      continue;
    }

    // Calcular retención
    let day1Retained = 0;
    let day7Retained = 0;
    let day30Retained = 0;

    cohortUsers.forEach(user => {
      const registrationDate = new Date(user.created_at);

      // Day 1
      const day1Start = new Date(registrationDate.getTime() + 24 * 60 * 60 * 1000);
      const day1End = new Date(registrationDate.getTime() + 2 * 24 * 60 * 60 * 1000);
      const hasDay1Activity = validActiveTests.some(t => {
        const testDate = new Date(t.started_at);
        return t.user_id === user.id && testDate >= day1Start && testDate < day1End;
      });
      if (hasDay1Activity) day1Retained++;

      // Day 7
      const day7Start = new Date(registrationDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      const day7End = new Date(registrationDate.getTime() + 9 * 24 * 60 * 60 * 1000);
      const hasDay7Activity = validActiveTests.some(t => {
        const testDate = new Date(t.started_at);
        return t.user_id === user.id && testDate >= day7Start && testDate < day7End;
      });
      if (hasDay7Activity) day7Retained++;

      // Day 30
      const day30Start = new Date(registrationDate.getTime() + 27 * 24 * 60 * 60 * 1000);
      const day30End = new Date(registrationDate.getTime() + 33 * 24 * 60 * 60 * 1000);
      const hasDay30Activity = validActiveTests.some(t => {
        const testDate = new Date(t.started_at);
        return t.user_id === user.id && testDate >= day30Start && testDate < day30End;
      });
      if (hasDay30Activity) day30Retained++;
    });

    const day1Pct = cohortUsers.length > 0 ? Math.round((day1Retained / cohortUsers.length) * 100) : 0;
    const day7Pct = cohortUsers.length > 0 ? Math.round((day7Retained / cohortUsers.length) * 100) : 0;
    const day30Pct = cohortUsers.length > 0 ? Math.round((day30Retained / cohortUsers.length) * 100) : 0;

    console.log(`   Day 1: ${day1Retained}/${cohortUsers.length} = ${day1Pct}%`);
    console.log(`   Day 7: ${day7Retained}/${cohortUsers.length} = ${day7Pct}%`);
    console.log(`   Day 30: ${day30Retained}/${cohortUsers.length} = ${day30Pct}%`);
    console.log('');

    retentionAnalysis.push({
      week: `Semana ${weekOffset}`,
      weekLabel: weekStart.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      registered: cohortUsers.length,
      day1Retention: day1Pct,
      day7Retention: day7Pct,
      day30Retention: day30Pct
    });
  }

  console.log('═'.repeat(80));
  console.log('📊 RESUMEN DE RETENTION');
  console.log('═'.repeat(80));
  console.log('');

  retentionAnalysis.forEach(r => {
    console.log(`${r.week} (${r.weekLabel}):`);
    console.log(`  Registrados: ${r.registered}`);
    console.log(`  Day 1: ${r.day1Retention}%`);
    console.log(`  Day 7: ${r.day7Retention}%`);
    console.log(`  Day 30: ${r.day30Retention}%`);
    console.log('');
  });

  // Calcular promedio
  const validWeeks = retentionAnalysis.filter(r => r.registered > 0);
  if (validWeeks.length > 0) {
    const avgDay1 = Math.round(validWeeks.reduce((sum, c) => sum + c.day1Retention, 0) / validWeeks.length);
    const avgDay7 = Math.round(validWeeks.reduce((sum, c) => sum + c.day7Retention, 0) / validWeeks.length);
    const avgDay30 = Math.round(validWeeks.reduce((sum, c) => sum + c.day30Retention, 0) / validWeeks.length);

    console.log('═'.repeat(80));
    console.log('📈 PROMEDIO ACTUAL');
    console.log('═'.repeat(80));
    console.log(`Day 1: ${avgDay1}%`);
    console.log(`Day 7: ${avgDay7}%`);
    console.log(`Day 30: ${avgDay30}%`);
  }

  console.log('');
  console.log('✅ Datos son DINÁMICOS - se calculan en tiempo real desde la BD');
  console.log('💡 Si los datos no cambian en la UI, puede ser cache del navegador');
  console.log('   Solución: Ctrl+Shift+R para hard refresh en el navegador');
})();
