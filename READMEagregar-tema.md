# 📚 GUÍA COMPLETA: Cómo Crear un Tema de Oposición

## 🎯 Proceso Completo en 4 Pasos

Esta guía explica el proceso completo para crear un tema de oposición desde cero hasta tener tests funcionales.

---
IMPRESCINDIBLE: sistema de codificación de respuestas: sistema 0=A, 1=B, 2=C, 3=D

## 📋 **PASO 1: PREPARAR EL TEMA**

### 1.1 Crear el tema en la tabla `topics`

```sql
-- Ejemplo: Crear Tema 8 de Auxiliar Administrativo
INSERT INTO topics (
  position_type,
  topic_number,
  title,
  description,
  difficulty,
  estimated_hours,
  is_active
) VALUES (
  'auxiliar_administrativo',
  8,
  'Tema 8: Título del tema oficial',
  'Descripción detallada del contenido del tema según el temario oficial',
  'medium',
  15,
  true
);
```

### 1.2 Verificar que se creó correctamente

```sql
-- Verificar el tema creado
SELECT id, position_type, topic_number, title, description 
FROM topics 
WHERE position_type = 'auxiliar_administrativo' 
  AND topic_number = 8;
```

---

## 📖 **PASO 2: VERIFICAR/AGREGAR ARTÍCULOS**

### 2.1 Identificar qué ley(es) incluye el tema

Revisar el temario oficial para saber qué leyes y artículos específicos incluye.

**Ejemplo Tema 7:**
- Ley 19/2013 de Transparencia
- Artículos: 1-40 (completa)

**Ejemplo Tema 5:**
- Constitución Española  
- Artículos: 103, 104, 105, 106

### 2.2 Verificar qué artículos ya tenemos en BD

```sql
-- Verificar artículos disponibles de una ley específica
SELECT 
  a.article_number, 
  a.title, 
  CASE WHEN a.content IS NOT NULL THEN '✅ Contenido OK' ELSE '❌ Sin contenido' END as status,
  CASE WHEN a.is_active = true THEN '✅ Activo' ELSE '❌ Inactivo' END as active_status
FROM articles a
JOIN laws l ON a.law_id = l.id
WHERE l.short_name = 'NOMBRE_LEY_AQUI'  -- Ej: 'CE', 'Ley 19/2013'
ORDER BY a.article_number::integer;
```

### 2.3 Agregar artículos faltantes (si es necesario)

```sql
-- Obtener el ID de la ley
SELECT id, short_name, name 
FROM laws 
WHERE short_name = 'NOMBRE_LEY_AQUI';

-- Insertar artículo faltante
INSERT INTO articles (
  law_id,
  article_number,
  title,
  content,
  is_active,
  is_verified
) VALUES (
  'LAW_ID_AQUI',           -- UUID de la ley
  'NUMERO_ARTICULO',       -- Ej: '104', '6bis'
  'Título del artículo',
  'Contenido completo del artículo...',
  true,
  true
);
```

**⚠️ IMPORTANTE:** Siempre usar el contenido oficial exacto del BOE o fuente oficial.

---

## 🔗 **PASO 3: MAPEAR TEMA ↔ ARTÍCULOS** ⭐ *ACTUALIZADO CON LECCIÓN*

### 3.1 **VERIFICAR MAPEO EXISTENTE PRIMERO** ⭐ *NUEVO PASO CRÍTICO*

```sql
-- Verificar qué leyes están ya mapeadas al tema
SELECT 
  t.title,
  ts.article_numbers,
  l.short_name as ley
FROM topics t
JOIN topic_scope ts ON t.id = ts.topic_id  
JOIN laws l ON ts.law_id = l.id
WHERE t.topic_number = X 
  AND t.position_type = 'auxiliar_administrativo';
```

### 3.2 **DECISION: INSERT vs UPDATE**

#### **SI LA LEY NO ESTÁ MAPEADA → INSERT NUEVO MAPEO**
```sql
-- Crear mapeo completo nuevo
INSERT INTO topic_scope (
  topic_id,
  law_id,
  article_numbers,
  weight
) VALUES (
  (SELECT id FROM topics WHERE position_type = 'auxiliar_administrativo' AND topic_number = 8),
  (SELECT id FROM laws WHERE short_name = 'NOMBRE_LEY'),
  ARRAY['LISTA', 'DE', 'ARTICULOS'],  -- Ej: ARRAY['103', '104', '105', '106']
  1.0
);
```

