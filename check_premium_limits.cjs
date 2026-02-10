require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Verificación profunda: ¿Usuarios premium tienen límites registrados?\n');

  // 1. Obtener todos los premium
  const { data: premiumUsers } = await supabase
    .from('user_profiles')
    .select('id, email, plan_type')
    .eq('plan_type', 'premium');

  console.log('👥 Total usuarios premium:', premiumUsers.length);

  // 2. Verificar si ALGUNO tiene registros en daily_question_limits (histórico)
  const { data: allLimits } = await supabase
    .from('daily_question_limits')
    .select('user_id, questions_today, limit_date')
    .order('limit_date', { ascending: false })
    .limit(1000);

  console.log('📊 Total registros de límites (histórico):', allLimits?.length || 0);

  if (allLimits && allLimits.length > 0) {
    console.log('');
    console.log('🔍 Buscando usuarios premium en registros de límites...\n');

    let foundPremiumWithLimit = false;

    for (const limit of allLimits) {
      const user = premiumUsers.find(u => u.id === limit.user_id);
      if (user) {
        foundPremiumWithLimit = true;
        console.log(`  ❌ BUG: ${user.email} (${user.plan_type})`);
        console.log(`      Fecha: ${limit.limit_date}`);
        console.log(`      Preguntas: ${limit.questions_today}`);
        console.log('');
      }
    }

    if (!foundPremiumWithLimit) {
      console.log('  ✅ CORRECTO: Ningún usuario premium tiene registros de límites');
    }
  }

  // 3. Verificar específicamente la función RPC
  console.log('');
  console.log('='.repeat(70));
  console.log('🧪 TEST: Verificar función get_daily_question_status para usuarios premium\n');

  // Tomar 3 usuarios premium aleatorios
  const testUsers = premiumUsers.slice(0, 3);

  for (const user of testUsers) {
    const { data, error } = await supabase.rpc('get_daily_question_status', {
      p_user_id: user.id
    });

    const result = Array.isArray(data) ? data[0] : data;

    if (error) {
      console.log(`  ❌ Error para ${user.email}:`, error.message);
    } else {
      const isPremiumFlag = result?.is_premium || false;
      const questionsRemaining = result?.questions_remaining ?? 999;
      const isLimitReached = result?.is_limit_reached || false;

      if (isPremiumFlag && questionsRemaining === 999 && !isLimitReached) {
        console.log(`  ✅ ${user.email}: is_premium=true, remaining=999, no límite`);
      } else {
        console.log(`  ❌ ${user.email}: is_premium=${isPremiumFlag}, remaining=${questionsRemaining}, limit=${isLimitReached}`);
        console.log('     DATOS:', JSON.stringify(result, null, 2));
      }
    }
  }
})();
