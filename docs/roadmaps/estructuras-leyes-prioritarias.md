# 🏛️ Roadmap: Estructuras de Leyes Prioritarias

## 🎯 **Objetivo**
Crear estructuras de títulos/capítulos para las 8 leyes más importantes que tienen muchas preguntas pero carecen de organización por secciones.

---

## 📊 **Leyes Seleccionadas** *(Total: 360+ preguntas sin estructura)*

### **🥇 ALTA PRIORIDAD**
| Ley | Artículos | Preguntas | BOE URL | Prioridad |
|-----|-----------|-----------|---------|-----------|
| **Ley 47/2003** - General Presupuestaria | 49 | **103** | ✅ | 🔥 Crítica |
| **RDL 5/2015** - Estatuto Básico Empleado Público | 132 | **198** | ❌ | 🔥 Crítica |
| **LO 3/2018** - LOPDGDD | 22 | **68** | ✅ | 🔥 Crítica |
| **Reglamento UE 2016/679** - RGPD | 35 | **108** | ❌ | 🔥 Crítica |

### **🥈 MEDIA PRIORIDAD**
| Ley | Artículos | Preguntas | BOE URL | Prioridad |
|-----|-----------|-----------|---------|-----------|
| **LO 3/2007** - Igualdad mujeres/hombres | 21 | **31** | ✅ | 🟡 Alta |
| **LO 3/1981** - Defensor del Pueblo | 15 | **33** | ✅ | 🟡 Alta |
| **Ley 29/1998** - Jurisdicción Contencioso-administrativa | 21 | **25** | ✅ | 🟡 Alta |
| **LO 1/2004** - Violencia de Género | 13 | **23** | ✅ | 🟡 Alta |

**Total impacto:** 308 artículos organizados | 589 preguntas mejoradas

---

## 📅 **Cronograma por Fases**

### **🔥 FASE 1: Leyes Críticas** *(4-5 horas)*
**Orden: Impacto vs. Complejidad**

#### **1.1 LO 3/2018 - LOPDGDD** *(45 min)*
- ✅ **22 artículos, 68 preguntas, CON BOE**
- **Estructura esperada:** ~4-5 títulos
- **Metodología:** Buscar "TÍTULO" en BOE
- **Complejidad:** BAJA (pocos artículos, estructura clara)

#### **1.2 Ley 29/1998 - Jurisdicción Contencioso-administrativa** *(45 min)*
- ✅ **21 artículos, 25 preguntas, CON BOE**
- **Estructura esperada:** ~3-4 títulos
- **Metodología:** Buscar "TÍTULO" en BOE
- **Complejidad:** BAJA (similar a LO 3/2018)

#### **1.3 Ley 47/2003 - General Presupuestaria** *(1.5 horas)*
- ✅ **49 artículos, 103 preguntas, CON BOE**
- **Estructura esperada:** ~6-8 títulos
- **Metodología:** Buscar "TÍTULO" en BOE
- **Complejidad:** MEDIA (más artículos, más preguntas)

#### **1.4 RDL 5/2015 - Estatuto Básico Empleado Público** *(2 horas)*
- ❌ **132 artículos, 198 preguntas, SIN BOE**
- **Acción previa:** Buscar URL BOE oficial
- **Estructura esperada:** ~8-12 títulos
- **Complejidad:** ALTA (muchos artículos, sin BOE directo)

### **🟡 FASE 2: Leyes Importantes** *(3-4 horas)*
**Orden: Menor complejidad primero**

#### **2.1 LO 1/2004 - Violencia de Género** *(30 min)*
- ✅ **13 artículos, 23 preguntas, CON BOE**
- **Estructura esperada:** ~2-3 títulos
- **Complejidad:** MUY BAJA

#### **2.2 LO 3/1981 - Defensor del Pueblo** *(45 min)*
- ✅ **15 artículos, 33 preguntas, CON BOE**
- **Estructura esperada:** ~3-4 títulos
- **Complejidad:** BAJA

