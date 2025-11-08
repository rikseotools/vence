// lib/adsense-config.js
// Configuración centralizada de AdSense

export const ADSENSE_CONFIG = {
  // Publisher ID (client ID)
  CLIENT_ID: 'ca-pub-5346427920432730',
  
  // Ad Slots para diferentes ubicaciones
  AD_SLOTS: {
    // Slot por defecto (cambiar cuando tengas slots reales de Google)
    DEFAULT: '1234567890',
    
    // Slots específicos por ubicación (para cuando Google apruebe tu sitio)
    TEST_AFTER_ANSWER: '1234567890',    // Después de cada respuesta en test
    TEST_COMPLETION: '1234567890',       // Al finalizar test
    SIDEBAR_DESKTOP: '1234567890',       // Sidebar en desktop
    MOBILE_BANNER: '1234567890'          // Banner móvil
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