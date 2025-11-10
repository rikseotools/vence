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

#### 2️⃣ **Plantilla SQL para Preguntas Normales**
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
  is_official_exam       -- false=pregunta normal
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
  false -- PREGUNTA NORMAL
);
```

#### 2️⃣ **Plantilla SQL para Preguntas OFICIALES** ⭐ **NUEVA**
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
  is_official_exam,      -- ⚠️ TRUE=EXAMEN OFICIAL
  exam_source,           -- ⚠️ CAMPO OBLIGATORIO para oficiales
  exam_date,             -- ⚠️ CAMPO RECOMENDADO para oficiales
  exam_entity            -- ⚠️ CAMPO RECOMENDADO para oficiales
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
  true,                           -- ⚠️ TRUE=EXAMEN OFICIAL
  'Examen AEAT 2023',            -- ⚠️ Fuente del examen oficial
  '2023-06-15',                  -- ⚠️ Fecha del examen (YYYY-MM-DD)
  'Agencia Estatal de Administración Tributaria'  -- ⚠️ Entidad organizadora
);
```

#### 📋 **REQUISITOS para Preguntas OFICIALES** ⭐ **NUEVA SECCIÓN**

**🚨 CAMPOS OBLIGATORIOS:**
- `is_official_exam: true` - Marca la pregunta como oficial
- `exam_source` - Fuente del examen (ej: "Examen AEAT 2023", "Convocatoria AGE 2022")

**🔸 CAMPOS RECOMENDADOS:**
- `exam_date` - Fecha del examen en formato YYYY-MM-DD
- `exam_entity` - Entidad que organizó el examen

**✅ EJEMPLOS de exam_source:**
- "Examen AEAT 2023"
- "Convocatoria AGE 2022"
- "Oposición Auxiliar Administrativo 2021"
- "Examen Ministerio Justicia 2024"

**❌ NUNCA dejar en NULL:**
- Si es `is_official_exam: true` → `exam_source` debe tener valor

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

## 🎯 **CHECKLIST DE VERIFICACIÓN ANTES DE CREAR CONTENIDO** ⭐ *NUEVA SECCIÓN*

### ✅ **Antes de crear una LEY:**
- [ ] ¿Hay preguntas específicas que mencionan esta ley?
- [ ] ¿La ley aparece en el texto de al menos 1 pregunta?
- [ ] ¿He verificado exhaustivamente que no existe ya? (múltiples búsquedas)
- [ ] ¿Tengo el nombre oficial completo del BOE?
- [ ] **REGLA:** Solo crear si hay demanda real de preguntas

### ✅ **Antes de crear ARTÍCULOS:**
- [ ] ¿Hay preguntas que referencian específicamente este artículo?
- [ ] ¿El artículo está en el content_scope de la sección correspondiente?
- [ ] ¿Tengo el contenido oficial del BOE del artículo?
- [ ] **REGLA:** Crear artículos solo cuando hay preguntas que los necesitan

### ✅ **Flujo de trabajo CORRECTO:**
1. [ ] **ANALIZAR** → ¿Qué leyes/artículos necesitan mis preguntas?
2. [ ] **VERIFICAR** → ¿Cuáles ya existen en la BD?
3. [ ] **IDENTIFICAR** → ¿Cuáles faltan realmente?
4. [ ] **CREAR** → Solo las que faltan y tienen demanda
5. [ ] **AÑADIR** → Las preguntas con vinculaciones correctas
6. [ ] **LIMPIAR** → Eliminar contenido creado sin propósito

### 🚨 **Señales de alarma:**
- ❌ "Creo esta ley por si acaso" → **NO CREAR**
- ❌ "La ley aparece en un error" → **VERIFICAR NECESIDAD PRIMERO**
- ❌ "Mejor tener todas las leyes completas" → **CREAR SOLO LO NECESARIO**
- ❌ "Ya creé la ley, ahora veamos si hay preguntas" → **FLUJO INVERTIDO**

**🎯 PRINCIPIO FUNDAMENTAL: La demanda de preguntas impulsa la creación de contenido, no al revés.**

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

los articulos nuevos que haya que crear, tu me los debs pedir  y yo te los doy del boe

las preguntas debes darmelas todas juntas en el mismo artefacto


## 📚 **LEYES FICTICIAS PARA CONTENIDO TÉCNICO** ⭐ NUEVA SECCIÓN

### 🎯 **¿Cuándo crear una Ley Ficticia?**

Cuando el tema **NO está basado en legislación oficial** sino en conocimientos técnicos:
- ✅ Informática (Windows, Office, hardware, redes)
- ✅ Herramientas digitales (navegadores, correo, gestores)
- ✅ Conocimientos prácticos no legislativos
- ❌ NO usar si el tema cita leyes/artículos BOE oficiales

---

### 📋 **PROCESO SIMPLIFICADO**

#### **1. Crear Ley Ficticia**
```sql
INSERT INTO laws (
  name,
  short_name,
  description,
  year,
  type,
  scope,
  is_active
) VALUES (
  'Nombre descriptivo completo',
  'Nombre corto',
  'Ley ficticia para agrupar conocimientos sobre [TEMA]...',  -- ⚠️ SIEMPRE empezar con "Ley ficticia"
  2024,
  'regulation',  -- Usar 'regulation' para contenido técnico
  'national',    -- Usar 'national' como estándar
  true
);
```

#### **2. Crear Artículo Único (normalmente solo artículo 1)**
```sql
INSERT INTO articles (
  law_id,
  article_number,
  title,
  content,
  is_active,
  is_verified
) VALUES (
  'UUID_LEY_FICTICIA',
  '1',
  'Título descriptivo del contenido',
  'Descripción del artículo que agrupa todo el contenido técnico del tema',
  true,
  true
);
```

#### **3. Mapear en topic_scope (igual que con leyes reales)**
```sql
INSERT INTO topic_scope (
  topic_id,
  law_id,
  article_numbers,
  weight
) VALUES (
  'UUID_TEMA',
  'UUID_LEY_FICTICIA',
  ARRAY['1'],  -- Normalmente solo artículo 1
  1.0
);
```

#### **4. Crear Preguntas (vinculadas al artículo 1)**
```sql
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
  is_active,
  is_official_exam
) VALUES (
  (SELECT id FROM articles WHERE article_number = '1' AND law_id = (SELECT id FROM laws WHERE short_name = 'NOMBRE_CORTO_LEY')),
  'Pregunta...',
  'A', 'B', 'C', 'D',
  0,  -- 0=A, 1=B, 2=C, 3=D
  'Explicación...',
  'medium',
  'single',
  ARRAY['tag1', 'tag2'],
  true,
  false
);
```

---

### 🎨 **CONVENCIONES IMPORTANTES**

| Campo | Valor Recomendado | Ejemplo |
|-------|-------------------|---------|
| **description** | Empezar con "Ley ficticia para agrupar conocimientos sobre..." | "Ley ficticia para agrupar conocimientos sobre procesadores de texto: Microsoft Word y Writer..." |
| **type** | `'regulation'` | Para contenido técnico |
| **scope** | `'national'` | Estándar para leyes ficticias |
| **article_number** | `'1'` | Normalmente un solo artículo contenedor |

---

