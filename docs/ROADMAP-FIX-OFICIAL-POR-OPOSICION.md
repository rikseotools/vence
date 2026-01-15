# ROADMAP: Fix Sistema de Preguntas Oficiales por Oposición

**Fecha:** 2026-01-15
**Estado:** ✅ COMPLETADO

---

## PROBLEMA IDENTIFICADO

Las preguntas marcadas como "oficiales" (`is_official_exam = true`) se muestran a TODOS los usuarios sin importar su oposición. Esto causa que:

1. Un usuario de **Auxiliar Administrativo** vea preguntas oficiales de **Tramitación Procesal**
2. Los **artículos "hot"** no se filtran por oposición del usuario
3. El **badge "Pregunta Oficial"** depende de texto libre inconsistente

### Datos del problema:
- 911 preguntas oficiales en total
- 572 (63%) NO tienen `exam_position` poblado
- 868 de 1000 hot_articles tienen `target_oposicion` NULL
- Valores de `exam_position` no normalizados (8+ variantes)

---

## SOLUCIÓN PROPUESTA

### FASE 1: Filtrar preguntas oficiales en fetchers (CRÍTICA)
**Archivos:** `lib/testFetchers.js`, `lib/lawFetchers.js`

**Cambio:** Cuando `onlyOfficialQuestions = true`, filtrar también por la oposición del usuario usando `exam_position` o parseando `exam_source`.

**Lógica:**
```javascript
if (onlyOfficialQuestions) {
  query = query.eq('is_official_exam', true)

  // NUEVO: Filtrar por oposición
  if (userOposicion) {
    // Mapear slug de oposición a valores válidos de exam_position
    const validPositions = getValidExamPositions(userOposicion)
    // Filtrar: exam_position IN validPositions OR exam_position IS NULL (legacy)
  }
}
```

**Status:** [x] COMPLETADO

---

### FASE 2: Normalizar y poblar `exam_position`
**Tabla:** `questions`

**Acciones:**
1. Crear script para normalizar valores existentes a formato estándar
2. Poblar las 572 preguntas que tienen `exam_position` NULL basándose en `exam_source`

**Mapeo de normalización:**
| Valor actual | Valor normalizado |
|---|---|
| "auxiliar administrativo del estado" | "auxiliar_administrativo_estado" |
| "auxiliar administrativo" | "auxiliar_administrativo_estado" |
| "auxiliar_administrativo" | "auxiliar_administrativo_estado" |
| "Cuerpo General Administrativo..." | "administrativo" |
| "cuerpo_gestion_administracion_civil" | "cuerpo_gestion_administracion_civil" (Gestión A2, diferente oposición) |
| "tramitacion_procesal" | "tramitacion_procesal" |

**Mapeo exam_source → exam_position:**
| Patrón en exam_source | exam_position |
|---|---|
| "Auxiliar Administrativo" | "auxiliar_administrativo_estado" |
| "Tramitación Procesal" o "Tramitaci" | "tramitacion_procesal" |
| "Auxilio Judicial" | "auxilio_judicial" |
| "Gestión Procesal" | "gestion_procesal" |
| "Cuerpo General Administrativo" | "administrativo" |
| "Cuerpo de Gestión A2" | "cuerpo_gestion_administracion_civil" |

**Status:** [x] COMPLETADO

---

### FASE 3: Fix RPC `check_hot_article_for_current_user`
**Ubicación:** Supabase (función RPC)

**Cambio:** Añadir parámetro `target_oposicion_param` y filtrar por él.

**En código:**
```javascript
// TestLayout.js:590
await supabase.rpc('check_hot_article_for_current_user', {
  article_id_param: articleId,
  user_id_param: userId,
  target_oposicion_param: userOposicionSlug  // NUEVO
})
```

**Status:** [x] COMPLETADO (filtro en cliente)

---

### FASE 4: Poblar `target_oposicion` en hot_articles
**Tabla:** `hot_articles`

**Acciones:**
1. Identificar de qué oposición es cada hot_article basándose en las preguntas que lo referencian
2. Actualizar los 868 registros con NULL

**Status:** [x] PARCIAL (duplicados impiden actualización completa)

---

### FASE 5: Mejorar badge de pregunta oficial
**Archivo:** `components/TestLayout.js`

**Cambio:** Usar `exam_position` (campo estructurado) en vez de parsear `exam_source` (texto libre).

**Status:** [x] COMPLETADO

---

## PROGRESO

| Fase | Descripción | Estado |
|---|---|---|
| 1 | Filtrar preguntas oficiales en fetchers | [x] COMPLETADO |
| 2 | Normalizar y poblar exam_position | [x] COMPLETADO - 694 preguntas con valor |
| 3 | Fix RPC check_hot_article | [x] COMPLETADO - Filtro añadido en cliente |
| 4 | Poblar target_oposicion en hot_articles | [x] PARCIAL - Duplicados impiden actualización completa |
| 5 | Mejorar badge pregunta oficial | [x] COMPLETADO - Usa exam_position con fallback |

---

## ESTADO FINAL (2026-01-15)

**Distribución de `exam_position` en preguntas oficiales (911 total):**
| exam_position | Cantidad | Oposición |
|---|---|---|
| auxiliar_administrativo_estado | 227 | Auxiliar Administrativo del Estado (C2) |
| administrativo | 142 | Administrativo del Estado (C1) |
| auxilio_judicial | 205 | Auxilio Judicial |
| tramitacion_procesal | 96 | Tramitación Procesal |
| cuerpo_gestion_administracion_civil | 24 | Gestión Administración Civil (A2) |
| NULL | 217 | Legacy - no determinable |

**Corrección aplicada:** `cuerpo_general_administrativo` → `administrativo` (el nombre correcto de la oposición)

---

## ARCHIVOS A MODIFICAR

### Fase 1:
- `lib/testFetchers.js` - Función de fetch de preguntas
- `lib/lawFetchers.js` - Función de fetch de preguntas por ley
- `app/auxiliar-administrativo-estado/test/test-aleatorio-examen/page.js` - Query directa

### Fase 2:
- `scripts/normalizar-exam-position.cjs` - Script nuevo
- `scripts/poblar-exam-position.cjs` - Script nuevo

### Fase 3:
- Supabase Dashboard - Función RPC
- `components/TestLayout.js` - Llamada a RPC

### Fase 4:
- `scripts/poblar-hot-articles-oposicion.cjs` - Script nuevo

### Fase 5:
- `components/TestLayout.js` - Función isOfficialForUserOposicion

---

## NOTAS IMPORTANTES

1. **Retrocompatibilidad:** Las preguntas con `exam_position = NULL` deben seguir mostrándose (son legacy)
2. **Mapeo de oposiciones:** El slug de la URL (ej: "auxiliar-administrativo-estado") debe mapearse a valores de exam_position
3. **Hot articles:** Requiere acceso a Supabase Dashboard para modificar la RPC

---

## CÓMO CONTINUAR SI SE ROMPE LA SESIÓN

1. Leer este archivo: `docs/ROADMAP-FIX-OFICIAL-POR-OPOSICION.md`
2. Ver qué fases están marcadas como completadas
3. Continuar con la siguiente fase pendiente
4. Actualizar el progreso en este archivo
