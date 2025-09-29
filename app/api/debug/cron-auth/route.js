// Endpoint temporal para debug de autenticación de cron jobs
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    console.log('🔐 Debug auth check:')
    console.log('   - Auth header exists:', !!authHeader)
    console.log('   - Auth header length:', authHeader ? authHeader.length : 0)
    console.log('   - CRON_SECRET exists:', !!cronSecret)
    console.log('   - CRON_SECRET length:', cronSecret ? cronSecret.length : 0)
    console.log('   - Headers match:', authHeader === `Bearer ${cronSecret}`)
    
    if (!cronSecret) {
      return NextResponse.json({ 
        error: 'CRON_SECRET not configured in environment',
        debug: {
          hasAuthHeader: !!authHeader,
          hasCronSecret: !!cronSecret
        }
      }, { status: 500 })
    }
    
    if (!authHeader) {
      return NextResponse.json({ 
        error: 'No authorization header',
        debug: {
          hasAuthHeader: false,
          hasCronSecret: !!cronSecret,
          expectedFormat: 'Bearer <token>'
        }
      }, { status: 401 })
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ 
        error: 'Invalid authorization',
        debug: {
          hasAuthHeader: true,
          authHeaderLength: authHeader.length,
          hasCronSecret: !!cronSecret,
          cronSecretLength: cronSecret.length,
          authMatches: false
        }
      }, { status: 401 })
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Authorization successful',
      debug: {
        hasAuthHeader: true,
        hasCronSecret: true,
        authMatches: true,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}