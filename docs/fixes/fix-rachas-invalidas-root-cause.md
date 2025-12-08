# Fix: Rachas Inválidas - Causa Raíz y Solución

**Fecha:** 2025-12-08
**Problema:** Usuarios con rachas mayores a sus días en la plataforma
**Afectados:** Inma Corcuera, Carmen Gil Perez, EM TC (y potencialmente otros)

## 🔍 Investigación

### Síntomas
- Usuarios mostrando rachas imposibles
- Ejemplo: Inma con 6 días en plataforma pero 9 días de racha

### Flujo del Sistema (Descubierto)

```
1. Usuario completa pregunta
   ↓
2. INSERT en test_questions
   ↓
3. TRIGGER: trigger_update_user_streak (en test_questions)
   ↓
4. FUNCIÓN: update_user_streak_function()
   ↓
5. FUNCIÓN: calculate_user_streak(user_id)  ← AQUÍ ESTÁ EL BUG
   ↓
6. UPDATE user_streaks con valor calculado
   ↓
7. UserProfileModal lee de user_streaks vía get_user_public_stats RPC
```

### Funciones Involucradas

#### 1. `trigger_update_user_streak`
- **Tabla:** `test_questions`
- **Evento:** `INSERT`
- **Ejecuta:** `update_user_streak_function()`

#### 2. `update_user_streak_function()`
- Obtiene user_id del test
- Llama a `calculate_user_streak(user_id)`
- Actualiza tabla `user_streaks`

#### 3. `calculate_user_streak(user_id)` ⚠️ **FUNCIÓN CON BUG**
```sql
CREATE OR REPLACE FUNCTION public.calculate_user_streak(p_user_id uuid)
RETURNS integer
AS $function$
  DECLARE
    v_streak INTEGER := 0;
    v_days_in_streak INTEGER := 0;
  BEGIN
    -- ❌ PROBLEMA: Revisa hasta 365 días atrás
    FOR i IN 0..365 LOOP
      v_check_date := CURRENT_DATE - i;

      -- Busca actividad en esa fecha
      SELECT EXISTS(...) INTO v_has_activity;

      -- Incrementa racha si hay actividad
      -- ❌ SIN VALIDAR contra user_profiles.created_at
    END LOOP;

    RETURN v_days_in_streak;
  END;
$function$
```

## ❌ El Problema

La función `calculate_user_streak()`:
1. Revisa hasta 365 días hacia atrás
2. Cuenta días con actividad
3. **NO verifica si el usuario existía en esas fechas**
4. **NO limita la racha a días desde user_profiles.created_at**

### Ejemplo Real (Inma):
- `user_profiles.created_at`: 2025-12-01
- Días en plataforma: 7 días
- Días únicos con actividad: 4 días
- **Racha calculada:** 9 días ❌ IMPOSIBLE

## ✅ Solución Implementada

### Cambios en `calculate_user_streak()`:

1. **Obtener fecha de creación del usuario:**
```sql
SELECT created_at INTO v_user_created_at
FROM user_profiles
WHERE id = p_user_id;
```

2. **Calcular máximo de días posibles:**
```sql
v_max_possible_days := DATE_PART('day', CURRENT_DATE - DATE(v_user_created_at))::INTEGER + 1;
```

3. **Limitar loop a días reales:**
```sql
FOR i IN 0..LEAST(365, v_max_possible_days) LOOP
  v_check_date := CURRENT_DATE - i;

  -- 🆕 No revisar fechas anteriores a la creación
  IF v_check_date < DATE(v_user_created_at) THEN
    EXIT;
  END IF;
  ...
END LOOP;
```

4. **Validación final:**
```sql
v_days_in_streak := LEAST(v_days_in_streak, v_max_possible_days);
```

## 📝 Archivo de Fix

**Ubicación:** `scripts/fix-calculate-user-streak-FINAL.sql`

### Qué hace el fix:
1. ✅ Modifica `calculate_user_streak()` con validación contra `created_at`
2. ✅ Actualiza todos los usuarios con rachas inválidas
3. ✅ Verifica que no quedan rachas incorrectas

### Cómo ejecutar:
```bash
# Ejecutar en Supabase SQL Editor
# URL: https://supabase.com/dashboard/project/yqbpstxowvgipqspqrgo/sql/new

# Copiar contenido de:
scripts/fix-calculate-user-streak-FINAL.sql
```

## 🔒 Prevención Futura

Con este fix, el sistema:
- ✅ Valida contra `user_profiles.created_at` en cada cálculo
- ✅ Limita rachas al máximo posible por días en plataforma
- ✅ Previene rachas inválidas en nuevas inserciones
- ✅ Corrige automáticamente valores existentes incorrectos

## 📊 Casos de Prueba

### Caso 1: Usuario nuevo (7 días en plataforma)
- **Antes:** Racha = 9 días ❌
- **Después:** Racha ≤ 7 días ✅

### Caso 2: Usuario activo todos los días desde registro
- **Antes:** Podría calcular más días de los posibles
- **Después:** Racha = días_en_plataforma ✅

### Caso 3: Usuario con gaps en actividad
- **Antes:** Cálculo podía ser incorrecto
- **Después:** Respeta límite de días_en_plataforma ✅

## 🎯 Resultado Esperado

Después de ejecutar el fix:
- Todos los usuarios tendrán `current_streak ≤ días_en_plataforma`
- Todos los usuarios tendrán `longest_streak ≤ días_en_plataforma`
- Los nuevos cálculos serán siempre válidos
- No se volverán a generar rachas imposibles

## 🔗 Archivos Relacionados

- `scripts/fix-calculate-user-streak-FINAL.sql` - Fix definitivo
- `scripts/fix-all-invalid-streaks.js` - Fix temporal anterior
- `scripts/investigate-inma-streak-issue.js` - Investigación inicial
- `components/UserProfileModal.js:42` - Donde se muestran las rachas
- `utils/testAnalytics.js:115` - Donde se completan los tests