#### **SI LA LEY YA ESTÁ MAPEADA → UPDATE ARTÍCULOS**
```sql
-- Actualizar mapeo existente
UPDATE topic_scope 
SET article_numbers = ARRAY['art1', 'art2', 'NUEVOS_ARTS']
WHERE topic_id = (SELECT id FROM topics WHERE position_type = 'auxiliar_administrativo' AND topic_number = X)
  AND law_id = (SELECT id FROM laws WHERE short_name = 'LEY_EXISTENTE');
```

### 3.3 Verificar el mapeo

```sql
-- Verificar que el mapeo se creó correctamente
SELECT 
  t.title,
  t.description,
  ts.article_numbers,
  l.short_name,
  array_length(ts.article_numbers, 1) as total_articulos
FROM topics t
JOIN topic_scope ts ON t.id = ts.topic_id  
JOIN laws l ON ts.law_id = l.id
WHERE t.topic_number = 8 
  AND t.position_type = 'auxiliar_administrativo';
```

---

## ❓ **PASO 4: CREAR PREGUNTAS**

### 4.1 Verificar preguntas existentes

```sql
-- Ver preguntas disponibles por artículo del tema
SELECT 
  a.article_number,
  a.title,
  COUNT(q.id) as total_preguntas,
  ARRAY_AGG(q.difficulty ORDER BY q.difficulty) as dificultades
FROM articles a
JOIN laws l ON a.law_id = l.id
LEFT JOIN questions q ON a.id = q.primary_article_id AND q.is_active = true
WHERE l.short_name = 'NOMBRE_LEY'
  AND a.article_number = ANY(ARRAY['LISTA', 'DE', 'ARTICULOS'])
GROUP BY a.article_number, a.title
ORDER BY a.article_number::integer;
```

### 4.2 Crear preguntas para artículos sin preguntas

```sql
-- Plantilla para crear pregunta
INSERT INTO questions (
  primary_article_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_option,
  explanation,
  difficulty,
  question_type,
  tags,
  is_active
) VALUES (
  (SELECT id FROM articles WHERE article_number = 'NUM_ARTICULO' AND law_id = (SELECT id FROM laws WHERE short_name = 'NOMBRE_LEY')),
  'Texto de la pregunta...',
  'Opción A',
  'Opción B',
  'Opción C',
  'Opción D',
  2,  -- Opción correcta (0=A, 1=B, 2=C, 3=D)
  'Explicación detallada de por qué la opción C es correcta...',
  'medium',  -- easy, medium, hard, extreme
  'single',  -- single, multiple, case_study
  ARRAY['tag1', 'tag2'],
  true
);
```

---

## 🧪 **PASO 5: CREAR TESTS DEL TEMA**

### 5.1 Estructura de archivos necesaria

```
app/es/auxiliar-administrativo-estado/test/tema-X/
├── page.js                    # Página principal del tema con lista de tests
├── test-1/
│   ├── page.js               # Metadata del test 1
│   └── Test1Client.js        # Componente cliente del test 1
├── test-2/
│   ├── page.js               # Metadata del test 2  
│   └── Test2Client.js        # Componente cliente del test 2
└── test-3/
    ├── page.js               # Metadata del test 3
    └── Test3Client.js        # Componente cliente del test 3
```

### 5.2 Plantilla para página principal del tema

```javascript
// app/es/auxiliar-administrativo-estado/test/tema-X/page.js
export default function TemaXTestsPage() {
  // Lista de tests disponibles
  const testsDisponibles = [
    {
      numero: "1",
      titulo: "Nivel Básico - Fundamentos",
      descripcion: "Arts. X, Y, Z • Primer contacto • Dificultad inicial",
      preguntas: 6,
      color: "from-green-500 to-emerald-600",
      icon: "🌱",
      difficulty: "Básico",
      enlace: "/es/auxiliar-administrativo-estado/test/tema-X/test-1"
    },
    // ... más tests
  ]
  
  // Renderizar interfaz con sistema de desbloqueo progresivo
}
```

### 5.3 Plantilla para TestClient

