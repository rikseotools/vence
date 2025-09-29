// Script para generar URLs de unsubscribe válidas para testing
import crypto from 'crypto'

function generateUnsubscribeToken(email) {
  const secret = process.env.UNSUBSCRIBE_SECRET || 'ilovetest-unsubscribe-2025'
  return crypto
    .createHmac('sha256', secret)
    .update(email)
    .digest('hex')
    .substring(0, 16)
}

function generateUnsubscribeUrl(email, action = 'unsubscribe') {
  const token = generateUnsubscribeToken(email)
  const baseUrl = 'https://vence.es'
  
  return `${baseUrl}/api/email-unsubscribe?token=${token}&email=${encodeURIComponent(email)}&action=${action}`
}

// Test
const email = 'ilovetestpro@gmail.com'
const unsubscribeUrl = generateUnsubscribeUrl(email)
const resubscribeUrl = generateUnsubscribeUrl(email, 'resubscribe')

console.log('📧 Email:', email)
console.log('🔗 URL Unsubscribe:', unsubscribeUrl)
console.log('🔗 URL Resubscribe:', resubscribeUrl)
console.log('')
console.log('🧪 Test Commands:')
console.log(`curl "${unsubscribeUrl}"`)
console.log(`curl "${resubscribeUrl}"`)