# 📋 Manual de Reparación Masiva de Preguntas Huérfanas

## 🎯 **OBJETIVO**
Reparar preguntas sin `primary_article_id` de forma sistemática y eficiente mediante ingeniería inversa: **PREGUNTA → LEY/ARTÍCULO → CREAR → VINCULAR**

---

## ⚡ **PROCESO RÁPIDO (5 PASOS)**

### **PASO 1: DIAGNÓSTICO INICIAL**
```sql
-- Ver estado actual de huérfanas
SELECT 
  COUNT(*) as total_huerfanas,
  COUNT(CASE WHEN created_at >= 'FECHA_INICIO' THEN 1 END) as huerfanas_recientes
FROM questions 
WHERE primary_article_id IS NULL;
```

### **PASO 2: ANÁLISIS DE CONTENIDO**
```sql
-- Ver preguntas huérfanas con contenido
SELECT 
  id,
  LEFT(question_text, 80) || '...' as pregunta,
  LEFT(explanation, 80) || '...' as explicacion,
  created_at
FROM questions 
WHERE primary_article_id IS NULL
  AND created_at >= 'FECHA_INICIO'
ORDER BY created_at DESC;
```

### **PASO 3: DETECCIÓN DE PATRONES**
Analizar manualmente las preguntas y detectar:
- **Leyes mencionadas:** "LO 3/1981", "LOTC", "Reglamento Congreso", etc.
- **Artículos específicos:** "artículo 2", "Art. 75 ter", etc.
- **Temas comunes:** Defensor del Pueblo, Tribunal Constitucional, etc.

### **PASO 4: VERIFICACIÓN DE LEYES**
```sql
-- Verificar qué leyes ya existen
SELECT id, short_name, name 
FROM laws 
WHERE short_name IN ('LO 3/1981', 'LOTC', 'Reglamento Congreso', 'TUE', 'TFUE');
```

### **PASO 5: REPARACIÓN MASIVA**
Usar el **Template de Reparación Masiva** (ver abajo)

---

## 🛠️ **TEMPLATE DE REPARACIÓN MASIVA**

### **A. Crear ley faltante (si no existe)**
```sql
-- Solo si la ley NO existe
INSERT INTO laws (name, short_name, description, year, type, scope, is_active) 
VALUES (
  'Nombre oficial completo',
  'CODIGO_CORTO',
  'Descripción',
  YYYY,
  'law',        -- SIEMPRE 'law' (excepto 'constitution' para CE)
  'national',   -- SIEMPRE 'national'
  true
)
RETURNING id;
```

### **B. Crear artículos faltantes**
```sql
-- Template para artículo oficial
INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified)
VALUES (
  (SELECT id FROM laws WHERE short_name = 'CODIGO_LEY'),
  'NUMERO',
  'Título oficial del BOE',
  'Contenido oficial completo del BOE con saltos de línea y formato correcto',
  true,
  true
)
RETURNING id;
```

### **C. Vinculación masiva eficiente**
```sql
-- UPDATE masivo con CASE para múltiples preguntas
UPDATE questions 
SET primary_article_id = CASE 
  WHEN id IN ('uuid1','uuid2','uuid3') 
    THEN (SELECT id FROM articles WHERE law_id = (SELECT id FROM laws WHERE short_name = 'LEY1') AND article_number = 'ART1')
  WHEN id IN ('uuid4','uuid5') 
    THEN (SELECT id FROM articles WHERE law_id = (SELECT id FROM laws WHERE short_name = 'LEY2') AND article_number = 'ART2')
  -- Continuar con más casos...
END
WHERE primary_article_id IS NULL 
  AND id IN ('lista_completa_de_uuids_a_reparar');
```

---

## 🔍 **PATRONES DE DETECCIÓN MANUAL**

### **Por texto de pregunta:**
- `%defensor%pueblo%` → **LO 3/1981**
- `%tribunal constitucional%` o `%LOTC%` → **LOTC**
- `%reglamento%congreso%` → **Reglamento Congreso**
- `%ley 7/1985%` → **Ley 7/1985 Régimen Local**
- `%ley 40/2015%` → **Ley 40/2015 Régimen Jurídico**
- `%TUE%` o `%unión europea%` → **TUE**
- `%TFUE%` → **TFUE**