```javascript
// app/es/auxiliar-administrativo-estado/test/tema-X/test-1/Test1Client.js
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import TestLayout from '../../../../../../components/TestLayout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Test1Client() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  const config = {
    name: "Test 1 - Tema X",
    description: "Descripción del test",
    color: "from-green-600 to-emerald-700",
    icon: "📋",
    difficulty: "Básico",
    timeLimit: null
  }

  useEffect(() => {
    async function loadQuestions() {
      // Query para cargar preguntas del tema específico
      const { data: questions } = await supabase
        .from('questions')
        .select(`
          *,
          articles!inner (
            article_number,
            title,
            content,
            laws!inner (short_name)
          )
        `)
        .eq('articles.laws.short_name', 'NOMBRE_LEY')
        .in('articles.article_number', ['LISTA', 'DE', 'ARTICULOS'])
        .eq('is_active', true)
      
      setQuestions(transformQuestions(questions))
      setLoading(false)
    }
    
    loadQuestions()
  }, [])

  // Transformar preguntas al formato esperado
  function transformQuestions(supabaseQuestions) {
    return supabaseQuestions.map(q => ({
      question: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      correct: q.correct_option, // YA viene como 0, 1, 2, 3
      explanation: q.explanation,
      article: {
        number: q.articles.article_number,
        title: q.articles.title,
        law_name: q.articles.laws.short_name
      }
    }))
  }

  if (loading) return <div>Cargando...</div>

  return <TestLayout tema={X} testNumber={1} config={config} questions={questions} />
}
```

---

## ✅ **CHECKLIST DE VERIFICACIÓN**

### Antes de considerar el tema completo:

- [ ] **Tema creado** en tabla `topics`
- [ ] **Todos los artículos** del temario oficial en tabla `articles`
- [ ] **Mapeo completo** en tabla `topic_scope` ⭐ *verificar INSERT vs UPDATE*
- [ ] **Mínimo 5 preguntas** por artículo importante
- [ ] **Al menos 2 tests** implementados (básico + intermedio)
- [ ] **Navegación** desde página principal funciona
- [ ] **Tests cargan preguntas** correctamente de BD
- [ ] **Resultados se guardan** en BD con tracking

---

## 🚨 **ERRORES COMUNES A EVITAR** ⭐ *ACTUALIZADO*

### ❌ **ERROR CRÍTICO: Intentar UPDATE sin mapeo existente** ⭐ *NUEVO*
```sql
-- ❌ ESTO FALLA SILENCIOSAMENTE si la ley NO está mapeada al tema:
UPDATE topic_scope 
SET article_numbers = array_append(article_numbers, '15')
WHERE topic_id = tema_id AND law_id = ley_nueva_id;
-- → 0 filas afectadas porque NO EXISTE el registro

-- ✅ SOLUCIÓN: Verificar primero si existe, luego decidir INSERT vs UPDATE
```

### ❌ **Error 1: Mapeo incompleto**
```sql
-- MAL: Solo algunos artículos
article_numbers = ARRAY['103', '104']

-- BIEN: Todos los artículos del temario oficial  
article_numbers = ARRAY['103', '104', '105', '106']
```

### ❌ **Error 2: Artículos sin contenido**
Siempre verificar que todos los artículos mapeados tienen contenido:
```sql
SELECT article_number, 
       CASE WHEN content IS NULL THEN '❌ SIN CONTENIDO' ELSE '✅ OK' END 
FROM articles WHERE article_number = ANY(ARRAY['lista','articulos']);
```

### ❌ **Error 3: Preguntas insuficientes**
Mínimo recomendado:
- **Artículos muy importantes:** 5+ preguntas
- **Artículos normales:** 2-3 preguntas  
- **Artículos secundarios:** 1-2 preguntas

### ❌ **Error 4: No probar el flujo completo**
Siempre probar:
1. Navegación desde /es/auxiliar-administrativo-estado/test
2. Carga de preguntas desde BD
3. Guardado de resultados
4. Tracking de respuestas

---

## 🎯 **EJEMPLO COMPLETO: Tema 5**

### Temario oficial:
**Tema 5: La Administración Pública**
- Constitución Española: Arts. 103, 104, 105, 106

### Comandos completos:

