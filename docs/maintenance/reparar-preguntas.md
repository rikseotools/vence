# 📋 README: Cómo Arreglar Preguntas con JSON de Auditoría

## 🎯 **PROCESO COMPLETO EN 5 PASOS**

Esta guía explica cómo revisar y corregir preguntas problemáticas usando el JSON de auditoría como punto de partida.

---

## 🏗️ **CONCEPTOS FUNDAMENTALES**

### **SISTEMA DE RESPUESTAS OBLIGATORIO**
```
🎯 SISTEMA: 0=A, 1=B, 2=C, 3=D
- correct_option = 0 → Opción A
- correct_option = 1 → Opción B  
- correct_option = 2 → Opción C
- correct_option = 3 → Opción D
```

### **TIPOS DE PREGUNTAS Y ASIGNACIÓN DE ARTÍCULOS**

#### **A) Preguntas de contenido específico → Artículo real**
```sql
-- Preguntas sobre el contenido literal de un artículo
-- Ejemplo: "Según el art. 15 CE, el derecho a la vida..."
primary_article_id = id_del_articulo_15
```

#### **B) Preguntas de estructura/temario → Artículo 0** ⭐
```sql
-- Preguntas que NO tienen artículo literal específico:
-- • Clasificación de derechos ("¿Qué tipo de derecho es X?")
-- • Estructura constitucional ("¿En qué sección está X?")  
-- • Historia/cronología ("¿Cuándo se reformó?")
-- • Temario general ("¿Cuántos títulos tiene la CE?")

primary_article_id = '2536184c-73ed-4568-9ac7-0bbf1da24dcb' -- Art. 0
```

#### **C) Toda la explicación va en el campo 'explanation'** ⭐
```sql
-- Para preguntas del artículo 0, la explicación debe ser completa y autónoma
-- Incluir toda la información necesaria para entender la respuesta:
explanation = 'Explicación completa con toda la información relevante, 
referencias normativas, estructura constitucional, fechas históricas, 
procedimientos, etc. Debe ser educativa y autosuficiente.'
```

---

## 📊 **PASO 1: ANALIZAR EL JSON DE AUDITORÍA**

### 1.1 Identificar problemas por categoría

```json
{
  "problemas_corregidos": [...]     // ✅ Ya resueltos automáticamente
  "problemas_persistentes": [...]   // ❌ Requieren revisión manual
  "problemas_empeorados": [...]     // 🚨 Prioridad máxima
}
```

### 1.2 Extraer IDs problemáticos

Del JSON, obtener los `id_pregunta` de:
- **Problemas persistentes** (puntuación baja en ambos LLMs)
- **Discrepancias** (puntuación muy diferente entre LLMs)
- **Problemas empeorados** (puntuación bajó)

---

## 🔍 **PASO 2: SQL PARA REVISAR PREGUNTA ESPECÍFICA**

### 2.1 Plantilla SQL completa

```sql
-- 🚨 REVISAR PREGUNTA PROBLEMÁTICA + ARTÍCULO ASIGNADO
-- ID: [PEGAR_ID_AQUI]

SELECT 
    '🚨 PREGUNTA PROBLEMÁTICA' as categoria,
    q.question_text,
    q.option_a, 
    q.option_b, 
    q.option_c, 
    q.option_d,
    q.correct_option,
    CASE q.correct_option
        WHEN 0 THEN 'A) ' || q.option_a
        WHEN 1 THEN 'B) ' || q.option_b
        WHEN 2 THEN 'C) ' || q.option_c
        WHEN 3 THEN 'D) ' || q.option_d
    END as respuesta_seleccionada,
    q.explanation,
    '---ARTÍCULO ASIGNADO---' as separador,
    a.article_number as articulo_asignado,
    a.title as titulo_articulo,
    l.short_name as ley,
    '---CONTENIDO DEL ARTÍCULO---' as separador2,
    a.content as contenido_articulo
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
JOIN laws l ON a.law_id = l.id
WHERE q.id = '[PEGAR_ID_AQUI]';
```

### 2.2 ¿Por qué incluir el artículo asignado?

- **Verificar coherencia:** ¿La pregunta corresponde al contenido del artículo?
- **Detectar asignaciones incorrectas:** ¿Debería estar en otro artículo?
- **Identificar preguntas de estructura:** ¿Debería estar en el artículo 0?

---

## 🧠 **PASO 3: ANÁLISIS Y DIAGNÓSTICO**

### 3.1 Tipos de problemas comunes

#### **A) Respuesta incorrecta**
```
- Verificar con el contenido del artículo
- Comprobar lógica de las opciones
- Revisar si la pregunta busca CORRECTA o INCORRECTA
```

