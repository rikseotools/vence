# 📋 MANUAL COMPLETO - CORRECCIÓN PREGUNTAS AUDITORÍA

## 🎯 **PROCESO OBLIGATORIO PASO A PASO**

### **PASO 1: ANÁLISIS INICIAL**
```sql
-- SQL estándar para analizar cualquier pregunta
SELECT 
  '📄 PREGUNTA X/42:' as titulo,
  q.question_text as pregunta,
  'A) ' || q.option_a as opcion_a,
  'B) ' || q.option_b as opcion_b,
  'C) ' || q.option_c as opcion_c,
  'D) ' || q.option_d as opcion_d,
  CASE q.correct_option 
    WHEN 0 THEN 'A) ' || q.option_a
    WHEN 1 THEN 'B) ' || q.option_b
    WHEN 2 THEN 'C) ' || q.option_c
    WHEN 3 THEN 'D) ' || q.option_d
  END as respuesta_marcada,
  q.explanation as explicacion,
  'Art. ' || a.article_number || ' - ' || a.title as articulo_info
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
WHERE q.id = 'ID_PREGUNTA';
```

### **PASO 2: VERIFICAR SI NECESITO ARTÍCULOS**
**🧠 ANÁLISIS INTELIGENTE:**
- ✅ **Si pregunta sobre estructura/fechas/general** → NO necesito verificar artículos específicos
- ✅ **Si pregunta se puede responder con artículo asignado** → SÍ verificar ese artículo
- ✅ **Si pregunta menciona contenido específico de artículos** → SÍ verificar esos artículos

```sql
-- Solo si es necesario verificar contenido actual en BD
SELECT article_number, title, content, LENGTH(content) as longitud
FROM articles 
WHERE article_number = 'NUM_ART' 
  AND law_id = (SELECT id FROM laws WHERE short_name = 'LEY');
```

### **PASO 3: SOLICITAR BOE SOLO SI ES NECESARIO**
**🚨 REGLA INTELIGENTE:** 
- **Solo pedir BOE** si necesito verificar contenido específico del artículo
- **Si 2 artículos relevantes → pedir ambos**
- **Si pregunta estructura/general → ir directo a artículo 0**
- **Verificar conversación** antes de pedir (puede ya estar dado)

*"Por favor proporciona el **contenido completo del artículo X CE del BOE oficial**."*

### **PASO 4: ACTUALIZAR ARTÍCULOS**
```sql
-- Actualizar SIEMPRE con contenido BOE
UPDATE articles 
SET 
  title = 'Título oficial BOE',
  content = 'Contenido oficial con

saltos de línea

y formato legible',
  updated_at = NOW(),
  verification_date = CURRENT_DATE,
  is_verified = true
WHERE article_number = 'NUM' 
  AND law_id = (SELECT id FROM laws WHERE short_name = 'LEY');
```

### **PASO 5: ANÁLISIS LÓGICO**
1. ✅ **Correspondencia:** ¿Pregunta se responde con artículo asignado?
2. ✅ **Respuesta:** ¿Es correcta según artículo actualizado?
3. ✅ **Explicación:** ¿Es precisa y completa?

### **PASO 6: APLICAR SOLUCIÓN**

#### **🔧 SOLUCIONES PERMITIDAS:**

**A) REASIGNAR A ARTÍCULO 0** *(Estructura/Fechas/General)*
```sql
UPDATE questions 
SET primary_article_id = (SELECT id FROM articles WHERE article_number = '0' AND law_id = (SELECT id FROM laws WHERE short_name = 'CE')),
    updated_at = NOW()
WHERE id = 'ID_PREGUNTA';
```

**B) CORREGIR RESPUESTA**
```sql
UPDATE questions 
SET correct_option = X, -- 0=A, 1=B, 2=C, 3=D
    updated_at = NOW()
WHERE id = 'ID_PREGUNTA';
```

**C) MEJORAR EXPLICACIÓN** *(SIEMPRE)*
```sql
UPDATE questions 
SET explanation = 'Explicación completa con análisis por descarte: opción A... opción B... opción C... Solo la opción X es correcta porque...',
    updated_at = NOW()
WHERE id = 'ID_PREGUNTA';
```

### **PASO 7: ACTUALIZAR PROGRESO**
```sql
-- Solo cambiar línea necesaria (ahorrar tokens)
| `ID_ANTERIOR` | ✅ ARREGLADO |
| `ID_SIGUIENTE` | ⏳ EN ANÁLISIS |
```

