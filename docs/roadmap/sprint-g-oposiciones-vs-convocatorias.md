# Sprint G — Separación `oposiciones` (cuerpo) vs `convocatorias` (proceso)

> **Detonante:** 2026-06-01 sesión catálogo. Manuel preguntó por qué `auxiliar-administrativo-madrid-2025` apuntaba a una convocatoria vieja. La investigación descubrió que el modelo actual mezcla dos conceptos ortogonales en la misma tabla:
>
> 1. **Cuerpo de oposición** (estable en el tiempo): "Auxiliar Administrativo Comunidad de Madrid". Nombre, slug, categoría, administración, coverage_level, seguimiento_url del organismo. NO cambia entre años.
> 2. **Convocatoria específica** (temporal): "Convocatoria de mayo 2025 con 551 plazas, examen abril 2026, BOCM Orden 13/05/2025". Plazas, fechas, BOE/BOCM ref, estado_proceso, hitos. Cambia cada año.
>
> Resultado: cuando llega convocatoria 2026, alguien creó una entrada nueva (`auxiliar-administrativo-madrid`) y la anterior quedó como `auxiliar-administrativo-madrid-2025` huérfana. Duplicación de campos estables, hitos enredados, complejidad creciente.
>
> **Objetivo:** modelo limpio donde una oposición tiene N convocatorias históricas + 0/1 activa. Sensor LLM detecta convocatoria nueva → INSERT sin tocar `oposiciones`. Newsletter automática. Escala lineal sin reescritura cuando lleguemos a 500+ oposiciones × 10 años de histórico.
>
> **Principios:**
> 1. **Una sola fuente de verdad por concepto.** Cuerpo y proceso son entidades distintas, viven en tablas distintas, FK entre ellas.
> 2. **Migración sin downtime.** Se mantiene compat hacia atrás durante la transición; las queries existentes siguen funcionando hasta el corte final.
> 3. **Trigger garantiza invariante.** `is_current = true` único por oposición a nivel BD, no a nivel aplicación.
> 4. **Refactor por capas.** BD primero, queries server después, frontend al final. Cada fase reversible.
>
> **Estado:** 📋 ROADMAP — fase G.0 (diseño) en curso.
> **Última actualización:** 2026-06-01.

---

## 1. Schema objetivo

### 1.1 Tabla `oposiciones` (depurada — cuerpo estable)

Campos que se quedan (estables, no cambian entre convocatorias):

```
id                UUID PK
slug              TEXT UNIQUE NOT NULL
nombre            TEXT NOT NULL
short_name        TEXT
categoria         TEXT     -- C1 / C2 / A1 / A2 / E
administracion    TEXT NOT NULL
grupo             TEXT
subgrupo          TEXT
tipo_acceso       TEXT NOT NULL
titulo_requerido  TEXT
salario_min/max   INTEGER
color_primario    TEXT
seo_title         TEXT
seo_description   TEXT
coverage_level    TEXT (CHECK)
fetcher_type      TEXT (CHECK)
headless_required BOOLEAN
demand_score      INTEGER
is_active         BOOLEAN  -- visibilidad pública del CUERPO
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ

-- URL del PORTAL del organismo (estable). Distinta del programa_url
-- que es del proceso concreto.
seguimiento_url   TEXT     -- portal empleo del organismo (estable)
```

Campos que se mueven a `convocatorias`:

```
exam_date, exam_date_approximate
inscription_start, inscription_deadline
boe_publication_date, boe_reference
plazas_libres, plazas_promocion_interna, plazas_discapacidad
estado_proceso
oep_decreto, oep_fecha
convocatoria_numero, convocatoria_fecha, convocatoria_dogv
landing_faqs, landing_estadisticas, landing_description
examen_config, requisitos_especiales
is_convocatoria_activa
programa_url               -- PDF de las bases del PROCESO concreto
seguimiento_change_*       -- monitoreo va por convocatoria
```

### 1.2 Tabla nueva `convocatorias` (proceso temporal)