#### **B) Explicación incorrecta**
```
- Contradicciones internas (respuesta vs explicación)
- Referencias normativas incorrectas (art. 81 vs art. 86)
- Interpretación errónea del artículo
```

#### **C) Asignación incorrecta de artículo** ⭐
```
- Preguntas de estructura → Art. 0
- Preguntas históricas → Art. 0  
- Preguntas de clasificación → Art. 0
- Preguntas de procedimientos → Art. 0
- Preguntas de temario general → Art. 0
- Contenido específico → Artículo real
```

**Ejemplos de preguntas que van al Art. 0:**
- "¿Qué tipo de derecho es la negociación colectiva?"
- "¿Cuándo se produjo la tercera reforma?"
- "¿En qué sección está el derecho a la propiedad?"
- "¿Cuántos artículos tiene la Constitución?"
- "¿Qué procedimiento se usa para reformar el art. 15?"

### 3.2 Patrones de detección automática

```sql
-- Detectar incoherencias
CASE 
    WHEN q.question_text ILIKE '%reforma%' AND a.article_number != '168' AND a.article_number != '169' AND a.article_number != '0' 
    THEN '❌ INCOHERENTE: Pregunta de reformas no asignada a arts. 168/169 o estructura'
    
    WHEN q.question_text ILIKE '%cuándo%produjo%' AND a.article_number != '0'
    THEN '❌ INCOHERENTE: Pregunta histórica no asignada a estructura'
    
    WHEN q.question_text ILIKE '%clasificación%' OR q.question_text ILIKE '%tipo de derecho%' AND a.article_number != '0'
    THEN '❌ INCOHERENTE: Pregunta de clasificación no asignada a estructura'
    
    ELSE '✅ COHERENTE: Pregunta y artículo relacionados'
END
```

---

## 🔧 **PASO 4: CORRECCIONES ESPECÍFICAS**

### 4.1 Corrección de respuesta ⭐

```sql
-- SISTEMA OBLIGATORIO: 0=A, 1=B, 2=C, 3=D
UPDATE questions 
SET correct_option = X  -- 0=A, 1=B, 2=C, 3=D
WHERE id = 'ID_PREGUNTA';
```

### 4.2 Corrección de explicación

```sql
UPDATE questions 
SET explanation = 'Nueva explicación corregida y detallada...'
WHERE id = 'ID_PREGUNTA';
```

### 4.3 Cambio de pregunta (CORRECTA ↔ INCORRECTA)

```sql
UPDATE questions 
SET 
    question_text = REPLACE(question_text, 'CORRECTA', 'INCORRECTA'),
    explanation = 'Nueva explicación acorde al cambio...'
WHERE id = 'ID_PREGUNTA';
```

### 4.4 Reasignación de artículo ⭐

```sql
-- Reasignar a artículo 0 (estructura/temario/historia)
-- ID fijo del artículo 0: 2536184c-73ed-4568-9ac7-0bbf1da24dcb
UPDATE questions 
SET primary_article_id = '2536184c-73ed-4568-9ac7-0bbf1da24dcb'
WHERE id = 'ID_PREGUNTA';

-- Reasignar a artículo específico (contenido literal)
UPDATE questions 
SET primary_article_id = (
    SELECT id FROM articles 
    WHERE article_number = 'NUM' 
    AND law_id = (SELECT id FROM laws WHERE short_name = 'LEY')
)
WHERE id = 'ID_PREGUNTA';
```

### 4.5 Explicación completa para Art. 0 ⭐

```sql
-- Para preguntas del artículo 0, la explicación debe ser autosuficiente
UPDATE questions 
SET explanation = 'Explicación completa y detallada que incluye:
- Toda la información necesaria para entender la respuesta
- Referencias normativas específicas (arts. X, Y, Z)
- Estructura constitucional relevante
- Fechas históricas si aplica
- Procedimientos si aplica
- Contexto educativo adicional
Sin depender del contenido de ningún artículo específico.'
WHERE id = 'ID_PREGUNTA';
```

---

## 📚 **PASO 5: VERIFICACIONES POST-CORRECCIÓN**

### 5.1 Verificar mapeo en topic_scope

```sql
-- Verificar que el artículo esté mapeado al tema
SELECT 
    t.title,
    ts.article_numbers,
    l.short_name
FROM topics t
JOIN topic_scope ts ON t.id = ts.topic_id  
JOIN laws l ON ts.law_id = l.id
WHERE t.topic_number = X 
  AND t.position_type = 'auxiliar_administrativo'
  AND l.short_name = 'LEY';
```

### 5.2 Añadir artículo faltante a topic_scope

