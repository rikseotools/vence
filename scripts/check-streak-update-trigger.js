import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkStreakSystem() {
  console.log('🔍 ANALIZANDO SISTEMA DE ACTUALIZACIÓN DE RACHAS\n')
  console.log('='.repeat(60))

  // 1. Ver cómo se actualiza la tabla user_streaks
  console.log('\n📊 ESTRUCTURA DE LA TABLA user_streaks:')
  const { data: columns } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'user_streaks')

  if (columns) {
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`)
    })
  }

  // 2. Verificar actividad reciente de Nila
  const { data: nilaProfile } = await supabase
    .from('public_user_profiles')
    .select('id')
    .eq('display_name', 'Nila')
    .single()

  if (nilaProfile) {
    console.log(`\n👤 ACTIVIDAD DE NILA (${nilaProfile.id.substring(0, 8)}...):`)

    // Últimas actividades
    const { data: recentTests } = await supabase
      .from('tests')
      .select('id, created_at')
      .eq('user_id', nilaProfile.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentTests) {
      console.log('\nÚltimos 5 tests:')
      recentTests.forEach(test => {
        const date = new Date(test.created_at)
        console.log(`  - ${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES')}`)
      })
    }

    // Ver rachas guardadas
    const { data: streak } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', nilaProfile.id)
      .single()

    if (streak) {
      console.log('\n📈 DATOS DE RACHA GUARDADOS:')
      console.log(`  - Racha actual: ${streak.current_streak} días`)
      console.log(`  - Racha más larga: ${streak.longest_streak} días`)
      console.log(`  - Última actividad: ${streak.last_activity_date}`)
      console.log(`  - Actualizado: ${streak.updated_at}`)

      // Calcular si debería seguir activa
      const lastActivity = new Date(streak.last_activity_date)
      const today = new Date()
      const daysSince = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24))

      console.log(`\n⚠️ Días desde última actividad: ${daysSince}`)
      if (daysSince <= 1) {
        console.log('✅ La racha debería estar activa')
      } else if (daysSince === 2) {
        console.log('⚠️ Hoy es el último día de gracia')
      } else {
        console.log('❌ La racha debería haberse roto')
      }
    }
  }

  console.log('\n💡 PROBLEMA IDENTIFICADO:')
  console.log('La tabla user_streaks parece estar guardando las rachas correctamente.')
  console.log('El límite de 60 días está en el FRONTEND (utils/streakCalculator.js).')
  console.log('\nSOLUCIÓN RECOMENDADA:')
  console.log('En lugar de calcular la racha en el frontend, usar directamente')
  console.log('los valores de user_streaks que ya están calculados en la BD.')
}

checkStreakSystem().catch(console.error)