### 📊 **EJEMPLOS EXISTENTES EN EL SISTEMA**

```sql
-- Ver leyes ficticias existentes
SELECT id, short_name, name, description 
FROM laws 
WHERE description ILIKE '%ficticia%'
ORDER BY created_at DESC;
```

**Ejemplos reales:**
- **Windows 10**: "Ley ficticia para agrupar conocimientos sobre el sistema operativo Windows 10"
- **Explorador de Windows**: "Ley ficticia que agrupa conocimientos sobre el Explorador de Windows 10..."
- **Informática Básica**: "Ley ficticia para agrupar conceptos fundamentales de informática..."
- **Procesadores de texto**: "Ley ficticia para agrupar conocimientos sobre procesadores de texto: Microsoft Word y Writer..."

---

### ⚠️ **DIFERENCIAS vs LEYES REALES**

| Aspecto | Ley Real | Ley Ficticia |
|---------|----------|--------------|
| **Fuente** | BOE oficial | Conocimiento técnico |
| **Artículos** | Múltiples específicos | Normalmente solo artículo 1 |
| **Contenido** | Texto legislativo exacto | Descripción del contenido técnico |
| **description** | Descripción de la ley | "Ley ficticia para agrupar conocimientos sobre..." |
| **Verificación** | BOE consolidado | No aplica |

---

### ✅ **CHECKLIST LEY FICTICIA**

- [ ] Descripción empieza con "Ley ficticia"
- [ ] type = 'regulation'
- [ ] scope = 'national'
- [ ] Artículo 1 creado con contenido descriptivo
- [ ] Mapeo en topic_scope con ARRAY['1']
- [ ] Preguntas vinculadas al artículo 1
- [ ] Verificación: consulta devuelve el tema completo

---

## 📚 **CONTENT COLLECTIONS - NUEVO SISTEMA TEMÁTICO** ⭐ NUEVA SECCIÓN

### 🎯 **¿Cuándo usar Content Collections?**

Para **contenido organizado temáticamente** que:
- ✅ Agrupa preguntas por materia (no por ley específica)
- ✅ Cruza múltiples leyes y artículos reales
- ✅ Se organiza por conceptos/materias (ej: Procedimiento Administrativo)
- ✅ Contiene subsecciones temáticas específicas
- ❌ NO crear temas tradicionales en tabla `topics`

**🔥 CARACTERÍSTICA CLAVE:** Las preguntas se vinculan a **artículos reales** de **leyes existentes**, pero se organizan por **materia temática**.

---

### 📋 **ARQUITECTURA DEL SISTEMA**

```
content_collections (Ej: "Procedimiento Administrativo")
├── content_sections (Ej: "Conceptos Generales", "Actos Administrativos")
├── content_scope (Mapea secciones → artículos reales)
└── Web Structure (/test-oposiciones/procedimiento-administrativo/)
```

**🔗 FLUJO:**
1. **Collection** → Agrupación principal temática
2. **Sections** → Subsecciones de estudio específicas
3. **Scope** → Mapeo a artículos reales de leyes BOE
4. **Questions** → Vinculadas a artículos reales (como siempre)
5. **Web** → Estructura de páginas automática

---

### 🛠️ **PROCESO COMPLETO PASO A PASO**

#### **1️⃣ CREAR CONTENT COLLECTION**
```sql
INSERT INTO content_collections (
  name,
  slug,
  description,
  icon,
  color,
  is_active
) VALUES (
  'Nombre de la Materia',
  'slug-materia',  -- Ej: 'procedimiento-administrativo'
  'Descripción completa del contenido que se cubrirá...',
  '📋',  -- Emoji representativo
  'from-teal-600 to-emerald-700',  -- Clases Tailwind CSS
  true
);
```

#### **2️⃣ CREAR SECTIONS DE LA COLLECTION**
```sql
-- Obtener ID de la collection
SELECT id FROM content_collections WHERE slug = 'slug-materia';

-- Crear múltiples secciones
INSERT INTO content_sections (
  collection_id,
  section_number,
  name,
  slug,
  description,
  icon,
  order_position,
  is_active
) VALUES 
  ('UUID_COLLECTION', 1, 'Conceptos Generales', 'conceptos-generales', 'Principios fundamentales y definiciones básicas...', '📚', 1, true),
  ('UUID_COLLECTION', 2, 'Actos Administrativos', 'actos-administrativos', 'Elementos y requisitos de los actos administrativos...', '📄', 2, true),
  ('UUID_COLLECTION', 3, 'Recursos Administrativos', 'recursos-administrativos', 'Tipos de recursos y procedimientos...', '⚖️', 3, true);
  -- ... más secciones según el material
```

#### **3️⃣ CREAR ESTRUCTURA WEB AUTOMÁTICA**

**📁 Estructura de archivos necesaria:**
```
app/test-oposiciones/slug-materia/
├── page.js                    # Página principal con grid de secciones
├── [seccion]/
│   └── page.js               # Páginas dinámicas de cada sección
└── lib/slug-materiaSSR.js    # Funciones SSR para cargar datos
```

**📝 Plantilla page.js principal:**
```javascript
// app/test-oposiciones/slug-materia/page.js
import Link from 'next/link'
import { loadMateriaData } from '../../lib/slug-materiaSSR'

export default async function MateriaPage() {
  const { sections, stats } = await loadMateriaData()

  return (
    <div className="bg-gray-50">
      {/* Header con stats */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Tests {collection.name}</h1>
          <div className="flex justify-center gap-8 mb-8">
            <div className="bg-white/10 rounded-lg p-6">
              <div className="text-3xl font-bold">{stats.totalSections}</div>
              <div className="text-sm">Secciones</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de secciones */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/test-oposiciones/slug-materia/${section.slug}`}
              className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all"
            >
              <div className="p-6">
                <div className="text-4xl mb-4">{section.icon}</div>
                <h3 className="font-bold text-gray-900 mb-3">{section.name}</h3>
                <p className="text-gray-600 text-sm">{section.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
```

#### **4️⃣ MAPEAR SECCIONES A ARTÍCULOS REALES**
```sql
-- Para cada sección, mapear a artículos BOE específicos
INSERT INTO content_scope (
  section_id,
  law_id,
  article_numbers,
  weight
) VALUES (
  (SELECT id FROM content_sections WHERE slug = 'conceptos-generales'),
  (SELECT id FROM laws WHERE short_name = 'Ley 39/2015'),  -- Ley real del BOE
  ARRAY['1', '2', '3', '4', '5'],  -- Artículos reales específicos
  1.0
);

-- Mapear a otra ley si es necesario
INSERT INTO content_scope (
  section_id,
  law_id,
  article_numbers,
  weight
) VALUES (
  (SELECT id FROM content_sections WHERE slug = 'conceptos-generales'),
  (SELECT id FROM laws WHERE short_name = 'Ley 40/2015'),  -- Otra ley real
  ARRAY['1', '2'],
  0.8
);
```

#### **5️⃣ CREAR PREGUNTAS (VINCULADAS A ARTÍCULOS REALES)**
```sql
-- Las preguntas se crean IGUAL que siempre: vinculadas a artículos reales
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
  (SELECT id FROM articles WHERE article_number = '1' AND law_id = (SELECT id FROM laws WHERE short_name = 'Ley 39/2015')),
  'Pregunta sobre conceptos generales...',
  'Opción A',
  'Opción B',
  'Opción C',
  'Opción D',
  2,  -- 0=A, 1=B, 2=C, 3=D
  'Explicación basada en el artículo 1 de la Ley 39/2015...',
  'medium',
  'single',
  ARRAY['procedimiento-administrativo', 'conceptos-generales'],  -- Tags temáticos
  true
);
```

#### **6️⃣ AGREGAR CARD EN PÁGINA PRINCIPAL**
```javascript
// En app/test-oposiciones/page.js - agregar a availableLaws array:
{
  id: 'slug-materia',
  title: 'Nombre de la Materia',
  description: 'Descripción del contenido organizado por materias...',
  slug: 'slug-materia',
  image: '📋',
  color: 'from-teal-600 to-emerald-700',
  sections: 10,
  articles: 'Múltiples leyes',
  priority: 3,
  tags: ['Temático', 'Completo']
}
```

---

### 🔍 **VERIFICACIONES NECESARIAS**

#### **1. Verificar estructura completa**
```sql
SELECT 
  cc.name as collection,
  cs.section_number,
  cs.name as section,
  cs.slug,
  cs.is_active,
  COUNT(csc.id) as mapeos_ley
