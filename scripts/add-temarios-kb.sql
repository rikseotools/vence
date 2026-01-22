-- Script para añadir conocimiento sobre temarios gratis a la knowledge base
-- Ejecutar con: node scripts/run-sql.cjs scripts/add-temarios-kb.sql

-- 1. Temarios gratis
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'funcionalidades',
  'temarios',
  '¿Los temarios son gratis en Vence?',
  E'## Temarios 100% Gratis en Vence\n\n**Sí, todos los temarios son completamente gratis.**\n\n### ¿Por qué?\nLa legislación es pública y está disponible en el BOE. Vence lo organiza y estructura de forma adecuada para que puedas estudiar de forma eficiente.\n\n### ¿Qué incluyen los temarios?\n- Contenido completo de cada tema\n- Artículos de las leyes organizados por tema\n- Indicación de artículos que han aparecido en exámenes oficiales\n- Estructura oficial según el BOE actualizado\n\n### Temarios disponibles:\n- **Auxiliar Administrativo del Estado** (28 temas)\n- **Administrativo del Estado C1** (45 temas)\n- **Tramitación Procesal y Administrativa**\n- **Auxilio Judicial**\n- **Administrativo de Castilla y León**\n\n### ¿Necesito registrarme?\nPuedes ver el temario sin registrarte. Si te registras (gratis), podrás ver tu progreso por tema.\n\nAccede desde: [Temarios](/temarios)',
  'Sí, todos los temarios son 100% gratis. Incluyen el contenido completo de cada tema con la legislación organizada del BOE.',
  ARRAY['temario', 'temarios', 'gratis', 'free', 'contenido', 'temas', 'legislación', 'BOE'],
  10,
  true
);

-- 2. Qué oposiciones tienen temario
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'funcionalidades',
  'temarios',
  '¿Qué oposiciones tienen temario en Vence?',
  E'## Oposiciones con Temario en Vence\n\nActualmente tenemos temarios completos para:\n\n### Administración General del Estado\n- **Auxiliar Administrativo del Estado** - 28 temas\n- **Administrativo del Estado C1** - 45 temas\n\n### Justicia\n- **Tramitación Procesal y Administrativa**\n- **Auxilio Judicial**\n\n### Comunidades Autónomas\n- **Administrativo de Castilla y León**\n\nTodos los temarios son **100% gratis** y están basados en la legislación oficial del BOE.\n\nAccede desde: [Temarios](/temarios)',
  'Auxiliar Administrativo del Estado (28 temas), Administrativo C1 (45 temas), Tramitación Procesal, Auxilio Judicial y Administrativo de Castilla y León.',
  ARRAY['oposiciones', 'temario', 'auxiliar', 'administrativo', 'tramitación', 'auxilio', 'justicia'],
  8,
  true
);

-- 3. De dónde sale el contenido del temario
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'funcionalidades',
  'temarios',
  '¿De dónde sale el contenido del temario?',
  E'## Origen del Contenido del Temario\n\nEl contenido de los temarios proviene directamente del **Boletín Oficial del Estado (BOE)**.\n\n### Proceso:\n1. Extraemos la legislación vigente del BOE\n2. La organizamos según el temario oficial de cada oposición\n3. Vinculamos cada tema con los artículos exactos que lo componen\n4. Actualizamos cuando hay cambios legislativos\n\n### Garantías:\n- Legislación **literal** del BOE\n- **Actualizada** a la normativa vigente\n- Organizada por **temas oficiales**\n- Indicamos qué artículos han aparecido en **exámenes oficiales**\n\nLa legislación es pública, nosotros la estructuramos para facilitar tu estudio.',
  'El contenido proviene del BOE oficial. Vence organiza la legislación vigente según el temario oficial de cada oposición.',
  ARRAY['contenido', 'temario', 'BOE', 'legislación', 'origen', 'fuente', 'oficial'],
  7,
  true
);

-- 4. Diferencia entre temario y tests
INSERT INTO ai_knowledge_base (category, subcategory, title, content, short_answer, keywords, priority, is_active)
VALUES (
  'funcionalidades',
  'temarios',
  '¿Cuál es la diferencia entre temario y tests en Vence?',
  E'## Temario vs Tests en Vence\n\n### Temario (100% Gratis)\nEl **contenido de estudio**: legislación organizada por temas.\n- Artículos de las leyes que entran en cada tema\n- Acceso completo sin restricciones\n- Para leer y estudiar la teoría\n\n### Tests (Limitados en Free)\nLa **práctica**: preguntas tipo test.\n- Plan Free: 25 preguntas/día\n- Plan Premium: ilimitados\n- Preguntas de exámenes oficiales + generadas por IA\n\n### Recomendación\n1. **Estudia** el temario (gratis)\n2. **Practica** con tests para afianzar\n3. **Repasa** tus fallos para mejorar\n\nEl temario es gratis para todos. Los tests tienen límite diario en el plan Free.',
  'Temario = contenido de estudio (100% gratis). Tests = práctica con preguntas (25/día en Free, ilimitados en Premium).',
  ARRAY['temario', 'tests', 'diferencia', 'gratis', 'premium', 'estudiar', 'practicar'],
  9,
  true
);

