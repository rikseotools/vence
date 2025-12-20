# 🐛 Informe de Bugs del Ranking de Opositores

**Fecha:** 23 Noviembre 2025
**Archivo:** `components/RankingModal.js`
**Reportado por:** Usuario (menos opositores en mensual que en semanal)

---

## 📋 Resumen Ejecutivo

Se han identificado **4 bugs críticos** en el sistema de ranking que pueden causar comportamientos inesperados, incluyendo el problema reportado de "menos usuarios en ranking mensual que en semanal".

---

## 🐛 BUG #1: Inconsistencia de Zona Horaria (CRÍTICO)

### 📍 Ubicación
`RankingModal.js:58-68`

### ❌ Problema
Los filtros **WEEK** y **MONTH** usan diferentes métodos para calcular fechas:

```javascript
// WEEK - usa hora LOCAL
const monday = new Date()
monday.setHours(0, 0, 0, 0) // ← Hora local
dateFilter = monday.toISOString()

// MONTH - usa UTC directamente
const firstDayOfMonth = new Date(Date.UTC(...)) // ← UTC
dateFilter = firstDayOfMonth.toISOString()
```

### 📊 Impacto
- **Week**: `2025-01-19T23:00:00.000Z` (en GMT+1) → Incluye respuestas del domingo 19 desde las 23:00
- **Month**: `2025-01-01T00:00:00.000Z` → Correcto, desde las 00:00 UTC

**Resultado:** Week está incluyendo respuestas de 1 hora del domingo anterior que NO deberían estar.

### ✅ Solución
```javascript
// WEEK - usar UTC como Month
const monday = new Date()
const dayOfWeek = monday.getDay() === 0 ? 6 : monday.getDay() - 1
monday.setUTCDate(monday.getUTCDate() - dayOfWeek)
monday.setUTCHours(0, 0, 0, 0) // ← Usar UTC
dateFilter = monday.toISOString()
```

---

## 🐛 BUG #2: Filtro Mínimo Incorrecto (CRÍTICO)

### 📍 Ubicación
`RankingModal.js:137` vs línea `655`

### ❌ Problema
**Discrepancia entre código y UI:**

```javascript
// CÓDIGO (línea 137)
.filter(user => user.totalQuestions >= 1) // ← Filtra por >= 1

// UI (línea 655)
<p className="text-xs text-gray-500">
  Mínimo 5 preguntas para aparecer en el ranking
</p>
```

### 📊 Impacto
- Usuarios con 1-4 preguntas aparecen en el ranking
- El UI miente al usuario sobre el requisito mínimo
- Inconsistencia con `rankingMedals.js:235` que SÍ usa `>= 5`

### ✅ Solución
```javascript
// Cambiar línea 137
.filter(user => user.totalQuestions >= 5) // ← Usar 5 como dice el UI
```

---

## 🐛 BUG #3: Limit Puede Cortar Usuarios (MODERADO)

### 📍 Ubicación
`RankingModal.js:92`

### ❌ Problema
La query tiene un `.limit(100000)` que limita RESPUESTAS, no usuarios:

```javascript
const { data: responses, error } = await supabase
  .from('test_questions')
  .select(...)
  .order('created_at', { ascending: false }) // ← Más reciente primero
  .limit(100000) // ← Limita respuestas totales
```

### 📊 Impacto
Si Month tiene > 100,000 respuestas:
1. Se ordenan por fecha DESC (más recientes primero)
2. Se toman las primeras 100,000
3. Las respuestas más antiguas (principio de mes) se cortan
4. Usuarios que solo respondieron al principio del mes **desaparecen del ranking**

**Escenario real:**
- Plataforma activa: 100 usuarios/día × 50 preguntas × 30 días = **150,000 respuestas**
- Month: Se cortan 50,000 respuestas antiguas → **Se pierden ~1000 usuarios del principio del mes**
- Week: Solo tiene ~35,000 respuestas → Obtiene todas

**Resultado:** Month puede tener menos usuarios que Week.

### ✅ Solución

**Opción 1: Eliminar el limit (recomendado)**
```javascript
const { data: responses, error } = await supabase
  .from('test_questions')
  .select(...)
  .gte('created_at', dateFilter)
  // Sin .limit() - obtener todas las respuestas del período
```

**Opción 2: Aumentar considerablemente el limit**
```javascript
.limit(1000000) // 1 millón de respuestas (suficiente para meses completos)
```

**Opción 3: Agregar en Postgres con RPC (más eficiente)**
```sql
CREATE OR REPLACE FUNCTION get_ranking_stats(
  p_start_date timestamptz,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  total_questions bigint,
  correct_answers bigint,
  accuracy numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.user_id,
    COUNT(*)::bigint as total_questions,
    COUNT(*) FILTER (WHERE tq.is_correct)::bigint as correct_answers,
    ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) as accuracy
  FROM test_questions tq
  INNER JOIN tests t ON t.id = tq.test_id
  WHERE tq.created_at >= p_start_date
    AND (p_end_date IS NULL OR tq.created_at <= p_end_date)
  GROUP BY t.user_id
  HAVING COUNT(*) >= 5;
END;
$$ LANGUAGE plpgsql;
```

---

## 🐛 BUG #4: Order By Innecesario y Costoso (MENOR)

