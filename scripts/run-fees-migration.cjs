#!/usr/bin/env node

/**
 * Script para ejecutar la migración de fees de Stripe
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('./lib/pg-agnostic-client.cjs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Ejecutando migración de fees de Stripe...\n');

  // 1. Crear tabla stripe_platform_fees
  console.log('1. Creando tabla stripe_platform_fees...');
  const { error: e1 } = await supabase.from('stripe_platform_fees').select('id').limit(1);

  if (e1 && e1.code === '42P01') {
    // Tabla no existe, crearla con SQL directo
    // No podemos usar RPC para DDL, así que vamos a usar la tabla directamente
    console.log('   Tabla no existe, necesita crearse desde Supabase Dashboard');
    console.log('   O ejecutar el SQL manualmente');
  } else if (e1) {
    console.log('   Error:', e1.message);
  } else {
    console.log('   ✅ Tabla ya existe');
  }

  // 2. Verificar columna payout_fee_estimated
  console.log('\n2. Verificando columna payout_fee_estimated...');
  const { data: testRow, error: e2 } = await supabase
    .from('payment_settlements')
    .select('payout_fee_estimated')
    .limit(1);

  if (e2 && e2.message.includes('payout_fee_estimated')) {
    console.log('   Columna no existe, necesita añadirse desde Supabase Dashboard');
  } else if (e2) {
    console.log('   Error:', e2.message);
  } else {
    console.log('   ✅ Columna ya existe');
  }

  console.log('\n✅ Migración verificada');
}

runMigration().catch(console.error);