#### **2.3 LO 3/2007 - Igualdad mujeres/hombres** *(1 hora)*
- ✅ **21 artículos, 31 preguntas, CON BOE**
- **Estructura esperada:** ~4-5 títulos
- **Complejidad:** BAJA-MEDIA

#### **2.4 Reglamento UE 2016/679 - RGPD** *(1.5 horas)*
- ❌ **35 artículos, 108 preguntas, SIN BOE**
- **Acción previa:** Buscar fuente oficial UE
- **Estructura esperada:** ~6-8 capítulos
- **Complejidad:** MEDIA (normativa UE, no BOE español)

---

## 🛠️ **Metodología de Trabajo**

### **📋 Proceso estándar por ley:**

#### **Paso 1: Investigación** *(5-10 min)*
```bash
1. Verificar BOE URL oficial
2. Abrir BOE en navegador
3. Buscar palabra "TÍTULO" en página
4. Contar títulos/capítulos existentes
```

#### **Paso 2: Extracción con metodología TÍTULO** *(10-20 min)*
```bash
1. Para cada "TÍTULO" encontrado:
   - Anotar artículo ANTES del título
   - Anotar artículo DESPUÉS del título
   - Determinar rango exacto
2. Verificar continuidad (sin gaps)
3. Identificar nombres oficiales completos
```

#### **Paso 3: Script de inserción** *(10-15 min)*
```javascript
// Crear script usando template:
// scripts/add-[ley-nombre]-structure.js

function get[Ley]Structure() {
  return [
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. [Nombre oficial]',
      description: '[Descripción]',
      article_range_start: X,
      article_range_end: Y,
      slug: '[ley]-titulo-i-[slug]',
      order_position: 1
    }
    // ... más títulos
  ]
}
```

#### **Paso 4: Ejecución y verificación** *(5-10 min)*
```bash
1. Ejecutar script de inserción
2. Verificar en BD con query
3. Probar filtros en UI
4. Confirmar funcionamiento correcto
```

---

## 🎯 **Templates de Scripts**

### **Template BOE (con URL)**
```javascript
// scripts/add-[ley]-structure.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function get[Ley]Structure() {
  // Estructura extraída con metodología TÍTULO
  return [
    // ... títulos con rangos exactos
  ]
}

async function insert[Ley]Structure() {
  try {
    console.log('🏛️ === CREANDO ESTRUCTURA [LEY] ===')
    
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', '[LEY_SHORT_NAME]')
      .single()
    
    if (lawError || !law) {
      throw new Error('[LEY] no encontrada')
    }
    
    // Eliminar estructura anterior si existe
    await supabase.from('law_sections').delete().eq('law_id', law.id)
    console.log('🗑️ Estructura anterior eliminada')
    
    // Insertar nueva estructura
    const structure = get[Ley]Structure()
    
    for (const section of structure) {
      const { error: insertError } = await supabase
        .from('law_sections')
        .insert({ law_id: law.id, ...section, is_active: true })
      
      if (insertError) {
        throw new Error(`Error: ${insertError.message}`)
      }
      
      console.log('✅', section.title, `(Arts. ${section.article_range_start}-${section.article_range_end})`)
    }
    
    console.log(`\n🎉 ESTRUCTURA [LEY] CREADA EXITOSAMENTE`)
    console.log('📊 Total títulos:', structure.length)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

insert[Ley]Structure()
```

### **Template Sin BOE (requiere investigación)**
```javascript
// Mismo template pero añadir:
// 1. Buscar BOE URL oficial primero
// 2. Comentar fuente utilizada
// 3. Proceso de verificación adicional
```

---

## 📊 **URLs BOE conocidas**

### **✅ Con BOE URL confirmada:**
- **LO 3/2018:** `https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673`
- **Ley 29/1998:** `https://www.boe.es/buscar/act.php?id=BOE-A-1998-16718`
- **Ley 47/2003:** `https://www.boe.es/buscar/act.php?id=BOE-A-2003-21614`
- **LO 3/2007:** `https://www.boe.es/buscar/act.php?id=BOE-A-2007-6115`
- **LO 3/1981:** `https://www.boe.es/buscar/act.php?id=BOE-A-1981-9375`
- **LO 1/2004:** `https://www.boe.es/buscar/act.php?id=BOE-A-2004-21760`

