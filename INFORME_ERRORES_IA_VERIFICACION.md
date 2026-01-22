# Informe: Análisis de Errores en Verificación con IA

**Fecha:** 21 enero 2026
**Fuente:** http://localhost:3000/admin/ai (tabla `ai_verification_errors`)
**Total errores analizados:** 24

---

## 📊 Resumen de Errores

### Por Tipo
| Tipo Error | Cantidad | % |
|------------|----------|---|
| `json_parse` | 16 | 67% |
| `api_error` (Overloaded) | 8 | 33% |

### Por Proveedor
- **Anthropic Claude:** 24 (100%)
- **OpenAI:** 0
- **Google:** 0

### Modelo Utilizado
- **Claude Haiku** (`claude-3-haiku-20240307`): 100% de los errores
- Límite configurado: 4096 tokens de salida

---

## 🔍 Análisis del Problema Principal: JSON Parse Errors

### Root Cause
Los errores de `json_parse` ocurren porque **la respuesta del modelo se trunca** antes de completar el JSON, dejándolo inválido.

### Evidencia
```json
{
  "verifications": [
    {
      "questionId": "d602fe3b-e77f-4515-91d6-5590d9431ced",
      "isCorrect": true,
      "confidence": "alta",
      "explanation": "La respuesta marcada como correcta (D) es efectivamente correcta según el artículo 2 de la Ley 39/2015.",
      "articleQuote": "1. La presente Ley se aplica al sector público, que comprende:\na) La Administración General del Estado.\nb) Las Administraciones de las Comunidades Autónomas.\nc) Las Entidades que integran la Administració
      // ❌ JSON se corta aquí - INVÁLIDO
```

**Error resultante:** `Expected ',' or '}' after property value in JSON at position 1481`

### Causas Específicas

1. **Campo `articleQuote` muy largo**
   - El prompt pide "Cita LITERAL del artículo del BOE" sin límite
   - Algunos artículos son largos (200-500+ caracteres)
   - Consume muchos tokens innecesariamente

2. **Campo `newExplanation` muy extenso**
   - Prompt requiere "mínimo 200 palabras"
   - Con múltiples preguntas, esto multiplica el consumo
   - Ejemplo: 5 preguntas × 200 palabras × 5 tokens/palabra = ~5000 tokens

3. **Batch de múltiples preguntas**
   - El sistema procesa hasta 10 preguntas en un solo request
   - Cada pregunta necesita: `isCorrect` + `explanation` + `articleQuote` + `newExplanation` + `suggestedFix`
   - Total por pregunta: ~600-1000 tokens
   - Total batch (10 preguntas): 6000-10000 tokens requeridos
   - **Límite del modelo: 4096 tokens** ❌

4. **Saltos de línea sin escapar**
   - Aunque el prompt indica usar `\\n`, el modelo a veces incluye saltos literales
   - Esto rompe el JSON incluso si no se trunca

---

## 🛠️ Mejoras Recomendadas

### 1. Limitar Longitud de `articleQuote` (ALTA PRIORIDAD)

**Prompt actual:**
```
"articleQuote": "Cita LITERAL del artículo del BOE que justifica la respuesta"
```

**Prompt mejorado:**
```
"articleQuote": "Cita breve del artículo (MÁXIMO 150 caracteres).
  Incluye solo la parte relevante que justifica la respuesta.
  Si es muy largo, usa '...' para indicar texto omitido."
```

**Impacto:** Reduce ~200-400 tokens por pregunta → ~30-50% menos tokens totales

---

### 2. Reducir Requisito de `newExplanation` (ALTA PRIORIDAD)

**Prompt actual:**
```
"newExplanation": "... mínimo 200 palabras ..."
```

**Prompt mejorado:**
```
"newExplanation": "Explicación DIDÁCTICA y COMPLETA para el alumno (100-150 palabras).
  ESTRUCTURA OBLIGATORIA:
  1. Fundamento legal (cita artículo y ley específicos)
  2. Por qué la opción correcta es válida
  3. Breve análisis de errores en otras opciones
  4. Consejo práctico para recordar

  SÉ CONCISO pero completo. Prioriza CLARIDAD sobre extensión."
```

**Impacto:** Reduce ~400-600 tokens por pregunta → ~40% menos tokens en explicaciones

---

### 3. Reducir Tamaño de Lotes (CRÍTICO)

**Configuración actual:**
```javascript
function getSafeBatchSize(model) {
  // Claude Haiku: 10 preguntas por batch
  if (model.includes('haiku')) return 10
  // ...
}
```

**Configuración mejorada:**
```javascript
function getSafeBatchSize(model) {
  // Claude Haiku: reducir a 5 preguntas por batch
  // Con explicaciones extensas, 10 preguntas exceden los 4096 tokens
  if (model.includes('haiku')) return 5

  // Claude Sonnet: 8 preguntas (tiene 8192 tokens)
  if (model.includes('sonnet')) return 8

  // GPT-4o-mini: 15 preguntas (tiene 16384 tokens)
  if (model.includes('gpt-4o-mini')) return 15

  return 5 // Default conservador
}
```

