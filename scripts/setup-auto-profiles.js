import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function setupAutoProfiles() {
  console.log('🔧 CONFIGURANDO PERFILES PÚBLICOS AUTOMÁTICOS\n')
  console.log('='.repeat(60))

  // Leer el SQL del archivo
  const sql = fs.readFileSync('scripts/create-auto-profile-trigger.sql', 'utf8')

  // Dividir el SQL en comandos individuales (separados por punto y coma)
  const commands = sql
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))

  let successCount = 0
  let errorCount = 0

  for (const command of commands) {
    try {
      // Ignorar comandos SELECT de verificación
      if (command.toUpperCase().includes('SELECT')) {
        const { data, error } = await supabase.rpc('query', { sql: command })
        if (error) {
          console.log('❌ Error en SELECT:', error.message)
        } else {
          console.log('✅ Consulta ejecutada:', data?.length || 0, 'resultados')
        }
      } else {
        // Para otros comandos, ejecutar directamente
        const { data, error } = await supabase.rpc('query', { sql: command })
        if (error) {
          // Si el error es porque ya existe, no es grave
          if (error.message.includes('already exists')) {
            console.log('⚠️  Ya existe:', command.substring(0, 50) + '...')
          } else {
            console.log('❌ Error:', error.message)
            console.log('   Comando:', command.substring(0, 100) + '...')
            errorCount++
          }
        } else {
          console.log('✅ Ejecutado:', command.substring(0, 50) + '...')
          successCount++
        }
      }
    } catch (err) {
      console.log('❌ Error inesperado:', err.message)
      errorCount++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 RESUMEN:')
  console.log(`✅ Comandos exitosos: ${successCount}`)
  console.log(`❌ Errores: ${errorCount}`)

  // Verificar cuántos perfiles públicos hay ahora
  const { count: profileCount } = await supabase
    .from('public_user_profiles')
    .select('*', { count: 'exact', head: true })

  const { data: authData } = await supabase.auth.admin.listUsers()
  const totalUsers = authData?.users?.length || 0

  console.log('\n📈 ESTADO ACTUAL:')
  console.log(`Total usuarios: ${totalUsers}`)
  console.log(`Perfiles públicos: ${profileCount}`)
  console.log(`Faltantes: ${totalUsers - profileCount}`)

  if (totalUsers - profileCount > 0) {
    console.log('\n⚠️  Aún faltan perfiles. Ejecutando creación manual...')

    // Intentar crear perfiles para usuarios faltantes
    for (const user of authData.users) {
      const { data: existingProfile } = await supabase
        .from('public_user_profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingProfile) {
        const displayName = user.user_metadata?.full_name ||
                          user.email?.split('@')[0] ||
                          'Usuario'

        const { error } = await supabase
          .from('public_user_profiles')
          .insert({
            id: user.id,
            display_name: displayName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (!error) {
          console.log(`✅ Perfil creado para: ${displayName}`)
        }
      }
    }
  }

  console.log('\n✨ Proceso completado!')
}

setupAutoProfiles().catch(console.error)