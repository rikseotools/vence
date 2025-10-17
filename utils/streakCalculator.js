// utils/streakCalculator.js - Cálculo centralizado de rachas de estudio

/**
 * Calcula la racha de días consecutivos de estudio con día de gracia
 * @param {Array} activities - Array de actividades/tests con campo created_at o completed_at
 * @param {string} dateField - Campo de fecha a usar ('created_at' o 'completed_at')
 * @returns {number} - Número de días en la racha actual
 */
export function calculateUserStreak(activities, dateField = 'created_at') {
  if (!activities || activities.length === 0) return 0
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Crear array de días con actividad (últimos 60 días para capturar rachas más largas)
  const activeDays = []
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    
    const hasActivityOnDate = activities.some(activity => {
      const activityDate = new Date(activity[dateField])
      activityDate.setHours(0, 0, 0, 0)
      return activityDate.getTime() === checkDate.getTime()
    })
    
    activeDays.push(hasActivityOnDate)
  }
  
  // Encontrar el primer día con actividad empezando desde hoy
  let startIndex = -1
  for (let i = 0; i < activeDays.length; i++) {
    if (activeDays[i]) {
      startIndex = i
      break
    }
  }
  
  // Si no hay actividad en los últimos 60 días, retornar 0
  if (startIndex === -1) return 0
  
  // Contar racha permitiendo máximo 1 día consecutivo sin actividad
  let streak = 0
  let consecutiveMisses = 0
  let daysInStreak = 0 // Incluir días de gracia en el conteo
  
  for (let i = startIndex; i < activeDays.length; i++) {
    if (activeDays[i]) {
      streak++ // Días con actividad real
      daysInStreak++ // Total de días en la racha
      consecutiveMisses = 0 // Resetear contador de faltas
    } else {
      consecutiveMisses++
      daysInStreak++ // Contar día de gracia como parte de la racha
      if (consecutiveMisses >= 2) {
        // Si faltas 2+ días seguidos, se rompe la racha
        // Restar el último día sin actividad del conteo
        daysInStreak--
        break
      }
      // Si es solo 1 día sin actividad, continuar (día de gracia)
    }
  }
  
  // Retornar días totales en la racha (incluyendo días de gracia)
  return daysInStreak
}