### **Por artículos mencionados:**
- `artículo 2` + Defensor → **LO 3/1981 Art. 2**
- `art. 75` + autonomía local → **LOTC Art. 75 ter**
- `artículo 22` + diputado → **Reglamento Congreso Art. 22**

---

## ⚠️ **ERRORES COMUNES A EVITAR**

### **❌ Error 1: Usar valores incorrectos**
```sql
-- MAL
type = 'ley_organica'
scope = 'estatal'

-- BIEN  
type = 'law'
scope = 'national'
```

### **❌ Error 2: No verificar existencia**
Siempre verificar antes de crear:
```sql
SELECT id FROM laws WHERE short_name = 'CODIGO';
SELECT id FROM articles WHERE article_number = 'NUM' AND law_id = (SELECT id FROM laws WHERE short_name = 'CODIGO');
```

### **❌ Error 3: Contenido sin formato**
- ✅ **SÍ:** Usar contenido oficial del BOE con saltos de línea
- ❌ **NO:** Inventar contenido o usar texto plano sin formato

### **❌ Error 4: UUIDs incorrectos**
- ✅ **SÍ:** Copiar UUIDs exactos de la consulta de análisis
- ❌ **NO:** Escribir UUIDs a mano

### **❌ Error 5: Multiple INSERT con un solo RETURNING**
```sql
-- MAL: Solo devuelve el ID del último INSERT
INSERT INTO articles VALUES (...);
INSERT INTO articles VALUES (...);
RETURNING id;  -- ❌ Solo el último ID

-- BIEN: Un INSERT por consulta para obtener cada ID
INSERT INTO articles VALUES (...) RETURNING id;
-- Ejecutar por separado
INSERT INTO articles VALUES (...) RETURNING id;
```

### **❌ Error 6: Asumir IDs sin verificar**
```sql
-- MAL: Asumir que el artículo se creó correctamente
UPDATE questions SET primary_article_id = 'uuid-asumido';

-- BIEN: Verificar existencia y obtener ID real
SELECT id FROM articles WHERE article_number = 'X' AND law_id = (SELECT id FROM laws WHERE short_name = 'Y');
```

---

## 🚀 **ESTRATEGIAS DE EFICIENCIA**

### **1. Agrupar por ley**
Procesar todas las preguntas de la misma ley juntas:
1. LO 3/1981 (Defensor del Pueblo) - Mayor volumen
2. LOTC (Tribunal Constitucional) - Artículos complejos  
3. Reglamentos - Menos frecuentes

### **2. Reutilizar artículos existentes**
```sql
-- Verificar artículos disponibles antes de crear
SELECT article_number, title FROM articles 
WHERE law_id = (SELECT id FROM laws WHERE short_name = 'CODIGO_LEY')
ORDER BY article_number::integer;
```

### **3. Usar UPDATE masivo**
- **1-5 preguntas:** UPDATE individual
- **6+ preguntas:** UPDATE con CASE masivo
- **20+ preguntas:** Dividir en lotes por ley

### **4. Crear artículos uno por uno**
```sql
-- IMPORTANTE: Cada INSERT debe ejecutarse por separado para obtener su ID
-- NO crear múltiples artículos en una sola consulta

-- PASO 1: Crear primer artículo
INSERT INTO articles (...) RETURNING id;
-- Anotar ID devuelto: abc123...

-- PASO 2: Crear segundo artículo  
INSERT INTO articles (...) RETURNING id;
-- Anotar ID devuelto: def456...

-- PASO 3: Usar IDs reales en UPDATE masivo
UPDATE questions SET primary_article_id = CASE
  WHEN id IN (...) THEN 'abc123...'  -- ID real del paso 1
  WHEN id IN (...) THEN 'def456...'  -- ID real del paso 2
END
```

