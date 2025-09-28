// app/api/debug/register-bulk-emails/route.js - Registrar emails bulk enviados
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST() {
  try {
    // Los 10 emails que enviamos en el bulk
    const bulkEmailResults = [
      {"email":"1985merche@gmail.com","emailId":"9775a219-70d3-4a10-bfae-669d81fdabec"},
      {"email":"scespedesg911@gmail.com","emailId":"6995c4ef-d238-42af-887d-ab3ec38af285"},
      {"email":"marta_k_89@hotmail.com","emailId":"118b5a71-cf17-4143-bee1-f04795f2eb52"},
      {"email":"ismatarento@gmail.com","emailId":"a41b8d07-840c-4b14-ad4e-16344f215460"},
      {"email":"elena.depablo.edp@gmail.com","emailId":"a3781962-0c8e-4140-9011-0c5a991a472e"},
      {"email":"irbidan@gmail.com","emailId":"48553068-77ea-4528-a2fa-47e2a36ad2f9"},
      {"email":"eresprocom@gmail.com","emailId":"175c1783-e2cf-465b-9ea3-1185e952b93d"},
      {"email":"faqmakemoney@gmail.com","emailId":"5c4afe8e-ee96-4e24-9e3c-1821ad600542"},
      {"email":"pilarsc1285@gmail.com","emailId":"80184d80-0aed-40e2-88e4-1f46bba04489"},
      {"email":"manueltrader@gmail.com","emailId":"5fc2d2d1-b52a-45ca-acc4-ce574583aca1"}
    ]

    console.log('📊 Registrando retroactivamente emails bulk...')

    // Obtener user_id para cada email
    const emailEvents = []
    
    for (const emailData of bulkEmailResults) {
      // Buscar user_id por email
      const { data: user } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', emailData.email)
        .single()

      if (user) {
        emailEvents.push({
          user_id: user.id,
          event_type: 'sent',
          email_type: 'reactivation',
          email_address: emailData.email,
          subject: '🚀 ¡Hemos mejorado mucho! Nuevos 16 temas completos - ILoveTest',
          template_id: 'reactivation_v1',
          email_content_preview: 'Email de reactivación con nuevas funcionalidades y motivación',
          created_at: new Date().toISOString()
        })
      }
    }

    // Insertar todos los eventos en bulk
    const { data, error } = await supabase
      .from('email_events')
      .insert(emailEvents)

    if (error) throw error

    console.log(`✅ Registrados ${emailEvents.length} emails en BD`)

    return NextResponse.json({
      success: true,
      message: `Registrados retroactivamente ${emailEvents.length} emails`,
      registeredEmails: emailEvents.length,
      events: emailEvents
    })

  } catch (error) {
    console.error('❌ Error registrando emails bulk:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}