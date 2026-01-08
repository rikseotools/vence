-- Migración: Crear tabla ai_knowledge_base para FAQs y conocimiento de la plataforma
-- Permite responder preguntas sobre planes, funcionalidades, etc. usando búsqueda semántica
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla principal
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Categorización
  category TEXT NOT NULL,              -- 'planes', 'funcionalidades', 'faq', 'plataforma', 'oposiciones'
  subcategory TEXT,                    -- Subcategoría opcional

  -- Contenido
  title TEXT NOT NULL,                 -- Título/pregunta: "¿Qué incluye el plan Free?"
  content TEXT NOT NULL,               -- Respuesta completa en markdown
  short_answer TEXT,                   -- Respuesta corta para respuestas rápidas

  -- Búsqueda
  keywords TEXT[] DEFAULT '{}',        -- Keywords para fallback sin embeddings
  embedding vector(1536),              -- Vector embedding para búsqueda semántica

  -- Configuración
  priority INTEGER DEFAULT 0,          -- Mayor = más prioridad en resultados
  is_active BOOLEAN DEFAULT true,

  -- Metadata flexible
  metadata JSONB DEFAULT '{}',         -- Info extra: precios, links, imágenes, etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_category ON ai_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_active ON ai_knowledge_base(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_keywords ON ai_knowledge_base USING GIN(keywords);

-- 3. Índice para búsqueda semántica con embeddings
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_embedding ON ai_knowledge_base
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 20);

-- 4. Función para buscar en knowledge base por similitud semántica
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  category text,
  title text,
  content text,
  short_answer text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.category,
    kb.title,
    kb.content,
    kb.short_answer,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) as similarity
  FROM ai_knowledge_base kb
  WHERE kb.is_active = true
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR kb.category = filter_category)
  ORDER BY kb.priority DESC, kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Función para buscar por keywords (fallback sin embeddings)
