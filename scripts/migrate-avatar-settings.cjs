/**
 * Script para crear registros de user_avatar_settings
 * para usuarios existentes que no tienen uno.
 *
 * Uso: node scripts/migrate-avatar-settings.cjs
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateAvatarSettings() {
  console.log('🚀 Iniciando migración de avatar_settings...\n');

  // 1. Obtener todos los user_ids que YA tienen avatar_settings
  const { data: existingSettings } = await supabase
    .from('user_avatar_settings')
    .select('user_id');

  const existingIds = new Set(existingSettings?.map(s => s.user_id) || []);
  console.log(`✅ Usuarios con avatar_settings existentes: ${existingIds.size}`);

  // 2. Obtener todos los usuarios de user_profiles
  const { data: allUsers, error: usersError } = await supabase
    .from('user_profiles')
    .select('id');

  if (usersError) {
    console.error('❌ Error obteniendo usuarios:', usersError);
    return;
  }

  console.log(`👥 Total usuarios en user_profiles: ${allUsers?.length || 0}`);

  // 3. Filtrar usuarios que NO tienen avatar_settings
  const usersWithoutSettings = allUsers?.filter(u => !existingIds.has(u.id)) || [];
  console.log(`🔍 Usuarios SIN avatar_settings: ${usersWithoutSettings.length}\n`);

  if (usersWithoutSettings.length === 0) {
    console.log('✨ Todos los usuarios ya tienen avatar_settings. Nada que hacer.');
    return;
  }

  // 4. Crear registros en batches de 100
  const BATCH_SIZE = 100;
  let created = 0;
  let errors = 0;

  for (let i = 0; i < usersWithoutSettings.length; i += BATCH_SIZE) {
    const batch = usersWithoutSettings.slice(i, i + BATCH_SIZE);

    const records = batch.map(user => ({
      user_id: user.id,
      mode: 'automatic',
      current_profile: null,
      current_emoji: null,
      current_name: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('user_avatar_settings')
      .insert(records);

    if (insertError) {
      console.error(`❌ Error en batch ${i / BATCH_SIZE + 1}:`, insertError.message);
      errors += batch.length;
    } else {
      created += batch.length;
      console.log(`💾 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} registros creados (${created}/${usersWithoutSettings.length})`);
    }
  }

  console.log('\n========================================');
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('========================================');
  console.log(`✅ Registros creados: ${created}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📝 Total procesados: ${usersWithoutSettings.length}`);
  console.log('========================================\n');

  // 5. Verificar resultado final
  const { data: finalCount } = await supabase
    .from('user_avatar_settings')
    .select('user_id', { count: 'exact', head: true });

  console.log(`🎉 Total registros en user_avatar_settings ahora: consulta la tabla para verificar`);
}

migrateAvatarSettings().catch(console.error);
