# Roadmap: Conocimiento Transferible entre Oposiciones

> **Fecha:** 2026-02-03
> **Estado:** Documentado para implementación futura
> **Prioridad:** Baja (mejora de UX)

## 1. Contexto del Problema

### 1.1 Bug Original (Corregido 2026-02-03)

La función `get_theme_performance_by_scope` tenía un bug que **inflaba las estadísticas 6x**:

**Síntoma reportado:**
- Nila reportó que veía "miles de preguntas esta semana" que no había hecho
- Caché mostraba 196,410 preguntas vs 33,297 reales

**Causa raíz:**
```sql
-- BUG: El JOIN usaba topic_number (duplicado por oposición)
INNER JOIN topics top ON top.topic_number = rwt.topic_number
```

Como hay 4 oposiciones con el mismo `topic_number` (ej: Tema 1 existe en auxiliar, administrativo, auxilio_judicial, tramitacion_procesal), cada respuesta se multiplicaba por 4.

**Fix aplicado:**
1. Eliminado el JOIN problemático
2. Añadido filtro por `position_type` del usuario
3. La función ahora solo cuenta respuestas para topics de la oposición del usuario

**Archivos de migración:**
- `database/migrations/fix_theme_performance_by_scope_multiplication.sql`
- `database/migrations/fix_theme_performance_filter_by_oposicion.sql`

### 1.2 El Concepto de Conocimiento Transferible

Muchos artículos son compartidos entre oposiciones:

| Estadística | Valor |
|-------------|-------|
| Total artículos en topic_scope | 4,928 |
| Artículos compartidos entre oposiciones | 2,457 (50%) |

**Ejemplo:**
- Art. 1 CE está en el Tema 1 de auxiliar_administrativo
- Art. 1 CE también está en el Tema 1 de auxilio_judicial
- Si un usuario estudia para auxiliar y luego cambia a auxilio_judicial, ya "domina" parte del temario

## 2. Comportamiento Actual (Post-Fix)

### 2.1 Cómo funciona ahora

1. La función `get_theme_performance_by_scope` filtra por la oposición del usuario (`user_profiles.target_oposicion`)
2. Solo muestra estadísticas para topics de ESA oposición
3. Si el usuario cambia de oposición:
   - La caché se recalcula en el cron nocturno
   - Verá estadísticas de artículos comunes en la nueva oposición
   - Los datos en `test_questions` nunca se pierden

### 2.2 Mapeo de oposición a position_type

```sql
CASE
  WHEN target_oposicion ILIKE '%auxiliar_administrativo%' THEN 'auxiliar_administrativo'
  WHEN target_oposicion ILIKE '%administrativo%' AND NOT ILIKE '%auxiliar%' THEN 'administrativo'
  WHEN target_oposicion ILIKE '%auxilio_judicial%' THEN 'auxilio_judicial'
  WHEN target_oposicion ILIKE '%tramitacion%' THEN 'tramitacion_procesal'
  ELSE 'auxiliar_administrativo'  -- Default
END
```

## 3. Roadmap: Feature de Conocimiento Transferible

### 3.1 Objetivo

Mostrar al usuario información sobre cuánto de su conocimiento es **aplicable a otras oposiciones**, sin inflar las estadísticas principales.

### 3.2 Diseño Propuesto

**Nueva sección en `/mis-estadisticas`:**