FROM content_collections cc
JOIN content_sections cs ON cc.id = cs.collection_id  
LEFT JOIN content_scope csc ON cs.id = csc.section_id
WHERE cc.slug = 'slug-materia'
GROUP BY cc.name, cs.section_number, cs.name, cs.slug, cs.is_active
ORDER BY cs.order_position;
```

#### **2. Verificar mapeo a leyes reales**
```sql
SELECT 
  cs.name as section,
  l.short_name as ley,
  csc.article_numbers,
  array_length(csc.article_numbers, 1) as total_articulos
FROM content_sections cs
JOIN content_scope csc ON cs.id = csc.section_id
JOIN laws l ON csc.law_id = l.id
WHERE cs.collection_id = (SELECT id FROM content_collections WHERE slug = 'slug-materia')
ORDER BY cs.order_position, l.short_name;
```

#### **3. Verificar preguntas disponibles**
```sql
SELECT 
  cs.name as section,
  l.short_name,
  a.article_number,
  COUNT(q.id) as preguntas
FROM content_sections cs
JOIN content_scope csc ON cs.id = csc.section_id
JOIN laws l ON csc.law_id = l.id
JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(csc.article_numbers)
LEFT JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
WHERE cs.collection_id = (SELECT id FROM content_collections WHERE slug = 'slug-materia')
GROUP BY cs.name, l.short_name, a.article_number, cs.order_position
ORDER BY cs.order_position, l.short_name, a.article_number::integer;
```

---

### ⚡ **VENTAJAS del Sistema Content Collections**

| Aspecto | Content Collections | Temas Tradicionales |
|---------|--------------------|--------------------|
| **Organización** | Por materia temática | Por oposición específica |
| **Artículos** | Múltiples leyes reales | Una ley o pocas leyes |
| **Flexibilidad** | Agrupa conceptos relacionados | Estructura rígida por tema |
| **Escalabilidad** | Fácil agregar secciones | Limitado por temario oficial |
| **Preguntas** | Vinculadas a BOE real | Vinculadas a BOE real |
| **Navegación** | Grid de materias | Lista lineal de tests |

---

### ✅ **CHECKLIST CONTENT COLLECTION**

- [ ] Content collection creada con slug único
- [ ] Multiple sections creadas con order_position
- [ ] Estructura web implementada (/test-oposiciones/slug/)
- [ ] Páginas dinámicas [seccion] funcionan (200 OK)
- [ ] Content_scope mapea sections a artículos BOE reales
- [ ] Preguntas vinculadas a artículos reales (no ficticios)
- [ ] Card agregada en página principal test-oposiciones
- [ ] Verificación: todas las secciones cargan sin errores
- [ ] Verificación: mapeo a leyes reales es correcto

---

### 🎯 **EJEMPLO COMPLETO: Procedimiento Administrativo**

```sql
-- 1. Collection principal
INSERT INTO content_collections (name, slug, description, icon, color, is_active) 
VALUES ('Procedimiento Administrativo', 'procedimiento-administrativo', 'Contenido organizado por materias del procedimiento administrativo común...', '📋', 'from-teal-600 to-emerald-700', true);

-- 2. Secciones (10 secciones)
INSERT INTO content_sections (collection_id, section_number, name, slug, description, icon, order_position, is_active) 
VALUES 
  ((SELECT id FROM content_collections WHERE slug = 'procedimiento-administrativo'), 1, 'Conceptos Generales', 'conceptos-generales', 'Principios fundamentales...', '📚', 1, true),
  ((SELECT id FROM content_collections WHERE slug = 'procedimiento-administrativo'), 2, 'Actos Administrativos', 'actos-administrativos', 'Elementos y requisitos...', '📄', 2, true);

-- 3. Mapeo a leyes reales
INSERT INTO content_scope (section_id, law_id, article_numbers, weight) 
VALUES (
  (SELECT id FROM content_sections WHERE slug = 'conceptos-generales'),
  (SELECT id FROM laws WHERE short_name = 'Ley 39/2015'),
  ARRAY['1', '2', '3', '4', '5'],
  1.0
);

-- 4. Estructura web: /app/test-oposiciones/procedimiento-administrativo/
-- 5. Preguntas vinculadas a artículos reales de Ley 39/2015
```

---

### 🚨 **DIFERENCIAS CRÍTICAS**

| Aspecto | Topics Tradicionales | Content Collections |
|---------|---------------------|-------------------|
| **Tabla principal** | `topics` | `content_collections` |
| **Subsecciones** | No tiene | `content_sections` |
| **Mapeo** | `topic_scope` | `content_scope` |
| **URL** | `/test/tema-X/` | `/test-oposiciones/materia/` |
| **Organización** | Por número de tema | Por concepto temático |
| **Público objetivo** | Oposición específica | Transversal a oposiciones |

---

### 💡 **CUÁNDO USAR CADA SISTEMA**

**🎯 Usar CONTENT COLLECTIONS cuando:**
- El contenido cruza múltiples leyes
- Se organiza por conceptos/materias
- Es aplicable a varias oposiciones
- Se necesita navegación temática flexible

**📚 Usar TEMAS TRADICIONALES cuando:**
- Es contenido específico de una oposición
- Sigue estructura oficial del temario
- Se mapea a pocas leyes específicas
- Se necesita orden lineal de estudio

---

### 🔍 **VERIFICACIÓN COMPLETA**

```sql
-- Verificar ley ficticia y su estructura
SELECT 
  t.topic_number,
  t.title as tema,
  l.short_name as ley,
  l.description,
  ts.article_numbers,
  a.article_number,
  a.title as articulo_titulo,
  COUNT(q.id) as total_preguntas