### 📍 Ubicación
`RankingModal.js:80`

### ❌ Problema
```javascript
.order('created_at', { ascending: false })
```

Este `ORDER BY` es innecesario porque:
1. Las respuestas se van a procesar todas de todas formas
2. El orden final se hace en JavaScript (línea 142-146)
3. Añade costo computacional en Postgres

### ✅ Solución
```javascript
let query = supabase
  .from('test_questions')
  .select(...)
  // Eliminar .order() - no es necesario
```

---

## 📊 Tests Creados

Se han creado 3 suites de tests para verificar los bugs:

1. **`__tests__/ranking-filters.test.js`**
   - ✅ Verifica cálculos de fecha para cada filtro
   - ❌ Detecta problema de zona horaria en Week
   - ❌ Detecta discrepancia filtro >= 1 vs >= 5

2. **`__tests__/ranking-bug-simulation.test.js`**
   - ✅ Simula diferentes zonas horarias
   - ✅ Demuestra inclusión incorrecta de respuestas del domingo en Week

3. **`__tests__/ranking-limit-bug.test.js`**
   - ✅ Demuestra cómo limit(100000) puede cortar usuarios
   - ✅ Simula escenario con 115,000 respuestas

Para ejecutar:
```bash
npm test -- __tests__/ranking-filters.test.js
npm test -- __tests__/ranking-bug-simulation.test.js
npm test -- __tests__/ranking-limit-bug.test.js
```

---

## 🔧 Soluciones Propuestas - Orden de Implementación

### 1️⃣ **Prioridad ALTA - Arreglar zona horaria en Week**

```javascript
// RankingModal.js:58-64
} else if (timeFilter === 'week') {
  // Esta semana - desde el lunes 0:00 UTC
  const monday = new Date()
  const dayOfWeek = monday.getUTCDay() === 0 ? 6 : monday.getUTCDay() - 1
  monday.setUTCDate(monday.getUTCDate() - dayOfWeek)
  monday.setUTCHours(0, 0, 0, 0) // ← Usar UTC
  dateFilter = monday.toISOString()
}
```

### 2️⃣ **Prioridad ALTA - Cambiar filtro mínimo a 5 preguntas**

```javascript
// RankingModal.js:137
const rankingData = Object.values(userStats)
  .filter(user => user.totalQuestions >= 5) // ← Cambiar de 1 a 5
  .map(user => ({
    ...user,
    accuracy: Math.round((user.correctAnswers / user.totalQuestions) * 100)
  }))
```

### 3️⃣ **Prioridad MEDIA - Eliminar limit o aumentarlo**

```javascript
// RankingModal.js:92
const { data: responses, error } = await query
  // Sin .limit() - obtener todas las respuestas
```

O si prefieres mantener un límite por seguridad:

```javascript
const { data: responses, error } = await query.limit(1000000)
```

### 4️⃣ **Prioridad BAJA - Eliminar ORDER BY innecesario**

```javascript
// RankingModal.js:73-80
let query = supabase
  .from('test_questions')
  .select(`
    tests!inner(user_id),
    is_correct,
    created_at
  `)
  // Eliminar .order() - no es necesario
```

---

## 🎯 Impacto de las Soluciones

| Bug | Impacto | Solución | Esfuerzo |
|-----|---------|----------|----------|
| #1 Zona horaria | 🔴 ALTO - Week incluye datos incorrectos | Usar UTC en Week | 5 min |
| #2 Filtro mínimo | 🔴 ALTO - UI inconsistente, usuarios con 1-4 preguntas | Cambiar >= 1 a >= 5 | 2 min |
| #3 Limit corta usuarios | 🟡 MEDIO - Month puede perder usuarios antiguos | Eliminar limit o aumentarlo | 2 min |
| #4 ORDER BY | 🟢 BAJO - Costo computacional innecesario | Eliminar ORDER BY | 1 min |

**Tiempo total de implementación: ~10 minutos**

---

## ✅ Checklist de Verificación Post-Fix

Después de implementar las soluciones:

- [ ] Ejecutar los 3 test suites y verificar que pasen
- [ ] Verificar en producción que Month tiene >= usuarios que Week
- [ ] Verificar que solo usuarios con >= 5 preguntas aparecen
- [ ] Verificar que Week NO incluye respuestas del domingo anterior
- [ ] Verificar que los conteos son consistentes entre filtros
- [ ] Monitorear performance de queries (sin ORDER BY debería mejorar)

---

## 📝 Notas Adicionales

### Comparación con `rankingMedals.js`

El archivo `lib/services/rankingMedals.js` tiene una implementación **más correcta**:
- ✅ Usa `>= 5` preguntas (línea 235)
- ✅ Siempre usa `start` y `end` dates (línea 208-209)
- ❌ Pero NO tiene el mismo problema de zona horaria porque recibe las fechas ya calculadas

**Recomendación:** Considerar unificar la lógica de ranking entre ambos archivos para evitar inconsistencias futuras.

---

## 🔗 Referencias

- Tests unitarios: `__tests__/ranking-*.test.js`
- Código principal: `components/RankingModal.js`
- Servicio de medallas: `lib/services/rankingMedals.js`
- Documentación de Supabase: https://supabase.com/docs/reference/javascript/limit
