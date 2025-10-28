# 📚 Manual: Estructura de Leyes - Títulos y Secciones

## 🎯 **Objetivo**
Manual para agregar estructura de títulos/capítulos/secciones a las leyes en la base de datos `law_sections`.

---

## 📊 **Tabla: `law_sections`**

### **Campos principales:**
| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `law_id` | uuid | ID de la ley (FK a `laws`) | `218452f5-b9f6-48f0-a25b-26df9cb19644` |
| `section_type` | text | Tipo de sección | `"titulo"`, `"capitulo"`, `"preambulo"` |
| `section_number` | text | Número/ID de la sección | `"I"`, `"II-III"`, `"Preliminar"` |
| `title` | text | Título completo descriptivo | `"Título I. Disposiciones generales"` |
| `description` | text | Descripción del contenido | `"Normas generales del régimen jurídico"` |
| `article_range_start` | integer | Artículo inicial | `1` |
| `article_range_end` | integer | Artículo final | `12` |
| `slug` | text | URL amigable | `"titulo-i-disposiciones-generales"` |
| `order_position` | integer | Orden de aparición | `1`, `2`, `3...` |
| `is_active` | boolean | Activo/Inactivo | `true` |

---

## 🔧 **Proceso paso a paso**

### **1. Obtener law_id de la ley**
```sql
SELECT id, short_name, name 
FROM laws 
WHERE short_name = 'Ley 40/2015';
```