### **4. Validación automática**
```sql
-- Verificar éxito de la reparación
SELECT 
  COUNT(*) as huerfanas_antes,
  COUNT(*) - COUNT(CASE WHEN primary_article_id IS NOT NULL THEN 1 END) as huerfanas_despues
FROM questions 
WHERE created_at >= 'FECHA_INICIO';
```

### **5. Flujo seguro: Verificar → Crear → Anotar → Vincular**
```sql
-- PASO A: Verificar qué artículos faltan
SELECT article_number FROM articles WHERE law_id = (...) AND article_number IN ('1','2','3');

-- PASO B: Crear artículos faltantes UNO POR UNO
INSERT INTO articles (...) WHERE article_number = '1' RETURNING id;
-- Resultado: abc123-def4-5678-9abc-def123456789

INSERT INTO articles (...) WHERE article_number = '2' RETURNING id;  
-- Resultado: xyz789-abc1-2345-6def-abc987654321

-- PASO C: Anotar IDs reales y usar en UPDATE
UPDATE questions SET primary_article_id = CASE
  WHEN id IN ('pregunta-uuid-1', 'pregunta-uuid-2') 
    THEN 'abc123-def4-5678-9abc-def123456789'  -- ID REAL del artículo 1
  WHEN id IN ('pregunta-uuid-3') 
    THEN 'xyz789-abc1-2345-6def-abc987654321'  -- ID REAL del artículo 2
END
```

---

## 📊 **CONSULTAS DE MONITOREO**

### **Estado general:**
```sql
SELECT 
  COUNT(*) as total_preguntas,
  COUNT(CASE WHEN primary_article_id IS NULL THEN 1 END) as huerfanas,
  ROUND(100.0 * COUNT(CASE WHEN primary_article_id IS NOT NULL THEN 1 END) / COUNT(*), 2) as porcentaje_vinculadas
FROM questions;
```

### **Por período:**
```sql
SELECT 
  DATE_TRUNC('day', created_at) as fecha,
  COUNT(*) as preguntas_creadas,
  COUNT(CASE WHEN primary_article_id IS NULL THEN 1 END) as huerfanas
FROM questions 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY 1 
ORDER BY 1 DESC;
```

### **Por ley:**
```sql
SELECT 
  l.short_name,
  COUNT(q.id) as preguntas_vinculadas
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
JOIN laws l ON a.law_id = l.id
GROUP BY l.short_name
ORDER BY 2 DESC;
```

---

## 🎯 **CHECKLIST DE CALIDAD**

### **Antes de empezar:**
- [ ] Backup de la base de datos
- [ ] Identificar fecha de corte para huérfanas recientes
- [ ] Listar todas las leyes que aparecen en las preguntas

### **Durante el proceso:**
- [ ] Verificar existencia de leyes antes de crear
- [ ] Usar contenido oficial del BOE para artículos
- [ ] Probar consultas con LIMIT 1 antes del UPDATE masivo
- [ ] Copiar UUIDs exactos de las consultas de análisis

### **Después del proceso:**
- [ ] Verificar que huérfanas recientes = 0
- [ ] Comprobar que las preguntas vinculadas tienen sentido
- [ ] Documentar nuevas leyes/artículos creados
- [ ] Actualizar esta guía con nuevos patrones encontrados

---

## 📚 **RECURSOS ÚTILES**

### **Fuentes oficiales:**
- **BOE:** https://www.boe.es/buscar/act.php?id=BOE-A-YYYY-NNNNN
- **Tribunal Constitucional:** https://www.tribunalconstitucional.es/
- **Congreso:** https://www.congreso.es/

### **Herramientas:**
- **Supabase SQL Editor** para ejecutar consultas
- **BOE consolidado** para contenido oficial de artículos
- **Regex tester** para detectar patrones en preguntas

---

## 🏆 **RESULTADO ESPERADO**

Al finalizar correctamente:
- ✅ **0 preguntas huérfanas recientes**
- ✅ **Todas las preguntas nuevas vinculadas correctamente**
- ✅ **Base de datos consistente y limpia**
- ✅ **Proceso documentado para futuras reparaciones**

**🎉 ¡Éxito garantizado siguiendo este manual!**