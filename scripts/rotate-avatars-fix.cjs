/**
 * Script para recalcular avatares usando test_questions (misma fuente que el ranking)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROFILES = [
  { id: 'unicorn', emoji: '🦄', nameEs: 'Unicornio Legendario', nameEsF: 'Unicornio Legendario', priority: 95 },
  { id: 'champion', emoji: '🦁', nameEs: 'León Campeón', nameEsF: 'Leona Campeona', priority: 90 },
  { id: 'consistent', emoji: '🐢', nameEs: 'Tortuga Constante', nameEsF: null, priority: 85 },
  { id: 'worker_ant', emoji: '🐜', nameEs: 'Hormiga Trabajadora', nameEsF: null, priority: 80 },
  { id: 'speed_eagle', emoji: '🦅', nameEs: 'Águila Veloz', nameEsF: null, priority: 75 },
  { id: 'smart_dolphin', emoji: '🐬', nameEs: 'Delfín Inteligente', nameEsF: null, priority: 70 },
  { id: 'busy_bee', emoji: '🐝', nameEs: 'Abeja Productiva', nameEsF: null, priority: 65 },
  { id: 'clever_squirrel', emoji: '🐿️', nameEs: 'Ardilla Astuta', nameEsF: null, priority: 60 },
  { id: 'night_owl', emoji: '🦉', nameEs: 'Búho Nocturno', nameEsF: null, priority: 55 },
  { id: 'early_bird', emoji: '🐓', nameEs: 'Gallo Madrugador', nameEsF: null, priority: 50 },
  { id: 'relaxed_koala', emoji: '🐨', nameEs: 'Koala Relajado', nameEsF: null, priority: 10 }
];

async function calculateUserProfile(userId) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Usar test_questions via tests (misma fuente que el ranking)
  const { data: answers } = await supabase
    .from('test_questions')
    .select(`
      is_correct,
      created_at,
      tests!inner(user_id)
    `)
    .eq('tests.user_id', userId)
    .gte('created_at', oneWeekAgo.toISOString());

  if (!answers || answers.length === 0) {
    return PROFILES.find(p => p.id === 'relaxed_koala');
  }

  const total = answers.length;
  const correct = answers.filter(a => a.is_correct).length;
  const accuracy = (correct / total) * 100;

  const uniqueDays = new Set(answers.map(a => a.created_at.split('T')[0]));
  const daysActive = uniqueDays.size;

  const { data: streakData } = await supabase
    .from('user_profiles')
    .select('current_streak')
    .eq('id', userId)
    .single();

  const streak = streakData?.current_streak || 0;

  // Unicornio Legendario: accuracy > 90% Y > 150 preguntas (25/día × 6 días)
  if (accuracy > 90 && total > 150) {
    return PROFILES.find(p => p.id === 'unicorn');
  }

  // León Campeón: accuracy > 85% Y > 150 preguntas (25/día × 6 días)
  if (accuracy > 85 && total > 150) {
    return PROFILES.find(p => p.id === 'champion');
  }

  // Tortuga Constante: streak > 14 días
  if (streak > 14) {
    return PROFILES.find(p => p.id === 'consistent');
  }

  // Hormiga Trabajadora: estudia todos los días (7 días)
  if (daysActive >= 7) {
    return PROFILES.find(p => p.id === 'worker_ant');
  }

  // Águila Veloz: > 100 preguntas/semana
  if (total > 100) {
    return PROFILES.find(p => p.id === 'speed_eagle');
  }

  // Delfín Inteligente: accuracy > 70%
  if (accuracy > 70) {
    return PROFILES.find(p => p.id === 'smart_dolphin');
  }

  // Abeja Productiva: estudia en varios momentos del día
  const hours = answers.map(a => new Date(a.created_at).getHours());
  const hasMorning = hours.some(h => h >= 6 && h < 12);
  const hasAfternoon = hours.some(h => h >= 12 && h < 18);
  const hasNight = hours.some(h => h >= 18 || h < 6);
  if (hasMorning && hasAfternoon && hasNight) {
    return PROFILES.find(p => p.id === 'busy_bee');
  }

  // Búho Nocturno
  const nightAnswers = answers.filter(a => {
    const hour = new Date(a.created_at).getHours();
    return hour >= 21 || hour < 6;
  });
  if (nightAnswers.length > total * 0.5) {
    return PROFILES.find(p => p.id === 'night_owl');
  }

  // Gallo Madrugador
  const morningAnswers = answers.filter(a => {
    const hour = new Date(a.created_at).getHours();
    return hour >= 5 && hour < 9;
  });
  if (morningAnswers.length > total * 0.5) {
    return PROFILES.find(p => p.id === 'early_bird');
  }

  // Koala Relajado: < 20 preguntas/semana
  if (total < 20) {
    return PROFILES.find(p => p.id === 'relaxed_koala');
  }

  return PROFILES.find(p => p.id === 'smart_dolphin');
}

async function rotateAvatars() {
  console.log('🔄 Recalculando TODOS los avatares con datos correctos...\n');

  // Obtener TODOS los usuarios en modo automático
  const { data: allAutoUsers } = await supabase
    .from('user_avatar_settings')
    .select('user_id')
    .eq('mode', 'automatic');

  const userIds = allAutoUsers?.map(u => u.user_id) || [];
  console.log('Usuarios en modo automático:', userIds.length);

  // Obtener género de usuarios
  const { data: userGenders } = await supabase
    .from('user_profiles')
    .select('id, gender')
    .in('id', userIds);

  const genderMap = new Map(
    (userGenders || []).map(u => [u.id, u.gender === 'female' || u.gender === 'mujer'])
  );

  let updated = 0;
  let errors = 0;
  const results = { unicorn: 0, champion: 0, consistent: 0, worker_ant: 0, speed_eagle: 0, smart_dolphin: 0, busy_bee: 0, clever_squirrel: 0, night_owl: 0, early_bird: 0, relaxed_koala: 0 };

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];

    try {
      const profile = await calculateUserProfile(userId);
      if (!profile) {
        errors++;
        continue;
      }

      results[profile.id]++;

      const isFemale = genderMap.get(userId) || false;
      const profileName = (isFemale && profile.nameEsF) ? profile.nameEsF : profile.nameEs;

      const { error } = await supabase
        .from('user_avatar_settings')
        .update({
          current_profile: profile.id,
          current_emoji: profile.emoji,
          current_name: profileName,
          last_rotation_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        errors++;
      } else {
        updated++;
      }
    } catch (err) {
      errors++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`Procesados: ${i + 1}/${userIds.length}`);
    }
  }

  console.log('\n========================================');
  console.log('📊 RESUMEN DE ROTACIÓN');
  console.log('========================================');
  console.log('✅ Avatares actualizados:', updated);
  console.log('❌ Errores:', errors);
  console.log('\n🎭 Distribución de perfiles:');
  Object.entries(results).sort((a, b) => b[1] - a[1]).forEach(([id, count]) => {
    const profile = PROFILES.find(p => p.id === id);
    if (count > 0) {
      console.log(`  ${profile.emoji} ${profile.nameEs}: ${count}`);
    }
  });
  console.log('========================================');
}

rotateAvatars().catch(console.error);
