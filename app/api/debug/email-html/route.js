// Endpoint temporal para debuggear el HTML del email
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId') || 'modal_articulos'
    const userId = searchParams.get('userId') || 'test-user'
    const testMode = false

    console.log('🔍 Debug HTML con templateId:', templateId)

    // Simular el contenido del email de modal_articulos
    let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Artículos problemáticos detectados automáticamente</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); padding: 25px; border-radius: 12px;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎯 Vence Mejora</h1>
    <p style="color: #bfdbfe; margin: 8px 0; font-size: 16px;">Detección automática de artículos problemáticos</p>
  </div>
  
  <h2 style="color: #2563eb; font-size: 22px;">¡Hola Manuel! 👋</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #374151;">
    Ya no tienes que apuntarte manualmente qué artículos fallas más a menudo. <strong>Vence ahora los detecta automáticamente</strong> y te los muestra en una sección especial.
  </p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://www.vence.es/auxiliar-administrativo-estado/test" style="display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
      🎯 Probar Ahora
    </a>
  </div>
</body>
</html>`

    // Añadir tracking pixel para detectar aperturas (solo en modo real)
    if (!testMode) {
      console.log('🔍 Generando tracking pixel con templateId:', templateId)
      const trackingPixel = `<img src="https://www.vence.es/api/email-tracking/open?user_id=${userId}&email_id=newsletter_${Date.now()}&type=newsletter&template_id=${templateId || 'newsletter'}" width="1" height="1" style="display:none;" alt="">`
      htmlContent = htmlContent.replace('</body>', `${trackingPixel}</body>`)
    }

    // Añadir tracking a enlaces (solo en modo real)
    if (!testMode) {
      console.log('🔍 Generando tracking de enlaces con templateId:', templateId)
      // Reemplazar enlaces que apuntan a vence.es con tracking
      htmlContent = htmlContent.replace(
        /href="(https?:\/\/(?:www\.)?vence\.es[^"]*)"/g,
        `href="https://www.vence.es/api/email-tracking/click?user_id=${userId}&type=newsletter&action=newsletter_link&template_id=${templateId || 'newsletter'}&redirect=$1"`
      )
    }

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('❌ Error generando HTML debug:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}