```sql
-- Si el artículo no está mapeado
UPDATE topic_scope 
SET article_numbers = array_append(article_numbers, 'NUMERO_ARTICULO')
WHERE topic_id = (SELECT id FROM topics WHERE topic_number = X)
  AND law_id = (SELECT id FROM laws WHERE short_name = 'LEY');
```

### 5.3 Verificar contenido del artículo

```sql
-- Asegurar que el artículo tiene contenido suficiente
SELECT article_number, title, 
       CASE 
           WHEN content IS NULL THEN '❌ SIN CONTENIDO'
           WHEN LENGTH(content) < 100 THEN '⚠️ CONTENIDO INSUFICIENTE'
           ELSE '✅ CONTENIDO OK'
       END
FROM articles 
WHERE id = 'ARTICLE_ID';
```

---

## ⚠️ **ERRORES COMUNES A EVITAR**

### ❌ **Error 1: No verificar el artículo asignado**
```
- Corregir respuesta sin verificar si el artículo es el correcto
- Resultado: Respuesta correcta pero en artículo incorrecto
```

### ❌ **Error 2: Contradicciones internas**
```
- Cambiar respuesta pero no actualizar explicación
- Resultado: Respuesta dice A pero explicación justifica B
```

### ❌ **Error 3: Sistema de respuestas**
```
- Confundir 1=A, 2=B con 0=A, 1=B
- Sistema correcto: 0=A, 1=B, 2=C, 3=D
```

### ❌ **Error 4: Asignaciones de estructura**
```
- Dejar preguntas históricas en artículos específicos
- Preguntas de "cuándo", "clasificación", "tipo" → Art. 0
```

### ❌ **Error 5: Topic_scope desactualizado**
```
- Reasignar pregunta pero no verificar mapeo
- Resultado: Pregunta "huérfana" no accesible en tests
```

---

## 🎯 **FLUJO RÁPIDO PARA EXPERTOS**

### **Para cada ID problemático:**

1. **SQL completa** → Ver pregunta + artículo asignado
2. **Análisis** → ¿Respuesta? ¿Explicación? ¿Asignación?
3. **Corrección** → UPDATE específico según problema
4. **Verificación** → Topic_scope + contenido artículo
5. **Siguiente pregunta**

### **Patrones de corrección:**

```sql
-- Explicación incorrecta
UPDATE questions SET explanation = '...' WHERE id = 'X';

-- Reasignación a estructura  
UPDATE questions SET primary_article_id = 'ART_0_ID' WHERE id = 'X';

-- Cambio CORRECTA/INCORRECTA
UPDATE questions SET question_text = REPLACE(...), explanation = '...' WHERE id = 'X';

-- Verificar mapeo
SELECT ... FROM topic_scope ... WHERE article_numbers @> ARRAY['NUM'];
```

---

## 📊 **MÉTRICAS DE ÉXITO**

### **Antes de la corrección:**
- Problemas persistentes: X
- Discrepancias LLM: Y  
- Puntuación promedio: Z

### **Después de la corrección:**
- ✅ Coherencia pregunta-artículo: 100%
- ✅ Explicaciones consistentes: 100%
- ✅ Mapeos topic_scope: 100%
- ✅ Respuestas verificadas: 100%

---

## 🏆 **BUENAS PRÁCTICAS**

1. **Una SQL a la vez** - No múltiples correcciones juntas
2. **Verificar SIEMPRE el artículo asignado** - Coherencia total
3. **Explicaciones detalladas** - Educativas y precisas
4. **Sistema de respuestas consistente** - 0=A, 1=B, 2=C, 3=D
5. **Topic_scope actualizado** - Accesibilidad garantizada
6. **Artículo 0 completo** - Información estructural suficiente

---

## 🚀 **EJEMPLO COMPLETO**

```sql
-- 1. Revisar pregunta
SELECT question_text, correct_option, explanation, a.content 
FROM questions q JOIN articles a ON q.primary_article_id = a.id 
WHERE q.id = 'problem-id';

-- 2. Identificar problema: Explicación contradice respuesta

-- 3. Corregir
UPDATE questions 
SET explanation = 'Explicación corregida que justifica la respuesta...'
WHERE id = 'problem-id';

-- 4. Verificar mapeo
SELECT article_numbers FROM topic_scope 
WHERE topic_id = tema_id AND law_id = ley_id;

-- 5. ✅ Corrección completada
```

---

**🎯 REGLA DE ORO: 
1. Sistema de respuestas: 0=A, 1=B, 2=C, 3=D
2. Preguntas sin artículo literal específico → Art. 0 + explicación completa
3. Siempre verificar coherencia entre pregunta, respuesta, explicación y artículo asignado.**