```sql
CREATE TABLE convocatorias (
  id                          UUID PK,
  oposicion_id                UUID NOT NULL FK → oposiciones(id) ON DELETE CASCADE,
  año                         INTEGER NOT NULL,    -- ej. 2026
  convocatoria_numero         TEXT,                -- ej. "Orden 1081/2025"
  convocatoria_fecha          DATE,
  convocatoria_dogv           TEXT,
  is_current                  BOOLEAN NOT NULL DEFAULT false,
  archived_at                 TIMESTAMPTZ,         -- NULL = vigente, fecha = histórica
  estado_proceso              TEXT,
  oep_decreto                 TEXT,
  oep_fecha                   DATE,
  plazas_libres               INTEGER,
  plazas_promocion_interna    INTEGER,
  plazas_discapacidad         INTEGER,
  boe_publication_date        DATE,
  boe_reference               TEXT,
  inscription_start           DATE,
  inscription_deadline        DATE,
  exam_date                   DATE,
  exam_date_approximate       BOOLEAN,
  programa_url                TEXT,
  examen_config               JSONB,
  landing_faqs                JSONB,
  landing_estadisticas        JSONB,
  landing_description         TEXT,
  requisitos_especiales       JSONB,
  seguimiento_last_checked    TIMESTAMPTZ,
  seguimiento_last_hash       TEXT,
  seguimiento_change_status   TEXT,
  seguimiento_change_detected_at TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (oposicion_id, año),
  CHECK (año >= 1970 AND año <= 2100)
);

CREATE INDEX idx_convocatorias_oposicion_current
  ON convocatorias (oposicion_id) WHERE is_current = true;

CREATE INDEX idx_convocatorias_estado_proceso
  ON convocatorias (estado_proceso) WHERE archived_at IS NULL;

CREATE INDEX idx_convocatorias_inscription_open
  ON convocatorias (inscription_start, inscription_deadline)
  WHERE estado_proceso = 'inscripcion_abierta';
```

### 1.3 Trigger: invariante `is_current` único

```sql
CREATE OR REPLACE FUNCTION ensure_single_current_convocatoria()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE convocatorias
    SET is_current = false
    WHERE oposicion_id = NEW.oposicion_id
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_convocatorias_single_current
AFTER INSERT OR UPDATE OF is_current ON convocatorias
FOR EACH ROW
WHEN (NEW.is_current = true)
EXECUTE FUNCTION ensure_single_current_convocatoria();
```

### 1.4 `convocatoria_hitos` — FK reasignado

```sql
ALTER TABLE convocatoria_hitos
  ADD COLUMN convocatoria_id UUID REFERENCES convocatorias(id) ON DELETE CASCADE;

-- Backfill: cada hito existente apunta a su convocatoria (1 oposicion = 1
-- convocatoria al principio).
UPDATE convocatoria_hitos h
SET convocatoria_id = c.id
FROM convocatorias c
WHERE c.oposicion_id = h.oposicion_id
  AND c.is_current = true;

-- Validar 0 NULL antes de hacer NOT NULL
ALTER TABLE convocatoria_hitos ALTER COLUMN convocatoria_id SET NOT NULL;

-- Mantener oposicion_id como denormalización para queries comunes
-- (NO se borra para no romper queries existentes durante transición).
```

### 1.5 Materialized view `mv_oposiciones_activas`

```sql
CREATE MATERIALIZED VIEW mv_oposiciones_activas AS
SELECT
  o.id, o.slug, o.nombre, o.short_name, o.categoria, o.administracion,
  o.coverage_level, o.fetcher_type, o.headless_required, o.demand_score,
  o.seguimiento_url AS organismo_url,
  o.color_primario, o.seo_title, o.seo_description,
  o.titulo_requerido, o.salario_min, o.salario_max,
  c.id AS convocatoria_id, c.año, c.convocatoria_numero,
  c.estado_proceso, c.plazas_libres, c.plazas_discapacidad,
  c.inscription_start, c.inscription_deadline, c.exam_date,
  c.boe_publication_date, c.boe_reference,
  c.programa_url, c.landing_faqs, c.landing_estadisticas,
  c.landing_description, c.examen_config
FROM oposiciones o
LEFT JOIN convocatorias c
  ON c.oposicion_id = o.id AND c.is_current = true
WHERE o.is_active = true;

CREATE UNIQUE INDEX ON mv_oposiciones_activas (id);
CREATE INDEX ON mv_oposiciones_activas (slug);
CREATE INDEX ON mv_oposiciones_activas (estado_proceso);
```

Refresh cron `refresh-mv-oposiciones-activas` cada 30 min (Sprint G.4).

