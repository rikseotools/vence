import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET() {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    console.log('📧 TEST: Enviando email directo...')
    
    const result = await resend.emails.send({
      from: 'Vence.es <info@vence.es>',
      to: 'manueltrader@gmail.com',
      subject: '🧪 TEST EMAIL - ' + new Date().toLocaleTimeString(),
      html: '<h1>Email de prueba</h1><p>Este es un email de prueba enviado directamente.</p>'
    })
    
    console.log('📧 TEST RESULT:', JSON.stringify(result, null, 2))
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ TEST ERROR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}