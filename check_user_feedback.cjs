const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Buscando conversación con begosaiz85@gmail.com...\n');

  // Buscar usuario
  const { data: user } = await supabase
    .from('user_profiles')
    .select('id, email, name')
    .eq('email', 'begosaiz85@gmail.com')
    .single();

  if (!user) {
    console.log('❌ Usuario no encontrado');
    return;
  }

  console.log('👤 Usuario encontrado:');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   Nombre:', user.name);
  console.log('');

  // Buscar feedback
  const { data: feedback } = await supabase
    .from('user_feedback')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  console.log('📝 Feedback encontrado:', feedback?.length || 0);
  console.log('');

  if (feedback && feedback.length > 0) {
    feedback.forEach((f, i) => {
      console.log('═'.repeat(80));
      console.log(`FEEDBACK #${i + 1} - ${new Date(f.created_at).toLocaleString('es-ES')}`);
      console.log('═'.repeat(80));
      console.log('Tipo:', f.type);
      console.log('Categoría:', f.category);
      console.log('Rating:', f.rating);
      console.log('Estado:', f.status);
      console.log('');
      console.log('Mensaje:');
      console.log(f.message);
      console.log('');
      if (f.context) {
        console.log('Contexto:');
        console.log(JSON.stringify(f.context, null, 2));
        console.log('');
      }
      if (f.admin_notes) {
        console.log('Notas admin:');
        console.log(f.admin_notes);
        console.log('');
      }
      console.log('');
    });
  }

  // Buscar también en cancellation_feedback si es relevante
  const { data: cancellations } = await supabase
    .from('cancellation_feedback')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (cancellations && cancellations.length > 0) {
    console.log('═'.repeat(80));
    console.log('💳 FEEDBACK DE CANCELACIÓN');
    console.log('═'.repeat(80));
    console.log('');
    cancellations.forEach((c, i) => {
      console.log(`Cancelación #${i + 1} - ${new Date(c.created_at).toLocaleString('es-ES')}`);
      console.log('Razón:', c.reason);
      console.log('Detalles:', c.details);
      console.log('');
    });
  }

  // Buscar tests del usuario para ver actividad
  const { data: tests } = await supabase
    .from('tests')
    .select('id, started_at, is_completed')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(10);

  console.log('═'.repeat(80));
  console.log('📊 ACTIVIDAD RECIENTE');
  console.log('═'.repeat(80));
  console.log(`Tests totales (últimos 10): ${tests?.length || 0}`);
  if (tests && tests.length > 0) {
    console.log('Último test:', new Date(tests[0].started_at).toLocaleString('es-ES'));
    console.log('Completado:', tests[0].is_completed ? 'Sí' : 'No');
  }
  console.log('');
})();
