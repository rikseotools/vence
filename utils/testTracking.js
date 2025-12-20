// utils/testTracking.js - Todo el sistema de tracking de interacciones
export class TestTracker {
  constructor() {
    this.interactionEvents = []
    this.mouseEvents = []
    this.scrollEvents = []
  }

  // Tracking de interacciones
  trackInteraction(type, details = {}, currentQuestion) {
    const event = {
      timestamp: Date.now(),
      type: type,
      question_number: currentQuestion + 1,
      ...details
    }
    
    this.interactionEvents.push(event)
    
    // Mantener solo los últimos 50 eventos para performance
    if (this.interactionEvents.length > 50) {
      this.interactionEvents = this.interactionEvents.slice(-50)
    }
  }

  // Tracking de mouse
  trackMouseMove(e, currentQuestion) {
    this.mouseEvents.push({
      timestamp: Date.now(),
      x: e.clientX,
      y: e.clientY,
      question: currentQuestion + 1
    })
    
    // Mantener solo los últimos 20 eventos
    if (this.mouseEvents.length > 20) {
      this.mouseEvents = this.mouseEvents.slice(-20)
    }
  }

  // Tracking de scroll
  trackScroll(currentQuestion) {
    this.scrollEvents.push({
      timestamp: Date.now(),
      scrollY: window.scrollY,
      question: currentQuestion + 1
    })
    
    if (this.scrollEvents.length > 10) {
      this.scrollEvents = this.scrollEvents.slice(-10)
    }
  }

  // Tracking de cambio de visibilidad
  trackVisibilityChange() {
    this.trackInteraction('visibility_change', {
      hidden: document.hidden,
      timestamp: Date.now()
    })
  }

  // Reset para nuevo test
  reset() {
    this.interactionEvents = []
    this.mouseEvents = []
    this.scrollEvents = []
    this.trackInteraction('test_restart')
  }

  // Obtener datos actuales
  getData() {
    return {
      interactionEvents: this.interactionEvents,
      mouseEvents: this.mouseEvents,
      scrollEvents: this.scrollEvents
    }
  }

  // Configurar event listeners del navegador
  setupBrowserTracking(currentQuestion, trackInteractionCallback) {
    if (typeof window === 'undefined') return () => {}

    const handleMouseMove = (e) => {
      this.trackMouseMove(e, currentQuestion)
    }

    const handleScroll = () => {
      this.trackScroll(currentQuestion)
    }

    const handleVisibilityChange = () => {
      this.trackVisibilityChange()
      trackInteractionCallback('visibility_change', {
        hidden: document.hidden,
        timestamp: Date.now()
      })
    }

    // Agregar listeners
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Función de cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }
}

// Instancia global del tracker
export const testTracker = new TestTracker()