```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Tu conocimiento en otras oposiciones                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Administrativo del Estado                               │
│ ████████████░░░░░░░░ 62% del temario cubierto          │
│ 45 artículos en común con tu oposición actual          │
│                                                         │
│ Auxilio Judicial                                        │
│ ██████░░░░░░░░░░░░░░ 31% del temario cubierto          │
│ 23 artículos en común con tu oposición actual          │
│                                                         │
│ Tramitación Procesal                                    │
│ ████████░░░░░░░░░░░░ 41% del temario cubierto          │
│ 34 artículos en común con tu oposición actual          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Implementación Técnica

#### Paso 1: Nueva función SQL

```sql
CREATE OR REPLACE FUNCTION get_transferable_knowledge(p_user_id UUID)
RETURNS TABLE(
  target_position_type TEXT,
  target_position_name TEXT,
  covered_topics INTEGER,
  total_topics INTEGER,
  coverage_percentage NUMERIC,
  shared_articles INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_position TEXT;
BEGIN
  -- Obtener oposición actual del usuario
  SELECT position_type INTO v_current_position
  FROM user_profiles WHERE id = p_user_id;

  RETURN QUERY
  WITH user_articles AS (
    -- Artículos que el usuario ha estudiado
    SELECT DISTINCT a.id AS article_id, a.law_id, a.article_number
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    JOIN articles a ON a.id = tq.article_id
    WHERE t.user_id = p_user_id
  ),
  other_positions AS (
    -- Otras oposiciones (no la del usuario)
    SELECT DISTINCT position_type,
      CASE position_type
        WHEN 'auxiliar_administrativo' THEN 'Auxiliar Administrativo'
        WHEN 'administrativo' THEN 'Administrativo del Estado'
        WHEN 'auxilio_judicial' THEN 'Auxilio Judicial'
        WHEN 'tramitacion_procesal' THEN 'Tramitación Procesal'
      END AS position_name
    FROM topics
    WHERE position_type != v_current_position
  )
  SELECT
    op.position_type,
    op.position_name,
    COUNT(DISTINCT top.topic_number)::INTEGER AS covered_topics,
    (SELECT COUNT(DISTINCT topic_number) FROM topics WHERE position_type = op.position_type)::INTEGER,
    ROUND(
      COUNT(DISTINCT top.topic_number)::NUMERIC /
      NULLIF((SELECT COUNT(DISTINCT topic_number) FROM topics WHERE position_type = op.position_type), 0) * 100,
      1
    ),
    COUNT(DISTINCT ua.article_id)::INTEGER AS shared_articles
  FROM other_positions op
  CROSS JOIN user_articles ua
  JOIN topic_scope ts ON ts.law_id = ua.law_id
    AND ua.article_number = ANY(ts.article_numbers)
  JOIN topics top ON top.id = ts.topic_id
    AND top.position_type = op.position_type
  GROUP BY op.position_type, op.position_name;
END;
$$;
```

#### Paso 2: API endpoint

```typescript
// app/api/stats/transferable-knowledge/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  const { data, error } = await supabase.rpc('get_transferable_knowledge', {
    p_user_id: userId
  })

  return NextResponse.json({ success: true, data })
}
```

#### Paso 3: Componente React

```tsx
// components/Statistics/TransferableKnowledge.tsx
export function TransferableKnowledge({ userId }) {
  const [data, setData] = useState([])

  useEffect(() => {
    fetch(`/api/stats/transferable-knowledge?userId=${userId}`)
      .then(res => res.json())
      .then(data => setData(data.data))
  }, [userId])

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6">
      <h3 className="text-lg font-bold mb-4">
        🔄 Tu conocimiento en otras oposiciones
      </h3>
      {data.map(pos => (
        <div key={pos.target_position_type} className="mb-4">
          <div className="flex justify-between mb-1">
            <span>{pos.target_position_name}</span>
            <span>{pos.coverage_percentage}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-purple-500 rounded-full"
              style={{ width: `${pos.coverage_percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {pos.shared_articles} artículos en común
          </p>
        </div>
      ))}
    </div>
  )
}
```

### 3.4 Consideraciones de UX

1. **Separación clara:** Esta sección debe estar SEPARADA de las estadísticas principales para no confundir
2. **Contexto educativo:** Explicar que "conocimiento transferible" significa artículos compartidos, no preguntas
3. **No inflar expectativas:** Aclarar que aprobar una oposición no garantiza aprobar otra
4. **Opt-in:** Considerar mostrar solo si el usuario lo solicita

### 3.5 Estimación de Esfuerzo

| Tarea | Tiempo estimado |
|-------|-----------------|
| Función SQL | 2h |
| API endpoint | 1h |
| Componente React | 3h |
| Tests | 2h |
| **Total** | **8h** |

## 4. Decisiones de Diseño

### 4.1 Por qué NO mostramos conocimiento transferible por defecto

1. **Confunde al usuario:** Ver "19,632 preguntas en Tema 3" cuando solo hizo 60 es confuso
2. **Falsas expectativas:** El usuario puede pensar que domina más de lo que realmente domina
3. **Complejidad de UI:** Requiere explicaciones adicionales que complican la interfaz

### 4.2 Por qué SÍ queremos implementarlo como feature opcional

1. **Valor real:** Los artículos compartidos SÍ representan conocimiento transferible
2. **Motivación:** Puede motivar a usuarios a considerar otras oposiciones
3. **Diferenciación:** Feature única que otras plataformas no tienen

## 5. Referencias

- **Bug original:** Reportado por Nila Jinayda Maíz Garay (2026-02-03)
- **Función corregida:** `get_theme_performance_by_scope` en `database/migrations/`
- **Tabla de caché:** `user_theme_performance_cache`
- **Cron de actualización:** `.github/workflows/refresh-theme-cache.yml`

## 6. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-02-03 | Bug corregido: multiplicación 6x en estadísticas |
| 2026-02-03 | Documentación creada para roadmap de conocimiento transferible |
