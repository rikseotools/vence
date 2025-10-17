import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function checkNilaStreakData() {
  try {
    console.log('🔍 Buscando datos de racha para usuario Nila...\n');
    
    // 1. Encontrar usuario Nila
    console.log('1️⃣ USUARIO NILA:');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .ilike('email', '%nila%')
      .limit(5);
    
    if (userError) {
      // Intentar con auth.users
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      const nilaUsers = authUsers?.users?.filter(u => u.email?.toLowerCase().includes('nila')) || [];
      
      if (nilaUsers.length > 0) {
        console.log('📧 Usuarios encontrados en auth.users:');
        nilaUsers.forEach(user => {
          console.log(`   ${user.email} (ID: ${user.id})`);
        });
        
        const nilaUser = nilaUsers[0];
        
        // 2. Actividad reciente de tests
        console.log('\n2️⃣ ACTIVIDAD RECIENTE (últimos 30 días):');
        const { data: recentActivity, error: activityError } = await supabase
          .from('test_sessions')
          .select('created_at, completed, total_questions, correct_answers')
          .eq('user_id', nilaUser.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .eq('completed', true)
          .order('created_at', { ascending: false });
        
        if (activityError) {
          console.error('❌ Error obteniendo actividad:', activityError);
        } else {
          console.log(`📊 Total de tests completados: ${recentActivity?.length || 0}`);
          
          // Agrupar por fecha
          const activePadandías = {};
          recentActivity?.forEach(session => {
            const date = new Date(session.created_at).toDateString();
            if (!activePadanías[date]) {
              activePadanías[date] = 0;
            }
            activePadanías[date]++;
          });
          
          const sortedDates = Object.entries(activePadanías)
            .sort(([a], [b]) => new Date(b) - new Date(a))
            .slice(0, 15); // Últimos 15 días con actividad
          
          console.log('\n📅 Días con actividad (últimos 15):');
          sortedDates.forEach(([date, count]) => {
            const daysAgo = Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24));
            console.log(`   ${date}: ${count} tests (hace ${daysAgo} días)`);
          });
          
          // 3. Calcular racha usando la misma lógica del código
          console.log('\n3️⃣ CÁLCULO DE RACHA:');
          const uniqueDays = [...new Set(recentActivity?.map(session => 
            new Date(session.created_at).toDateString()
          ))].sort((a, b) => new Date(b) - new Date(a));
          
          console.log(`📈 Días únicos con actividad: ${uniqueDays.length}`);
          
          // Calcular racha consecutiva
          let streak = 0;
          let consecutiveMisses = 0;
          const today = new Date();
          
          for (let i = 0; i < 30; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateStr = checkDate.toDateString();
            
            if (uniqueDays.includes(dateStr)) {
              streak++;
              consecutiveMisses = 0;
              console.log(`   ✅ Día ${i}: ${dateStr} - actividad encontrada (racha: ${streak})`);
            } else {
              consecutiveMisses++;
              console.log(`   ❌ Día ${i}: ${dateStr} - sin actividad (faltas consecutivas: ${consecutiveMisses})`);
              if (consecutiveMisses >= 2) {
                console.log(`   🔥 Racha rota tras ${consecutiveMisses} días sin actividad`);
                break;
              }
            }
          }
          
          console.log(`\n🎯 RACHA CALCULADA: ${streak} días`);
          
        }
        
        // 4. Verificar analytics_daily_user_stats si existe
        console.log('\n4️⃣ ANALYTICS DAILY USER STATS:');
        const { data: analytics, error: analyticsError } = await supabase
          .from('analytics_daily_user_stats')
          .select('current_streak_days, longest_streak_days, updated_at, total_study_days')
          .eq('user_id', nilaUser.id)
          .single();
        
        if (analyticsError) {
          console.log('❌ Tabla analytics_daily_user_stats no encontrada o sin datos');
        } else {
          console.log(`📊 Current streak (analytics): ${analytics.current_streak_days}`);
          console.log(`🏆 Longest streak (analytics): ${analytics.longest_streak_days}`);
          console.log(`📅 Last updated: ${analytics.updated_at}`);
          console.log(`📚 Total study days: ${analytics.total_study_days}`);
        }
        
      } else {
        console.log('❌ No se encontró usuario con email que contenga "nila"');
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

checkNilaStreakData();