```sql
-- 1. Crear tema
INSERT INTO topics (position_type, topic_number, title, description, difficulty, estimated_hours, is_active) 
VALUES ('auxiliar_administrativo', 5, 'Tema 5: La Administración Pública', 'Constitución Española Arts. 103-106', 'medium', 12, true);

-- 2. Verificar artículos (ya existen en BD)
SELECT article_number, title FROM articles a 
JOIN laws l ON a.law_id = l.id 
WHERE l.short_name = 'CE' AND a.article_number IN ('103', '104', '105', '106');

-- 3. Mapear tema
INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) 
VALUES (
  (SELECT id FROM topics WHERE position_type = 'auxiliar_administrativo' AND topic_number = 5),
  (SELECT id FROM laws WHERE short_name = 'CE'),
  ARRAY['103', '104', '105', '106'],
  1.0
);

-- 4. Verificar preguntas existentes
SELECT a.article_number, COUNT(q.id) as preguntas 
FROM articles a 
LEFT JOIN questions q ON a.id = q.primary_article_id 
WHERE a.article_number IN ('103', '104', '105', '106') 
GROUP BY a.article_number;

-- 5. Crear preguntas para Arts. 104, 105, 106 (Art. 103 ya tiene preguntas)
-- [Crear preguntas usando plantilla del PASO 4.2]
```

---

# 📋 Manual Conciso: Crear Leyes y Artículos

## 🚨 **VALORES PERMITIDOS (CHECK CONSTRAINTS)**

### **Tabla `laws`:**
- **`scope`:** `'national'` | `'eu'`
- **`type`:** `'constitution'` | `'law'` | `'regulation'`

### **Tabla `articles`:**
- **Todos los campos:** Sin restricciones especiales

---

## ⚡ **PROCESO PASO A PASO**

### **1️⃣ VERIFICAR VALORES PERMITIDOS**
```sql
-- Ver valores permitidos ANTES de insertar
SELECT DISTINCT scope FROM laws;
SELECT DISTINCT type FROM laws;
```

### **2️⃣ CREAR LEY (UNO POR UNO)**
```sql
-- Plantilla para crear ley
INSERT INTO laws (
  name,
  short_name,
  description,
  year,
  type,           -- 'law' (la mayoría)
  scope,          -- 'national' (la mayoría)
  is_active
) VALUES (
  'Nombre completo oficial',
  'CODIGO_CORTO',  -- Ej: 'LO 6/1985' (no 'LOPJ')
  'Descripción breve',
  YYYY,
  'law',           -- ✅ SIEMPRE usar 'law'
  'national',      -- ✅ SIEMPRE usar 'national'
  true
);
```

### **3️⃣ VERIFICAR CREACIÓN**
```sql
SELECT id, short_name, name FROM laws WHERE short_name = 'CODIGO_CORTO';
```

### **4️⃣ CREAR ARTÍCULO**
```sql
-- Plantilla para crear artículo
INSERT INTO articles (
  law_id,
  article_number,
  title,
  content,
  is_active,
  is_verified
) VALUES (
  (SELECT id FROM laws WHERE short_name = 'CODIGO_CORTO'),
  'NUMERO',        -- Ej: '162', '35', '2'
  'Título del artículo',
  'Contenido completo oficial del BOE',
  true,
  true
);
```

### **5️⃣ VERIFICAR CREACIÓN FINAL**
```sql
SELECT l.short_name, a.article_number, a.title 
FROM laws l 
JOIN articles a ON l.id = a.law_id 
WHERE l.short_name = 'CODIGO_CORTO';
```

---

## 🎯 **VALORES SEGUROS (COPY-PASTE)**

### **Para leyes normales:**
- **`type`:** `'law'`
- **`scope`:** `'national'`

### **Para Constitución:**
- **`type`:** `'constitution'`
- **`scope`:** `'national'`

### **Para Reglamentos:**
- **`type`:** `'regulation'`
- **`scope`:** `'national'`

---

## ❌ **ERRORES COMUNES A EVITAR**

1. **❌ NO usar:** `'Nacional'`, `'estatal'`, `'Ley Orgánica'`
2. **✅ SÍ usar:** `'national'`, `'law'`
3. **❌ NO ejecutar** múltiples `INSERT` juntos
4. **✅ SÍ ejecutar** uno por uno y verificar

---

## 🚀 **EJEMPLO COMPLETO**

