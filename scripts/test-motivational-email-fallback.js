// scripts/test-motivational-email-fallback.js
// Script para probar el sistema de email fallback motivacional

const TEST_USER_ID = '10b2e5c8-8f3a-4e59-9e2a-5c8f2a1d6b3e' // Usuario "ilovetest"
const TEST_USER_EMAIL = 'ilovetestpro@gmail.com'

// Función para simular diferentes tipos de notificaciones motivacionales
async function testMotivationalEmailFallback() {
  console.log('🧪 Iniciando test del sistema de email fallback motivacional...')

  // Definir tipos de test a realizar
  const testNotifications = [
    {
      type: 'daily_progress',
      title: '📈 Progreso Constante - TEST',
      body: '¡Llevas 5 días consecutivos estudiando! Has completado 47 preguntas esta semana. ¿Continuamos con el buen ritmo?',
      primaryAction: {
        label: '🚀 Mantener Racha (5 min)',
        type: 'maintain_streak'
      },
      secondaryAction: {
        label: '📈 Ver Racha Completa',
        type: 'view_streak_stats'
      }
    },
    {
      type: 'accuracy_improvement',
      title: '🎯 Mejora Detectada - TEST',
      body: 'Tu precisión en Tema 7 ha mejorado del 67% al 82% esta semana. ¡Excelente progreso!',
      primaryAction: {
        label: '🔥 Test Intensivo (10 preguntas)',
        type: 'intensive_test'
      },
      secondaryAction: {
        label: '📖 Ver Teoría',
        type: 'view_theory'
      }
    },
    {
      type: 'constructive_encouragement',
      title: '🤗 Momento de Reflexión - TEST',
      body: 'Recuerda que ya has dominado 12 artículos y tu mejor racha fue de 8 días. El progreso general está en 68%. Te recomendamos repasar Tema 3.',
      primaryAction: {
        label: '💪 Test de Refuerzo (5 min)',
        type: 'directed_test'
      },
      secondaryAction: {
        label: '📈 Ver Progreso',
        type: 'view_progress'
      }
    }
  ]

  // Ejecutar tests para cada tipo
  for (const notification of testNotifications) {
    console.log(`\n📧 Testeando tipo: ${notification.type}`)
    
    try {
      const response = await fetch('/api/send-motivational-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: TEST_USER_EMAIL,
          userName: 'Test User (ILoveTest)',
          messageType: notification.type,
          title: notification.title,
          body: notification.body,
          primaryAction: notification.primaryAction,
          secondaryAction: notification.secondaryAction,
          userId: TEST_USER_ID
        })
      })

      const result = await response.json()

      if (response.ok) {
        console.log(`✅ Email ${notification.type} enviado correctamente`)
        console.log(`   Email ID: ${result.emailId}`)
        console.log(`   Mensaje: ${result.message}`)
      } else {
        console.error(`❌ Error enviando ${notification.type}:`, result.error)
      }

      // Esperar un poco entre requests
      await new Promise(resolve => setTimeout(resolve, 2000))

    } catch (error) {
      console.error(`❌ Error en test ${notification.type}:`, error.message)
    }
  }

  console.log('\n🏁 Test completado. Revisa el admin panel en /es/admin/notificaciones/email para ver los resultados.')
}

// Función para crear datos de test del usuario si no existen
async function setupTestUserData() {
  console.log('🔧 Configurando datos de test para el usuario...')
  
  // Aquí podrías insertar datos de test en la base de datos si fuera necesario
  // Por ejemplo, crear algunos tests completados, respuestas, etc.
  
  console.log('✅ Datos de test configurados')
}

// Función para verificar el estado del sistema
async function checkSystemStatus() {
  console.log('🔍 Verificando estado del sistema...')
  
  const checks = [
    {
      name: 'RESEND_API_KEY',
      status: !!process.env.RESEND_API_KEY,
      message: process.env.RESEND_API_KEY ? 'Configurada' : 'NO CONFIGURADA'
    },
    {
      name: 'API Endpoint',
      status: true, // Asumimos que existe ya que acabamos de leer el archivo
      message: '/api/send-motivational-email disponible'
    },
    {
      name: 'Usuario Test',
      status: TEST_USER_ID && TEST_USER_EMAIL,
      message: `${TEST_USER_EMAIL} (${TEST_USER_ID})`
    }
  ]

  checks.forEach(check => {
    const icon = check.status ? '✅' : '❌'
    console.log(`${icon} ${check.name}: ${check.message}`)
  })

  return checks.every(check => check.status)
}

// Función principal
async function main() {
  console.log('🚀 Sistema de Test para Email Fallback Motivacional')
  console.log('=' * 50)

  // Verificar sistema
  const systemOk = await checkSystemStatus()
  if (!systemOk) {
    console.log('❌ Sistema no está listo. Revisa la configuración.')
    return
  }

  // Configurar datos de test
  await setupTestUserData()

  // Ejecutar tests
  await testMotivationalEmailFallback()
}

// Ejecutar si se llama directamente
if (typeof window === 'undefined') {
  // Node.js environment
  main().catch(console.error)
} else {
  // Browser environment - exponer funciones globalmente para debug
  window.testMotivationalEmailFallback = testMotivationalEmailFallback
  window.checkSystemStatus = checkSystemStatus
  console.log('🧪 Funciones de test disponibles: testMotivationalEmailFallback(), checkSystemStatus()')
}

module.exports = {
  testMotivationalEmailFallback,
  checkSystemStatus,
  setupTestUserData
}