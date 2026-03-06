// utils/testTracking.ts - Sistema de tracking de interacciones de test

interface InteractionEvent {
  timestamp: number
  type: string
  question_number: number
  [key: string]: unknown
}

interface MouseEvent {
  timestamp: number
  x: number
  y: number
  question: number
}

interface ScrollEvent {
  timestamp: number
  scrollY: number
  question: number
}

export interface TrackingData {
  interactionEvents: InteractionEvent[]
  mouseEvents: MouseEvent[]
  scrollEvents: ScrollEvent[]
}

export class TestTracker {
  interactionEvents: InteractionEvent[] = []
  mouseEvents: MouseEvent[] = []
  scrollEvents: ScrollEvent[] = []

  trackInteraction(type: string, details: Record<string, unknown> = {}, currentQuestion?: number) {
    const event: InteractionEvent = {
      timestamp: Date.now(),
      type,
      question_number: (currentQuestion || 0) + 1,
      ...details
    }

    this.interactionEvents.push(event)

    if (this.interactionEvents.length > 50) {
      this.interactionEvents = this.interactionEvents.slice(-50)
    }
  }

  trackMouseMove(e: { clientX: number; clientY: number }, currentQuestion: number) {
    this.mouseEvents.push({
      timestamp: Date.now(),
      x: e.clientX,
      y: e.clientY,
      question: currentQuestion + 1
    })

    if (this.mouseEvents.length > 20) {
      this.mouseEvents = this.mouseEvents.slice(-20)
    }
  }

  trackScroll(currentQuestion: number) {
    this.scrollEvents.push({
      timestamp: Date.now(),
      scrollY: window.scrollY,
      question: currentQuestion + 1
    })

    if (this.scrollEvents.length > 10) {
      this.scrollEvents = this.scrollEvents.slice(-10)
    }
  }

  trackVisibilityChange() {
    this.trackInteraction('visibility_change', {
      hidden: document.hidden,
      timestamp: Date.now()
    })
  }

  reset() {
    this.interactionEvents = []
    this.mouseEvents = []
    this.scrollEvents = []
    this.trackInteraction('test_restart')
  }

  getData(): TrackingData {
    return {
      interactionEvents: this.interactionEvents,
      mouseEvents: this.mouseEvents,
      scrollEvents: this.scrollEvents
    }
  }

  setupBrowserTracking(currentQuestion: number, trackInteractionCallback: (type: string, details: Record<string, unknown>) => void): () => void {
    if (typeof window === 'undefined') return () => {}

    const handleMouseMove = (e: globalThis.MouseEvent) => {
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

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }
}

// Instancia global del tracker
export const testTracker = new TestTracker()
