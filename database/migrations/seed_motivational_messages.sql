-- =====================================================
-- SEED: Mensajes Motivacionales Iniciales (50 mensajes)
-- =====================================================
-- Placeholders disponibles: {nombre}, {ciudad}, {dias}, {nota}, {racha}

-- ========================================
-- CATEGORÍA: EXAM_RESULT (Resultados de exámenes)
-- ========================================

-- SUBCATEGORÍA: Excelente (9-10)
INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, min_accuracy, priority) VALUES
('exam_result', 'excellent',
 '["¡PERFECTO, {nombre}! 🏆 Un día menos para tu plaza", "¡IMPRESIONANTE, {nombre}! Así se consiguen las plazas 🌟", "¡BRUTAL, {nombre}! Tu esfuerzo está dando frutos 💪"]'::jsonb,
 '🏆', 'celebratory', 'yellow', 90, 10),

('exam_result', 'excellent',
 '["¡{nombre}! Cada día estás más cerca de tu objetivo 🎯", "¡Imparable, {nombre}! Sigue así y la plaza es tuya ⚡", "¡Crack! Tu constancia te llevará lejos 🚀"]'::jsonb,
 '🎉', 'celebratory', 'green', 90, 10);

-- SUBCATEGORÍA: Muy Bien (8-8.9)
INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, min_accuracy, max_accuracy, priority) VALUES
('exam_result', 'very_good',
 '["¡MUY BIEN, {nombre}! Vas por muy buen camino 💪", "¡Excelente trabajo, {nombre}! Un día menos para tu plaza 📚", "¡Sigue así, {nombre}! Tu esfuerzo se nota 🌟"]'::jsonb,
 '🎉', 'motivational', 'green', 80, 89.9, 9),

('exam_result', 'very_good',
 '["¡Genial, {nombre}! Estás dominando el temario ✨", "¡Muy bien, {nombre}! La constancia es tu mejor aliada 🔥", "¡Increíble progreso, {nombre}! Sigue con esa energía 💯"]'::jsonb,
 '💪', 'motivational', 'blue', 80, 89.9, 9);

-- SUBCATEGORÍA: Bien (7-7.9)
INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, min_accuracy, max_accuracy, priority) VALUES
('exam_result', 'good',
 '["¡Bien hecho, {nombre}! Vas por buen camino 👏", "¡Sigue así, {nombre}! Cada test te acerca más 📈", "¡Buen trabajo, {nombre}! La práctica hace al maestro 📖"]'::jsonb,
 '👏', 'supportive', 'blue', 70, 79.9, 8),

('exam_result', 'good',
 '["¡{nombre}, vas bien! Sigue practicando y mejorarás 💪", "¡Progreso constante, {nombre}! Así se consigue 🎯", "¡Adelante, {nombre}! Cada día un paso más cerca ⚡"]'::jsonb,
 '📚', 'supportive', 'blue', 70, 79.9, 8);

-- SUBCATEGORÍA: Regular (6-6.9)
INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, min_accuracy, max_accuracy, priority) VALUES
('exam_result', 'okay',
 '["Vas bien, {nombre}! Revisa tus fallos y mejora 💪", "¡{nombre}, sigue adelante! Los errores son aprendizaje 📖", "¡Ánimo, {nombre}! La constancia vence todo 🌱"]'::jsonb,
 '💙', 'supportive', 'blue', 60, 69.9, 7),

('exam_result', 'okay',
 '["¡{nombre}, sigue practicando! Cada test suma 📚", "No te rindas, {nombre}! Estás aprendiendo 💡", "¡Sigue así, {nombre}! El progreso llega con paciencia 🌟"]'::jsonb,
 '💪', 'supportive', 'purple', 60, 69.9, 7);

-- SUBCATEGORÍA: Bajo (5-5.9)
INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, min_accuracy, max_accuracy, priority) VALUES
('exam_result', 'low',
 '["No te desanimes, {nombre}! Los errores son tu mejor profesor 💙", "¡{nombre}, cada intento te hace más fuerte! 💪", "Sigue adelante, {nombre}! El éxito está en la constancia 🌱"]'::jsonb,
 '💙', 'supportive', 'blue', 50, 59.9, 6),

('exam_result', 'low',
 '["¡{nombre}, no pares! Cada pregunta fallada es una lección 📖", "Revisa, aprende y vuelve más fuerte, {nombre}! 🔥", "La perseverancia es tu arma, {nombre}! 💪"]'::jsonb,
 '🌱', 'supportive', 'purple', 50, 59.9, 6);