---

## 🚨 **REGLAS ABSOLUTAS**

### **✅ OBLIGATORIO:**
- ✅ **SIEMPRE** pedir artículos BOE oficiales
- ✅ **SIEMPRE** actualizar BD antes de analizar
- ✅ **SIEMPRE** verificar si ya tengo el artículo en conversación
- ✅ **SIEMPRE** análisis por descarte en explicaciones
- ✅ **SIEMPRE** mejorar explicación para que sea más clara

### **❌ PROHIBIDO:**
- ❌ **NUNCA** eliminar preguntas como solución
- ❌ **NUNCA** asumir contenido sin verificar BOE
- ❌ **NUNCA** usar `rewrite` completo en progreso (usar `update`)

---

## 📊 **CASOS DE USO ARTÍCULO 0**

**Preguntas SIN artículo literal específico:**
- 📊 Estructura constitucional (títulos, capítulos, secciones)
- 📅 Fechas históricas (publicación, reformas)
- 🔢 Datos numéricos (169 artículos, disposiciones)
- 📋 Conocimiento general constitucional

---

## 🔄 **FLUJO OPTIMIZADO**

```
1. SQL análisis pregunta
2. SQL verificar artículo(s) BD
3. Pedir BOE oficial(es)
4. Actualizar artículo(s) BD
5. Análisis lógico completo
6. Aplicar solución correcta
7. Update progreso (1 línea)
```

---

## 📝 **SEGUIMIENTO PROGRESO**

### **PROGRESO: 18/42 arregladas (42.9%)**

| ID Pregunta | Estado |
|-------------|--------|
| `88bd6a7e-3b6f-4e0e-bab9-358583e22def` | ✅ ARREGLADO |
| `68bb1e9c-9dcd-47ad-bb48-6974ba80a17b` | ✅ ARREGLADO |
| `e4aab24d-02d9-43f3-ab71-9a6725f93857` | ✅ ARREGLADO |
| `06b4b2b8-396a-44e9-a2ba-2448153d7ab7` | ✅ ARREGLADO |
| `67786f29-59a8-41d9-9213-892692d2371a` | ✅ ARREGLADO |
| `a749b684-ccde-49ac-a0d1-d83234a5b1b3` | ✅ ARREGLADO |
| `1ea9beef-af32-4d6f-adc4-c8b85fa3fcff` | ✅ ARREGLADO |
| `99b725b5-33b8-4ba5-943c-1c2fd11fbcc6` | ✅ ARREGLADO |
| `89a367ce-b6fa-410c-8e20-0f0bf137afa4` | ✅ ARREGLADO |
| `c2dee3e3-3181-4304-8cbd-628957173886` | ✅ ARREGLADO |
| `e4af18b5-4101-40c1-becb-37e440b15b72` | ✅ ARREGLADO |
| `7ab274a7-517f-4dc5-8af5-5bf72438c07f` | ✅ ARREGLADO |
| `c0788dd9-2a74-4465-ac02-2151841dd6ed` | ✅ ARREGLADO |
| `bc761702-fb47-4f09-977e-fc4def2c4db6` | ✅ ARREGLADO |
| `9d7ac230-514b-4ab4-ac4e-d20347f48557` | ✅ ARREGLADO |
| `96e24da8-ab7b-44dc-9ba6-b2de28fa2c06` | ✅ ARREGLADO |
| `885e507e-50ee-484f-80e3-da2c4cbe2f26` | ✅ ARREGLADO |
| `f5a9a11d-1232-4e55-b6ac-3767e762c934` | ✅ ARREGLADO |
| `27290fdb-3be5-4405-b666-8955e680d972` | ⏳ EN ANÁLISIS |

**PRÓXIMA:** `27290fdb-3be5-4405-b666-8955e680d972`

---

## 🎯 **ESTE MANUAL CUBRE TODO EL PROCESO ESTABLECIDO**

✅ Revisión auditoría y topic scope  
✅ SQL análisis pregunta individual  
✅ Verificación artículos BD  
✅ Solicitud BOE obligatoria  
✅ Actualización BD antes de análisis  
✅ Análisis lógico completo  
✅ Soluciones (nunca eliminar)  
✅ Seguimiento progreso conciso  
✅ Artículo 0 para estructura/general  
✅ Múltiples artículos (pedir todos)  
✅ Mejorar explicaciones siempre  
✅ Verificar conversación previa