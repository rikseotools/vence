# Hot Articles - Artículos Importantes por Oposición

> Última actualización: 2026-02-14

## Descripción

La tabla `hot_articles` almacena artículos de legislación que han aparecido en **exámenes oficiales anteriores**. Esta información es valiosa porque indica qué artículos son importantes **para cada oposición específica**.

Un artículo puede ser crítico para Auxiliar Administrativo pero irrelevante para Tramitación Procesal.

## Uso en la App

Cuando un usuario responde una pregunta vinculada a un artículo que está en `hot_articles`:

1. Se muestra un badge naranja: **"🔥 Artículo que apareció en exámenes oficiales"**
2. Se indica cuántas veces apareció en exámenes

Esto ayuda al usuario a identificar contenido de alta prioridad para su estudio.

## Estructura de la Tabla

```sql
CREATE TABLE hot_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  law_id UUID NOT NULL REFERENCES laws(id) ON DELETE CASCADE,

  -- Oposición específica (FORMATO: con guiones)
  target_oposicion TEXT,  -- 'auxiliar-administrativo-estado', 'tramitacion-procesal', etc.

  -- Estadísticas
  total_official_appearances INTEGER DEFAULT 0,  -- Veces que apareció
  unique_exams_count INTEGER DEFAULT 0,          -- En cuántos exámenes distintos
  hotness_score NUMERIC DEFAULT 0,               -- Puntuación calculada
  priority_level TEXT,                           -- 'critical', 'high', 'medium', 'low'

  -- Metadata
  article_number TEXT,
  law_name TEXT,
  article_title TEXT,
  first_appearance_date DATE,
  last_appearance_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único: un artículo solo puede aparecer una vez por oposición
CREATE UNIQUE INDEX hot_articles_article_oposicion_unique
  ON hot_articles(article_id, target_oposicion);
```

## Valores de target_oposicion

**IMPORTANTE: Usar SIEMPRE guiones, NO underscores**

| Valor Correcto | Valor Incorrecto |
|----------------|------------------|
| `auxiliar-administrativo-estado` | ~~auxiliar_administrativo_estado~~ |
| `administrativo-estado` | ~~administrativo_estado~~ |
| `tramitacion-procesal` | ~~tramitacion_procesal~~ |
| `auxilio-judicial` | ~~auxilio_judicial~~ |
| `gestion-estado` | ~~gestion_estado~~ |

Los valores deben coincidir con `oposiciones.slug` en la base de datos.

## Cómo se Relaciona con Preguntas Oficiales

```
questions (is_official_exam=true)
    │
    ├── primary_article_id ────► articles
    │                                │
    └── exam_source                  │
         (identifica oposición)      ▼
                               hot_articles
                                    │
                                    └── target_oposicion
                                         (oposición específica)
```

## Sincronización

**NO hay sincronización automática.** Después de importar preguntas oficiales, hay que ejecutar el script de sincronización.

### Script de Sincronización (Recomendado)

```bash
# Ver qué se insertaría (sin cambios)
DRY_RUN=1 node scripts/sync-hot-articles.cjs

# Ejecutar sincronización
node scripts/sync-hot-articles.cjs
```

El script automáticamente:
1. Detecta artículos con preguntas oficiales que no están en `hot_articles`
2. Determina la oposición desde `exam_source`
3. Calcula `priority_level` y `hotness_score`
4. Inserta las nuevas entradas

**Ejecutar después de importar preguntas oficiales.**

---

### Sincronización Manual (Alternativa)

Si prefieres hacerlo manualmente:

#### Paso 1: Identificar artículos de preguntas oficiales

```sql
-- Ver artículos con preguntas oficiales que NO están en hot_articles
SELECT
  a.id AS article_id,
  a.article_number,
  l.short_name AS law_name,
  l.id AS law_id,
  COUNT(*) AS appearances,
  array_agg(DISTINCT q.exam_source) AS exam_sources
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
JOIN laws l ON a.law_id = l.id
WHERE q.is_official_exam = true
  AND q.is_active = true
  AND q.primary_article_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM hot_articles h
    WHERE h.article_id = a.id
  )
GROUP BY a.id, a.article_number, l.short_name, l.id
ORDER BY appearances DESC;
```

### Paso 2: Determinar la oposición desde exam_source

| exam_source contiene | target_oposicion |
|----------------------|------------------|
| "Auxiliar Administrativo Estado" | `auxiliar-administrativo-estado` |
| "Auxilio Judicial" | `auxilio-judicial` |
| "Tramitación Procesal" | `tramitacion-procesal` |
| "Administrativo" o "AGE" | `administrativo-estado` |
| "Gestión" | `gestion-estado` |

### Paso 3: Insertar en hot_articles

