-- Script para corregir información de Vence y añadir temarios
-- Ejecutar con: node scripts/run-sql.cjs scripts/fix-kb-vence-temarios.sql

-- 1. CORREGIR entrada "¿Qué es Vence?" (ID: 271c3589-d8d7-47f8-a3a3-9d2fa170ab62)
UPDATE ai_knowledge_base
SET
  content = E'**Vence** es una plataforma de preparación para oposiciones en España, especializada en:\n\n- 🏛️ **Auxiliar Administrativo del Estado** (C2)\n- 🏛️ **Administrativo del Estado** (C1)\n- ⚖️ **Tramitación Procesal y Administrativa**\n- ⚖️ **Auxilio Judicial**\n\n**¿Qué ofrece?**\n- 📚 **Temarios completos y GRATIS** - Legislación del BOE organizada por temas\n- 📝 Miles de preguntas tipo test de exámenes oficiales\n- 🆓 **Plan Free**: 25 preguntas/día gratis + temarios completos\n- 🤖 **Chat con IA** para resolver dudas sobre las leyes\n- 💬 **Chat de soporte** con el equipo de Vence (disponible incluso en plan Free)\n- 📊 Estadísticas de progreso detalladas\n- 🎯 Tests personalizados por ley o tema\n- 📱 Funciona en móvil, tablet y ordenador\n\nCreada por opositores para opositores.',
  short_answer = 'Plataforma de oposiciones con temarios gratis, tests (25/día gratis), chat IA para dudas de leyes, chat de soporte humano (gratis) y estadísticas.',
  keywords = ARRAY['vence', 'qué es', 'oposiciones', 'temario', 'gratis', 'tests', 'auxiliar', 'administrativo', 'tramitación', 'auxilio', 'soporte'],
  embedding = NULL,
  updated_at = NOW()
WHERE id = '271c3589-d8d7-47f8-a3a3-9d2fa170ab62';

-- 2. Temarios gratis
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'funcionalidades',
  'temarios',
  '¿Los temarios son gratis en Vence?',
  E'## Temarios 100% Gratis en Vence\n\n**Sí, todos los temarios son completamente gratis.**\n\n### ¿Por qué?\nLa legislación es pública y está disponible en el BOE. Vence lo organiza y estructura de forma adecuada para que puedas estudiar de forma eficiente.\n\n### ¿Qué incluyen los temarios?\n- Contenido completo de cada tema\n- Artículos de las leyes organizados por tema\n- Indicación de artículos que han aparecido en exámenes oficiales\n- Estructura oficial según el BOE actualizado\n\n### Temarios disponibles:\n- **Auxiliar Administrativo del Estado** (28 temas)\n- **Administrativo del Estado C1** (45 temas)\n- **Tramitación Procesal y Administrativa**\n- **Auxilio Judicial**\n\n### ¿Necesito registrarme?\nPuedes ver el temario sin registrarte. Si te registras (gratis), podrás ver tu progreso por tema.\n\nAccede desde: [Temarios](/temarios)',
  'Sí, todos los temarios son 100% gratis. Incluyen el contenido completo de cada tema con la legislación organizada del BOE.',
  ARRAY['temario', 'temarios', 'gratis', 'free', 'contenido', 'temas', 'legislación', 'BOE'],
  10,
  true
);

-- 3. Qué oposiciones tienen temario
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'funcionalidades',
  'temarios',
  '¿Qué oposiciones tienen temario en Vence?',
  E'## Oposiciones con Temario en Vence\n\nActualmente tenemos temarios completos para:\n\n### Administración General del Estado\n- **Auxiliar Administrativo del Estado** - 28 temas\n- **Administrativo del Estado C1** - 45 temas\n\n### Justicia\n- **Tramitación Procesal y Administrativa**\n- **Auxilio Judicial**\n\nTodos los temarios son **100% gratis** y están basados en la legislación oficial del BOE.\n\nAccede desde: [Temarios](/temarios)',
  'Auxiliar Administrativo del Estado (28 temas), Administrativo C1 (45 temas), Tramitación Procesal y Auxilio Judicial. Todos gratis.',
  ARRAY['oposiciones', 'temario', 'auxiliar', 'administrativo', 'tramitación', 'auxilio', 'justicia'],
  8,
  true
);

