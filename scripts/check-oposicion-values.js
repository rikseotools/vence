// Script para verificar los valores de oposición en la base de datos
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkOposicionValues() {
  console.log('🔍 VERIFICANDO VALORES DE OPOSICIÓN EN LA BASE DE DATOS')
  console.log('=' . repeat(60))

  try {
    // 1. Obtener todos los valores únicos de target_oposicion
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('target_oposicion')
      .not('target_oposicion', 'is', null)
      .limit(200)

    if (error) {
      console.error('Error:', error)
      return
    }

    // Contar valores únicos
    const oposicionCount = {}
    profiles.forEach(profile => {
      const op = profile.target_oposicion
      oposicionCount[op] = (oposicionCount[op] || 0) + 1
    })

    console.log('\n📊 VALORES ÚNICOS DE target_oposicion:')
    console.log('-'.repeat(40))

    Object.entries(oposicionCount)
      .sort((a, b) => b[1] - a[1]) // Ordenar por frecuencia
      .forEach(([oposicion, count]) => {
        const isUUID = oposicion.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        if (isUUID) {
          console.log(`❌ UUID: ${oposicion} (${count} usuarios)`)
        } else {
          console.log(`✅ Valor válido: "${oposicion}" (${count} usuarios)`)
        }
      })

    // 2. Buscar usuarios con UUIDs específicamente
    const uuidPattern = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

    console.log('\n🔍 USUARIOS CON UUID EN target_oposicion:')
    console.log('-'.repeat(40))

    // Filtrar los que tienen UUID
    const usersWithUUID = profiles.filter(p => {
      return p.target_oposicion?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    console.log(`Total usuarios con UUID: ${usersWithUUID.length}`)

    if (usersWithUUID.length > 0) {
      console.log('\nPrimeros 5 UUIDs encontrados:')
      usersWithUUID.slice(0, 5).forEach(user => {
        console.log(`  - ${user.target_oposicion}`)
      })
    }

    // 3. Valores esperados
    console.log('\n✅ VALORES ESPERADOS (según el código):')
    console.log('-'.repeat(40))
    const valoresEsperados = [
      'auxiliar_administrativo_estado',
      'administrativo_estado',
      'gestion_estado',
      'tramitacion_procesal',
      'auxilio_judicial',
      'gestion_procesal'
    ]

    valoresEsperados.forEach(valor => {
      const count = oposicionCount[valor] || 0
      console.log(`  - ${valor}: ${count} usuarios`)
    })

    // 4. Recomendación
    console.log('\n💡 RECOMENDACIÓN:')
    console.log('-'.repeat(40))
    if (usersWithUUID.length > 0) {
      console.log('Hay usuarios con UUIDs en lugar de códigos de oposición.')
      console.log('Esto puede deberse a:')
      console.log('1. Un bug en el formulario de registro/onboarding')
      console.log('2. Migración de datos incorrecta')
      console.log('3. Valores guardados antes de implementar el sistema actual')
      console.log('\nSolución: Actualizar estos registros con valores válidos')
    }

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

checkOposicionValues()