**Impacto:** Reduce JSON truncado en ~80%

---

### 4. Mejorar Parsing de JSON Truncado (MEDIA PRIORIDAD)

Añadir función de recuperación para JSONs parcialmente válidos:

```javascript
function tryParsePartialJSON(jsonStr) {
  try {
    return JSON.parse(jsonStr)
  } catch (error) {
    // Intentar recuperar JSON truncado
    // Si termina con "..., intentar cerrar el JSON
    let fixed = jsonStr.trim()

    // Si está dentro de un string, cerrarlo
    const openQuotes = (fixed.match(/"/g) || []).length
    if (openQuotes % 2 !== 0) {
      fixed += '"'
    }

    // Contar llaves/corchetes abiertos
    const openBraces = (fixed.match(/\{/g) || []).length
    const closeBraces = (fixed.match(/\}/g) || []).length
    const openBrackets = (fixed.match(/\[/g) || []).length
    const closeBrackets = (fixed.match(/\]/g) || []).length

    // Cerrar arrays abiertos
    for (let i = 0; i < (openBrackets - closeBrackets); i++) {
      fixed += ']'
    }

    // Cerrar objetos abiertos
    for (let i = 0; i < (openBraces - closeBraces); i++) {
      fixed += '}'
    }

    // Intentar parsear de nuevo
    try {
      return JSON.parse(fixed)
    } catch {
      // Si aún falla, devolver null
      return null
    }
  }
}
```

**Impacto:** Recupera ~30-40% de JSONs truncados que de otro modo fallarían

---

### 5. Añadir Recordatorio de Prioridad (BAJA PRIORIDAD)

Al final del prompt, añadir:

```
PRIORIDAD CRÍTICA:
1. Completa el JSON correctamente ANTES de añadir contenido extenso
2. Si te quedas sin tokens, acorta las explicaciones pero CIERRA el JSON
3. Es mejor una explicación más corta pero JSON válido, que una explicación larga truncada
```

---

## 📈 Impacto Esperado de las Mejoras

| Mejora | Reducción de Errores | Esfuerzo |
|--------|---------------------|----------|
| Limitar `articleQuote` | ~40% | Bajo |
| Reducir `newExplanation` | ~30% | Bajo |
| Reducir batch size | ~50% | Muy Bajo |
| Parsing robusto | +30% recuperación | Medio |
| **TOTAL ESTIMADO** | **~70-80% menos errores** | **Bajo-Medio** |

---

## 🎯 Errores API (Overloaded)

### Análisis
- 8 errores de tipo "Overloaded"
- Fecha: 19/12/2025 (concentrados en minutos)
- **Causa:** Rate limiting de Anthropic durante periodo de alta carga

### Solución Actual
Ya existe código de retry (línea 717+ en `ai-verify-article/route.js`)

### Mejora Sugerida
Añadir **exponential backoff**:

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (error.message.includes('Overloaded') && i < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, i), 10000) // Max 10s
        console.log(`⏳ Overloaded, reintentando en ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
      } else {
        throw error
      }
    }
  }
}
```

---

## ✅ Verificaciones ya Implementadas

El código YA tiene estas protecciones (NO necesitan cambios):

1. ✅ **Limpieza de saltos de línea** (líneas 683-689, 792-798)
2. ✅ **Límites por modelo** (función `getMaxOutputTokens`)
3. ✅ **Fallback de parsing** (try-catch con limpieza)
4. ✅ **Logging de errores** (tabla `ai_verification_errors`)

---

## 📋 Plan de Acción Recomendado

### Fase 1: Cambios Rápidos (< 30 min)
1. Reducir batch size de Haiku de 10 → 5
2. Limitar `articleQuote` a 150 caracteres
3. Reducir `newExplanation` de 200 → 100-150 palabras

### Fase 2: Mejoras Robustez (1-2 horas)
4. Implementar `tryParsePartialJSON`
5. Añadir exponential backoff para Overloaded
6. Testing con preguntas que fallaron anteriormente

### Fase 3: Monitoreo (Ongoing)
7. Revisar logs de errores semanalmente
8. Ajustar batch sizes según métricas reales
9. Considerar migrar a Claude Sonnet para casos complejos

---

## 🔗 Referencias

- Tabla BD: `ai_verification_errors`
- Código: `/app/api/verify-articles/ai-verify-article/route.js`
- Admin page: http://localhost:3000/admin/ai
- Errors API: `/api/verify-articles/errors?lawId=...`

---

**Conclusión:** Los errores son predecibles y solucionables con ajustes menores al prompt y configuración. La mayoría son causados por exceder el límite de tokens al procesar demasiadas preguntas con explicaciones extensas en un solo batch.
