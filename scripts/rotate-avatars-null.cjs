/**
 * Script para asignar avatares a usuarios con current_emoji NULL
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Definición de perfiles (copiado de la configuración)
const PROFILES = [
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
  // Obtener métricas del usuario de la última semana
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data: answers } = await supabase
    .from('user_question_history')
    .select('is_correct, answered_at')
    .eq('user_id', userId)
    .gte('answered_at', oneWeekAgo.toISOString());

  if (!answers || answers.length === 0) {
    // Sin actividad = Koala Relajado
    return PROFILES.find(p => p.id === 'relaxed_koala');
  }

  const total = answers.length;
  const correct = answers.filter(a => a.is_correct).length;
  const accuracy = (correct / total) * 100;

  // Calcular días activos
  const uniqueDays = new Set(answers.map(a => a.answered_at.split('T')[0]));
  const daysActive = uniqueDays.size;

  // Obtener racha actual
  const { data: streakData } = await supabase
    .from('user_profiles')
    .select('current_streak')
    .eq('id', userId)
    .single();

  const streak = streakData?.current_streak || 0;

  // Determinar perfil basado en métricas (orden por prioridad)

  // León Campeón: accuracy > 85%
  if (accuracy > 85) {
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

  // Delfín Inteligente: mejora > 10% (simplificado - accuracy > 70%)
  if (accuracy > 70) {
    return PROFILES.find(p => p.id === 'smart_dolphin');
  }

  // Abeja Productiva: estudia en varios momentos del día
  const hours = answers.map(a => new Date(a.answered_at).getHours());
  const hasMorning = hours.some(h => h >= 6 && h < 12);
  const hasAfternoon = hours.some(h => h >= 12 && h < 18);
  const hasNight = hours.some(h => h >= 18 || h < 6);
  if (hasMorning && hasAfternoon && hasNight) {
    return PROFILES.find(p => p.id === 'busy_bee');
  }

  // Búho Nocturno: mayoría de sesiones después de 21:00
  const nightAnswers = answers.filter(a => {
    const hour = new Date(a.answered_at).getHours();
    return hour >= 21 || hour < 6;
  });
  if (nightAnswers.length > total * 0.5) {
    return PROFILES.find(p => p.id === 'night_owl');
  }

  // Gallo Madrugador: mayoría antes de 9:00
  const morningAnswers = answers.filter(a => {
    const hour = new Date(a.answered_at).getHours();
    return hour >= 5 && hour < 9;
  });
  if (morningAnswers.length > total * 0.5) {
    return PROFILES.find(p => p.id === 'early_bird');
  }

  // Koala Relajado: < 20 preguntas/semana
  if (total < 20) {
    return PROFILES.find(p => p.id === 'relaxed_koala');
  }

  // Default: Delfín Inteligente
  return PROFILES.find(p => p.id === 'smart_dolphin');
}

async function rotateAvatars() {
  console.log('🔄 Rotando avatares para usuarios sin emoji...\n');

  // 1. Obtener usuarios con current_emoji NULL
  const { data: usersWithoutEmoji } = await supabase
    .from('user_avatar_settings')
    .select('user_id')
    .is('current_emoji', null)
    .eq('mode', 'automatic');

  const userIds = usersWithoutEmoji?.map(u => u.user_id) || [];
  console.log('Usuarios sin emoji:', userIds.length);

  if (userIds.length === 0) {
    console.log('✨ Todos los usuarios ya tienen emoji asignado.');
    return;
  }

  // 2. Obtener género de usuarios
  const { data: userGenders } = await supabase
    .from('user_profiles')
    .select('id, gender')
    .in('id', userIds);

  const genderMap = new Map(
    (userGenders || []).map(u => [u.id, u.gender === 'female' || u.gender === 'mujer'])
  );

  // 3. Procesar usuarios
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];

    try {
      const profile = await calculateUserProfile(userId);
      if (!profile) {
        errors++;
        continue;
      }

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

    // Progreso cada 50 usuarios
    if ((i + 1) % 50 === 0) {
      console.log(`Procesados: ${i + 1}/${userIds.length}`);
    }
  }

  console.log('\n========================================');
  console.log('📊 RESUMEN DE ROTACIÓN');
  console.log('========================================');
  console.log('✅ Avatares asignados:', updated);
  console.log('❌ Errores:', errors);
  console.log('========================================');

  // Mostrar algunos ejemplos
  console.log('\n🎭 Ejemplos de avatares asignados:');
  const { data: samples } = await supabase
    .from('user_avatar_settings')
    .select('user_id, current_emoji, current_name')
    .in('user_id', userIds.slice(0, 10))
    .not('current_emoji', 'is', null);

  for (const s of samples || []) {
    const { data: profile } = await supabase
      .from('public_user_profiles')
      .select('display_name')
      .eq('id', s.user_id)
      .single();
    console.log(s.current_emoji, profile?.display_name || 'Usuario', '-', s.current_name);
  }
}

rotateAvatars().catch(console.error);
