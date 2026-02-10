require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd';

(async () => {
  console.log('🔍 Investigando usuario sin compra: jinayda32@gmail.com\n');
  console.log('ID:', userId);
  console.log('');

  // 1. Datos del perfil
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  console.log('📋 PERFIL:');
  console.log('  Email:', profile.email);
  console.log('  Plan:', profile.plan_type);
  console.log('  Registrado:', profile.created_at);
  console.log('  Última actualización:', profile.updated_at);
  console.log('');

  // 2. Suscripciones
  const { data: subs } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId);

  console.log('💳 SUSCRIPCIONES:', subs ? subs.length : 0);
  if (subs && subs.length > 0) {
    subs.forEach((sub, i) => {
      console.log(`  [${i+1}] Status: ${sub.status}`);
      console.log(`      Plan: ${sub.plan_type}`);
      console.log(`      Stripe ID: ${sub.stripe_subscription_id || 'N/A'}`);
      console.log(`      Período: ${sub.current_period_start} → ${sub.current_period_end}`);
      console.log(`      Creada: ${sub.created_at}`);
      console.log('');
    });
  }

  // 3. Eventos de conversión
  const { data: events } = await supabase
    .from('conversion_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  console.log('📊 EVENTOS DE CONVERSIÓN:', events ? events.length : 0);
  if (events && events.length > 0) {
    events.forEach((evt, i) => {
      console.log(`  [${i+1}] Tipo: ${evt.event_type}`);
      console.log(`      Fecha: ${evt.created_at}`);
      console.log(`      Datos:`, JSON.stringify(evt.event_data, null, 2));
      console.log('');
    });
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('💡 CONCLUSIÓN:');
  console.log('='.repeat(70));

  if (!subs || subs.length === 0) {
    console.log('⚠️  NO tiene suscripciones → Plan premium asignado MANUALMENTE');
  } else if (subs.some(s => s.status === 'active')) {
    console.log('⚠️  Tiene suscripción activa pero SIN registro de pago');
    console.log('   Posibles causas:');
    console.log('   - Pago procesado antes de implementar tracking');
    console.log('   - Suscripción creada manualmente por admin');
    console.log('   - Error en webhook de Stripe');
  } else {
    console.log('⚠️  Suscripción inactiva pero mantiene plan premium');
    console.log('   Posible plan asignado manualmente');
  }
})();
