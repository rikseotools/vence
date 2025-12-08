import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Probar con cliente normal (con RLS)
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Probar con service role (sin RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkAdminViewAccess() {
  console.log('🔍 VERIFICANDO ACCESO A admin_users_with_roles\n')
  console.log('='.repeat(60))

  // 1. Probar con cliente normal (como lo hace el componente)
  console.log('1️⃣ PROBANDO CON CLIENTE NORMAL (ANON KEY):')
  const { data: clientData, error: clientError } = await supabaseClient
    .from('admin_users_with_roles')
    .select('user_id, full_name, email')
    .limit(5)

  if (clientError) {
    console.log('   ❌ Error con cliente normal:', clientError.message)
  } else {
    console.log(`   ✅ Acceso exitoso, ${clientData?.length || 0} registros obtenidos`)
  }

  // 2. Probar con service role
  console.log('\n2️⃣ PROBANDO CON SERVICE ROLE:')
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('admin_users_with_roles')
    .select('user_id, full_name, email')
    .limit(5)

  if (adminError) {
    console.log('   ❌ Error con service role:', adminError.message)
  } else {
    console.log(`   ✅ Acceso exitoso, ${adminData?.length || 0} registros obtenidos`)
    if (adminData && adminData.length > 0) {
      console.log('   Ejemplo de registro:', {
        user_id: adminData[0].user_id?.substring(0, 8) + '...',
        full_name: adminData[0].full_name,
        email: adminData[0].email
      })
    }
  }

  // 3. Verificar si es una vista o tabla
  console.log('\n3️⃣ VERIFICANDO TIPO DE OBJETO EN BASE DE DATOS:')
  const { data: schemaData } = await supabaseAdmin
    .from('information_schema.tables')
    .select('table_name, table_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'admin_users_with_roles')
    .single()

  if (schemaData) {
    console.log(`   Tipo: ${schemaData.table_type}`)
  } else {
    console.log('   No se encontró admin_users_with_roles en el schema público')
  }

  // 4. Verificar public_user_profiles
  console.log('\n4️⃣ VERIFICANDO public_user_profiles:')
  const { data: publicData, error: publicError } = await supabaseClient
    .from('public_user_profiles')
    .select('id, display_name')
    .limit(5)

  if (publicError) {
    console.log('   ❌ Error accediendo a public_user_profiles:', publicError.message)
  } else {
    console.log(`   ✅ ${publicData?.length || 0} perfiles públicos obtenidos`)
  }

  // 5. Contar usuarios totales
  console.log('\n5️⃣ CONTANDO USUARIOS TOTALES:')
  const { count: totalUsers } = await supabaseAdmin
    .from('auth.users')
    .select('*', { count: 'exact', head: true })

  console.log(`   Total de usuarios en auth.users: ${totalUsers}`)

  const { count: publicProfiles } = await supabaseAdmin
    .from('public_user_profiles')
    .select('*', { count: 'exact', head: true })

  console.log(`   Total de perfiles públicos: ${publicProfiles}`)
}

checkAdminViewAccess().catch(console.error)