// Script para verificar la salud del sistema de emails
// Ejecutar: node scripts/check-email-health.js

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkEmailHealth() {
  console.log('🔍 VERIFICANDO SALUD DEL SISTEMA DE EMAILS...\n')

  try {
    // 1. Volumen últimos 7 días
    const { data: recentEmails } = await supabase
      .from('email_events')
      .select('created_at, user_email, subject')
      .eq('email_type', 'motivational')
      .eq('event_type', 'sent')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    console.log(`📧 VOLUMEN ÚLTIMOS 7 DÍAS: ${recentEmails?.length || 0} emails`)
    console.log(`👥 USUARIOS ÚNICOS: ${new Set(recentEmails?.map(e => e.user_email) || []).size}`)

    // 2. Verificar violaciones de límite semanal
    const emailsByUser = {}
    recentEmails?.forEach(email => {
      emailsByUser[email.user_email] = (emailsByUser[email.user_email] || 0) + 1
    })

    const violations = Object.entries(emailsByUser).filter(([_, count]) => count > 1)
    if (violations.length > 0) {
      console.log('\n🚨 VIOLACIONES DE LÍMITE SEMANAL:')
      violations.forEach(([email, count]) => {
        console.log(`   ${email}: ${count} emails`)
      })
    } else {
      console.log('\n✅ LÍMITE SEMANAL RESPETADO - Ningún usuario con >1 email')
    }

    // 3. Variedad de templates
    const subjects = recentEmails?.map(e => e.subject) || []
    const subjectCounts = {}
    subjects.forEach(subject => {
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1
    })

    console.log('\n🎨 VARIEDAD DE TEMPLATES:')
    Object.entries(subjectCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([subject, count]) => {
        console.log(`   "${subject}": ${count} veces`)
      })

    // 4. Promedio diario
    const dailyAverage = (recentEmails?.length || 0) / 7
    console.log(`\n📊 PROMEDIO DIARIO: ${dailyAverage.toFixed(1)} emails/día`)

    // 5. Estado del sistema
    const isHealthy = violations.length === 0 && dailyAverage < 50
    console.log(`\n${isHealthy ? '✅' : '❌'} ESTADO DEL SISTEMA: ${isHealthy ? 'SALUDABLE' : 'REQUIERE ATENCIÓN'}`)

    // 6. Recomendaciones
    if (violations.length > 0) {
      console.log('\n⚠️  RECOMENDACIÓN: Revisar lógica de cooldown')
    }
    if (dailyAverage > 50) {
      console.log('\n⚠️  RECOMENDACIÓN: Criterios demasiado amplios, considerar más restricciones')
    }
    if (Object.keys(subjectCounts).length < 3) {
      console.log('\n⚠️  RECOMENDACIÓN: Poca variedad de templates')
    }

  } catch (error) {
    console.error('❌ Error verificando salud:', error.message)
  }
}

checkEmailHealth()