// app/api/unsubscribe/route.js
import { NextResponse } from 'next/server'
import { processUnsubscribeByToken } from '@/lib/emails/emailService.server'

export async function POST(request) {
  try {
    console.log('🚫 API Unsubscribe: Iniciando procesamiento...')
    
    const body = await request.json()
    console.log('🚫 API Unsubscribe: Body recibido:', JSON.stringify(body, null, 2))
    
    const { token, unsubscribeAll = false, specificTypes = null } = body
    
    console.log('🚫 API Unsubscribe: Parámetros extraídos:', {
      token: token ? token.substring(0, 10) + '...' : 'NO TOKEN',
      unsubscribeAll,
      specificTypes,
      specificTypesType: typeof specificTypes,
      specificTypesArray: Array.isArray(specificTypes)
    })
    
    if (!token) {
      console.error('❌ API Unsubscribe: Token faltante')
      return NextResponse.json({
        success: false,
        error: 'Token requerido'
      }, { status: 400 })
    }
    
    console.log('🚫 API Unsubscribe: Llamando processUnsubscribeByToken...')
    
    const result = await processUnsubscribeByToken(token, specificTypes, unsubscribeAll)
    
    console.log('🚫 API Unsubscribe: Resultado de processUnsubscribeByToken:', result)
    
    if (!result.success) {
      console.error('❌ API Unsubscribe: processUnsubscribeByToken falló:', result.error)
      return NextResponse.json(result, { status: 400 })
    }
    
    console.log('✅ API Unsubscribe: Procesado exitosamente para:', result.email)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('❌ API Unsubscribe: Error interno completo:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}