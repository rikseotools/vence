// lib/adsense-config.js
// Configuración centralizada de AdSense

export const ADSENSE_CONFIG = {
  // Publisher ID (client ID)
  CLIENT_ID: 'ca-pub-5346427920432730',
  
  // Ad Slots para diferentes ubicaciones
  AD_SLOTS: {
    // Slot real de Google AdSense
    DEFAULT: '7351611098',
    
    // Slots específicos por ubicación 
    TEST_AFTER_ANSWER: '7351611098',    // Después de cada respuesta en test (REAL)
    TEST_COMPLETION: '7351611098',       // Al finalizar test (mismo slot por ahora)
    SIDEBAR_DESKTOP: '7351611098',       // Sidebar en desktop (mismo slot por ahora)
    MOBILE_BANNER: '7351611098'          // Banner móvil (mismo slot por ahora)
  },
  
  // Configuraciones por tipo de anuncio
  STYLES: {
    TEST_AFTER_ANSWER: {
      display: 'block',
      textAlign: 'center'
    },
    TEST_COMPLETION: {
      display: 'block', 
      textAlign: 'center'
    },
    SIDEBAR: {
      display: 'block'
    }
  },
  
  // Configuración de responsividad
  RESPONSIVE: {
    FULL_WIDTH: true,
    LIMITED_WIDTH: false
  }
}

// Helper function para obtener slot según ubicación
export const getAdSlot = (location = 'DEFAULT') => {
  return ADSENSE_CONFIG.AD_SLOTS[location] || ADSENSE_CONFIG.AD_SLOTS.DEFAULT
}

// Helper function para obtener estilo según tipo
export const getAdStyle = (type = 'TEST_AFTER_ANSWER') => {
  return ADSENSE_CONFIG.STYLES[type] || ADSENSE_CONFIG.STYLES.TEST_AFTER_ANSWER
}