-- 4. De dónde salen las preguntas (CORREGIDO - no son generadas por IA)
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'funcionalidades',
  'preguntas',
  '¿De dónde salen las preguntas de los tests?',
  E'## Origen de las Preguntas en Vence\n\nLas preguntas de Vence provienen de **dos fuentes principales**:\n\n### 1. Exámenes Oficiales\nPreguntas reales de convocatorias anteriores. Están marcadas con el badge "Pregunta de Examen Oficial" e indican de qué examen provienen.\n\n### 2. Creadas por el Equipo de Vence\nPreguntas elaboradas por nuestro equipo, basadas en la legislación vigente. Cada pregunta está vinculada al artículo exacto de la ley correspondiente.\n\n### Características:\n- Todas las preguntas están **vinculadas a artículos del BOE**\n- Incluyen **explicación** con referencia al artículo\n- Las de exámenes oficiales muestran la **fuente original**\n- Revisadas para garantizar que estén actualizadas\n\n**Nota**: La IA de Vence NO genera las preguntas. La IA es el asistente del chat que te ayuda a entender conceptos y resolver dudas.',
  'Las preguntas vienen de exámenes oficiales y del equipo de Vence. La IA NO genera preguntas, solo ayuda a resolver dudas en el chat.',
  ARRAY['preguntas', 'origen', 'exámenes', 'oficiales', 'fuente', 'test', 'IA'],
  9,
  true
);

-- 5. Diferencia entre temario y tests
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'funcionalidades',
  'temarios',
  '¿Cuál es la diferencia entre temario y tests en Vence?',
  E'## Temario vs Tests en Vence\n\n### Temario (100% Gratis para todos)\nEl **contenido de estudio**: legislación organizada por temas.\n- Artículos de las leyes que entran en cada tema\n- Acceso completo sin restricciones\n- Para leer y estudiar la teoría\n- No requiere registro\n\n### Tests (Gratis con límite diario)\nLa **práctica**: preguntas tipo test.\n- **Plan Free**: 25 preguntas/día gratis\n- **Plan Premium**: tests ilimitados\n- Preguntas de exámenes oficiales + creadas por Vence\n- Con explicaciones y referencia a artículos\n\n### Recomendación\n1. **Estudia** el temario (gratis)\n2. **Practica** con tests para afianzar\n3. **Repasa** tus fallos para mejorar',
  'Temario = contenido de estudio (100% gratis). Tests = práctica con preguntas (25/día gratis, ilimitados en Premium).',
  ARRAY['temario', 'tests', 'diferencia', 'gratis', 'premium', 'estudiar', 'practicar'],
  9,
  true
);

-- 6. Plan Free - qué incluye
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'planes',
  'free',
  '¿Qué incluye el plan gratis de Vence?',
  E'## Plan Free de Vence\n\nEl plan gratuito incluye:\n\n### Sin límites:\n- ✅ **Temarios completos** - Todo el contenido de estudio\n- ✅ **Registro gratuito** - Sin tarjeta de crédito\n\n### Con límites diarios:\n- 📝 **25 preguntas de test al día**\n- 💬 **5 mensajes de chat IA al día**\n- 📊 Estadísticas básicas\n\n### Ideal para:\n- Probar la plataforma\n- Estudiar el temario a tu ritmo\n- Práctica ligera diaria\n\nSi necesitas más práctica, puedes pasarte a Premium en cualquier momento.',
  'Plan Free: temarios completos gratis, 25 preguntas/día, 5 mensajes chat IA/día, estadísticas básicas. Sin tarjeta.',
  ARRAY['plan', 'free', 'gratis', 'gratuito', 'incluye', 'límite', 'preguntas'],
  10,
  true
);

-- 7. Chat de soporte gratis
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'funcionalidades',
  'soporte',
  '¿El chat de soporte es gratis?',
  E'## Chat de Soporte en Vence\n\n**Sí, el chat de soporte es completamente gratis**, incluso en el plan Free.\n\n### Dos tipos de chat en Vence:\n\n#### 1. Chat con IA (este chat)\n- Resuelve dudas sobre las leyes y el contenido\n- Explica artículos y conceptos\n- Plan Free: 5 mensajes/día\n- Plan Premium: ilimitado\n\n#### 2. Chat de Soporte Humano\n- Atendido por el equipo de Vence\n- Para dudas sobre la plataforma, pagos, etc.\n- **100% GRATIS** en todos los planes\n- Sin límite de mensajes\n\n### ¿Cómo acceder al soporte?\nDesde tu perfil o desde el menú, busca "Soporte" o "Contacto". Un miembro del equipo te atenderá lo antes posible.',
  'Sí, el chat de soporte con el equipo de Vence es 100% gratis en todos los planes, incluso en Free. Sin límite.',
  ARRAY['soporte', 'chat', 'ayuda', 'contacto', 'gratis', 'equipo', 'humano', 'atención'],
  9,
  true
);