-- ========================================
-- CATEGORÍA: STREAK (Rachas de estudio)
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, min_streak, priority) VALUES
('streak', 'active',
 '["🔥 {nombre}, llevas {racha} días de racha! Imparable!", "⚡ {racha} días seguidos, {nombre}! Así se consiguen las plazas", "🌟 {nombre}, {racha} días sin parar! Tu plaza te espera"]'::jsonb,
 '🔥', 'celebratory', 'yellow', 3, 10),

('streak', 'milestone',
 '["💯 {nombre}! {racha} días de racha. Eres un campeón!", "🏆 {racha} días consecutivos, {nombre}! Brutal!", "⭐ {nombre}, {racha} días de disciplina! Imparable!"]'::jsonb,
 '🏆', 'celebratory', 'yellow', 7, 10);

-- ========================================
-- CATEGORÍA: DAILY_PROGRESS (Progreso diario)
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, time_of_day, priority) VALUES
('daily_progress', 'morning',
 '["☀️ ¡Buenos días, {nombre}! Un día menos para tu plaza", "🌅 ¡Hola {nombre}! Hoy es el día de brillar", "☕ Buenos días! El éxito empieza con acción"]'::jsonb,
 '☀️', 'motivational', 'yellow', ARRAY['morning'], 8),

('daily_progress', 'afternoon',
 '["🌤️ Sigue avanzando, {nombre}! Cada minuto cuenta", "📖 Tarde de estudio = Mañana de éxito", "💪 Tu esfuerzo de hoy construye tu futuro"]'::jsonb,
 '🌤️', 'motivational', 'blue', ARRAY['afternoon'], 7),

('daily_progress', 'night',
 '["🌙 Estudiar de noche demuestra tu compromiso, {nombre}", "⭐ Mientras otros duermen, tú avanzas", "🌃 El sacrificio de hoy es el logro de mañana"]'::jsonb,
 '🌙', 'motivational', 'purple', ARRAY['night'], 7);

-- ========================================
-- CATEGORÍA: ACHIEVEMENT (Logros específicos)
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, priority) VALUES
('achievement', 'questions_milestone',
 '["🎉 {nombre}! Has respondido {preguntas} preguntas! Increíble", "💯 {preguntas} preguntas completadas, {nombre}! Imparable", "🚀 {nombre}, {preguntas} preguntas! Tu plaza está más cerca"]'::jsonb,
 '🎉', 'celebratory', 'green', 9),

('achievement', 'mastery',
 '["🏆 {nombre}, dominas {porcentaje}% del temario! Brutal!", "⭐ {porcentaje}% del temario conquistado, {nombre}!", "💪 {nombre}, ya controlas {porcentaje}% del contenido!"]'::jsonb,
 '🏆', 'celebratory', 'yellow', 9);

-- ========================================
-- CATEGORÍA: LOADING (Mensajes durante carga de examen)
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, priority) VALUES
('loading', 'preparation',
 '["⚡ Preparando tu examen, {nombre}! A demostrar lo aprendido", "🎯 Cargando test... Tu plaza te espera al otro lado", "💪 Casi listo, {nombre}! Es tu momento de brillar"]'::jsonb,
 '⚡', 'motivational', 'blue', 8),

('loading', 'encouragement',
 '["🌟 Preparando preguntas para ti... Vas a hacerlo genial!", "📚 Cargando... Recuerda: cada pregunta es una oportunidad", "🔥 Casi listo! Confía en tu preparación"]'::jsonb,
 '🌟', 'motivational', 'green', 8);

-- ========================================
-- CATEGORÍA: WELCOME (Bienvenida/Reactivación)
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, priority) VALUES
('welcome', 'return',
 '["¡Bienvenido de vuelta, {nombre}! Tu plaza te ha esperado 💪", "¡{nombre}! Qué alegría verte de nuevo 🎉", "Vuelves más fuerte, {nombre}! A por todas 🚀"]'::jsonb,
 '🎉', 'friendly', 'blue', 9),

('welcome', 'first_time',
 '["¡Bienvenido, {nombre}! Empiezas tu camino hacia la plaza 🌟", "¡Hola {nombre}! Primer paso dado, miles por delante 💪", "¡{nombre}! Bienvenido a tu futuro éxito 🎯"]'::jsonb,
 '👋', 'friendly', 'green', 10);

