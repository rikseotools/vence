// Sistema de mensajes motivacionales para oposiciones
// Contexto: Preparación Auxiliar Administrativo del Estado

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'
type AchievementSubcategory = 'streak_milestones' | 'score_achievements' | 'knowledge_milestones'

interface MessageContext {
  subcategory?: AchievementSubcategory | string
  streak?: number
  daysInactive?: number
  score?: number
  totalQuestions?: number
  weakTopic?: string
  strongTopic?: string
  daysUntilExam?: number | null
  motivationLevel?: 'low' | 'medium' | 'high'
  timeOfDay?: TimeOfDay | string
  dayOfWeek?: string
  userGender?: 'male' | 'female' | 'neutral'
}

interface UrgencyContext {
  daysInactive?: number
  streak?: number
  daysUntilExam?: number | null
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
}

export const oposicionMessageTemplates = {
  // 🔥 MANTENER RACHA - Motivación positiva
  streak_danger: {
    urgent: [
      "🔥 ¡{streak} días consecutivos! Hora de continuar tu éxito. 📚 Tip: Solo 10-15 preguntas diarias mantienen la retención activa",
      "💎 Los demás opositores admiran tu constancia. ¡Sigue así! 🧠 Estudios confirman: la práctica espaciada es 2x más efectiva",
      "⭐ {streak} días consecutivos... ¡Estás tan cerca del éxito! ⏰ Consejo: 15 minutos diarios > 2 horas una vez por semana",
      "💪 Tu plaza te está esperando. Solo 10 preguntas para seguir adelante. 🎯 La constancia vence al talento cuando el talento no es constante",
      "🎯 Cada día de estudio te acerca más a tu objetivo. 📖 Dato: Repasar en intervalos aumenta la memoria a largo plazo un 400%",
      "🌟 {streak} días de esfuerzo... ¡Tu dedicación es admirable! 💡 Neurociencia: El cerebro forma conexiones más fuertes con práctica diaria",
      "📈 Tu progreso es increíble. ¡Sigamos construyendo tu futuro! 🔬 Investigación: 10 preguntas diarias > maratones de estudio",
      "🚀 Los aprobados mantienen el ritmo. ¡Tú eres uno de ellos! ⚡ Tip de expertos: Poco y often > mucho y rara vez"
    ],
    motivational: [
      "🎯 Cada día de estudio es una inversión en tu futuro. 🧠 Ciencia: El espaciado temporal fija el conocimiento x3 veces mejor",
      "📚 Tu futuro profesional te está llamando. ¿Lo escuchas? 💡 Consejo: 10 preguntas diarias = 3650 al año",
      "⭐ Los aprobados construyen el éxito día a día. ¡Únete a ellos! 📊 Estadística: El 90% de aprobados estudiaba diariamente",
      "🏆 Tu oposición es tu oportunidad. ¡Vamos por esas preguntas! ⏱️ Técnica: Microlearning de 15 min = máxima retención",
      "💼 Tu plaza fija te está esperando, construyámosla juntos. 🔬 Estudio: La consistencia supera a la intensidad en memoria",
      "🔥 La constancia es el camino hacia el éxito. 🎯 Regla de oro: Mejor 5 min diarios que 5 horas los domingos",
      "⚡ Tu dedicación de hoy = Tu plaza de mañana. 📈 Curva del olvido: Repasar cada 24h mejora retención al 80%"
    ]
  },

  // ☀️ MOTIVACIÓN DIARIA por horarios
  daily_motivation: {
    morning: [
      "☀️ ¡Buenos días! Tu plaza matutina te espera. 🧠 Neurociencia: El cerebro está 23% más activo por las mañanas",
      "🌅 Cada mañana es una oportunidad de estar más cerca de aprobar. ⏰ Técnica Pomodoro: 25 min focus + 5 min descanso",
      "💼 Las personas exitosas empiezan temprano. ¿Te unes? 📊 Harvard Study: Estudiar temprano mejora retención 40%",
      "🚀 Tu oposición empieza AHORA. 15 minutos pueden cambiar tu futuro. 🎯 Regla 1%: Mejorar solo 1% diario = x37 veces mejor en un año",
      "☕ Café + Test = Combinación ganadora para tu oposición. 🔬 Cafeína + aprendizaje = +12% memoria a largo plazo",
      "🎯 Madruga con determinación, estudia con propósito. 💡 Tip: Resolver dudas por la mañana consolida el aprendizaje",
      "⭐ El día perfecto empieza con preguntas perfectas. 📈 Solo 10 preguntas matutinas activan el modo aprendizaje todo el día",
      "💪 Buenos días. Tu plaza te está esperando. 🧠 Cortisol matutino + estudio = máxima concentración y memoria"
    ],
    afternoon: [
      "🕐 Pausa del trabajo = Momento perfecto para tu oposición. 🧠 Estudio: El cerebro procesa mejor tras descansos activos",
      "⚡ Media jornada de otros, media oposición tuya. ¡Equilibrio perfecto! 📊 Microlearning: 15 min = 1 semana tradicional",
      "🎯 Aprovecha este momento para estudiar. 💡 Psicología: Los breaks de trabajo son ideales para consolidar memoria",
      "💡 Un test ahora = Un paso más cerca de tu plaza fija. ⏱️ Técnica: 5-10 preguntas refrescan el conocimiento sin saturar",
      "🔄 Recarga energías con preguntas que te acercan al aprobado. 🔬 Neuroplasticidad: Cambiar de actividad potencia el aprendizaje",
      "⏰ Hora de almuerzo = Hora de alimentar tu futuro. 📈 Digestión lenta + estudio ligero = retención óptima",
      "🚀 15 minutos de estudio > 15 minutos de redes sociales. 📱 Dato: 15 min diarios = 91 horas anuales de estudio"
    ],
    evening: [
      "🌆 El día laboral termina, tu preparación continúa. 🧠 Estudio: El cerebro consolida mejor la información antes de dormir",
      "✨ Antes de Netflix... ¿10 preguntas por tu futuro? 📺 15 min de estudio = 45 min de entretenimiento sin culpa",
      "🌙 Los mejores opositores estudian cuando otros descansan. ⏰ Noches tranquilas = concentración x2",
      "🔥 Tu oposición no tiene horarios. ¿Y tu dedicación? 🎯 Consistencia nocturna marca la diferencia",
      "🎬 Episodio de serie: 45 min. Test completo: 20 min. ¿Qué eliges? 📊 20 min = 100 preguntas anuales extra",
      "⭐ Las personas exitosas se forjan en las noches de estudio. 💡 Neurociencia: Estudiar de noche refuerza la memoria",
      "💤 Duerme tranquilo sabiendo que hoy avanzaste hacia tu plaza. 😴 Sueño + estudio previo = retención del 85%"
    ],
    night: [
      "🌃 Última oportunidad del día. ¿La aprovechas? 🧠 Memoria consolidativa: El cerebro fija conocimientos durante el sueño",
      "✨ 5 preguntas antes de dormir = Sueños más cerca del aprobado. 😴 REM + contenido reciente = recuerdo a largo plazo",
      "🌙 Quienes estudian de noche serán quienes triunfen mañana. 🔬 Harvard: Repasar antes de dormir mejora retención 40%",
      "💫 Termina el día como empezaste: pensando en tu oposición. 🎯 Rutina nocturna = hábito de éxito automático"
    ]
  } as Record<string, string[]>,

  // 🌟 REGRESO después de inactividad
  comeback: {
    short_break: [ // 1-2 días sin actividad
      "👋 ¡Te echamos de menos! Tu oposición te esperaba. 🧠 Descanso de 1-2 días puede mejorar la consolidación",
      "🔄 Un día de descanso está bien. ¿Volvemos a por todas? ⚡ Pausa corta + vuelta = mente más fresca",
      "⚡ Recargaste pilas. Ahora recarga conocimientos. 🔋 Cerebro descansado = capacidad de aprendizaje +25%",
      "🎯 Tu plaza siguió esperándote. ¡Vamos a por ella! 📚 Retomar rápido mantiene la curva de aprendizaje"
    ],
    medium_break: [ // 3-5 días
      "🌟 ¡Qué alegría verte de vuelta! Tu progreso te está esperando. 🧠 3-5 días = tiempo perfecto para resetear motivación",
      "⏰ Cada día de estudio suma. ¡Sigamos construyendo tu éxito! 📈 Constancia irregular > perfección esporádica",
      "💫 Es un buen momento para retomar el ritmo. 🔄 Intervalos de descanso pueden potenciar el rendimiento",
      "💪 Volver es de personas determinadas. ¡Tú eres una de ellas! 🎯 Resilencia: clave del 90% de aprobados",
      "🔥 {days_inactive} días de pausa. Hora de volver con más energía. ⚡ Descanso moderado = motivación renovada"
    ],
    long_break: [ // 6+ días
      "🌈 ¡Nunca es tarde para volver! Tu oposición te recibe con los brazos abiertos. 🔄 Neuroplasticidad: El cerebro siempre puede reaprender",
      "✨ Otros opositores han seguido, pero tú tienes tu propio ritmo. 🐢 Tortuga constante > liebre esporádica",
      "💖 Tu sueño profesional sigue ahí. ¡Vamos a hacerlo realidad! 🎯 Metas claras reactivan la motivación dormida",
      "🎯 Tu oposición es una maratón, no un sprint. ¡Sigamos juntos! 🏃‍♀️ Ritmo personal > velocidad externa",
      "🌅 Cada día es una nueva oportunidad de acercarte a tu meta. 🧠 Cada neurona conserva la capacidad de aprender"
    ]
  },

  // 🏆 LOGROS y celebraciones
  achievement: {
    streak_milestones: [
      "🏆 ¡{streak} días consecutivos! Así se prepara una oposición. 🧠 Hábito formado: 21 días, experticia: 66 días",
      "⭐ ¡Increíble! Ya has respondido {total_questions} preguntas. 📊 Volumen + consistencia = dominio garantizado",
      "🔥 ¡Racha de fuego! Los demás opositores querrían tu constancia. 🎯 Constancia > talento según estudios de éxito",
      "💪 {streak} días sin fallar. Tu plaza está cada vez más cerca. 📈 Cada día = 1% mejor, año = 37x mejor",
      "🎯 ¡Imparable! Tu dedicación marca la diferencia. 🧠 Disciplina: El músculo más importante del opositor",
      "👑 {streak} días de constancia absoluta. 💎 Excelencia = resultado de hábitos excepcionales diarios",
      "⚡ Constancia nivel: EXPERTO. 🔬 Neurociencia: Rutinas crean autopistas neuronales de éxito"
    ],
    score_achievements: [
      "🎯 ¡{score}% de aciertos! Nivel experto desbloqueado. 🧠 +80% accuracy = zona de dominio cognitivo",
      "⭐ Puntuación perfecta: {score}%. ¡Eres imparable! 💯 Perfección = preparación + oportunidad",
      "🏅 {score}% de media. Los tribunales estarían impresionados. 👨‍⚖️ Consistencia en puntuación = predictor de aprobado",
      "💯 Dominando la oposición: {score}% de éxito. 🎓 Dominio = 10.000 horas o {score}% de precisión"
    ],
    knowledge_milestones: [
      "📚 ¡{total_questions} preguntas completadas! Eres una enciclopedia. 🧠 Volumen de práctica = expertise real",
      "🧠 Conocimiento desbloqueado: {mastered_topics} temas dominados. 🔗 Conexiones neuronales = conocimiento sólido",
      "⚡ Velocidad mental: {avg_time}s por pregunta. ¡Increíble! ⚡ Rapidez + precisión = automatización del saber",
      "🎓 Nivel experto alcanzado en {strong_areas}. 💪 Fortalezas identificadas = ventaja competitiva clara"
    ]
  } as Record<string, string[]>,

  // 🎯 PROXIMIDAD DEL EXAMEN
  exam_proximity: {
    very_close: [ // < 30 días
      "🎯 CONVOCATORIA CERCA: Cada momento cuenta. ¡Sigamos! 🧠 Estrés positivo + preparación = rendimiento óptimo",
      "⭐ {days_until_exam} días para la convocatoria. ¡Tu momento ha llegado! ⏰ Presión temporal bien gestionada = foco máximo",
      "🔥 FASE FINAL: Tu preparación está dando frutos. 🌱 Últimas semanas = cosecha de meses de esfuerzo",
      "💯 Últimos días de preparación. ¡Estás preparado para triunfar! 🎯 Confianza + preparación = éxito inevitable",
      "🏁 META A LA VISTA: {days_until_exam} días para tu nueva vida. 🚀 Recta final = momento de máximo rendimiento",
      "⏰ CUENTA FINAL: {days_until_exam} días para demostrar todo lo que sabes. 💪 Conocimiento + tiempo = oportunidad perfecta"
    ],
    close: [ // 30-90 días
      "📅 Quedan {days_until_exam} días. Cada día de estudio es oro. ⚡ Intensidad controlada = preparación efectiva",
      "🎯 La convocatoria se acerca. ¿Tu nivel está donde quieres? 📊 Autoevaluación honesta = ajuste estratégico",
      "💪 Tiempo de intensificar. Tu plaza te está esperando. 🔥 Últimos 2-3 meses = momento decisivo",
      "🔥 {days_until_exam} días para cambiar tu vida. ¿Los aprovecharás? ⏰ Tiempo limitado = valor infinito"
    ],
    moderate: [ // 3-6 meses
      "📆 {months_until_exam} meses para la convocatoria. Tiempo de ser constante. 🐢 Constancia prolongada > ráfagas intensas",
      "🎯 Preparación a medio plazo: cada día cuenta para tu éxito. 📈 Progreso sostenido = bases sólidas",
      "💼 Tu futuro profesional se construye día a día. 🏗️ Cimientos sólidos requieren tiempo y paciencia"
    ]
  },

  // 📊 ÁREAS DÉBILES
  weakness_focus: [
    "📊 Tu área débil en {weak_topic} necesita atención. ¡A por ella! 🎯 Enfoque en debilidades = mejora exponencial",
    "🎯 Convierte tu debilidad en fortaleza: practica {weak_topic}. 💪 Zona de incomodidad = zona de crecimiento",
    "💡 Los aprobados dominan TODAS las áreas. ¿Trabajamos {weak_topic}? 🏆 Excelencia integral = diferencia competitiva",
    "🔧 Reparemos esa área débil: {weak_topic} te está esperando. 🛠️ Debilidad identificada = 50% del problema resuelto",
    "⚡ {weak_topic} al {weak_percentage}%. Tiempo de mejorarlo. 📈 Cada punto de mejora = ventaja en el examen",
    "🎓 Especialízate en tu punto débil: {weak_topic}. 🧠 Neuroplasticidad: Siempre es posible mejorar",
    "🏗️ Construyamos fortaleza en {weak_topic}. ¡Tú puedes! 💎 Presión sobre debilidades crea fortalezas sólidas"
  ],

  // 💪 ÁREAS FUERTES (refuerzo positivo)
  strength_reinforcement: [
    "🏆 ¡Dominando {strong_topic} al {strong_percentage}%! Sigue así",
    "⭐ Tu fortaleza en {strong_topic} es de nivel experto",
    "🔥 {strong_topic}: Tu área estrella. ¡Mantenla brillando!",
    "💪 Experto en {strong_topic}. Los tribunales quedarían impresionados"
  ],

  // 🎯 RENDIMIENTO Y ESTADÍSTICAS
  performance_insights: [
    "📈 Tu rendimiento está subiendo. ¡{improvement}% mejor esta semana!",
    "⚡ Velocidad mejorada: {time_improvement}s menos por pregunta",
    "🎯 Precisión en aumento: {accuracy_improvement}% más de aciertos",
    "🔥 Racha de {correct_streak} respuestas correctas. ¡Imparable!"
  ],

  // 🌟 MOTIVACIÓN ESPECIAL
  special_motivation: {
    monday: [
      "💼 ¡Lunes de opositor! Empieza la semana con determinación. 🧠 Fresh start effect: Los lunes potencian la motivación",
      "🚀 Nueva semana, nuevas oportunidades de acercarte a tu plaza. 📅 Planning semanal = 5x más efectividad",
      "⚡ Lunes = Nuevo impulso hacia tu oposición. 🔄 Reset mental semanal = energía renovada"
    ],
    friday: [
      "🎉 ¡Viernes! Termina la semana con broche de oro. 🏆 Viernes productivo = weekend sin culpa",
      "⭐ Un test del viernes = Weekend más tranquilo. 😌 Cierre semanal positivo = descanso mental",
      "🔥 Viernes de esfuerzo = Lunes más cerca del aprobado. 📈 Momentum de viernes = impulso de lunes"
    ],
    weekend: [
      "🌅 Fin de semana = Tiempo extra para tu oposición. ⏰ Sin prisa = concentración profunda",
      "⚡ Los weekends son perfectos para avanzar a tu ritmo. 🎯 Tiempo libre = oportunidad de oro",
      "🎯 Sábado de estudio = Domingo de satisfacción. 😊 Equilibrio productivo = bienestar sostenible"
    ]
  },

  // 🌟 MOTIVACIÓN ESPECIAL (usuarios muy inactivos)
  emergency_motivation: [
    "🌟 ¡Tu potencial está intacto! Es hora de retomar el camino. 🧠 Neuroplasticidad: El cerebro mantiene capacidad de aprender toda la vida",
    "💫 Han pasado {days_inactive} días, pero tu sueño sigue vivo. 💪 Pausa no es abandono, es recarga estratégica",
    "🌈 Mientras otros {active_users} usuarios estudian, tú puedes unirte cuando quieras. 👥 Comunidad + motivación = fuerza multiplicada",
    "💖 Tu sueño profesional te está esperando pacientemente. ¡Vamos juntos! 🎯 Metas dormidas despiertan con primer paso",
    "🌅 Cada día es una nueva oportunidad. ¡Hoy puede ser tu día! ⚡ Momento presente = único momento de acción real"
  ]
}