```sql
-- 1. Crear ley
INSERT INTO laws (name, short_name, description, year, type, scope, is_active) 
VALUES ('Ley X de YYYY', 'LEY_X', 'Descripción', 2023, 'law', 'national', true);

-- 2. Verificar
SELECT id FROM laws WHERE short_name = 'LEY_X';

-- 3. Crear artículo  
INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified)
VALUES ((SELECT id FROM laws WHERE short_name = 'LEY_X'), '1', 'Art. 1', 'Contenido...', true, true);

-- 4. Verificar final
SELECT l.short_name, a.article_number FROM laws l JOIN articles a ON l.id = a.law_id WHERE l.short_name = 'LEY_X';
```

**🎯 REGLA DE ORO: Siempre usar `'law'` + `'national'` para evitar errores.**

---

# 📋 PROCEDIMIENTO: Cómo Añadir Preguntas a un Tema

## 🛡️ **REGLA DE ORO**
> **NUNCA se pueden crear preguntas huérfanas**  
> `primary_article_id` es NOT NULL - debe existir el artículo ANTES de crear la pregunta

---

## 🔄 **PROCESO EN 3 PARTES OBLIGATORIAS** ⭐ *ACTUALIZADO*

### **📍 PARTE 1: VERIFICAR MAPEO DE LEYES EN TOPIC_SCOPE** ⭐ *NUEVA SECCIÓN*

#### 1️⃣ **PASO CRÍTICO: Verificar qué leyes están mapeadas**
```sql
-- Verificar topic_scope del tema para ver qué leyes están mapeadas
SELECT 
  t.title,
  ts.article_numbers,
  l.short_name as ley
FROM topics t
JOIN topic_scope ts ON t.id = ts.topic_id  
JOIN laws l ON ts.law_id = l.id
WHERE t.topic_number = X 
  AND t.position_type = 'auxiliar_administrativo';
```

#### 2️⃣ **Si la ley NO está mapeada → CREAR mapeo completo**
```sql
-- CREAR MAPEO NUEVO (no UPDATE)
INSERT INTO topic_scope (
  topic_id,
  law_id,
  article_numbers,
  weight
) VALUES (
  (SELECT id FROM topics WHERE position_type = 'auxiliar_administrativo' AND topic_number = X),
  (SELECT id FROM laws WHERE short_name = 'NOMBRE_LEY'),
  ARRAY['ARTICULOS_NECESARIOS'],
  1.0
);
```

#### 3️⃣ **Si la ley YA está mapeada → UPDATE artículos**
```sql
-- ACTUALIZAR MAPEO EXISTENTE
UPDATE topic_scope 
SET article_numbers = ARRAY['art1', 'art2', 'NUEVOS_ARTS']
WHERE topic_id = (SELECT id FROM topics WHERE position_type = 'auxiliar_administrativo' AND topic_number = X)
  AND law_id = (SELECT id FROM laws WHERE short_name = 'LEY_EXISTENTE');
```

---

### **📍 PARTE 2: PREPARAR ARTÍCULOS**

#### 1️⃣ **Identificar artículos necesarios**
- Revisar qué artículos mencionan las preguntas
- Verificar si ya existen en la BD
- Identificar cuáles faltan por crear

#### 2️⃣ **Crear artículos faltantes**
```sql
-- ✅ FORMATO CORRECTO (legible con saltos de línea)
INSERT INTO articles (
  law_id,
  article_number,
  title,
  content,  -- CON SALTOS DE LÍNEA COMO EN BOE
  is_active,
  is_verified
) VALUES (
  (SELECT id FROM laws WHERE short_name = 'NOMBRE_LEY'),
  'NUMERO',
  'Título oficial',
  'Contenido con

saltos de línea

y párrafos separados.',
  true,
  true
);
```

#### 3️⃣ **Verificar**
```sql
-- Confirmar que se crearon
SELECT article_number, title, '✅ OK' as status
FROM articles a JOIN laws l ON a.law_id = l.id
WHERE l.short_name = 'LEY' AND a.article_number IN ('NUEVOS');
```

---

### **📍 PARTE 3: CREAR PREGUNTAS**

#### 1️⃣ **Sistema de respuestas**
```
🎯 SISTEMA OBLIGATORIO: 0=A, 1=B, 2=C, 3=D
```

