const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('═'.repeat(80));
  console.log('🔍 BÚSQUEDA DE FEEDBACK - begosaiz85@gmail.com');
  console.log('═'.repeat(80));
  console.log('');

  // 1. Buscar por email exacto
  const { data: user1 } = await supabase
    .from('user_profiles')
    .select('id, email, name')
    .eq('email', 'begosaiz85@gmail.com')
    .maybeSingle();

  // 2. Buscar variantes
  const { data: user2 } = await supabase
    .from('user_profiles')
    .select('id, email, name')
    .ilike('email', 'begosaiz%')
    .limit(5);

  // 3. Buscar por nombre Bego
  const { data: user3 } = await supabase
    .from('user_profiles')
    .select('id, email, name')
    .ilike('name', '%bego%')
    .limit(5);

  console.log('Resultados de búsqueda:');
  console.log('');

  if (user1) {
    console.log('✅ Encontrado por email exacto:');
    console.log('   Email:', user1.email);
    console.log('   Nombre:', user1.name);
    console.log('   ID:', user1.id);
  } else {
    console.log('❌ No encontrado por email exacto');
  }
  console.log('');

  if (user2 && user2.length > 0) {
    console.log('✅ Encontrado por email similar:');
    user2.forEach(u => {
      console.log('   Email:', u.email);
      console.log('   Nombre:', u.name);
      console.log('   ID:', u.id);
      console.log('');
    });
  } else {
    console.log('❌ No encontrado por email similar (begosaiz*)');
  }

  if (user3 && user3.length > 0) {
    console.log('✅ Encontrado por nombre (bego):');
    user3.forEach(u => {
      console.log('   Email:', u.email);
      console.log('   Nombre:', u.name);
      console.log('   ID:', u.id);
      console.log('');
    });
  } else {
    console.log('❌ No encontrado por nombre (bego)');
  }

  // 4. Mostrar últimos 30 feedbacks para revisar manualmente
  console.log('═'.repeat(80));
  console.log('📋 ÚLTIMOS 30 FEEDBACKS (para revisar manualmente)');
  console.log('═'.repeat(80));
  console.log('');

  const { data: recentFeedback } = await supabase
    .from('user_feedback')
    .select('id, type, message, created_at, status, user_id, user_profiles(email, name)')
    .order('created_at', { ascending: false })
    .limit(30);

  if (recentFeedback && recentFeedback.length > 0) {
    recentFeedback.forEach((f, i) => {
      console.log(`${i + 1}. ${new Date(f.created_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })}`);
      console.log(`   Email: ${f.user_profiles?.email || 'Sin email'}`);
      console.log(`   Nombre: ${f.user_profiles?.name || 'Sin nombre'}`);
      console.log(`   Estado: ${f.status}`);
      console.log(`   Tipo: ${f.type}`);
      console.log(`   Mensaje: ${f.message.substring(0, 120)}...`);
      console.log('');
    });
  }
})();