FROM topics t
JOIN topic_scope ts ON t.id = ts.topic_id  
JOIN laws l ON ts.law_id = l.id
LEFT JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(ts.article_numbers)
LEFT JOIN questions q ON q.primary_article_id = a.id
WHERE l.description ILIKE '%ficticia%'
GROUP BY t.topic_number, t.title, l.short_name, l.description, ts.article_numbers, a.article_number, a.title
ORDER BY t.topic_number;
```

---

## 📚 **GUÍA ESPECÍFICA: AÑADIR PREGUNTAS A CONTENT SCOPE** ⭐ NUEVA SECCIÓN ACTUALIZADA

### 🎯 **¿Qué es Content Scope?**

**Content Scope** es el sistema para mapear **secciones temáticas** (como "Conceptos Generales") a **artículos específicos** de leyes reales del BOE, similar a topic_scope pero para **contenido organizado por materias**.

**🔥 DIFERENCIA CLAVE vs Topics:**
- **Topics**: Tema 8 → Artículos específicos
- **Content Scope**: "Conceptos Generales" → Artículos específicos de múltiples leyes

---

### 🛠️ **PROCESO COMPLETO PASO A PASO**

#### **1️⃣ IDENTIFICAR CONTENT SCOPE EXISTENTE**

```sql
-- Ver qué content_scope ya existe para la sección
SELECT 
  cs.name as seccion,
  l.short_name as ley,
  csc.article_numbers
FROM content_sections cs
JOIN content_scope csc ON cs.id = csc.section_id
JOIN laws l ON csc.law_id = l.id
WHERE cs.slug = 'SLUG_SECCION';  -- Ej: 'conceptos-generales'
```

#### **2️⃣ DECISIÓN: INSERT vs UPDATE vs CREAR NUEVO**

**🔍 CASO A: La ley YA está mapeada → UPDATE artículos**
```sql
UPDATE content_scope 
SET article_numbers = ARRAY['1', '2', '3', 'NUEVOS_ARTICLES']
WHERE section_id = (SELECT id FROM content_sections WHERE slug = 'conceptos-generales')
  AND law_id = (SELECT id FROM laws WHERE short_name = 'Ley 39/2015');
```

**🔍 CASO B: La ley NO está mapeada → INSERT nuevo mapeo**
```sql
INSERT INTO content_scope (
  section_id,
  law_id,
  article_numbers,
  weight
) VALUES (
  (SELECT id FROM content_sections WHERE slug = 'conceptos-generales'),
  (SELECT id FROM laws WHERE short_name = 'NUEVA_LEY'),
  ARRAY['1', '2', '3'],  -- Artículos específicos
  1.0
);
```

**🔍 CASO C: La sección NO existe → CREAR TODO**
```sql
-- 1. Buscar collection padre
SELECT id FROM content_collections WHERE slug = 'procedimiento-administrativo';

-- 2. Crear sección
INSERT INTO content_sections (
  collection_id,
  section_number,
  name, 
  slug,
  description,
  icon,
  order_position,
  is_active
) VALUES (
  'UUID_COLLECTION',
  X,  -- Número de sección
  'Nombre de la Sección',
  'slug-seccion',
  'Descripción de la sección...',
  '📚',
  X,  -- Posición en orden
  true
);

-- 3. Crear mapeo inicial
INSERT INTO content_scope (section_id, law_id, article_numbers, weight)
VALUES (
  (SELECT id FROM content_sections WHERE slug = 'slug-seccion'),
  (SELECT id FROM laws WHERE short_name = 'Ley 39/2015'), 
  ARRAY['1', '2', '3'],
  1.0
);
```

---

#### **3️⃣ VERIFICAR ARTÍCULOS EXISTEN**

```sql
-- Verificar que todos los artículos existen en la BD
SELECT 
  a.article_number,
  a.title,
  CASE WHEN a.content IS NOT NULL THEN '✅ Contenido OK' ELSE '❌ Sin contenido' END as content_status
FROM articles a
JOIN laws l ON a.law_id = l.id
WHERE l.short_name = 'LEY_ESPECÍFICA'
  AND a.article_number = ANY(ARRAY['LISTA', 'DE', 'ARTICULOS'])
ORDER BY a.article_number::integer;
```

**⚠️ Si faltan artículos → PARAR y solicitarlos del BOE oficial**

---

#### **4️⃣ CREAR PREGUNTAS VINCULADAS A CONTENT SCOPE**

```sql
-- Script para crear múltiples preguntas de content scope
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
  is_active,
  is_official_exam,
  exam_source
) VALUES (
  -- Pregunta 1: Ley 39/2015, Art. 1
  (SELECT id FROM articles WHERE article_number = '1' AND law_id = (SELECT id FROM laws WHERE short_name = 'Ley 39/2015')),
  'Pregunta sobre conceptos generales del artículo 1...',
  'Opción A',
  'Opción B',
  'Opción C',
  'Opción D',
  1,  -- B=1 (sistema 0=A, 1=B, 2=C, 3=D)
  'Explicación basada en el artículo 1 de la Ley 39/2015...',
  'medium',
  'single',
  ARRAY['procedimiento-administrativo', 'conceptos-generales'],
  true,
  false,  -- Pregunta normal (no oficial)
  null
), (
  -- Pregunta 2: Ley 39/2015, Art. 3  
  (SELECT id FROM articles WHERE article_number = '3' AND law_id = (SELECT id FROM laws WHERE short_name = 'Ley 39/2015')),
  'Pregunta sobre principios de actuación...',
  'Opción A',
  'Opción B',
  'Opción C',
  'Opción D',
  2,  -- C=2
  'Explicación basada en el artículo 3 de la Ley 39/2015...',
  'medium',
  'single',
  ARRAY['procedimiento-administrativo', 'conceptos-generales', 'principios'],
  true,
  false,
  null
), (
  -- Pregunta 3: CE, Art. 103
  (SELECT id FROM articles WHERE article_number = '103' AND law_id = (SELECT id FROM laws WHERE short_name = 'CE')),
  'Pregunta sobre eficacia de la Administración...',
  'Opción A',
  'Opción B', 
  'Opción C',
  'Opción D',
  0,  -- A=0
  'Explicación basada en el artículo 103 CE...',
  'medium',
  'single',
  ARRAY['constitucional', 'administracion-publica'],
  true,
  false,
  null
);
-- ... más preguntas según sea necesario
```

---

#### **5️⃣ VERIFICAR CONTENT SCOPE FUNCIONA**

```sql
-- Verificar que el mapeo content_scope está completo
SELECT 
  cs.name as seccion,
  l.short_name,
  csc.article_numbers,
  COUNT(q.id) as preguntas_disponibles
FROM content_sections cs
JOIN content_scope csc ON cs.id = csc.section_id
JOIN laws l ON csc.law_id = l.id
JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(csc.article_numbers)
LEFT JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
WHERE cs.slug = 'SLUG_SECCION'
GROUP BY cs.name, l.short_name, csc.article_numbers
ORDER BY l.short_name;
```

**✅ Output esperado:**
```
seccion            | short_name   | article_numbers | preguntas_disponibles
Conceptos Generales| CE          | {103,105}       | 15
Conceptos Generales| Ley 39/2015 | {1,2,3}        | 10  
Conceptos Generales| Ley 40/2015 | {1,4}          | 5
```

---

### 🌐 **VERIFICAR FUNCIONALIDAD WEB**

#### **URLs que deben funcionar:**
- `http://localhost:3000/test-oposiciones/procedimiento-administrativo` → Listado de secciones  
- `http://localhost:3000/test-oposiciones/procedimiento-administrativo/conceptos-generales` → Detalle de sección
- `http://localhost:3000/test-personalizado?seccion=conceptos-generales` → Test funcional