### **❌ Requieren búsqueda:**
- **RDL 5/2015** - Estatuto Básico Empleado Público
- **Reglamento UE 2016/679** - RGPD (fuente oficial UE)

---

## 🔍 **Verificaciones de Calidad**

### **Por cada ley completada:**
- [ ] **Rangos continuos** - Sin gaps entre títulos
- [ ] **Slugs únicos** - Prefijo por ley para evitar duplicados
- [ ] **Títulos oficiales** - Texto exacto del BOE
- [ ] **Artículos existentes** - Verificar que coinciden con BD
- [ ] **UI funcional** - Modal "Filtrar por Títulos" aparece
- [ ] **Performance** - Consultas rápidas sin impacto

### **Verificación global final:**
```sql
-- Verificar todas las estructuras creadas
SELECT 
  l.short_name,
  COUNT(ls.id) as titulos_creados,
  MIN(ls.article_range_start) as primer_articulo,
  MAX(ls.article_range_end) as ultimo_articulo
FROM laws l
JOIN law_sections ls ON l.id = ls.law_id
WHERE l.short_name IN (
  'Ley 47/2003', 'RDL 5/2015', 'LO 3/2018', 'Reglamento UE 2016/679',
  'LO 3/2007', 'LO 3/1981', 'Ley 29/1998', 'LO 1/2004'
)
GROUP BY l.id, l.short_name
ORDER BY titulos_creados DESC;
```

---

## 🚀 **Impacto Esperado**

### **📈 Mejoras en UX:**
- **Modal "Filtrar por Títulos"** aparece en 8 leyes adicionales
- **Navegación específica** por secciones de cada ley
- **Tests más organizados** por áreas temáticas
- **Estudio dirigido** a títulos específicos

### **📊 Métricas de éxito:**
- **100% leyes prioritarias** con estructura
- **589 preguntas** mejor organizadas
- **308 artículos** navegables por títulos
- **8 filtros nuevos** en configurador de tests

### **⏱️ Tiempo total estimado:**
- **Fase 1 (críticas):** 4-5 horas
- **Fase 2 (importantes):** 3-4 horas
- **Total proyecto:** 7-9 horas

---

## 🎯 **Orden de Ejecución Recomendado**

### **Primera sesión (2-3 horas):**
1. LO 3/2018 - LOPDGDD
2. Ley 29/1998 - Jurisdicción Contencioso-administrativa  
3. LO 1/2004 - Violencia de Género

### **Segunda sesión (2-3 horas):**
4. LO 3/1981 - Defensor del Pueblo
5. LO 3/2007 - Igualdad mujeres/hombres
6. Ley 47/2003 - General Presupuestaria

### **Tercera sesión (3-4 horas):**
7. RDL 5/2015 - Estatuto Básico Empleado Público
8. Reglamento UE 2016/679 - RGPD

---

## ✅ **Checklist de Progreso**

### **🔥 Fase 1 - Críticas:**
- [ ] LO 3/2018 - LOPDGDD
- [ ] Ley 29/1998 - Jurisdicción Contencioso-administrativa
- [ ] Ley 47/2003 - General Presupuestaria  
- [ ] RDL 5/2015 - Estatuto Básico Empleado Público

### **🟡 Fase 2 - Importantes:**
- [ ] LO 1/2004 - Violencia de Género
- [ ] LO 3/1981 - Defensor del Pueblo
- [ ] LO 3/2007 - Igualdad mujeres/hombres
- [ ] Reglamento UE 2016/679 - RGPD

### **📊 Verificaciones finales:**
- [ ] Todas las estructuras funcionan correctamente
- [ ] Modal "Filtrar por Títulos" aparece en las 8 leyes
- [ ] Performance mantenida o mejorada
- [ ] Tests de filtrado funcionan correctamente

---

*📝 Roadmap creado: 28/10/2025*
*🎯 Ready para ejecución por fases*
*⚡ Enfoque: Máximo impacto con metodología probada*