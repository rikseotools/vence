// lib/testing/motivationalNotificationTester.js
// Utilidades para probar el sistema de notificaciones motivacionales

import { MotivationalAnalyzer } from '../notifications/motivationalAnalyzer.js'

/**
 * Función para forzar la generación de notificaciones motivacionales para testing
 * Simula diferentes escenarios para probar el email fallback
 */
export class MotivationalNotificationTester {
  constructor(supabase, userId) {
    this.supabase = supabase
    this.userId = userId
  }

  /**
   * Genera notificaciones motivacionales de test directamente
   */
  async generateTestNotifications() {
    const testNotifications = [
      {
        id: `test-daily-progress-${Date.now()}`,
        type: 'daily_progress',
        title: '📈 Progreso Constante - TEST',
        body: '¡Llevas 5 días consecutivos estudiando! Has completado 47 preguntas esta semana. ¿Continuamos con el buen ritmo?',
        timestamp: new Date().toISOString(),
        isRead: false,
        consecutive_days: 5,
        total_time: '3h 45m',
        priority: 65,
        icon: '📈',
        color: 'blue',
        bgColor: 'bg-blue-100 dark:bg-blue-900/50',
        textColor: 'text-blue-600 dark:text-blue-400',
        borderColor: 'border-blue-200 dark:border-blue-800',
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
        id: `test-accuracy-improvement-${Date.now()}`,
        type: 'accuracy_improvement',
        title: '🎯 Mejora Detectada - TEST',
        body: 'Tu precisión en Tema 7 ha mejorado del 67% al 82% esta semana. ¡Excelente progreso!',
        timestamp: new Date().toISOString(),
        isRead: false,
        topic: 'Tema 7',
        old_accuracy: 67,
        new_accuracy: 82,
        improvement: 15,
        priority: 60,
        icon: '🎯',
        color: 'green',
        bgColor: 'bg-green-100 dark:bg-green-900/50',
        textColor: 'text-green-600 dark:text-green-400',
        borderColor: 'border-green-200 dark:border-green-800',
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
        id: `test-constructive-encouragement-${Date.now()}`,
        type: 'constructive_encouragement',
        title: '🤗 Momento de Reflexión - TEST',
        body: 'Recuerda que ya has dominado 12 artículos y tu mejor racha fue de 8 días. El progreso general está en 68%. Te recomendamos repasar Tema 3.',
        timestamp: new Date().toISOString(),
        isRead: false,
        past_achievements: { bestStreak: 8, masteredArticles: 12 },
        total_progress: 68,
        recommended_topic: 'Tema 3',
        priority: 55,
        icon: '🤗',
        color: 'purple',
        bgColor: 'bg-purple-100 dark:bg-purple-900/50',
        textColor: 'text-purple-600 dark:text-purple-400',
        borderColor: 'border-purple-200 dark:border-purple-800',
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

    return testNotifications
  }

  /**
   * Simula el envío de notificaciones con fallback a email
   */
  async testEmailFallback(user, notifications) {
    const results = []

    for (const notification of notifications) {
      try {
        console.log(`🧪 Testing email fallback for: ${notification.type}`)

        // Simular fallo de push notification
        const pushFailed = true // Forzar fallback para testing

        if (pushFailed) {
          console.log('📧 Push notification failed, sending email fallback...')
          
          const emailResult = await this.sendMotivationalEmail(user, notification)
          
          results.push({
            notificationType: notification.type,
            pushSent: false,
            emailSent: emailResult.success,
            emailId: emailResult.emailId,
            error: emailResult.error
          })
        }
      } catch (error) {
        console.error(`❌ Error testing ${notification.type}:`, error)
        results.push({
          notificationType: notification.type,
          pushSent: false,
          emailSent: false,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * Envía email motivacional (replica la lógica del hook)
   */
  async sendMotivationalEmail(user, notification) {
    try {
      console.log('📧 Enviando email motivacional fallback:', notification.type)
      
      const response = await fetch('/api/send-motivational-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: user.email,
          userName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
          messageType: notification.type,
          title: notification.title,
          body: notification.body,
          primaryAction: notification.primaryAction,
          secondaryAction: notification.secondaryAction,
          userId: user.id
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error enviando email motivacional')
      }

      const result = await response.json()
      console.log('✅ Email motivacional enviado correctamente:', result.emailId)
      
      return {
        success: true,
        emailId: result.emailId
      }
    } catch (error) {
      console.error('❌ Error en sendMotivationalEmail:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Función principal para ejecutar test completo
   */
  async runCompleteTest(user) {
    console.log('🚀 Iniciando test completo del sistema de email fallback motivacional')
    console.log(`👤 Usuario: ${user.email} (${user.id})`)

    try {
      // 1. Generar notificaciones de test
      console.log('\n1️⃣ Generando notificaciones de test...')
      const testNotifications = await this.generateTestNotifications()
      console.log(`✅ ${testNotifications.length} notificaciones generadas`)

      // 2. Probar email fallback
      console.log('\n2️⃣ Probando sistema de email fallback...')
      const results = await this.testEmailFallback(user, testNotifications)

      // 3. Mostrar resultados
      console.log('\n3️⃣ Resultados del test:')
      console.log('═'.repeat(50))
      
      let successCount = 0
      let failCount = 0

      results.forEach(result => {
        const status = result.emailSent ? '✅' : '❌'
        console.log(`${status} ${result.notificationType}`)
        
        if (result.emailSent) {
          console.log(`   📧 Email ID: ${result.emailId}`)
          successCount++
        } else {
          console.log(`   ❌ Error: ${result.error}`)
          failCount++
        }
      })

      console.log('═'.repeat(50))
      console.log(`📊 Resumen: ${successCount} exitosos, ${failCount} fallidos`)
      console.log(`📱 Panel Admin: /es/admin/notificaciones/email`)
      console.log(`📧 Revisa tu email: ${user.email}`)

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failCount
        }
      }

    } catch (error) {
      console.error('❌ Error en test completo:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Test específico para verificar que las notificaciones motivacionales 
   * se disparan cuando no hay notificaciones urgentes
   */
  async testMotivationalTrigger(user) {
    console.log('🎯 Testing trigger de notificaciones motivacionales...')

    try {
      // Crear instancia del analizador
      const analyzer = new MotivationalAnalyzer(this.supabase, user.id)

      // Forzar generación de notificaciones motivacionales
      const motivationalNotifs = await analyzer.generateMotivationalNotifications()

      console.log(`🌟 ${motivationalNotifs.length} notificaciones motivacionales generadas`)

      if (motivationalNotifs.length > 0) {
        // Probar email fallback con las notificaciones reales
        const results = await this.testEmailFallback(user, motivationalNotifs)
        
        console.log('📊 Resultados del trigger test:')
        results.forEach(result => {
          const status = result.emailSent ? '✅' : '❌'
          console.log(`${status} ${result.notificationType}: ${result.emailSent ? result.emailId : result.error}`)
        })

        return results
      } else {
        console.log('ℹ️ No se generaron notificaciones motivacionales (usuario no cumple criterios o ya fueron enviadas)')
        return []
      }

    } catch (error) {
      console.error('❌ Error en test de trigger:', error)
      return []
    }
  }
}

/**
 * Función de conveniencia para testing rápido
 */
export async function quickTestMotivationalEmails(supabase, user) {
  const tester = new MotivationalNotificationTester(supabase, user.id)
  return await tester.runCompleteTest(user)
}

/**
 * Función específica para probar solo el trigger de notificaciones motivacionales
 */
export async function testMotivationalTrigger(supabase, user) {
  const tester = new MotivationalNotificationTester(supabase, user.id)
  return await tester.testMotivationalTrigger(user)
}