#### 2️⃣ **Plantilla SQL**
```sql
INSERT INTO questions (
  primary_article_id,
  question_text,
  option_a,
  option_b, 
  option_c,
  option_d,
  correct_option,        -- ⚠️ 0=A, 1=B, 2=C, 3=D
  explanation,
  difficulty,            -- 'easy', 'medium', 'hard', 'extreme'
  question_type,         -- 'single'
  tags,                  -- ARRAY['tag1', 'tag2']
  is_active,             -- true
  is_official_exam       -- true=oficial, false=normal
) VALUES (
  (SELECT id FROM articles WHERE article_number = 'NUM' AND law_id = (SELECT id FROM laws WHERE short_name = 'LEY')),
  'Texto de la pregunta...',
  'Opción A',
  'Opción B',
  'Opción C', 
  'Opción D',
  X, -- 0, 1, 2 o 3
  'Explicación detallada...',
  'medium',
  'single',
  ARRAY['tag1', 'tag2'],
  true,
  false -- false=pregunta normal, true=examen oficial
);
```

#### 3️⃣ **Verificar**
```sql
SELECT 
  '✅ PREGUNTAS INSERTADAS' as status,
  COUNT(*) as total,
  'Tipo' as categoria
FROM questions 
WHERE created_at > NOW() - INTERVAL '2 minutes';
```

---

## ⚠️ **ERRORES COMUNES A EVITAR** ⭐ *ACTUALIZADO*

### ❌ **ERROR CRÍTICO: Intentar UPDATE sin mapeo existente** ⭐ *NUEVO*
```sql
-- ❌ ESTO FALLA SILENCIOSAMENTE si la ley NO está mapeada al tema:
UPDATE topic_scope 
SET article_numbers = array_append(article_numbers, '15')
WHERE topic_id = tema_id AND law_id = ley_nueva_id;
-- → 0 filas afectadas porque NO EXISTE el registro

-- ✅ SOLUCIÓN: Verificar primero si existe, luego decidir INSERT vs UPDATE
```

### ❌ **Error 1: Crear pregunta sin artículo**
```sql
-- ESTO FALLA AHORA (primary_article_id NOT NULL)
INSERT INTO questions (primary_article_id, ...) VALUES (NULL, ...);
```

### ❌ **Error 2: Respuestas incorrectas**
```sql
-- MAL: 1=A, 2=B, 3=C, 4=D
correct_option = 4  -- ❌ NO EXISTE

-- BIEN: 0=A, 1=B, 2=C, 3=D  
correct_option = 3  -- ✅ Respuesta D
```

### ❌ **Error 3: Artículos sin formato**
```sql
-- MAL: Todo junto
content = 'Texto sin saltos de línea todo apelotonado...'

-- BIEN: Con formato BOE
content = 'Párrafo 1.

Párrafo 2.

Lista:
- Item 1
- Item 2'
```

### ❌ **Error 4: No actualizar topic_scope**
- Crear artículo pero no añadirlo al topic_scope del tema
- La pregunta se crea pero el artículo no está "mapeado" al tema

---

## 🎯 **CHECKLIST FINAL** ⭐ *ACTUALIZADO*

- [ ] **Verificar mapeo topic_scope** → ¿Ley ya mapeada?
- [ ] **Si NO mapeada** → INSERT nuevo mapeo
- [ ] **Si SÍ mapeada** → UPDATE artículos existentes
- [ ] **Artículos creados** con formato legible
- [ ] **Respuestas correctas** (0=A, 1=B, 2=C, 3=D)
- [ ] **is_official_exam** configurado correctamente
- [ ] **Explicaciones** detalladas y precisas
- [ ] **Tags** relevantes para categorización
- [ ] **Verificación** ejecutada sin errores

---

## 🚀 **EJEMPLO COMPLETO** ⭐ *ACTUALIZADO CON LECCIÓN*

### **Situación: Añadir preguntas de Art. 15 Ley 50/1997 al Tema 8**

