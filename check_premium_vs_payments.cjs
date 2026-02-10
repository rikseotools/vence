require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Verificando usuarios premium vs compras...\n');

  // 1. Obtener todos los usuarios premium
  const { data: premiumUsers, error: usersError } = await supabase
    .from('user_profiles')
    .select('id, email, plan_type, created_at')
    .or('plan_type.eq.premium,plan_type.eq.premium_monthly,plan_type.eq.premium_semester')
    .order('created_at', { ascending: false });

  if (usersError) {
    console.error('❌ Error obteniendo usuarios:', usersError);
    return;
  }

  console.log(`📊 Total usuarios premium: ${premiumUsers.length}\n`);

  // 2. Obtener todas las compras
  const { data: payments, error: paymentsError } = await supabase
    .from('conversion_events')
    .select('user_id, created_at, event_data')
    .eq('event_type', 'payment_completed');

  if (paymentsError) {
    console.error('❌ Error obteniendo pagos:', paymentsError);
    return;
  }

  console.log(`💳 Total pagos registrados: ${payments.length}\n`);

  // 3. Crear set de usuarios con pagos
  const paidUserIds = new Set(payments.map(p => p.user_id));

  // 4. Filtrar usuarios premium sin pago (excluyendo nila y manuel)
  const premiumWithoutPayment = premiumUsers.filter(u => {
    // Excluir nila y manuel
    if (u.email && (u.email.toLowerCase().includes('nila') || u.email.toLowerCase().includes('manuel'))) {
      return false;
    }
    // Verificar si NO tiene pago
    return !paidUserIds.has(u.id);
  });

  console.log('='.repeat(70));
  console.log('🎯 RESULTADO DE LA VERIFICACIÓN');
  console.log('='.repeat(70));
  console.log('');

  if (premiumWithoutPayment.length === 0) {
    console.log('✅ PERFECTO: Todos los usuarios premium tienen compras registradas');
    console.log('   (excluyendo cuentas de nila y manuel)');
  } else {
    console.log(`⚠️  ENCONTRADOS ${premiumWithoutPayment.length} USUARIOS PREMIUM SIN COMPRA:\n`);

    premiumWithoutPayment.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email || 'sin email'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Plan: ${user.plan_type}`);
      console.log(`   Registrado: ${user.created_at}`);
      console.log('');
    });
  }

  // 5. Mostrar estadísticas de cuentas excluidas
  const excludedAccounts = premiumUsers.filter(u =>
    u.email && (u.email.toLowerCase().includes('nila') || u.email.toLowerCase().includes('manuel'))
  );

  if (excludedAccounts.length > 0) {
    console.log('='.repeat(70));
    console.log(`ℹ️  Cuentas excluidas de la verificación (${excludedAccounts.length}):\n`);
    excludedAccounts.forEach(acc => {
      const hasPurchase = paidUserIds.has(acc.id);
      console.log(`   • ${acc.email} - Plan: ${acc.plan_type} - Compra: ${hasPurchase ? '✅' : '❌'}`);
    });
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('📈 RESUMEN:');
  console.log('='.repeat(70));
  console.log(`Total premium: ${premiumUsers.length}`);
  console.log(`Con compra: ${premiumUsers.filter(u => paidUserIds.has(u.id)).length}`);
  console.log(`Sin compra: ${premiumUsers.filter(u => !paidUserIds.has(u.id)).length}`);
  console.log(`Excluidos (nila/manuel): ${excludedAccounts.length}`);
  console.log(`⚠️  Requieren atención: ${premiumWithoutPayment.length}`);
})();
