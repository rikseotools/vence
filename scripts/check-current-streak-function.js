// Ver la función ACTUAL de get_user_public_stats que está en producción
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkCurrentFunction() {
  try {
    console.log('🔍 Verificando función get_user_public_stats en producción...\n')

    // Ejecutar query SQL directa para ver la definición de la función
    const { data, error } = await supabase
      .rpc('execute_sql', {
        sql: `
          SELECT
            pg_get_functiondef(p.oid) as function_definition
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
            AND p.proname = 'get_user_public_stats';
        `
      })

    if (error) {
      console.log('❌ Error con execute_sql, intentando método alternativo...')

      // Método alternativo: usar pg_catalog
      const query = `
        SELECT routine_definition
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name = 'get_user_public_stats';
      `

      console.log('Query:', query)
      console.log('\n⚠️ Necesitas ejecutar esta query manualmente en Supabase SQL Editor')
      console.log('o usar psql directamente para ver la función actual.\n')

      // Por ahora, verificar llamando la función con un usuario
      console.log('📊 Probando la función con Inma Corcuera...\n')
      const inmaId = '7194d681-0047-47da-8d2f-45634b2605a1'

      const { data: stats, error: statsError } = await supabase
        .rpc('get_user_public_stats', { p_user_id: inmaId })

      if (statsError) {
        console.error('❌ Error:', statsError)
      } else {
        console.log('✅ Función get_user_public_stats devuelve:', stats[0])
        console.log('\n🔍 Verificando si usa tabla user_streaks o calcula en tiempo real...')

        // Verificar si hay tabla user_streaks
        const { data: streakData, error: streakError } = await supabase
          .from('user_streaks')
          .select('*')
          .eq('user_id', inmaId)
          .single()

        if (streakError) {
          console.log('❌ No se puede leer user_streaks:', streakError.message)
        } else {
          console.log('\n📊 Datos en user_streaks:')
          console.log('  current_streak:', streakData.current_streak)
          console.log('  longest_streak:', streakData.longest_streak)
          console.log('\n📊 Datos desde RPC:')
          console.log('  current_streak:', stats[0].streak || stats[0].current_streak)
          console.log('  longest_streak:', stats[0].longest_streak)

          if (streakData.current_streak === (stats[0].streak || stats[0].current_streak)) {
            console.log('\n✅ La RPC está usando la tabla user_streaks directamente')
          } else {
            console.log('\n⚠️ La RPC está calculando las rachas en tiempo real (no usa user_streaks)')
          }
        }
      }
      return
    }

    console.log('Definición de función:', data)

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

checkCurrentFunction()