```sql
INSERT INTO hot_articles (
  article_id,
  law_id,
  target_oposicion,
  article_number,
  law_name,
  total_official_appearances,
  unique_exams_count,
  priority_level,
  hotness_score
)
VALUES (
  'uuid-del-articulo',
  'uuid-de-la-ley',
  'auxiliar-administrativo-estado',  -- CON GUIONES
  '131',
  'Ley 39/2015',
  5,   -- apariciones
  3,   -- exámenes distintos
  'high',  -- critical/high/medium/low
  50   -- score (apariciones * 10)
)
ON CONFLICT (article_id, target_oposicion)
DO UPDATE SET
  total_official_appearances = EXCLUDED.total_official_appearances,
  unique_exams_count = EXCLUDED.unique_exams_count,
  priority_level = EXCLUDED.priority_level,
  hotness_score = EXCLUDED.hotness_score,
  updated_at = NOW();
```

### Cálculo de priority_level

```sql
CASE
  WHEN total_official_appearances >= 5 THEN 'critical'
  WHEN total_official_appearances >= 3 THEN 'high'
  WHEN total_official_appearances >= 2 THEN 'medium'
  ELSE 'low'
END
```

## Filtrado por Oposición del Usuario

El filtrado se hace via API v2 (Drizzle + Zod + TypeScript):

**Endpoint:** `GET /api/v2/hot-articles/check`

**Parámetros:**
- `articleId` — UUID del artículo
- `userOposicion` — oposición del perfil del usuario (ej: `auxiliar-administrativo-estado`)
- `currentOposicion` — oposición de la URL actual (ej: `auxiliar-administrativo-cyl`)

**Lógica:** Busca en `hot_articles` por `articleId + userOposicion`. Para la "curiosidad" (otras oposiciones donde el artículo es importante), excluye tanto la oposición del usuario como la actual (de la URL).

**Código:** `lib/api/hot-articles/queries.ts` → `checkHotArticle()`

**BD normalizada:** `target_oposicion` siempre usa dashes (ej: `auxiliar-administrativo-estado`, nunca `auxiliar_administrativo_estado`). El mapeo de compatibilidad está en `lib/config/exam-positions.ts` → `HOT_ARTICLE_TARGET_MAP`.

## Exclusiones: Contenido No Legal

Los artículos de **informática y contenido técnico** NO deben estar en `hot_articles`:

```javascript
const NON_LEGAL_CONTENT = [
  'Informática Básica',
  'Windows 10',
  'Windows 11',
  'Hojas de cálculo. Excel',
  'Base de datos: Access',
  'Procesadores de texto',
  // ...
]
```

Estos temas tienen "artículos virtuales" que no son legislación real.

## Mantenimiento

### Verificar inconsistencias

```sql
-- Artículos con target_oposicion incorrecto (underscores)
SELECT target_oposicion, COUNT(*)
FROM hot_articles
WHERE target_oposicion LIKE '%_%'
GROUP BY target_oposicion;

-- Artículos con 0 apariciones (basura)
SELECT COUNT(*) FROM hot_articles
WHERE total_official_appearances = 0;
```

### Limpiar datos basura

```sql
-- Eliminar entradas sin apariciones reales
DELETE FROM hot_articles
WHERE total_official_appearances = 0;

-- Normalizar underscores a guiones
UPDATE hot_articles
SET target_oposicion = REPLACE(target_oposicion, '_', '-')
WHERE target_oposicion LIKE '%_%';
```

## Historial de Problemas Resueltos

### 2026-02-14: Normalización y Limpieza

**Problemas encontrados:**
1. 42% de entradas usaban underscores en lugar de guiones
2. 256 entradas tenían `target_oposicion = NULL` con 0 apariciones
3. Artículos de informática estaban marcados como "hot" incorrectamente

**Solución:**
1. Normalizado `administrativo_estado` → `administrativo-estado`
2. Normalizado `auxiliar_administrativo_estado` → `auxiliar-administrativo-estado`
3. Eliminadas 1000 entradas con 0 apariciones oficiales
4. Añadido filtro `isLegalArticle()` en TestLayout.js

**Resultado:**
- 744 artículos hot válidos
- 1,185 apariciones oficiales totales
- Correctamente distribuidos por oposición

## Consultas Útiles

### Ver estado actual

```sql
SELECT
  target_oposicion,
  COUNT(*) AS articulos,
  SUM(total_official_appearances) AS apariciones_totales
FROM hot_articles
GROUP BY target_oposicion
ORDER BY apariciones_totales DESC;
```

### Top artículos más importantes

```sql
SELECT
  law_name,
  article_number,
  target_oposicion,
  total_official_appearances,
  priority_level
FROM hot_articles
WHERE target_oposicion = 'auxiliar-administrativo-estado'
ORDER BY total_official_appearances DESC
LIMIT 20;
```