---

## 2. Plan de migración (datos)

### G.2.1 — Crear `convocatorias` desde oposiciones existentes

Para cada `oposiciones` con `estado_proceso IS NOT NULL` o `convocatoria_fecha IS NOT NULL`, INSERT en `convocatorias`:

```sql
INSERT INTO convocatorias (
  oposicion_id, año, convocatoria_numero, convocatoria_fecha,
  convocatoria_dogv, is_current, archived_at,
  estado_proceso, oep_decreto, oep_fecha,
  plazas_libres, plazas_promocion_interna, plazas_discapacidad,
  boe_publication_date, boe_reference,
  inscription_start, inscription_deadline,
  exam_date, exam_date_approximate, programa_url,
  examen_config, landing_faqs, landing_estadisticas,
  landing_description, requisitos_especiales,
  seguimiento_last_checked, seguimiento_last_hash, seguimiento_change_status
)
SELECT
  o.id,
  COALESCE(EXTRACT(YEAR FROM o.convocatoria_fecha)::int,
           EXTRACT(YEAR FROM o.exam_date)::int,
           2026) AS año,
  o.convocatoria_numero, o.convocatoria_fecha, o.convocatoria_dogv,
  -- is_current = true salvo si el slug acaba en -YYYY pasado
  CASE
    WHEN o.slug ~ '-\d{4}$' AND o.is_active = false THEN false
    ELSE true
  END AS is_current,
  -- archived_at: solo si la convocatoria está cerrada/superada
  CASE
    WHEN o.is_active = false AND o.estado_proceso IN ('examen_realizado', 'resultados', 'nombramientos')
      THEN COALESCE(o.exam_date::timestamptz, NOW())
    ELSE NULL
  END AS archived_at,
  o.estado_proceso, o.oep_decreto, o.oep_fecha,
  o.plazas_libres, o.plazas_promocion_interna, o.plazas_discapacidad,
  o.boe_publication_date, o.boe_reference,
  o.inscription_start, o.inscription_deadline,
  o.exam_date, o.exam_date_approximate, o.programa_url,
  o.examen_config, o.landing_faqs, o.landing_estadisticas,
  o.landing_description, o.requisitos_especiales,
  o.seguimiento_last_checked, o.seguimiento_last_hash, o.seguimiento_change_status
FROM oposiciones o
WHERE o.estado_proceso IS NOT NULL
   OR o.convocatoria_fecha IS NOT NULL
   OR o.exam_date IS NOT NULL
   OR o.plazas_libres IS NOT NULL;
```

### G.2.2 — Caso especial Madrid 2025 + 2026

`auxiliar-administrativo-madrid` y `auxiliar-administrativo-madrid-2025` son el mismo cuerpo. Tras G.2.1:

1. Una vez ambas tengan filas en `convocatorias`, hay 2 convocatorias diferentes en BD pero apuntan a oposiciones distintas.
2. Necesitamos UNIFICAR: reasignar la convocatoria 2025 al cuerpo `madrid` (sin sufijo) y eliminar la entrada `madrid-2025` de `oposiciones`.

```sql
-- Paso 1: redireccionar convocatoria_id → cuerpo correcto
UPDATE convocatorias
SET oposicion_id = (SELECT id FROM oposiciones WHERE slug = 'auxiliar-administrativo-madrid'),
    is_current = false,
    archived_at = '2026-04-12'::timestamptz  -- fecha del examen 2025
WHERE oposicion_id = (SELECT id FROM oposiciones WHERE slug = 'auxiliar-administrativo-madrid-2025');

-- Paso 2: redireccionar hitos
UPDATE convocatoria_hitos
SET oposicion_id = (SELECT id FROM oposiciones WHERE slug = 'auxiliar-administrativo-madrid')
WHERE oposicion_id = (SELECT id FROM oposiciones WHERE slug = 'auxiliar-administrativo-madrid-2025');

-- Paso 3: eliminar entrada huérfana
DELETE FROM oposiciones WHERE slug = 'auxiliar-administrativo-madrid-2025';
```

Patrón general aplicable a otros casos similares (`auxiliar-administrativo-canarias-2024` etc.).

### G.2.3 — `convocatoria_hitos.convocatoria_id`

