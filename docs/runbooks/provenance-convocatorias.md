# Runbook — Provenance de documentos de convocatoria (referenciado → clonado → enlazado)

**Cuándo seguir este runbook (frase-gatillo):** *"revisa la provenance de convocatorias"*, o cuando el panel `/admin/salud-sistema` muestre el hallazgo **`convocatoria_docs_incompletos`**. Seguir esto ANTES de improvisar.

> 🎯 **Principio (diseño `docs/roadmap/verificacion-convocatorias-documentos-proceso.md`):** cada dato de la landing (`exam_date`, `plazas_*`, calendario, hitos) debe **apuntar a su documento-fuente oficial** clonado (URL + tipo + cita literal + hash + snapshot). Cero invención. Si un hito cita un BOE/boletín, ese documento debe estar **clonado en `convocatoria_documentos` y ENLAZADO** vía `convocatoria_hitos.source_documento_id`.

## 0. Qué avisa el hallazgo

- **`convocatoria_docs_incompletos`** (category `content`, severity `warn`) por oposición viva cuya convocatoria vigente tiene provenance incompleta. Fuente: **VISTA `convocatoria_docs_coverage`** (migración `20260721_convocatoria_docs_coverage.sql`).
- El detector vive en el sweep (`scripts/health-sweep.cjs` + gemelo `backend/src/content-health-sweep/content-health-sweep.service.ts`).

## 1. Leer la cobertura (la vista es la fuente única)

```sql
SELECT slug, año, docs_clonados, hitos_con_url, hitos_enlazados,
       hitos_enlazables, docs_por_clonar, citas_sin_fuente, incompleto
FROM convocatoria_docs_coverage
WHERE is_active AND is_current AND incompleto
ORDER BY docs_por_clonar DESC;
```

Columnas (por convocatoria):
- `docs_clonados` — filas en `convocatoria_documentos`.
- `hitos_con_url` — hitos que apuntan a un documento oficial (tienen `url`).
- `hitos_enlazados` — hitos con `source_documento_id` (provenance completa).
- `hitos_enlazables` — la `url` YA coincide con un doc clonado, falta el enlace → **backfill SIN fetch**.
- `docs_por_clonar` — la `url` NO coincide con ningún doc clonado → **hay que clonar el documento oficial**.
- `citas_sin_fuente` — `cita_literal` sin `source_documento_id` → la cita no tiene evidencia clonada.

## 2. Arreglar, en orden de coste

### 2.1. Enlazar lo ya clonado (barato, determinista, sin red)
```bash
node scripts/backfill-hito-source-documento.cjs          # dry-run (cuenta)
node scripts/backfill-hito-source-documento.cjs --apply  # enlaza por coincidencia exacta de URL
```
Idempotente (solo `source_documento_id IS NULL`) y determinista (si la url coincide con >1 doc, elige el más antiguo). Cierra `hitos_enlazables` sin tocar contenido.

### 2.2. Clonar el documento referenciado (fetch oficial, con verificación)
Para cada `docs_por_clonar`: coger la `url` del hito (BOE/boletín/sede), **clonar** el documento con la herramienta existente (`backend/scripts/clonar-documento.ts`; usa el fetcher headless para SPAs) → inserta en `convocatoria_documentos` (url, tipo, `content_hash`, `extracted_text` snapshot, `llm_extraction`, `confianza`). Después enlazar el hito (`source_documento_id`).
- **NUNCA inventar:** el documento se clona de su URL oficial. Si la URL da 403/está caída (madrid.es, algún BOP con TLS roto), **NO se clona a ciegas** — se deja el hueco anotado (es "URL de seguimiento caída", familia T-047), no se fabrica evidencia.
- El `tipo` se pone según el documento (`oep_decreto`, `bases`, `resolucion_tribunal`, `correccion_errores`, `anuncio_fecha`, `lista_admitidos`…), no `nota` (que es lo que emite el pipeline automático `detect-notas`).

### 2.3. Citas sin fuente (`citas_sin_fuente`)
Un hito con `cita_literal` pero sin `source_documento_id`: localizar el documento del que salió la cita, clonarlo (2.2) y enlazar. Si la cita no se puede rastrear a un documento oficial, es sospechosa (¿de dónde salió el texto?) → verificar contra fuente antes de dejarla.

## 3. Hitos huérfanos (`convocatoria_id IS NULL`)

La vista es por convocatoria, así que **no ve** los hitos con `convocatoria_id NULL` (cuelgan solo de `oposicion_id`). El detector los cuenta aparte (finding con `detail.orphan=true`). Estos hitos tienen provenance no atribuible a un ciclo: hay que **asignarlos a su convocatoria** (normalmente la `is_current`, pero si el hito es de un ciclo pasado va a la convocatoria archivada de ese año — mirar la fecha del hito, no asumir). Solo entonces entran en la cobertura.

## 4. Qué NO tocar / no hacer

- **NO** clonar sin verificar la URL oficial. **NO** fabricar `cita_literal` ni `content_hash`.
- **NO** asignar un hito huérfano a la `is_current` sin mirar su fecha (podría ser de un ciclo archivado).
- El pipeline `detect-notas` seguirá clonando `nota` automáticas desde la `seguimiento_url`; esto es complementario (los documentos que respaldan HECHOS, citados por hitos).

## 5. Verificar el arreglo

```sql
-- tras enlazar/clonar, la convocatoria debe salir de la lista:
SELECT slug, docs_por_clonar, hitos_enlazables, citas_sin_fuente, incompleto
FROM convocatoria_docs_coverage WHERE slug = '<slug>';
```
`incompleto` debe pasar a `false` cuando `docs_por_clonar = hitos_enlazables = citas_sin_fuente = 0`.