-- ========================================
-- MENSAJES POR TEMPORADA / CONTEXTO
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, day_of_week, priority) VALUES
('daily_progress', 'monday',
 '["💼 Lunes de ganadores, {nombre}! Nueva semana, nueva oportunidad", "🔋 Lunes! Empieza la semana con fuerza", "⚡ {nombre}, nuevo lunes para acercarte a tu plaza"]'::jsonb,
 '💼', 'motivational', 'blue', ARRAY[1], 8),

('daily_progress', 'friday',
 '["🎉 Viernes! Pero tú sigues estudiando como un campeón", "🏁 {nombre}, termina la semana como empezaste: imparable", "💪 Viernes de esfuerzo = Lunes más cerca de tu plaza"]'::jsonb,
 '🎉', 'motivational', 'green', ARRAY[5], 8),

('daily_progress', 'weekend',
 '["🚀 Fin de semana estudiando = Plaza más cerca", "💪 {nombre}, mientras otros descansan, tú avanzas", "🌟 Fin de semana de sacrificio, futuro de éxito"]'::jsonb,
 '🚀', 'motivational', 'purple', ARRAY[6,7], 8);

-- ========================================
-- MENSAJES DE MEJORA Y COMPARACIÓN PERSONAL
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, priority) VALUES
('achievement', 'improvement',
 '["📊 {nombre}, has mejorado un {mejora}% desde el mes pasado!", "🎯 Tu precisión ha subido {mejora} puntos! Impresionante!", "⚡ {nombre}, ahora respondes {mejora}% más rápido que antes"]'::jsonb,
 '📊', 'celebratory', 'green', 9),

('achievement', 'consistency',
 '["🌟 {nombre}, {dias} días consecutivos estudiando! Disciplina pura", "💯 {dias} días sin fallar! Eso es dedicación", "🔥 {nombre}, llevas {dias} días demostrando tu compromiso"]'::jsonb,
 '🌟', 'celebratory', 'yellow', 9);

-- ========================================
-- MENSAJES DE MOTIVACIÓN EN MOMENTOS DIFÍCILES
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, max_accuracy, priority) VALUES
('exam_result', 'struggle',
 '["💙 Los errores son escalones hacia el éxito, {nombre}", "🌱 Cada pregunta fallada es una lección valiosa", "💪 No importa cuántas veces caes, sino cuántas te levantas"]'::jsonb,
 '💙', 'supportive', 'blue', 49.9, 7),

('exam_result', 'persistence',
 '["🌟 {nombre}, la persistencia vence lo que la fuerza no puede", "🔥 Cada intento te hace más sabio, {nombre}", "💪 El camino es duro, pero tú eres más duro aún"]'::jsonb,
 '🌱', 'supportive', 'purple', 49.9, 7);

-- ========================================
-- MENSAJES INSPIRADORES GENERALES
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, priority) VALUES
('daily_progress', 'inspiration',
 '["🎯 Un test más, un paso menos hacia tu objetivo", "💪 La constancia es tu mejor aliada, {nombre}", "⚡ Cada pregunta te acerca a tu meta"]'::jsonb,
 '🎯', 'motivational', 'blue', 7),

('daily_progress', 'time_investment',
 '["⏰ Cada minuto invertido hoy es tu éxito de mañana", "📚 Tu esfuerzo de hoy construye tu futuro", "🌟 Estudiar hoy es celebrar mañana"]'::jsonb,
 '⏰', 'motivational', 'green', 7);

-- ========================================
-- MENSAJES CON REFERENCIA A LA CIUDAD (si disponible)
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, priority) VALUES
('daily_progress', 'location',
 '["🌍 {nombre}, desde {ciudad} hacia tu plaza! Un día menos", "📍 {ciudad} te verá triunfar, {nombre}! Sigue así", "🏙️ Desde {ciudad} conquistas tu futuro, {nombre}"]'::jsonb,
 '🌍', 'motivational', 'blue', 6),

('exam_result', 'location_success',
 '["🎉 {nombre} desde {ciudad}! Increíble resultado!", "🌟 {ciudad} está orgullosa de ti, {nombre}!", "💪 Representando a {ciudad} como un crack!"]'::jsonb,
 '🎉', 'celebratory', 'green', 80, 6);

-- ========================================
-- MENSAJES DE CUENTA REGRESIVA
-- ========================================

INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, priority) VALUES
('daily_progress', 'countdown',
 '["📅 Un día menos para tu plaza, {nombre}. Sigue adelante!", "⏰ Cada día que pasa, tu meta está más cerca", "🗓️ {nombre}, hoy es otro día conquistado"]'::jsonb,
 '📅', 'motivational', 'purple', 8);

COMMENT ON TABLE motivational_messages IS 'Mensajes motivacionales con 50+ variantes contextuales';
