require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  // Obtener conversaciones de los últimos 5 días
  const { data: logs } = await supabase
    .from('ai_chat_logs')
    .select('user_id, created_at')
    .gte('created_at', fiveDaysAgo.toISOString())
    .eq('had_error', false)
    .order('created_at', { ascending: true });

  // Obtener usuarios premium
  const userIds = [...new Set(logs.map(l => l.user_id))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, plan_type')
    .in('id', userIds);

  const premiumUserIds = new Set((profiles || []).filter(p => p.plan_type === 'premium').map(p => p.id));

  console.log('📊 ANÁLISIS DE LÍMITES DE CHAT (últimos 5 días)');
  console.log('═══════════════════════════════════════════════\n');

  // Agrupar por usuario y día
  const userDailyMessages = {};
  logs.forEach(log => {
    const userId = log.user_id;
    const date = new Date(log.created_at).toISOString().split('T')[0];
    const key = `${userId}_${date}`;

    if (!userDailyMessages[key]) {
      userDailyMessages[key] = {
        userId,
        date,
        count: 0,
        isPremium: premiumUserIds.has(userId)
      };
    }
    userDailyMessages[key].count++;
  });

  // Analizar límites
  const entries = Object.values(userDailyMessages);
  const freeUsers = entries.filter(e => !e.isPremium);
  const premiumUsers = entries.filter(e => e.isPremium);
  const usersAtLimit = freeUsers.filter(e => e.count >= 5);
  const usersOverLimit = freeUsers.filter(e => e.count > 5);

  console.log('👥 RESUMEN:');
  console.log(`- Días-usuario FREE: ${freeUsers.length}`);
  console.log(`- Días-usuario PREMIUM: ${premiumUsers.length}`);
  console.log(`- FREE alcanzaron límite (≥5): ${usersAtLimit.length}`);
  console.log(`- FREE superaron límite (>5): ${usersOverLimit.length}\n`);

  if (usersOverLimit.length > 0) {
    console.log('⚠️ USUARIOS QUE SUPERARON EL LÍMITE:\n');
    usersOverLimit.forEach(entry => {
      const userIdDisplay = entry.userId ? entry.userId.substring(0, 8) + '...' : 'null (anónimo)';
      console.log(`- Usuario: ${userIdDisplay}`);
      console.log(`  Fecha: ${entry.date}`);
      console.log(`  Mensajes: ${entry.count} (límite: 5)\n`);
    });
  } else if (usersAtLimit.length > 0) {
    console.log('✅ Ningún usuario superó el límite de 5 mensajes/día');
    console.log(`   (pero ${usersAtLimit.length} alcanzaron exactamente 5)\n`);
  } else {
    console.log('✅ Ningún usuario alcanzó el límite de 5 mensajes/día\n');
  }

  // Distribución de mensajes diarios
  if (freeUsers.length > 0) {
    const messageCounts = freeUsers.map(e => e.count).sort((a, b) => a - b);
    console.log('📈 DISTRIBUCIÓN (usuarios FREE):\n');
    console.log(`- Mínimo: ${Math.min(...messageCounts)} mensajes/día`);
    console.log(`- Máximo: ${Math.max(...messageCounts)} mensajes/día`);
    console.log(`- Promedio: ${(messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length).toFixed(1)} mensajes/día`);
    console.log(`- Mediana: ${messageCounts[Math.floor(messageCounts.length / 2)]} mensajes/día`);
  }
})();
