// app/api/admin/users-count/route.js - API para obtener conteo real de usuarios
import { createClient } from '@supabase/supabase-js'

// Cliente con service role para bypass completo de RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role key del servidor
)

export async function GET(request) {
  try {
    console.log('🔍 API: Obteniendo todos los usuarios...')
    
    // Obtener todos los usuarios
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
    
    if (usersError) {
      console.error('❌ Error obteniendo usuarios:', usersError)
      return Response.json({ error: usersError.message }, { status: 500 })
    }
    
    // Obtener todas las preferencias de email
    const { data: emailPrefs, error: prefsError } = await supabaseAdmin
      .from('email_preferences')
      .select('user_id, unsubscribed_all')
    
    if (prefsError) {
      console.error('❌ Error obteniendo preferencias:', prefsError)
      return Response.json({ error: prefsError.message }, { status: 500 })
    }
    
    // Procesar suscripciones
    const prefsMap = new Map()
    emailPrefs?.forEach(pref => prefsMap.set(pref.user_id, pref))
    
    let subscribed = 0
    let unsubscribed = 0
    
    allUsers.forEach(user => {
      const userPrefs = prefsMap.get(user.id)
      // Un usuario está NO suscrito SOLO si existe el registro Y unsubscribed_all es true
      if (userPrefs && userPrefs.unsubscribed_all === true) {
        unsubscribed++
        console.log(`❌ Usuario ${user.id} NO suscrito`)
      } else {
        subscribed++
        console.log(`✅ Usuario ${user.id} suscrito`)
      }
    })
    
    const total = allUsers.length
    const subscriptionRate = total > 0 ? ((subscribed / total) * 100).toFixed(1) : 0
    
    console.log(`✅ API: ${subscribed} suscritos, ${unsubscribed} no suscritos de ${total} usuarios totales`)
    
    return Response.json({
      total,
      subscribed,
      unsubscribed,
      subscriptionRate: parseFloat(subscriptionRate)
    })
    
  } catch (error) {
    console.error('❌ Error en API users-count:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}