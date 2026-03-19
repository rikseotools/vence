const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Usuarios de los últimos 7 días
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, created_at, target_oposicion')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('=== NUEVOS USUARIOS (últimos 7 días) ===');
  console.log('Total:', data.length);

  // Agrupar por oposición
  const byOposicion = {};
  data.forEach(u => {
    const op = u.target_oposicion || 'sin_definir';
    if (!byOposicion[op]) byOposicion[op] = [];
    byOposicion[op].push(u);
  });

  console.log('\n=== POR OPOSICIÓN ===');
  Object.entries(byOposicion)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([op, users]) => {
      console.log(op + ':', users.length);
    });

  console.log('\n=== DETALLE (últimos 15) ===');
  data.slice(0, 15).forEach(u => {
    const date = new Date(u.created_at).toLocaleDateString('es-ES');
    console.log(date, '-', u.target_oposicion || 'sin_definir', '-', u.email);
  });
}

main();