```sql
-- PARTE 1: Verificar mapeo existente
SELECT l.short_name, ts.article_numbers 
FROM topic_scope ts JOIN laws l ON ts.law_id = l.id 
WHERE topic_id = (SELECT id FROM topics WHERE topic_number = 8);
-- Resultado: Solo 'Ley 2/2014' y 'Ley 40/2015' → 'Ley 50/1997' NO mapeada

-- PARTE 2: Crear mapeo nuevo (INSERT, no UPDATE)
INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight)
VALUES (
  (SELECT id FROM topics WHERE position_type = 'auxiliar_administrativo' AND topic_number = 8),
  (SELECT id FROM laws WHERE short_name = 'Ley 50/1997'),
  ARRAY['15'],
  1.0
);

-- PARTE 3: Verificar artículo existe
SELECT article_number FROM articles 
WHERE article_number = '15' AND law_id = (SELECT id FROM laws WHERE short_name = 'Ley 50/1997');

-- PARTE 4: Crear pregunta
INSERT INTO questions (primary_article_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, question_type, tags, is_active, is_official_exam)
VALUES ((SELECT id FROM articles WHERE article_number = '15' AND law_id = (SELECT id FROM laws WHERE short_name = 'Ley 50/1997')), '¿Pregunta?', 'A', 'B', 'C', 'D', 1, 'Explicación...', 'medium', 'single', ARRAY['tag'], true, false);
```

---

## 📚 **LECCIÓN APRENDIDA DEL TEMA 8** ⭐ *NUEVA SECCIÓN*

**❌ Lo que falló:**
```sql
-- Intenté UPDATE en un mapeo inexistente
UPDATE topic_scope SET article_numbers = array_append(...)
WHERE law_id = 'Ley 50/1997' -- Esta ley NO estaba mapeada al tema 8
-- → 0 filas afectadas, sin error pero sin efecto
```

**✅ Solución correcta:**
```sql
-- Crear mapeo nuevo porque la ley no existía
INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight)
VALUES (tema_8_id, ley_50_1997_id, ARRAY['15'], 1.0);
-- → 1 fila insertada, mapeo creado correctamente
```

**🎯 REGLA DE ORO ACTUALIZADA:**
> **Antes de UPDATE, verificar que existe el registro.  
> Si no existe → INSERT nuevo mapeo.  
> Si existe → UPDATE artículos.**

---

## 📚 **RECURSOS ADICIONALES**

### Fuentes oficiales para contenido:
- **BOE:** https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229 (CE)
- **BOE:** https://www.boe.es/buscar/act.php?id=BOE-A-2013-12887 (Ley 19/2013)
- **Temarios oficiales:** Convocatorias BOE de cada oposición

### Herramientas útiles:
- **Hash generator:** Para verificar integridad de artículos
- **SQL formatter:** Para queries más legibles
- **Supabase SQL Editor:** Para ejecutar consultas

---

**🎉 ¡Con esta guía puedes crear cualquier tema de oposición de forma sistemática y sin errores!**

---

## 📚 **PROCEDIMIENTO SIMPLIFICADO** ⭐ *SECCIÓN FINAL*

### **FLUJO RÁPIDO PARA EXPERTOS:**

```sql
-- 1. Verificar mapeo
SELECT l.short_name FROM topic_scope ts 
JOIN laws l ON ts.law_id = l.id 
WHERE topic_id = tema_id;

-- 2A. Si ley NO mapeada → INSERT
INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) 
VALUES (tema_id, ley_id, ARRAY['arts'], 1.0);

-- 2B. Si ley SÍ mapeada → UPDATE
UPDATE topic_scope SET article_numbers = ARRAY['nuevos','arts'] 
WHERE topic_id = tema_id AND law_id = ley_id;

-- 3. Crear artículos (si faltan)
INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified)
VALUES (ley_id, 'num', 'título', 'contenido...', true, true);

-- 4. Crear preguntas
INSERT INTO questions (primary_article_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, question_type, tags, is_active, is_official_exam)
VALUES (article_id, 'pregunta', 'A', 'B', 'C', 'D', 0, 'explicación', 'medium', 'single', ARRAY['tags'], true, false);
```

### **NO TE LIES, PROCESO SIMPLE:**

1. **Verificar topic_scope** → ¿Ley mapeada?
2. **INSERT nuevo mapeo** O **UPDATE existente**
3. **Crear artículos faltantes** (formato legible)
4. **Crear preguntas** (sistema 0=A, 1=B, 2=C, 3=D)
5. **Verificar resultado**

### **UNA SQL A LA VEZ:**
- Dame una SQL
- Espera respuesta
- Sigue con la siguiente
- No todo junto

### **REGLAS FINALES:**
- **Short_name oficial:** 'LO 6/1985' (no 'LOPJ')
- **Contenido legible:** Con saltos de línea, no apelotonado
- **Sistema respuestas:** 0=A, 1=B, 2=C, 3=D
- **Verificar antes UPDATE:** ¿Existe el registro?

---