// Función para seleccionar mensaje contextual
export function selectContextualMessage(category: string, context: MessageContext = {}): string {
  const {
    subcategory,
    streak = 0,
    daysInactive = 0,
    score = 0,
    totalQuestions = 0,
    weakTopic = '',
    strongTopic = '',
    daysUntilExam = null,
    motivationLevel = 'medium',
    timeOfDay = 'morning',
  } = context;

  let messagePool: string[] = [];

  // Seleccionar pool de mensajes según categoría
  switch (category) {
    case 'streak_danger':
      messagePool = motivationLevel === 'high' ?
        oposicionMessageTemplates.streak_danger.urgent :
        oposicionMessageTemplates.streak_danger.motivational;
      break;

    case 'daily_motivation':
      messagePool = (oposicionMessageTemplates.daily_motivation as Record<string, string[]>)[timeOfDay] ||
        oposicionMessageTemplates.daily_motivation.morning;
      break;

    case 'comeback':
      if (daysInactive <= 2) {
        messagePool = oposicionMessageTemplates.comeback.short_break;
      } else if (daysInactive <= 5) {
        messagePool = oposicionMessageTemplates.comeback.medium_break;
      } else {
        messagePool = oposicionMessageTemplates.comeback.long_break;
      }
      break;

    case 'achievement':
      messagePool = (oposicionMessageTemplates.achievement as Record<string, string[]>)[subcategory || 'streak_milestones'] ||
        oposicionMessageTemplates.achievement.streak_milestones;
      break;

    case 'exam_proximity':
      if (daysUntilExam !== null && daysUntilExam <= 30) {
        messagePool = oposicionMessageTemplates.exam_proximity.very_close;
      } else if (daysUntilExam !== null && daysUntilExam <= 90) {
        messagePool = oposicionMessageTemplates.exam_proximity.close;
      } else {
        messagePool = oposicionMessageTemplates.exam_proximity.moderate;
      }
      break;

    case 'weakness_focus':
      messagePool = oposicionMessageTemplates.weakness_focus;
      break;

    case 'emergency':
      messagePool = oposicionMessageTemplates.emergency_motivation;
      break;

    default:
      messagePool = oposicionMessageTemplates.daily_motivation.morning;
  }

  // Seleccionar mensaje aleatorio del pool
  const randomMessage = messagePool[Math.floor(Math.random() * messagePool.length)];

  // Reemplazar variables en el mensaje
  return randomMessage
    .replace('{streak}', String(streak))
    .replace('{days_inactive}', String(daysInactive))
    .replace('{score}', String(score))
    .replace('{total_questions}', String(totalQuestions))
    .replace('{weak_topic}', weakTopic)
    .replace('{strong_topic}', strongTopic)
    .replace('{days_until_exam}', String(daysUntilExam))
    .replace('{months_until_exam}', String(Math.ceil((daysUntilExam || 0) / 30)))
    .replace('{weak_percentage}', String(Math.round(Math.random() * 30 + 40)))
    .replace('{strong_percentage}', String(Math.round(Math.random() * 20 + 80)))
    .replace('{improvement}', String(Math.round(Math.random() * 15 + 5)))
    .replace('{time_improvement}', String(Math.round(Math.random() * 5 + 1)))
    .replace('{accuracy_improvement}', String(Math.round(Math.random() * 10 + 3)))
    .replace('{correct_streak}', String(Math.round(Math.random() * 8 + 3)))
    .replace('{active_users}', String(Math.round(Math.random() * 500 + 100)));
}

// Función para determinar urgencia del mensaje
export function calculateMessageUrgency(context: UrgencyContext): number {
  const {
    daysInactive = 0,
    streak = 0,
    daysUntilExam = null,
    riskLevel = 'low'
  } = context;

  let urgency = 1; // Base

  // Factor inactividad
  if (daysInactive >= 7) urgency += 4;
  else if (daysInactive >= 3) urgency += 2;
  else if (daysInactive >= 1) urgency += 1;

  // Factor racha en peligro
  if (streak >= 10 && daysInactive >= 1) urgency += 2;
  if (streak >= 5 && daysInactive >= 1) urgency += 1;

  // Factor proximidad examen
  if (daysUntilExam && daysUntilExam <= 30) urgency += 3;
  else if (daysUntilExam && daysUntilExam <= 90) urgency += 1;

  // Factor nivel de riesgo
  switch (riskLevel) {
    case 'critical': urgency += 3; break;
    case 'high': urgency += 2; break;
    case 'medium': urgency += 1; break;
  }

  return Math.min(urgency, 5); // Máximo 5
}

export default {
  oposicionMessageTemplates,
  selectContextualMessage,
  calculateMessageUrgency
};