```sql
ALTER TABLE convocatoria_hitos
  ADD COLUMN convocatoria_id UUID REFERENCES convocatorias(id) ON DELETE CASCADE;

UPDATE convocatoria_hitos h
SET convocatoria_id = c.id
FROM convocatorias c
WHERE c.oposicion_id = h.oposicion_id
  AND c.is_current = true;

-- Hitos huérfanos (convocatoria archivada): asociar a la convocatoria archivada
UPDATE convocatoria_hitos h
SET convocatoria_id = c.id
FROM convocatorias c
WHERE c.oposicion_id = h.oposicion_id
  AND h.convocatoria_id IS NULL
  AND c.archived_at IS NOT NULL
  AND -- asociar por proximidad de fechas
    h.fecha BETWEEN c.convocatoria_fecha AND COALESCE(c.archived_at::date, NOW()::date);

ALTER TABLE convocatoria_hitos ALTER COLUMN convocatoria_id SET NOT NULL;
```

---

## 3. Refactor de código (queries server)

### G.3.1 — Endpoint `/api/oposiciones/catalog`

Antes: lee solo de `oposiciones`. Después: lee de `mv_oposiciones_activas` (JOIN ya hecho).

```typescript
const { data } = await supabase
  .from('mv_oposiciones_activas')  // antes: 'oposiciones'
  .select('id, slug, nombre, short_name, categoria, administracion, coverage_level, demand_score, año, estado_proceso, plazas_libres')
  .order('demand_score', { ascending: false, nullsFirst: false })
```

### G.3.2 — Banner inscripciones abiertas

Antes:
```typescript
.from('oposiciones')
.eq('is_active', true)
.lte('inscription_start', today)
.gte('inscription_deadline', today)
```

Después:
```typescript
.from('mv_oposiciones_activas')
.eq('estado_proceso', 'inscripcion_abierta')
// o más estricto con la MV joined:
.lte('inscription_start', today)
.gte('inscription_deadline', today)
```

### G.3.3 — `/oposiciones` listado público

```typescript
.from('mv_oposiciones_activas')
.select('slug, nombre, plazas_libres, plazas_discapacidad, estado_proceso, exam_date, inscription_deadline, subgrupo')
.order('plazas_libres', { ascending: false, nullsFirst: false })
```

### G.3.4 — `auto-promote-coverage` service

Lógica actual mira campos de `oposiciones` (estado_proceso, plazas_libres, etc.). Después:

```sql
WITH topics_count AS (...),
     questions_count AS (...),
     convocatoria_data AS (
       SELECT oposicion_id,
              estado_proceso, plazas_libres, exam_date, boe_reference, convocatoria_fecha,
              landing_faqs, landing_estadisticas, examen_config
       FROM convocatorias
       WHERE is_current = true
     )
SELECT o.id, o.slug, o.coverage_level AS current_level,
  CASE
    WHEN cd.landing_faqs IS NOT NULL AND jsonb_array_length(cd.landing_faqs) >= 3
         AND cd.landing_estadisticas IS NOT NULL AND jsonb_array_length(cd.landing_estadisticas) >= 3
         AND cd.examen_config IS NOT NULL AND cd.examen_config != '{}'::jsonb
         AND COALESCE(qc.n_questions, 0) >= 50
      THEN 'con_landing'
    WHEN COALESCE(qc.n_questions, 0) >= 50 THEN 'con_tests'
    WHEN COALESCE(tc.n_topics, 0) >= 5 THEN 'con_temario'
    WHEN cd.plazas_libres IS NOT NULL OR cd.exam_date IS NOT NULL
         OR cd.boe_reference IS NOT NULL OR cd.convocatoria_fecha IS NOT NULL THEN 'monitorizada'
    ELSE 'catalogada'
  END AS calculated_level
FROM oposiciones o
LEFT JOIN topics_count tc ON tc.position_type = REPLACE(o.slug, '-', '_')
LEFT JOIN questions_count qc ON qc.position_type = REPLACE(o.slug, '-', '_')
LEFT JOIN convocatoria_data cd ON cd.oposicion_id = o.id
WHERE o.coverage_level != 'full';
```

### G.3.5 — Cron `refresh-mv-oposiciones-activas`