#### **Verificación en consola:**
```sql
-- Simular carga de preguntas de content_scope
SELECT 
  cs.name as seccion,
  l.short_name as ley,
  a.article_number,
  q.question_text,
  q.correct_option,
  q.explanation
FROM content_sections cs
JOIN content_scope csc ON cs.id = csc.section_id  
JOIN laws l ON csc.law_id = l.id
JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(csc.article_numbers)
JOIN questions q ON q.primary_article_id = a.id
WHERE cs.slug = 'conceptos-generales'
  AND q.is_active = true
ORDER BY l.short_name, a.article_number::integer
LIMIT 5;
```

---

### ⭐ **PLANTILLA PARA SCRIPT DE PREGUNTAS CONTENT SCOPE**

```javascript
// scripts/add-content-scope-questions-SECCION.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Función helper para convertir letra a número
function letterToNumber(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };  // ⚠️ Sistema 0-indexed correcto
  return map[letter.toUpperCase()];
}

// Preguntas específicas para la sección
const questionsBatch = [
  {
    question_text: "Pregunta específica...",
    option_a: "Opción A",
    option_b: "Opción B", 
    option_c: "Opción C",
    option_d: "Opción D",
    correct_option: "B",  // Se convierte a 1
    explanation: "Explicación detallada...",
    law_short_name: "Ley 39/2015",
    article_number: "3"
  },
  // ... más preguntas
]

async function addContentScopeQuestions() {
  console.log('🔧 AÑADIENDO PREGUNTAS A CONTENT SCOPE: SECCION\n')
  
  for (const [index, questionData] of questionsBatch.entries()) {
    // 1. Verificar duplicados por similitud de texto
    const { data: existingQuestion } = await supabase
      .from('questions')
      .select('id')
      .ilike('question_text', questionData.question_text.substring(0, 50) + '%')
      .single()
    
    if (existingQuestion) {
      console.log(`⚠️ Pregunta ${index + 1} duplicada, saltando...`)
      continue
    }
    
    // 2. Obtener la ley
    const { data: law } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', questionData.law_short_name)
      .single()
    
    if (!law) {
      console.log(`❌ Ley ${questionData.law_short_name} no encontrada`)
      continue
    }
    
    // 3. Obtener el artículo
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', law.id)
      .eq('article_number', questionData.article_number)
      .single()
    
    if (!article) {
      console.log(`❌ Artículo ${questionData.article_number} de ${questionData.law_short_name} no encontrado`)
      continue
    }
    
    // 4. Insertar la pregunta
    const { data: newQuestion, error: questionError } = await supabase
      .from('questions')
      .insert({
        question_text: questionData.question_text,
        option_a: questionData.option_a,
        option_b: questionData.option_b,
        option_c: questionData.option_c,
        option_d: questionData.option_d,
        correct_option: letterToNumber(questionData.correct_option),  // ⚠️ Conversión correcta
        explanation: questionData.explanation,
        primary_article_id: article.id,
        is_active: true,
        difficulty: 'medium',
        is_official_exam: false,
        exam_source: 'content_scope_batch_SECCION',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()
    
    if (questionError) {
      console.log(`❌ Error insertando pregunta ${index + 1}: ${questionError.message}`)
      continue
    }
    
    console.log(`✅ Pregunta ${index + 1} añadida: ${newQuestion.id}`)
  }
  
  console.log('\n🎯 Preguntas añadidas a content_scope exitosamente!')
}

addContentScopeQuestions()
```

---

### ✅ **CHECKLIST CONTENT SCOPE**

- [ ] **Content scope verificado** → ¿Qué leyes están mapeadas?
- [ ] **Artículos verificados** → ¿Existen todos en BD?
- [ ] **Preguntas creadas** → Vinculadas a artículos reales
- [ ] **Sistema respuestas correcto** → 0=A, 1=B, 2=C, 3=D
- [ ] **Tags temáticos** → ARRAY['procedimiento-administrativo', 'seccion-especifica']
- [ ] **URLs funcionan** → Sección detalle y test personalizado
- [ ] **Verificación SQL** → Count de preguntas coincide
- [ ] **Navegación web** → Grid de secciones carga correctamente

---

### 🚨 **ERRORES CRÍTICOS A EVITAR**

#### ❌ **Error 1: UPDATE sin mapeo existente**
```sql
-- ❌ ESTO FALLA SILENCIOSAMENTE
UPDATE content_scope SET article_numbers = ARRAY['1','2','3']
WHERE law_id = ley_no_mapeada_id;  -- 0 filas afectadas
```

#### ❌ **Error 2: Opciones incorrectas**  
```sql
-- ❌ MAL: Sistema 1-indexed
correct_option = 4  -- D (NO EXISTE)

-- ✅ BIEN: Sistema 0-indexed  
correct_option = 3  -- D
```

#### ❌ **Error 3: No verificar artículos**
- Crear preguntas sin verificar que los artículos existen
- Resultado: primary_article_id NULL → Error

#### ❌ **Error 4: Tags incorrectos**
```sql
-- ❌ MAL: Tags genéricos
tags = ARRAY['pregunta', 'test']

-- ✅ BIEN: Tags específicos de content scope
tags = ARRAY['procedimiento-administrativo', 'conceptos-generales', 'ley-39-2015']
```

---

### 💡 **REGLAS DE ORO CONTENT SCOPE**

1. **VERIFICAR PRIMERO** → Qué está mapeado vs qué necesitas mapear
2. **ARTÍCULOS REALES** → Solo vincular a artículos existentes del BOE
3. **SISTEMA 0-INDEXED** → A=0, B=1, C=2, D=3 (SIEMPRE)
4. **TAGS TEMÁTICOS** → Incluir nombre de la sección y ley
5. **EXPLICACIONES PRECISAS** → Referenciar artículo específico
6. **UNA SQL A LA VEZ** → No ejecutar batches grandes sin verificar

---

### 🎯 **EJEMPLO REAL: Conceptos Generales**

```sql
-- 1. Verificar mapeo existente
SELECT l.short_name, csc.article_numbers 
FROM content_scope csc 
JOIN laws l ON csc.law_id = l.id 
WHERE section_id = (SELECT id FROM content_sections WHERE slug = 'conceptos-generales');

-- Resultado:
-- Ley 39/2015 | {1,2,3}
-- CE | {103,105}  
-- Ley 40/2015 | {1,4}

-- 2. Crear pregunta vinculada a Art. 3 Ley 39/2015
INSERT INTO questions (primary_article_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, question_type, tags, is_active) 
VALUES (
  (SELECT id FROM articles WHERE article_number = '3' AND law_id = (SELECT id FROM laws WHERE short_name = 'Ley 39/2015')),
  '¿Cuál es uno de los principios de actuación de las Administraciones Públicas según la Ley 39/2015?',
  'Discrecionalidad absoluta',
  'Transparencia y participación', 
  'Secreto administrativo',
  'Autonomía total',
  1,  -- B=1 (Transparencia y participación)
  'La Ley 39/2015 establece entre sus principios la transparencia y participación ciudadana como pilares fundamentales de la actuación administrativa.',
  'medium',
  'single',
  ARRAY['procedimiento-administrativo', 'conceptos-generales', 'principios', 'ley-39-2015'],
  true
);

-- 3. Verificar que funciona
SELECT COUNT(*) FROM questions q
JOIN articles a ON q.primary_article_id = a.id  
JOIN laws l ON a.law_id = l.id
WHERE l.short_name = 'Ley 39/2015' 
  AND a.article_number = '3'
  AND q.is_active = true;
-- Expected: 6+ preguntas
```