### **2. Consultar estructura oficial**
- **Fuente:** BOE oficial de la ley
- **Verificar:** Títulos, capítulos y rangos de artículos actualizados
- **Ejemplo:** [Ley 40/2015 en BOE](https://www.boe.es/eli/es/l/2015/10/01/40/con)

### **3. Insertar secciones en orden**
```sql
INSERT INTO law_sections (
  law_id, 
  section_type, 
  section_number, 
  title, 
  description, 
  article_range_start, 
  article_range_end, 
  slug, 
  order_position, 
  is_active
) VALUES 
(
  '[law_id_obtenido]',
  'titulo',
  'Preliminar', 
  'Título Preliminar. Disposiciones generales',
  'Principios generales y disposiciones comunes',
  1,
  12,
  'titulo-preliminar-disposiciones-generales',
  1,
  true
);
```

### **4. Verificar inserción**
```sql
SELECT * FROM law_sections 
WHERE law_id = '[law_id]' 
ORDER BY order_position;
```

---

## ✅ **Verificaciones de calidad**

### **Antes de insertar:**
- [ ] **Rangos correctos:** Sin solapamientos entre secciones
- [ ] **Numeración:** `order_position` secuencial (1, 2, 3...)
- [ ] **Slugs únicos:** No duplicados dentro de la misma ley
- [ ] **Títulos oficiales:** Texto exacto del BOE
- [ ] **Artículos existentes:** Verificar que los artículos realmente existen

### **Después de insertar:**
- [ ] **Conteo:** Número correcto de secciones
- [ ] **Funcionalidad:** Modal "Filtrar por Títulos" aparece
- [ ] **Filtrado:** Los filtros funcionan correctamente
- [ ] **Performance:** Consultas rápidas

---

## 🎯 **Ejemplo completo: Ley 40/2015**

### **1. Obtener law_id**
```sql
-- Resultado esperado: law_id para Ley 40/2015
SELECT id FROM laws WHERE short_name = 'Ley 40/2015';
```

### **2. Estructura oficial Ley 40/2015**
*(Basada en BOE oficial)*

| Sección | Artículos | Título |
|---------|-----------|--------|
| **Título Preliminar** | 1-4 | Disposiciones generales |
| **Título I** | 5-8 | Sujetos del sector público |
| **Título II** | 9-16 | Principios de actuación y funcionamiento del sector público |
| **Título III** | 17-24 | Principios de intervención de las Administraciones Públicas |
| **Título IV** | 25-31 | Funcionamiento electrónico del sector público |
| **Título V** | 32-67 | Relaciones interadministrativas |
| **Título VI** | 68-92 | Órganos colegiados |
| **Título VII** | 93-102 | Responsabilidad patrimonial |

### **3. Script de inserción**
```sql
-- Insertar estructura Ley 40/2015
INSERT INTO law_sections (
  law_id, 
  section_type, 
  section_number, 
  title, 
  description, 
  article_range_start, 
  article_range_end, 
  slug, 
  order_position, 
  is_active
) VALUES 
-- Título Preliminar
((SELECT id FROM laws WHERE short_name = 'Ley 40/2015'), 'titulo', 'Preliminar', 'Título Preliminar. Disposiciones generales', 'Objeto, ámbito de aplicación y principios generales', 1, 4, 'titulo-preliminar-disposiciones-generales', 1, true),

-- Título I
((SELECT id FROM laws WHERE short_name = 'Ley 40/2015'), 'titulo', 'I', 'Título I. Del sector público', 'Sujetos comprendidos en el sector público', 5, 8, 'titulo-i-sector-publico', 2, true),

-- Título II  
((SELECT id FROM laws WHERE short_name = 'Ley 40/2015'), 'titulo', 'II', 'Título II. De los principios de actuación y funcionamiento del sector público', 'Principios de organización, funcionamiento y relaciones', 9, 16, 'titulo-ii-principios-actuacion-funcionamiento', 3, true),

-- Título III
((SELECT id FROM laws WHERE short_name = 'Ley 40/2015'), 'titulo', 'III', 'Título III. De los principios de intervención de las Administraciones Públicas', 'Regulación, planificación, programación y control', 17, 24, 'titulo-iii-principios-intervencion', 4, true),

-- Título IV
((SELECT id FROM laws WHERE short_name = 'Ley 40/2015'), 'titulo', 'IV', 'Título IV. Del funcionamiento electrónico del sector público', 'Administración electrónica y medios electrónicos', 25, 31, 'titulo-iv-funcionamiento-electronico', 5, true),

-- Título V
((SELECT id FROM laws WHERE short_name = 'Ley 40/2015'), 'titulo', 'V', 'Título V. De las relaciones interadministrativas', 'Cooperación, colaboración y coordinación administrativa', 32, 67, 'titulo-v-relaciones-interadministrativas', 6, true),

-- Título VI
((SELECT id FROM laws WHERE short_name = 'Ley 40/2015'), 'titulo', 'VI', 'Título VI. De los órganos colegiados de las Administraciones Públicas', 'Funcionamiento y régimen jurídico de órganos colegiados', 68, 92, 'titulo-vi-organos-colegiados', 7, true),

-- Título VII
((SELECT id FROM laws WHERE short_name = 'Ley 40/2015'), 'titulo', 'VII', 'Título VII. De la responsabilidad patrimonial de las Administraciones Públicas', 'Responsabilidad por daños causados por el funcionamiento', 93, 102, 'titulo-vii-responsabilidad-patrimonial', 8, true);
```

### **4. Verificación**
```sql
-- Verificar inserción correcta
SELECT 
  section_number,
  title,
  CONCAT('Arts. ', article_range_start, '-', article_range_end) as rango,
  order_position
FROM law_sections 
WHERE law_id = (SELECT id FROM laws WHERE short_name = 'Ley 40/2015')
ORDER BY order_position;
```

---

## 🔍 **Verificar mapeos de leyes**

### **Consulta de verificación completa**
```sql
-- Leyes en BD vs Mapeos en código
WITH law_mapping_check AS (
  SELECT 
    l.short_name,
    l.name,
    CASE 
      WHEN ls.law_id IS NOT NULL THEN '✅ Con secciones'
      ELSE '❌ Sin secciones'
    END as tiene_secciones,
    COUNT(ls.id) as num_secciones
  FROM laws l
  LEFT JOIN law_sections ls ON l.id = ls.law_id AND ls.is_active = true
  GROUP BY l.id, l.short_name, l.name, ls.law_id
)
SELECT * FROM law_mapping_check 
ORDER BY num_secciones DESC, short_name;
```

### **Leyes que necesitan mapeo en lawMappingUtils.js**
```sql
-- Encontrar leyes sin mapeo aparente
SELECT short_name, name 
FROM laws 
WHERE short_name NOT IN (
  'CE', 'Ley 39/2015', 'Ley 40/2015', 'Ley 19/2013',
  'Ley 7/1985', 'Ley 50/1997', 'RD 364/1995'
  -- Agregar otros mapeos conocidos
)
ORDER BY short_name;
```

---

## 🎯 **Leyes prioritarias para estructurar**

### **Alta prioridad** (más usadas en tests)
1. **Ley 40/2015** - Régimen Jurídico Sector Público ⭐
2. **Ley 19/2013** - Transparencia
3. **Constitución Española** - ✅ Ya estructurada
4. **Ley 39/2015** - ✅ Ya estructurada

### **Media prioridad**
- Ley 7/1985 - Bases Régimen Local
- Ley 50/1997 - Del Gobierno
- LO 6/1985 - Poder Judicial

### **Baja prioridad**
- Real Decretos específicos
- Leyes sectoriales
- Normativa técnica

---

## 🚀 **Estrategia Híbrida: IA + Script**

### **🤖 Enfoque recomendado:**
Después de múltiples pruebas, la **mejor estrategia es híbrida**:
- **IA para crear estructuras** - Precisión y verificación manual
- **Script para detectar cambios** - Monitoreo automático del BOE

### **🎯 ¿Por qué este enfoque?**

#### **💡 IA es mejor para estructuras porque:**
- **📖 Comprende contexto legal** - Entiende títulos, capítulos, rangos
- **🔍 Verifica fuentes oficiales** - Consulta BOE directamente y valida
- **🧠 Detecta errores complejos** - Identifica inconsistencias en rangos
- **⚡ Corrección inmediata** - Responde a feedback y corrige al instante
- **🎯 Precisión por ley** - Cada estructura se verifica individualmente

#### **⚙️ Script es mejor para monitoreo porque:**
- **🔄 Automatización** - Ejecuta verificaciones programadas
- **📊 Detección de cambios** - Compara hashes de contenido BOE
- **⏰ Alertas tempranas** - Notifica cuando una ley se actualiza
- **🔧 Procesamiento masivo** - Revisa múltiples leyes simultáneamente

## 🤖 **Proceso recomendado: IA para estructuras**

### **1. Crear estructura con IA (RECOMENDADO):**
```text
Prompt para Claude:
"Por favor crea la estructura de [LEY] consultando el BOE oficial. 
Verifica los rangos exactos de artículos para cada título."

Ejemplo:
"Crea la estructura de Ley 40/2015 desde BOE oficial"
```

#### **✅ Ventajas del enfoque IA:**
- **🎯 Precisión humana** - Verificación manual de cada rango
- **🔍 Validación BOE** - Consulta directa a fuente oficial
- **⚡ Corrección inmediata** - Respuesta a feedback del usuario
- **📋 Comprensión contextual** - Entiende capítulos, secciones, gaps

### **2. Script para monitoreo de cambios:**
```bash
# ✅ IMPLEMENTADO: Script para detectar cambios en BOE
node scripts/extract-law-structure.js "Ley 39/2015"
node scripts/extract-law-structure.js "Ley 40/2015"

# Verificar todas las leyes con BOE URL
node scripts/extract-law-structure.js
```

#### **⚙️ Funcionalidades del script:**
- ✅ **Descarga BOE oficial** - Obtiene contenido desde URL oficial
- ✅ **Calcula hash de contenido** - Para detectar cambios en la ley
- ✅ **Detección de modificaciones** - Compara con versión anterior
- ✅ **Tracking de cambios** - Actualiza `last_checked` y `content_hash`
- ✅ **Alertas de cambios** - Notifica cuando BOE actualiza contenido
- ✅ **Monitoreo masivo** - Revisa múltiples leyes automáticamente

## 📋 **Flujo de trabajo recomendado:**

### **🔄 Para crear nueva estructura:**
1. **Solicitar a IA:** "Crea estructura de [LEY] desde BOE oficial"
2. **Verificar resultado:** IA consultará BOE y creará estructura
3. **Feedback:** Corregir si hay errores (como hicimos con Ley 39/2015)
4. **Aplicar:** IA insertará estructura corregida en BD

### **📊 Para monitorear cambios:**
```bash
# Verificar si BOE ha actualizado las leyes
node scripts/extract-law-structure.js

# Output esperado:
📚 CE - Verificado: 28/10/2025
📚 Ley 39/2015 - Verificado: 28/10/2025  
📚 Ley 40/2015 - Verificado: 28/10/2025
```

### **⚠️ Si detecta cambios:**
```bash
# Script detectará cambio de hash
🏛️ === PROCESANDO Ley 39/2015 ===
📥 Descargando contenido del BOE...
🔍 ¡CAMBIO DETECTADO! Hash diferente
⚠️ ACCIÓN REQUERIDA: Solicitar a IA revisar estructura

# Entonces solicitar a IA:
"El BOE ha actualizado Ley 39/2015. Por favor revisa 
si hay cambios en la estructura de títulos y artículos."
```

### **Detalles técnicos del script:**

#### **Flujo de trabajo:**
1. **Validación inicial** - Verifica que la ley existe en tabla `laws`
2. **Descarga BOE** - Obtiene contenido HTML desde `boe_url`
3. **Cálculo hash** - Genera SHA256 del contenido para detectar cambios
4. **Estructura de datos** - Aplica estructura manual verificada o extracción automática
5. **Backup de seguridad** - Elimina estructura existente (si hay)
6. **Inserción BD** - Inserta nuevas secciones en tabla `law_sections`
7. **Actualización metadata** - Actualiza `content_hash` y `last_checked` en tabla `laws`

#### **Dependencias del script:**
- `@supabase/supabase-js` - Conexión a base de datos
- `crypto` (Node.js nativo) - Para generar hashes SHA256
- `fetch` (Node.js nativo) - Para descargar contenido BOE

#### **Variables de entorno requeridas:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://yqbpstxowvgipqspqrgo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### **Manejo de errores:**
- **Ley no encontrada** - Error si no existe en tabla `laws`
- **Sin BOE URL** - Error si `boe_url` es null
- **Error descarga** - Maneja problemas HTTP del BOE
- **Error inserción** - Rollback automático si falla la inserción

## 🎯 **Casos de uso específicos:**

### **✅ Estructuras ya verificadas:**
- **Ley 39/2015** ✅ - Estructura corregida y validada con BOE
- **CE** ✅ - Estructura disponible  
- **Ley 40/2015** ✅ - Datos BOE configurados

### **🔄 Próximas estructuras a crear (usar IA):**
```text
Ejemplos de prompts:
"Crea estructura de Ley 40/2015 desde BOE oficial"
"Crea estructura de Ley 19/2013 desde BOE oficial"
"Crea estructura de Ley 7/1985 desde BOE oficial"
```

### **📊 Scripts de ayuda futuros:**
```bash
# Para monitoreo programado
node scripts/check-boe-updates.js

# Para validar integridad
node scripts/validate-law-structures.js

# Para generar reportes
node scripts/law-structure-report.js
```

### **🔧 Mejoras futuras:**
- **Webhook BOE** - Notificación automática de cambios
- **Cron job** - Verificación diaria de hashes
- **Dashboard** - Panel de estado de estructuras
- **API endpoint** - `/api/law-structure-status` para verificaciones

### **Formato JSON para estructuras**
```json
{
  "law_short_name": "Ley 40/2015",
  "sections": [
    {
      "type": "titulo",
      "number": "Preliminar",
      "title": "Título Preliminar. Disposiciones generales",
      "description": "Objeto, ámbito de aplicación y principios generales",
      "article_range": [1, 4],
      "slug": "titulo-preliminar-disposiciones-generales"
    }
  ]
}
```

---

## ⚠️ **Precauciones importantes**

1. **Backup antes de cambios:** Siempre hacer backup de `law_sections`
2. **Verificar artículos:** Comprobar que existen en `articles` table
3. **Testing después:** Probar modal "Filtrar por Títulos" funciona
4. **Performance:** Verificar que consultas siguen siendo rápidas
5. **Consistency:** Mantener formato consistente entre leyes

---

*📝 Manual creado: 28/10/2025*
*🔄 Actualizar cuando se agreguen nuevas leyes*