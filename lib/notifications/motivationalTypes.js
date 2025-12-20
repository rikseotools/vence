// lib/notifications/motivationalTypes.js
// Definiciones de notificaciones motivacionales (solo cuando no hay avisos urgentes)

export const MOTIVATIONAL_NOTIFICATION_TYPES = {
  // 📈 PROGRESO BASADO EN DATOS REALES
  daily_progress: {
    priority: 25,
    icon: '📈',
    color: 'purple',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
    textColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-700',
    cooldown_hours: 24, // Una vez por día máximo
    conditions: {
      min_consecutive_days: 2,
      max_times_shown: 3 // No ser pesado
    },
    primaryAction: {
      label: '💪 Continuar Racha',
      type: 'quick_test'
    },
    secondaryAction: {
      label: '📊 Ver Progreso',
      type: 'view_stats'
    },
    messageTemplates: [
      "Llevas {consecutive_days} días seguidos estudiando ({total_time}) 💪",
      "¡{consecutive_days} días de constancia! Has acumulado {total_time} - ¡excelente progreso!",
      "Racha de {consecutive_days} días - {total_time} de dedicación total 🎯"
    ]
  },

  // 🌱 PROGRESO CONSTRUCTIVO (reemplaza críticas)
  constructive_progress: {
    priority: 30,
    icon: '🌱',
    color: 'green',
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-700',
    cooldown_hours: 48,
    conditions: {
      min_questions_answered: 20,
      progress_percentage_threshold: 30
    },
    primaryAction: {
      label: '🚀 Plan Optimizado',
      type: 'optimized_plan'
    },
    secondaryAction: {
      label: '📈 Ver Evolución',
      type: 'view_progress'
    },
    messageTemplates: [
      "¡Ya tienes una base del {progress}%! 💪 Cada pregunta te acerca más al objetivo",
      "Has avanzado {progress}% del camino 🎯 Tip: {daily_questions} preguntas diarias = +10% en 2 semanas",
      "Progreso sólido: {progress}% completado 📚 Tu próximo objetivo: llegar al {next_target}%"
    ]
  },

  // ⚡ ACELERACIÓN POSITIVA (reemplaza "no llegarás a tiempo")
  positive_acceleration: {
    priority: 28,
    icon: '⚡',
    color: 'orange',
    bgColor: 'bg-orange-50 dark:bg-orange-900/30',
    textColor: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-200 dark:border-orange-700',
    cooldown_hours: 72,
    conditions: {
      needs_acceleration: true,
      min_time_remaining: 30 // días
    },
    primaryAction: {
      label: '🚀 Plan Turbo',
      type: 'acceleration_plan'
    },
    secondaryAction: {
      label: '🎯 Micro-objetivos',
      type: 'micro_goals'
    },
    messageTemplates: [
      "⚡ Aceleremos el ritmo juntos: Plan optimizado {minutes} min/día para llegar al {target}%",
      "🚀 Momento de intensificar: {questions} preguntas diarias = objetivo alcanzable en {weeks} semanas",
      "💪 Plan de aceleración: cada {daily_goal} te acerca {weekly_gain}% más - ¡vamos por ello!"
    ]
  },

  // 🎯 MEJORAS DETECTADAS CON DATOS
  accuracy_improvement: {
    priority: 22,
    icon: '🎯',
    color: 'green',
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-700',
    cooldown_hours: 48, // Cada 2 días máximo
    conditions: {
      min_improvement_percentage: 10,
      min_questions_in_period: 15
    },
    primaryAction: {
      label: '🎯 Test en Tema Mejorado',
      type: 'topic_test'
    },
    secondaryAction: {
      label: '📈 Ver Evolución',
      type: 'view_progress'
    },
    messageTemplates: [
      "Tu precisión en {topic} mejoró del {old_accuracy}% al {new_accuracy}%",
      "¡Gran mejora en {topic}! Subiste {improvement}% esta semana",
      "{topic}: de {old_accuracy}% a {new_accuracy}% - ¡excelente progreso!"
    ]
  },

  // ⚡ VELOCIDAD DE RESPUESTA
  speed_improvement: {
    priority: 20,
    icon: '⚡',
    color: 'yellow',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-700',
    cooldown_hours: 72, // Cada 3 días máximo
    conditions: {
      min_improvement_seconds: 2,
      min_questions_compared: 20
    },
    primaryAction: {
      label: '🚀 Test de Velocidad',
      type: 'speed_test'
    },
    secondaryAction: {
      label: '📊 Ver Tiempos',
      type: 'view_timing'
    },
    messageTemplates: [
      "Respondes {improvement_seconds}s más rápido que hace una semana",
      "Tu velocidad mejoró: de {old_time}s a {new_time}s por pregunta",
      "¡Más ágil! Redujiste {improvement_seconds}s el tiempo promedio"
    ]
  },

  // 🤗 ÁNIMO CONSTRUCTIVO (reemplaza regresiones críticas)
  constructive_encouragement: {
    priority: 26,
    icon: '🤗',
    color: 'blue',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-700',
    cooldown_hours: 96, // Solo cuando realmente sea útil
    conditions: {
      needs_encouragement: true,
      has_previous_progress: true
    },
    primaryAction: {
      label: '🎯 Repaso Dirigido',
      type: 'targeted_review'
    },
    secondaryAction: {
      label: '🏆 Ver Logros',
      type: 'view_achievements'
    },
    messageTemplates: [
      "Momento perfecto para repasar tus logros anteriores 🏆 Ya dominaste {past_achievements} - ¡volvamos a ello!",
      "Los altibajos son normales 🤗 Recuerda: ya conseguiste {best_streak} días seguidos - tienes la capacidad",
      "🌟 Pausa estratégica: has progresado {total_progress}% hasta ahora. Refresquemos con {recommended_topic}"
    ]
  },

  // 🏆 ARTÍCULOS DOMINADOS  
  articles_mastered: {
    priority: 18,
    icon: '🏆',
    color: 'indigo',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/30',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    borderColor: 'border-indigo-200 dark:border-indigo-700',
    cooldown_hours: 96, // Cada 4 días máximo
    conditions: {
      min_new_mastered: 2,
      mastery_threshold: 85
    },
    primaryAction: {
      label: '🎯 Test de Maestría',
      type: 'mastery_test'
    },
    secondaryAction: {
      label: '🏆 Ver Dominados',
      type: 'view_mastered'
    },
    messageTemplates: [
      "Has dominado {count} artículos nuevos: {article_list}",
      "¡{count} artículos más en tu haber! {article_list}",
      "Nuevos dominios ({count}): {article_list}"
    ]
  },

  // 📚 CONSISTENCIA DE ESTUDIO
  study_consistency: {
    priority: 16,
    icon: '📚',
    color: 'blue',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-700',
    cooldown_hours: 120, // Cada 5 días máximo
    conditions: {
      min_sessions_week: 3,
      consistency_score: 0.7
    },
    primaryAction: {
      label: '🎯 Sesión Óptima',
      type: 'optimal_session'
    },
    secondaryAction: {
      label: '📊 Ver Patrones',
      type: 'view_patterns'
    },
    messageTemplates: [
      "Estudias consistentemente a las {optimal_time} - tu momento más productivo",
      "Patrón perfecto: {sessions_count} sesiones esta semana a tu hora ideal",
      "Tu horario óptimo ({optimal_time}) te da {accuracy}% de precisión"
    ]
  },

  // 🎪 VARIEDAD DE APRENDIZAJE
  learning_variety: {
    priority: 14,
    icon: '🎪',
    color: 'pink',
    bgColor: 'bg-pink-50 dark:bg-pink-900/30',
    textColor: 'text-pink-600 dark:text-pink-400',
    borderColor: 'border-pink-200 dark:border-pink-700',
    cooldown_hours: 168, // Una vez por semana máximo
    conditions: {
      min_test_types: 3,
      min_topics_touched: 5
    },
    primaryAction: {
      label: '🌟 Explorar Nuevo Tema',
      type: 'explore_topic'
    },
    secondaryAction: {
      label: '🎪 Ver Variedad',
      type: 'view_variety'
    },
    messageTemplates: [
      "Has probado {test_types} tipos de tests y {topics} temas - ¡gran variedad!",
      "Explorador nato: {test_types} modalidades y {topics} temas esta semana",
      "Aprendizaje diverso: {test_types} tests diferentes en {topics} áreas"
    ]
  },

  // 🎯 PREDICCIÓN POSITIVA DE EXAMEN
  positive_exam_prediction: {
    priority: 35,
    icon: '🎯',
    color: 'emerald',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-700',
    cooldown_hours: 120, // Cada 5 días máximo
    conditions: {
      min_readiness_score: 70,
      min_questions_answered: 100,
      exam_approaching: true
    },
    primaryAction: {
      label: '🚀 Plan Final',
      type: 'final_preparation'
    },
    secondaryAction: {
      label: '📊 Ver Predicción',
      type: 'view_prediction'
    },
    messageTemplates: [
      "¡Tu predicción de examen es {readiness_score}%! 🎯 Vas por buen camino para febrero 2026",
      "Excelente progreso: {readiness_score}% preparación estimada 🏆 Mantén el ritmo hasta {exam_date}",
      "Predicción positiva: {readiness_score}% listo 💪 Solo faltan {days_remaining} días - ¡puedes hacerlo!"
    ]
  }
}

// Configuración de frecuencia para evitar spam
export const MOTIVATIONAL_CONFIG = {
  max_daily_motivational: 1,        // Máximo 1 por día
  max_weekly_motivational: 3,       // Máximo 3 por semana  
  min_user_activity_days: 2,        // Usuario debe haber estudiado al menos 2 días
  global_cooldown_hours: 12,        // Espacio mínimo entre cualquier motivacional
  
  // Prioridad mínima para mostrar (solo cuando no hay urgentes)
  min_priority_when_no_urgent: 14,
  
  // Análisis requerido para activar
  min_questions_for_analysis: 10,
  min_study_sessions: 3
}

// Función para obtener templates de mensaje aleatorio
export const getRandomMessageTemplate = (notificationType) => {
  const type = MOTIVATIONAL_NOTIFICATION_TYPES[notificationType]
  if (!type?.messageTemplates?.length) return null
  
  const randomIndex = Math.floor(Math.random() * type.messageTemplates.length)
  return type.messageTemplates[randomIndex]
}

// Función para formatear mensaje con datos
export const formatNotificationMessage = (template, data) => {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] || match
  })
}