**🎯 RESULTADO:** Pregunta aparece en `/test-personalizado?seccion=conceptos-generales` automáticamente.

---

## 🎯 **CÓMO USAR EL SISTEMA CONTENT SCOPE EXISTENTE** ⭐ SECCIÓN PRÁCTICA

### 📋 **SITUACIÓN: Quiero añadir preguntas a una sección existente**

**Content Scope ya está implementado y funcionando**. Solo necesitas seguir este flujo:

#### **PASO 1: Identificar sección existente**
```sql
-- Ver todas las secciones disponibles en content collections
SELECT 
  cc.name as collection,
  cs.section_number,
  cs.name,
  cs.slug,
  cs.description
FROM content_collections cc
JOIN content_sections cs ON cc.id = cs.collection_id
WHERE cc.is_active = true AND cs.is_active = true
ORDER BY cc.name, cs.order_position;
```

**📋 Secciones disponibles actualmente:**
- **procedimiento-administrativo/conceptos-generales** ✅ (ya tiene 26 preguntas)
- **procedimiento-administrativo/el-procedimiento-administrativo** (pendiente)
- **procedimiento-administrativo/responsabilidad-patrimonial** (pendiente)
- Y otras 7 secciones más...

#### **PASO 2: Verificar mapeo actual de la sección**
```sql
-- Para sección específica (ej: conceptos-generales)
SELECT 
  cs.name as seccion,
  l.short_name as ley,
  csc.article_numbers,
  array_length(csc.article_numbers, 1) as total_articulos
FROM content_sections cs
JOIN content_scope csc ON cs.id = csc.section_id
JOIN laws l ON csc.law_id = l.id
WHERE cs.slug = 'conceptos-generales'  -- CAMBIAR por la sección que quieras
ORDER BY l.short_name;
```

**📊 Ejemplo output conceptos-generales:**
```
seccion            | ley          | article_numbers | total_articulos
Conceptos Generales| CE          | {103,105}       | 2
Conceptos Generales| Ley 39/2015 | {1,2,3}        | 3  
Conceptos Generales| Ley 40/2015 | {1,4}          | 2
```

#### **PASO 3: Crear script de preguntas usando la plantilla**

```javascript
// scripts/add-[SECCION]-questions.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function letterToNumber(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()];
}

const questionsBatch = [
  {
    question_text: "¿Tu pregunta específica sobre la sección?",
    option_a: "Opción A",
    option_b: "Opción B",
    option_c: "Opción C", 
    option_d: "Opción D",
    correct_option: "C",  // Se convierte a 2
    explanation: "Explicación detallada referenciando el artículo específico...",
    law_short_name: "Ley 39/2015",  // Debe ser una de las leyes mapeadas
    article_number: "3"             // Debe ser uno de los artículos mapeados
  },
  // ... hasta 10 preguntas por batch
]

async function addQuestionsToContentScope() {
  console.log('🔧 AÑADIENDO PREGUNTAS A CONTENT SCOPE\n')
  
  let addedCount = 0
  let duplicateCount = 0
  
  for (const [index, questionData] of questionsBatch.entries()) {
    console.log(`📝 Procesando pregunta ${index + 1}/${questionsBatch.length}...`)
    
    // 1. Verificar duplicados
    const { data: existingQuestion } = await supabase
      .from('questions')
      .select('id')
      .ilike('question_text', questionData.question_text.substring(0, 50) + '%')
      .single()
    
    if (existingQuestion) {
      console.log(`   ⚠️ Pregunta duplicada, saltando...`)
      duplicateCount++
      continue
    }
    
    // 2. Obtener ley
    const { data: law } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', questionData.law_short_name)
      .single()
    
    if (!law) {
      console.log(`   ❌ Ley ${questionData.law_short_name} no encontrada`)
      continue
    }
    
    // 3. Obtener artículo
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', law.id)
      .eq('article_number', questionData.article_number)
      .single()
    
    if (!article) {
      console.log(`   ❌ Artículo ${questionData.article_number} de ${questionData.law_short_name} no encontrado`)
      continue
    }
    
    // 4. Insertar pregunta
    const { data: newQuestion, error: questionError } = await supabase
      .from('questions')
      .insert({
        question_text: questionData.question_text,
        option_a: questionData.option_a,
        option_b: questionData.option_b,
        option_c: questionData.option_c,
        option_d: questionData.option_d,
        correct_option: letterToNumber(questionData.correct_option),
        explanation: questionData.explanation,
        primary_article_id: article.id,
        is_active: true,
        difficulty: 'medium',
        is_official_exam: false,
        exam_source: 'content_scope_batch'
      })
      .select('id')
      .single()
    
    if (questionError) {
      console.log(`   ❌ Error insertando: ${questionError.message}`)
      continue
    }
    
    console.log(`   ✅ Pregunta añadida: ${newQuestion.id}`)
    addedCount++
  }
  
  console.log(`\n📊 RESUMEN:`)
  console.log(`✅ Preguntas añadidas: ${addedCount}`)
  console.log(`⚠️ Duplicadas ignoradas: ${duplicateCount}`)
  console.log(`🎯 Total procesadas: ${questionsBatch.length}`)
}

addQuestionsToContentScope()
```

#### **PASO 4: Ejecutar script**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://yqbpstxowvgipqspqrgo.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w node scripts/add-[SECCION]-questions.js
```

#### **PASO 5: Verificar que funciona**
```sql
-- Contar nuevas preguntas por sección
SELECT 
  cs.name as seccion,
  l.short_name,
  COUNT(q.id) as total_preguntas
FROM content_sections cs
JOIN content_scope csc ON cs.id = csc.section_id
JOIN laws l ON csc.law_id = l.id
JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(csc.article_numbers)
LEFT JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
WHERE cs.slug = 'TU_SECCION_AQUI'
GROUP BY cs.name, l.short_name
ORDER BY l.short_name;
```

#### **PASO 6: Probar URLs**
- **Sección detalle:** `http://localhost:3000/test-oposiciones/procedimiento-administrativo/TU_SECCION`
- **Test funcional:** `http://localhost:3000/test-personalizado?seccion=TU_SECCION`

---

### 🎯 **FLUJO TÍPICO PARA AÑADIR PREGUNTAS**

**📌 ORDEN RECOMENDADO:**

1. **Analiza 10 preguntas muestra** → ¿Qué artículos necesitas?
2. **Verifica mapeo actual** → ¿Ya están mapeados esos artículos?
3. **Si faltan artículos → PARAR** → Solicita artículos BOE oficiales
4. **Si faltan mapeos → UPDATE content_scope** → Añadir artículos al mapeo
5. **Crea script con plantilla** → 10 preguntas máximo por batch
6. **Ejecuta script** → Verifica salida sin errores
7. **Prueba URLs** → Sección detalle + test personalizado
8. **Confirma count** → SQL de verificación