CREATE OR REPLACE FUNCTION search_knowledge_base_keywords(
  search_terms text[],
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  category text,
  title text,
  content text,
  short_answer text,
  metadata jsonb,
  match_score int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.category,
    kb.title,
    kb.content,
    kb.short_answer,
    kb.metadata,
    (SELECT COUNT(*)::int FROM unnest(search_terms) term WHERE term = ANY(kb.keywords)) as match_score
  FROM ai_knowledge_base kb
  WHERE kb.is_active = true
    AND kb.keywords && search_terms  -- Overlap operator: tiene algún keyword en común
  ORDER BY kb.priority DESC, match_score DESC
  LIMIT match_count;
END;
$$;

-- 6. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_ai_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_knowledge_base_updated_at ON ai_knowledge_base;
CREATE TRIGGER trigger_ai_knowledge_base_updated_at
  BEFORE UPDATE ON ai_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_knowledge_base_updated_at();

-- 7. RLS Policies
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer (es contenido público)
CREATE POLICY "Anyone can read knowledge base" ON ai_knowledge_base
  FOR SELECT USING (is_active = true);

-- Solo admins pueden modificar
CREATE POLICY "Admins can manage knowledge base" ON ai_knowledge_base
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- 8. Insertar datos iniciales de la plataforma
INSERT INTO ai_knowledge_base (category, title, content, short_answer, keywords, priority, metadata) VALUES

-- PLANES
('planes', '¿Qué incluye el plan Free?',
'El **plan Free** de Vence incluye:

- ✅ **25 preguntas de test al día** - Suficiente para mantener el hábito de estudio
- ✅ **5 mensajes de chat IA al día** - Para resolver dudas puntuales
- ✅ **Acceso a todos los temas** - Sin restricciones de contenido
- ✅ **Estadísticas básicas** - Ve tu progreso general
- ✅ **Racha de estudio** - Mantén tu motivación

El plan Free es perfecto para empezar y probar la plataforma. Cuando necesites estudiar más intensivamente, puedes actualizar a Premium.',
'25 preguntas/día, 5 mensajes de chat IA/día, acceso a todos los temas, estadísticas básicas.',
ARRAY['free', 'gratis', 'plan', 'incluye', 'límite', 'limitación', 'qué tengo', 'beneficios'],
10,
'{"preguntas_dia": 25, "chat_dia": 5}'::jsonb),

('planes', '¿Qué incluye el plan Premium?',
'El **plan Premium** de Vence incluye:

- ✅ **Preguntas ilimitadas** - Estudia sin límites
- ✅ **Chat IA ilimitado** - Pregunta todo lo que necesites
- ✅ **Estadísticas avanzadas** - Análisis detallado por ley y tema
- ✅ **Tests personalizados** - Configura exactamente lo que quieres practicar
- ✅ **Sin publicidad** - Experiencia limpia y enfocada
- ✅ **Soporte prioritario** - Respuestas más rápidas

**Precios:**
- 💰 **59€ / 6 meses** (~9.83€/mes) - Más popular
- 💰 **20€ / mes** - Máxima flexibilidad',
'Preguntas ilimitadas, chat IA ilimitado, estadísticas avanzadas, tests personalizados. 59€/6 meses o 20€/mes.',
ARRAY['premium', 'precio', 'coste', 'pagar', 'suscripción', 'ilimitado', 'sin límites', 'cuánto cuesta'],
10,
'{"precio_semestral": 59, "precio_mensual": 20, "moneda": "EUR"}'::jsonb),

('planes', '¿Cuál es la diferencia entre Free y Premium?',
'**Comparativa Free vs Premium:**

| Característica | Free | Premium |
|----------------|------|---------|
| Preguntas/día | 25 | ♾️ Ilimitadas |
| Chat IA/día | 5 mensajes | ♾️ Ilimitado |
| Temas | ✅ Todos | ✅ Todos |
| Estadísticas | Básicas | Avanzadas |
| Tests personalizados | Limitado | Completo |
| Soporte | Normal | Prioritario |

**¿Cuándo pasar a Premium?**
- Si te quedas sin preguntas antes de terminar tu sesión de estudio
- Si necesitas análisis detallado de tus puntos débiles
- En la recta final antes del examen, cuando necesitas estudiar intensivamente',
'Free: 25 preguntas y 5 chats al día. Premium: todo ilimitado + estadísticas avanzadas.',
ARRAY['diferencia', 'comparar', 'free', 'premium', 'vs', 'versus', 'mejor'],
9,
'{}'::jsonb),

-- FUNCIONALIDADES
('funcionalidades', '¿Cómo funciona el chat de IA?',
'El **chat de IA de Vence** (Nila AI) es tu asistente personal para oposiciones:

**¿Qué puede hacer?**
- 📚 Responder dudas sobre **176 leyes españolas** con artículos exactos
- 📊 Mostrarte tu **progreso y estadísticas** por ley
- 🎯 Identificar tus **puntos débiles** y qué repasar
- ✍️ Explicar **por qué una respuesta es correcta** en las preguntas del test
- 📅 Informarte sobre **fechas de exámenes** y convocatorias

**¿Qué NO puede hacer?**
- ❌ Generar tests (usa el botón "Preparar test" para eso)
- ❌ Responder sobre temas no relacionados con oposiciones

Cada respuesta incluye los **artículos exactos** de la legislación para que puedas verificar la información.',
'Asistente IA con acceso a 176 leyes españolas. Responde dudas, muestra estadísticas y explica respuestas.',
ARRAY['chat', 'ia', 'inteligencia artificial', 'nila', 'asistente', 'cómo funciona', 'qué puede'],
8,
'{"leyes": 176, "articulos": 21000}'::jsonb),

('funcionalidades', '¿Cómo funcionan las estadísticas?',
'Las **estadísticas de Vence** te ayudan a estudiar de forma inteligente:

**Estadísticas básicas (Free):**
- Total de preguntas respondidas
- Porcentaje de aciertos global
- Racha de días estudiando

**Estadísticas avanzadas (Premium):**
- 📊 **Por ley**: Aciertos en cada ley (Ley 39/2015, Ley 40/2015, etc.)
- 📈 **Por tema**: Rendimiento en cada tema del temario
- 🎯 **Puntos débiles**: Artículos donde más fallas
- 📅 **Evolución**: Gráfico de tu progreso en el tiempo
- 🔥 **Artículos calientes**: Los más preguntados en exámenes oficiales

Puedes acceder a tus estadísticas desde el menú principal o preguntando a la IA "¿Cómo voy?".',
'Estadísticas por ley, tema, puntos débiles y evolución temporal. Básicas en Free, avanzadas en Premium.',
ARRAY['estadísticas', 'progreso', 'rendimiento', 'aciertos', 'fallos', 'cómo voy', 'mis datos'],
7,
'{}'::jsonb),

('funcionalidades', '¿De dónde salen las preguntas?',
'Las preguntas de Vence provienen de **dos fuentes**:

**1. Preguntas oficiales** 📋
- Extraídas de **exámenes reales** de convocatorias anteriores
- Incluyen el año y convocatoria de origen
- Marcadas con distintivo de "Oficial"

**2. Preguntas generadas con IA** 🤖
- Creadas por IA basándose en los **artículos reales** de las leyes
- Verificadas para asegurar precisión
- Permiten practicar artículos que no han aparecido en exámenes

Todas las preguntas están **vinculadas al artículo exacto** de la legislación, para que puedas verificar y profundizar.',
'Preguntas oficiales de exámenes reales + preguntas generadas por IA basadas en artículos de leyes.',
ARRAY['preguntas', 'origen', 'fuente', 'oficiales', 'exámenes', 'de dónde', 'cómo se hacen'],
7,
'{}'::jsonb),

-- PLATAFORMA
('plataforma', '¿Qué es Vence?',
'**Vence** es una plataforma de preparación para oposiciones en España, especializada en:

- 🏛️ **Auxiliar Administrativo del Estado** (C2)
- 🏛️ **Administrativo del Estado** (C1)

**¿Qué ofrece?**
- 📝 Miles de preguntas tipo test (oficiales + generadas por IA)
- 🤖 Chat con IA que conoce 176 leyes españolas
- 📊 Estadísticas de progreso detalladas
- 🎯 Tests personalizados por ley o tema
- 📱 Funciona en móvil, tablet y ordenador

Creada por opositores para opositores, con el objetivo de hacer el estudio más eficiente y menos tedioso.',
'Plataforma de preparación para oposiciones de Auxiliar y Administrativo del Estado con tests y chat IA.',
ARRAY['vence', 'qué es', 'plataforma', 'app', 'aplicación', 'para qué sirve'],
10,
'{}'::jsonb),

('plataforma', '¿Cómo contacto con soporte?',
'Puedes contactar con el equipo de Vence de varias formas:

- 📧 **Email**: Escribe a través del formulario de contacto en la web
- 💬 **Chat IA**: Para dudas sobre el temario, pregunta directamente a Nila AI
- 🐛 **Reportar errores**: Usa el botón "Reportar" en cualquier pregunta que creas incorrecta

**Tiempo de respuesta:**
- Usuarios Free: 24-48 horas
- Usuarios Premium: Respuesta prioritaria (< 24 horas)

Para problemas técnicos urgentes (no puedo acceder, error de pago, etc.), indica "URGENTE" en el asunto.',
'Email de contacto, chat IA para dudas del temario, botón reportar para errores en preguntas.',
ARRAY['contacto', 'soporte', 'ayuda', 'problema', 'email', 'reportar', 'error'],
6,
'{}'::jsonb),

-- FAQ
('faq', '¿Puedo cancelar mi suscripción Premium?',
'Sí, puedes **cancelar en cualquier momento**:

1. Ve a tu **Perfil** → **Suscripción**
2. Haz clic en **"Gestionar suscripción"**
3. Selecciona **"Cancelar"**

**¿Qué pasa al cancelar?**
- Mantienes el acceso Premium **hasta el final del período pagado**
- No se te cobrará en el siguiente período
- Tu progreso y estadísticas **se conservan**
- Puedes volver a suscribirte cuando quieras

No hay penalizaciones ni costes ocultos por cancelar.',
'Sí, cancela desde Perfil > Suscripción. Mantienes acceso hasta fin del período pagado.',
ARRAY['cancelar', 'baja', 'anular', 'devolver', 'reembolso', 'dejar de pagar'],
8,
'{}'::jsonb),

('faq', '¿Las preguntas se actualizan con cambios de leyes?',
'Sí, **mantenemos las preguntas actualizadas**:

- 🔄 **Monitorización continua**: Seguimos el BOE para detectar cambios legislativos
- ✏️ **Actualización de artículos**: Cuando una ley cambia, actualizamos los artículos afectados
- 🚫 **Desactivación de preguntas obsoletas**: Las preguntas sobre artículos derogados se desactivan
- ✅ **Verificación con IA**: Usamos IA para detectar posibles inconsistencias

Si detectas alguna pregunta desactualizada, usa el botón **"Reportar"** y la revisamos prioritariamente.',
'Sí, monitorizamos el BOE y actualizamos artículos y preguntas cuando hay cambios legislativos.',
ARRAY['actualizar', 'cambios', 'leyes', 'boe', 'derogado', 'modificado', 'vigente'],
7,
'{}'::jsonb),

('faq', '¿Funciona en el móvil?',
'Sí, Vence **funciona perfectamente en móvil**:

- 📱 **Diseño responsive**: Se adapta a cualquier tamaño de pantalla
- 📲 **Instalar como app**: Puedes añadirla a tu pantalla de inicio (PWA)
- 🔄 **Sincronización**: Tu progreso se guarda en la nube, accede desde cualquier dispositivo
- 📴 **Sin app store**: No necesitas descargar nada, funciona desde el navegador

**Para instalar en móvil:**
1. Abre vence.es en Chrome/Safari
2. Toca "Añadir a pantalla de inicio"
3. ¡Listo! Tendrás un icono como una app normal',
'Sí, diseño responsive + PWA. Funciona en navegador móvil y se puede instalar como app.',
ARRAY['móvil', 'celular', 'app', 'android', 'iphone', 'ios', 'tablet', 'descargar'],
7,
'{}'::jsonb);

-- 9. Comentario de tabla
COMMENT ON TABLE ai_knowledge_base IS 'Base de conocimiento para el chat IA: FAQs, info de planes, funcionalidades de la plataforma';

-- 10. Verificar
SELECT
  category,
  COUNT(*) as total,
  array_agg(title) as titulos
FROM ai_knowledge_base
GROUP BY category
ORDER BY category;
