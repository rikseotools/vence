// app/api/log-notification-error/route.js
// API para recibir logs de errores de notificaciones y mostrarlos en Vercel

import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { error, details, timestamp } = body
    
    // Log estructurado que aparecerá en Vercel logs
    console.error('🚨 NOTIFICATION_ERROR:', {
      error_type: error,
      timestamp,
      user_id: details.userId,
      user_email: details.userEmail,
      missing_fields: {
        type: details.type === 'MISSING' ? 'MISSING' : 'OK',
        title: details.title === 'MISSING' ? 'MISSING' : 'OK', 
        body: details.body === 'MISSING' ? 'MISSING' : 'OK'
      }
    })
    
    return NextResponse.json({ 
      status: 'logged',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error in log-notification-error API:', error)
    return NextResponse.json(
      { error: 'Failed to log notification error' },
      { status: 500 }
    )
  }
}