Nuevo cron NestJS cada 30 min:
```typescript
@Cron('*/30 * * * *', { name: 'refresh-mv-oposiciones-activas', timeZone: 'UTC' })
async handle() {
  await this.db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_oposiciones_activas`);
  await this.cache.invalidate('oposiciones:catalog:v1');
}
```

### G.3.6 — Cron `check-seguimiento`

Ahora monitoriza `convocatorias.seguimiento_last_*` en vez de `oposiciones.seguimiento_*`. Cada convocatoria activa tiene su propio hash.

---

## 4. Frontend

### G.4.1 — Landing dinámica `app/[oposicion]/page.tsx`

Lee de `oposiciones` + `convocatoria_actual` (vía endpoint `/api/oposiciones/[slug]` o supabase directo). Si la oposición tiene `convocatorias_archivadas`, mostrar sección "Convocatorias anteriores" con timeline cronológico.

### G.4.2 — Banner inscripción

Sin cambio aparente en UX. Cambia el origen del dato (de `oposiciones` a `mv_oposiciones_activas`).

### G.4.3 — Exámenes oficiales

Si una oposición tiene exámenes oficiales históricos importados, vincularlos por `convocatoria_id` además de por `exam_position`. Permite mostrar "Examen 2023, 2024, 2025" agrupado por convocatoria.

---

## 5. Plan de salida (rollback)

Cada fase es reversible:

- G.1 (schema): DROP TABLE convocatorias + DROP COLUMN convocatoria_id de hitos. Datos vuelven al modelo anterior.
- G.2 (datos): restaurar tablas desde snapshot pre-migración.
- G.3 (queries): revert commit. Las queries vuelven a leer de `oposiciones`.
- G.4 (frontend): revert commit.

Estrategia: NO eliminar columnas de `oposiciones` hasta validar G.3 y G.4 en producción durante 1 semana (G.7).

---

## 6. Fases ejecutables

- **G.0 — Diseño** (este documento). ✅ Hecho.
- **G.1 — Schema BD** (migración SQL + trigger).
- **G.2 — Migración de datos** (script Node con verificación de integridad).
- **G.3 — Refactor server queries** (endpoints + auto-promote).
- **G.4 — Materialized view + cron refresh**.
- **G.5 — Frontend** (landing + listing).
- **G.6 — Tests + verificación end-to-end**.
- **G.7 — Drop columnas obsoletas en `oposiciones`** (sólo tras validación).

Total estimado: 6-10h distribuibles en 2-3 sesiones.

---

## 7. Métricas de éxito

- 0 entradas con sufijo `-YYYY` en `oposiciones.slug` tras G.2.2.
- Cada `oposicion` con `coverage_level >= 'monitorizada'` tiene exactamente 1 convocatoria con `is_current=true` (verificable con CHECK + trigger).
- Hitos: 100% de filas en `convocatoria_hitos` con `convocatoria_id NOT NULL`.
- Latencia `/api/oposiciones/catalog`: <50ms (igual que ahora gracias a MV).
- Auto-promote-coverage sigue funcionando: prueba ejecutando manualmente el CTE refactor antes del cutover.
- Newsletter: prueba con convocatoria sintética insertada en BD → email enviado en <5 min.

---

## 8. Riesgos identificados

1. **Datos legacy inconsistentes:** algunas oposiciones tienen `estado_proceso` pero sin `convocatoria_fecha` ni `exam_date`. Resuelto con CASE en INSERT (año = 2026 default).
2. **Múltiples convocatorias por oposición sin sufijo:** improbable si el catálogo está limpio, verificar antes de G.2.
3. **Convocatoria activa NO es la más reciente:** si una oposición tiene 2025 archivada y 2026 activa, OK. Si tiene 2026 archivada (cerrada) y 2027 activa, también OK. Si tiene 2025 archivada y 2027 activa (saltando 2026), también OK — la convocatoria activa es la marcada con `is_current=true`, no la del año mayor.
4. **Cache miss tras migración:** invalidar `oposiciones:catalog:v1` tras G.2 y G.4.
5. **MV refresh con CONCURRENTLY requiere UNIQUE index:** ya incluido en el design.

---

## 9. Referencias

- Roadmap previo: `docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md`
- Manual crear oposición: `docs/maintenance/crear-nueva-oposicion.md`
- Cabos absorbidos: caso Madrid 2025 + 2026, posibles otros casos `*-YYYY` en BD.