---

### 🚨 **ERRORES MÁS COMUNES**

#### **❌ Error 1: Crear leyes sin verificar necesidad** ⭐ *NUEVA LECCIÓN*
```javascript
// ❌ INCORRECTO: Crear ley porque aparece en un error
async function createLeyInnecesaria() {
  // Ví "Ley 1/2015" en un error y la creé sin verificar
  const { data } = await supabase.from('laws').insert({
    name: 'Ley 1/2015, de 6 de febrero...',
    short_name: 'Ley 1/2015',
    // ...
  })
  // ❌ RESULTADO: Ley creada sin propósito, sin preguntas que la usen
}

// ✅ CORRECTO: Verificar primero si hay preguntas que la necesitan
async function verificarAntesDe() {
  // 1. Buscar preguntas que mencionen la ley
  const { data: preguntasConLey } = await supabase
    .from('questions')
    .select('id')
    .ilike('question_text', '%Ley 1/2015%')
  
  if (preguntasConLey.length === 0) {
    console.log('❌ No hay preguntas que usen esta ley - NO crear')
    return
  }
  
  // 2. Solo entonces crear la ley
  // ...
}
```

**🎯 REGLA: Solo crear leyes cuando hay preguntas específicas que las referencian.**

#### **❌ Error 2: Flujo incorrecto de verificación** ⭐ *NUEVA LECCIÓN*
```javascript
// ❌ INCORRECTO: Crear primero, verificar después
async function flujoIncorrecto() {
  // 1. Crear ley porque aparece en error
  await crearLey1_2015()
  
  // 2. Añadir preguntas
  await añadirPreguntas()
  
  // 3. Después me doy cuenta que no hay preguntas que la usen
  // ❌ RESULTADO: Trabajo redundante, ley innecesaria
}

// ✅ CORRECTO: Verificar primero, crear solo si es necesario
async function flujoCorreto() {
  // 1. PRIMERO: Revisar qué leyes necesitan las preguntas
  const leyesNecesarias = await analizarPreguntasDelLote()
  
  // 2. SEGUNDO: Verificar qué leyes ya existen
  const leyesFaltantes = await verificarLeyesExistentes(leyesNecesarias)
  
  // 3. TERCERO: Crear solo las leyes que realmente faltan
  for (const ley of leyesFaltantes) {
    await crearLeyConArticulos(ley)
  }
  
  // 4. CUARTO: Añadir las preguntas
  await añadirPreguntas()
  // ✅ RESULTADO: Solo se crea lo necesario, trabajo eficiente
}
```

**🎯 REGLA: SIEMPRE verificar necesidad ANTES de crear contenido.**

#### **❌ Error 3: Usar artículos no mapeados**
```javascript
// ❌ MAL: Art. 15 no está en content_scope de conceptos-generales
law_short_name: "Ley 39/2015",
article_number: "15"  // No mapeado

// ✅ BIEN: Solo artículos mapeados {1,2,3}  
article_number: "3"   // Sí mapeado
```

#### **❌ Error 2: Opciones incorrectas**
```javascript
correct_option: "4"  // ❌ No existe
correct_option: "D"  // ✅ Se convierte a 3
```

#### **❌ Error 3: No verificar duplicados**
- El script maneja duplicados automáticamente
- Compara primeros 50 caracteres de question_text
- Si encuentra similar → salta sin insertar

#### **❌ Error 4: Leyes inexistentes**
```sql
-- Verificar que la ley existe ANTES de crear script
SELECT id, short_name FROM laws WHERE short_name = 'Ley 39/2015';
```

---

### 📋 **CHECKLIST RÁPIDO PARA CONTENT SCOPE**

- [ ] Sección existe en content_sections ✅
- [ ] Content_scope mapeado con artículos específicos ✅
- [ ] Artículos BOE existen en BD ✅
- [ ] Script usa solo artículos mapeados ✅
- [ ] Sistema 0-indexed (A=0, B=1, C=2, D=3) ✅
- [ ] Script detecta duplicados ✅
- [ ] URLs sección + test funcionan ✅
- [ ] Count SQL correcto ✅

---

### 💡 **REGLAS DE ORO RÁPIDAS**

1. **SOLO artículos ya mapeados** en content_scope
2. **Sistema 0-indexed SIEMPRE** (A=0, B=1, C=2, D=3)
3. **Máximo 10 preguntas** por script/batch
4. **Verificar duplicados** automático en script
5. **URLs de prueba** siempre después de insertar
6. **Si falla algo** → revisar mapeo content_scope primero

---

### 🎯 **PRÓXIMAS SECCIONES PENDIENTES**

Para continuar expandiendo procedimiento-administrativo:

```sql
-- Ver secciones SIN preguntas aún
SELECT 
  cs.name,
  cs.slug,
  COALESCE(COUNT(q.id), 0) as preguntas_actuales
FROM content_sections cs
JOIN content_collections cc ON cs.collection_id = cc.id
LEFT JOIN content_scope csc ON cs.id = csc.section_id
LEFT JOIN laws l ON csc.law_id = l.id
LEFT JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(csc.article_numbers)
LEFT JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
WHERE cc.slug = 'procedimiento-administrativo'
GROUP BY cs.name, cs.slug, cs.order_position
HAVING COUNT(q.id) = 0
ORDER BY cs.order_position;
```

**🎯 RESULTADO ESPERADO:** Lista de secciones que necesitan preguntas, ordenadas por prioridad.

---

## 🛠️ **COMANDOS ÚTILES CONTENT SCOPE**

### **Ver estado completo del sistema:**
```sql
SELECT 
  cc.name as collection,
  COUNT(DISTINCT cs.id) as total_secciones,
  COUNT(DISTINCT csc.id) as total_mapeos,
  COUNT(DISTINCT q.id) as total_preguntas
FROM content_collections cc
LEFT JOIN content_sections cs ON cc.id = cs.collection_id
LEFT JOIN content_scope csc ON cs.id = csc.section_id  
LEFT JOIN laws l ON csc.law_id = l.id
LEFT JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(csc.article_numbers)
LEFT JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
WHERE cc.is_active = true
GROUP BY cc.name;
```

### **Ver progreso por sección:**
```sql
SELECT 
  cs.name,
  cs.slug,
  COUNT(DISTINCT l.id) as leyes_mapeadas,
  COUNT(DISTINCT a.id) as articulos_mapeados,
  COUNT(q.id) as preguntas_disponibles,
  CASE 
    WHEN COUNT(q.id) >= 10 THEN '✅ Completa'
    WHEN COUNT(q.id) >= 5 THEN '🔶 Parcial'  
    WHEN COUNT(q.id) > 0 THEN '🔸 Iniciada'
    ELSE '❌ Pendiente'
  END as status
FROM content_sections cs
LEFT JOIN content_scope csc ON cs.id = csc.section_id
LEFT JOIN laws l ON csc.law_id = l.id
LEFT JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(csc.article_numbers)
LEFT JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
WHERE cs.collection_id = (SELECT id FROM content_collections WHERE slug = 'procedimiento-administrativo')
GROUP BY cs.name, cs.slug, cs.order_position
ORDER BY cs.order_position;
```

**🎯 ESTOS COMANDOS te dan visibilidad completa del estado actual del sistema Content Scope.**

---

## 🎓 **LEARNINGS Y MEJORES PRÁCTICAS** ⭐ NUEVA SECCIÓN

### 🚀 **CASO DE ESTUDIO: Procedimiento Administrativo - Ejecución**

*Basado en la implementación exitosa de la sección de ejecución con 41 preguntas y artículos BOE oficiales.*

#### **📝 LEARNINGS CRÍTICOS**

**🔴 1. ORDEN CORRECTO DE IMPLEMENTACIÓN**
```
✅ PROCESO CORRECTO:
1. Verificar artículos existen → 2. Crear artículos faltantes → 3. Crear content_scope → 4. Añadir preguntas

❌ PROCESO INCORRECTO: 
1. Crear preguntas → 2. Crear artículos después → 3. Errores de FK
```

**🔴 2. VERIFICACIÓN PREVIA DE ARTÍCULOS BOE**
- **SIEMPRE verificar artículos existen antes de crear preguntas**
- En el caso de ejecución: artículos 99 y 105 no existían
- **Solución:** Solicitar contenido BOE oficial al usuario ANTES de proceder

```sql
-- Query crítica ANTES de crear preguntas:
SELECT 
  unnest(ARRAY['96','97','98','99','100','101','102','103','104','105']) as required_article,
  CASE WHEN a.id IS NOT NULL THEN '✅ Existe' ELSE '❌ Falta' END as status,
  a.title
FROM unnest(ARRAY['96','97','98','99','100','101','102','103','104','105']) as required_article
LEFT JOIN articles a ON a.article_number = required_article 
  AND a.law_id = (SELECT id FROM laws WHERE short_name = 'Ley 39/2015')
ORDER BY required_article::integer;
```

**🔴 3. DATABASE SCHEMA GOTCHAS**

| Error Común | Campo Correcto | Error Típico |
|-------------|----------------|--------------|
| `difficulty_level` | `difficulty` | Column doesn't exist |
| `question_type = 'multiple_choice'` | `question_type = 'single'` | Check constraint violation |
| CommonJS `require()` | ES `import` | Module syntax error |

**🔴 4. CONTENT_SCOPE ESPECÍFICO vs GENERAL**
- ❌ **Error:** Crear content_scope en sección general "procedimiento-administrativo"  
- ✅ **Correcto:** Crear sección específica "El Procedimiento Administrativo: Ejecución"
- **Learning:** Cada subsección debe tener su propio content_scope específico

#### **🛠️ TEMPLATE DE SCRIPT BULLETPROOF**

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addQuestionsToContentScope() {
  try {
    // 1. 🔍 VERIFICAR SECCIÓN EXISTE
    const { data: section, error: sectionError } = await supabase
      .from('content_sections')
      .select('id, name')
      .eq('slug', 'ejecucion')
      .single();
    
    if (sectionError || !section) {
      throw new Error('❌ Sección no existe. Crear primero.');
    }
    
    // 2. 🔍 VERIFICAR ARTÍCULOS EXISTEN
    const requiredArticles = ['96', '98', '101', '102', '104'];
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, article_number')
      .eq('law_id', 'UUID_LEY_39_2015')
      .in('article_number', requiredArticles);
    
    if (articles.length !== requiredArticles.length) {
      const missing = requiredArticles.filter(req => 
        !articles.find(art => art.article_number === req)
      );
      throw new Error(`❌ Artículos faltantes: ${missing.join(', ')}`);
    }
    
    // 3. 🔍 FUNCIÓN HELPER PARA CONVERTIR RESPUESTAS
    const letterToNumber = (letter) => {
      const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
      return map[letter.toUpperCase()] ?? 0;
    };
    
    // 4. 📝 PROCESAR PREGUNTAS
    const questionsData = [
      {
        question_text: "¿Cuál es el principio de ejecutoriedad?",
        option_a: "Los actos administrativos se ejecutan inmediatamente",
        option_b: "Los actos administrativos son ejecutables sin necesidad de intervención judicial",
        option_c: "Los actos administrativos requieren autorización judicial",
        option_d: "Los actos administrativos se ejecutan solo si hay recurso",
        correct_option: "B",
        explanation: "**Ejecutoriedad**: Los actos administrativos pueden ejecutarse por la propia Administración sin necesidad de acudir a los tribunales...",
        primary_article_number: "98"
      }
      // ... más preguntas
    ];
    
    // 5. 💾 INSERTAR PREGUNTAS CON VALIDACIÓN
    for (const questionData of questionsData) {
      const article = articles.find(a => a.article_number === questionData.primary_article_number);
      
      if (!article) {
        console.log(`⚠️ Saltando pregunta: artículo ${questionData.primary_article_number} no encontrado`);
        continue;
      }
      
      // Schema correcto validado
      const questionInsert = {
        question_text: questionData.question_text,
        option_a: questionData.option_a,
        option_b: questionData.option_b,
        option_c: questionData.option_c,
        option_d: questionData.option_d,
        correct_option: letterToNumber(questionData.correct_option),
        explanation: questionData.explanation,
        primary_article_id: article.id,
        difficulty: 'medium',        // ✅ Campo correcto
        question_type: 'single',     // ✅ Valor correcto
        is_official_exam: false,
        is_active: true
      };
      
      const { data, error } = await supabase
        .from('questions')
        .insert(questionInsert)
        .select('id, question_text');
      
      if (error) {
        console.log('❌ Error inserting question:', error.message);
      } else {
        console.log(`✅ Pregunta añadida: ${data[0].question_text.substring(0, 50)}...`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

addQuestionsToContentScope();
```

#### **📋 CHECKLIST POST-IMPLEMENTACIÓN**

```bash
# 1. Verificar URLs funcionan
curl -I http://localhost:3000/test-oposiciones/procedimiento-administrativo/ejecucion

# 2. Verificar datos en BD
SELECT 
  cs.name as seccion,
  COUNT(DISTINCT a.id) as articulos,
  COUNT(q.id) as preguntas
FROM content_sections cs
JOIN content_scope csc ON cs.id = csc.section_id
JOIN laws l ON csc.law_id = l.id  
JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(csc.article_numbers)
LEFT JOIN questions q ON q.primary_article_id = a.id
WHERE cs.slug = 'ejecucion'
GROUP BY cs.name;

# 3. Verificar mapeo routing
# Confirmar 'ejecucion' está en generateStaticParams()
```

#### **🎯 GOLDEN RULES PARA CONTENT SCOPE**

1. **📖 BOE FIRST**: Verificar contenido oficial ANTES de implementar
2. **🔗 ARTICLES FIRST**: Crear artículos faltantes ANTES de preguntas  
3. **🎯 SPECIFIC SCOPE**: Cada subsección debe tener content_scope específico
4. **📝 DIDACTIC EXPLANATIONS**: Explicaciones deben ser educativas, no solo correctas
5. **✅ SCHEMA VALIDATION**: Validar campos y constraints antes de insertar
6. **🔄 ROUTING UPDATE**: Actualizar generateStaticParams para nuevas secciones

**💡 RESULTADO:** 62 preguntas funcionales en 10 artículos oficiales BOE con URL activa.