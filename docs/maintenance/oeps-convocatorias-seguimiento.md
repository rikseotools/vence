# Manual: Resolver Cambios Detectados en Seguimiento de Convocatorias

## Resumen

Cuando el admin dice "el seguimiento ha detectado cambios" o se ven badges de **🎯 OEPs** en el sidebar admin, seguir este manual para sincronizar las landing pages con la realidad.

## Arquitectura actual (desde 06/04/2026): sistema multi-sensor

Todas las alertas de convocatorias se centralizan en **`/admin/oep-signals`** con 3 sensores activos:

| Sensor | Qué detecta | Score base | Cron |
|--------|-------------|------------|------|
| `llm_semantic` | Entidades OEP extraídas con Claude Haiku (año, plazas, BOC ref, fechas, estado) | 40 | L-V 10:00 UTC |
| `timeline_silence` | Hitos `current` con fecha pasada +3 días sin avance | 70 | Diario 7:00 UTC |
| `hash_change` | SHA-256 del contenido de la página cambió (sensor antiguo, integrado como complemento) | 30 | L-V 9:00 UTC |

**Score final** (con bonus por evidencias): 0-100. Score ≥ 60 → badge rojo, 40-59 → amarillo, <40 → normal.

**Flujo:** cada sensor genera señales en la tabla `oep_detection_signals`. El admin las revisa en `/admin/oep-signals` y decide `Aplicar` (requiere acción manual siguiendo este manual) o `Descartar` (falso positivo).

> **Nota:** La página `/admin/seguimiento-convocatorias` queda como vista histórica técnica de hashes. Ya no tiene badge — todas las alertas van a **🎯 OEPs**.

## 1. Identificar qué oposiciones tienen señales pendientes

### Opción A — Panel admin (recomendado)
`/admin/oep-signals` → tab "Sin revisar". Muestra:
- Oposición + sensor que detectó
- Score con color por urgencia
- Datos extraídos (año, plazas, BOC ref, fechas)
- Diff resumido con BD
- Link a página origen

### Opción B — Query directa
```javascript
// Señales pendientes ordenadas por confianza
supabase
  .from('oep_detection_signals')
  .select('*, oposiciones(slug, nombre)')
  .eq('status', 'pending')
  .order('confidence_score', { ascending: false })
```

### Opción C — Compatibilidad sistema viejo (solo hash_change)
```javascript
// Oposiciones con seguimiento_change_status = 'changed'
supabase
  .from('oposiciones')
  .select('id, slug, nombre, estado_proceso, seguimiento_url, seguimiento_change_status, seguimiento_change_detected_at')
  .eq('seguimiento_change_status', 'changed')
```

## 2. Leer la pagina de seguimiento

Para cada oposicion con cambio, usar WebFetch en la `seguimiento_url` para extraer:

- Documentos publicados con fechas
- Resoluciones nuevas
- Listas (admitidos, excluidos, aprobados)
- Plazos abiertos o cerrados
- Fechas de examen

**Prompt recomendado para WebFetch:**
```
Lista TODOS los documentos, resoluciones, listas y tramites publicados en esta pagina con sus fechas.
Especialmente busca si hay algo publicado recientemente. Quiero una lista cronologica completa.
```

## 3. Comparar con lo que tenemos en BD

### 3a. Ver hitos actuales

```javascript
// Hitos de la oposicion
const { data: op } = await supabase
  .from('oposiciones')
  .select('id, estado_proceso, plazas_libres, exam_date')
  .eq('slug', '<slug>')
  .single()

const { data: hitos } = await supabase
  .from('convocatoria_hitos')
  .select('*')
  .eq('oposicion_id', op.id)
  .order('order_index', { ascending: true })
```

### 3b. Comparar y detectar diferencias

| Aspecto | Que verificar |
|---------|--------------|
| **Plazas** | ¿Coinciden BD vs web oficial? |
| **estado_proceso** | ¿Refleja la fase actual? (ver tabla de estados abajo) |
| **Hitos** | ¿Faltan hitos nuevos? ¿Hay que cambiar status de upcoming a completed/current? |
| **Fechas** | ¿exam_date actualizada? ¿inscription_deadline correcta? |
| **order_index** | ¿Hay duplicados? Cada hito debe tener un order_index unico |

### 3c. Estados del proceso selectivo

| Estado | Significado |
|--------|------------|
| `sin_oep` | No hay OEP aprobada |
| `oep_aprobada` | OEP aprobada, sin convocatoria |
| `convocada` | Convocatoria publicada, inscripcion no abierta |
| `inscripcion_abierta` | Plazo de inscripcion abierto |
| `inscripcion_cerrada` | Inscripcion cerrada |
| `lista_admitidos` | Lista de admitidos publicada |
| `pendiente_examen` | Fecha de examen conocida |
| `examen_realizado` | Examen ya realizado |
| `resultados` | Resultados publicados |
| `nombramientos` | Proceso finalizado |

## 4. Actualizar la BD

### 4a. Actualizar hitos existentes (cambiar status)

```javascript
// Marcar hito como completado
await supabase
  .from('convocatoria_hitos')
  .update({ status: 'completed' })
  .eq('oposicion_id', '<uuid>')
  .ilike('titulo', '%listas provisionales%')

// Cambiar hito de upcoming a current
await supabase
  .from('convocatoria_hitos')
  .update({ status: 'current' })
  .eq('oposicion_id', '<uuid>')
  .ilike('titulo', '%examen%')
```

### 4b. Insertar hitos nuevos

```javascript
await supabase
  .from('convocatoria_hitos')
  .insert({
    oposicion_id: '<uuid>',
    fecha: '2026-03-18',
    titulo: 'Lista provisional de aprobados del primer ejercicio',
    descripcion: 'Plazo alegaciones: 3 dias habiles.',
    url: 'https://...',  // URL al documento si existe
    status: 'current',   // completed | current | upcoming
    order_index: 7        // Siguiente numero disponible (sin duplicar)
  })
```

### 4c. Actualizar estado de la oposicion

```javascript
await supabase
  .from('oposiciones')
  .update({
    estado_proceso: 'lista_admitidos',  // Nuevo estado
    exam_date: '2026-06-15',            // Si se conoce fecha examen
    // plazas_libres: 104,              // Si hay que corregir plazas
  })
  .eq('slug', '<slug>')
```

### 4d. Corregir hitos con order_index duplicados

Si hay hitos con el mismo order_index, reasignar:

```javascript
// Ver hitos actuales
const { data: hitos } = await supabase
  .from('convocatoria_hitos')
  .select('id, order_index, titulo, fecha')
  .eq('oposicion_id', '<uuid>')
  .order('fecha', { ascending: true })

// Reasignar order_index secuencial
for (let i = 0; i < hitos.length; i++) {
  await supabase
    .from('convocatoria_hitos')
    .update({ order_index: i + 1 })
    .eq('id', hitos[i].id)
}
```

## 4e. Reglas de integridad de hitos y fechas de examen

### Principio fundamental

**Hitos = solo hechos con fecha oficial.** Un hito solo debe existir si el evento ya ocurrio o tiene una fecha publicada oficialmente (en BOE, BORM, BOA, etc.). Las previsiones y estimaciones NUNCA van en hitos.

**Previsiones = solo en `oposiciones.exam_date` + `exam_date_approximate`.** Cuando no hay fecha oficial de examen pero se puede estimar (por convocatorias anteriores, plazos legales, etc.), se pone en `exam_date` con `exam_date_approximate = true`. La landing ya muestra "(fecha aproximada)" automaticamente.

### Reglas de hitos

| Regla | Descripcion |
|-------|-------------|
| **Sin estimaciones** | No crear hitos upcoming con fechas inventadas o redondas (1 de mes, etc.). Si no hay fecha oficial, no hay hito. |
| **Sin duplicados** | No dos hitos con el mismo titulo o mismo significado (ej: "Fin plazo solicitudes" y "Cierre plazo inscripcion" son lo mismo). |
| **order_index secuencial** | Sin gaps ni duplicados. Si se borran hitos, reindexar con el script de la seccion 4d. |
| **Status coherente** | `completed` = fecha pasada. `upcoming` = fecha futura. `current` = evento en curso o muy proximo (dias, no meses). |
| **Orden cronologico** | Los hitos deben estar ordenados por fecha. order_index debe reflejar el orden cronologico. |

### Reglas de exam_date en oposiciones

| Situacion | exam_date | exam_date_approximate |
|-----------|-----------|----------------------|
| Fecha oficial confirmada (BOE, etc.) | Fecha exacta | `false` |
| Estimacion/prevision sin fecha oficial | Fecha estimada | `true` |
| Sin fecha conocida ni estimable | `NULL` | `false` |
| Examen ya realizado | Fecha real del examen pasado | `false` |

**Nunca:** `exam_date = NULL` con `approximate = true` (no tiene sentido).
**Nunca:** `exam_date` futura con `approximate = false` si no esta confirmada oficialmente.

### Cuando un examen ya se ha realizado

Si `estado_proceso` es `examen_realizado`, `resultados` o `nombramientos`:
- `exam_date` debe ser la fecha real del examen pasado (no una fecha futura)
- `exam_date_approximate` debe ser `false`
- No debe haber hitos upcoming de "Examen" (el examen ya paso)

### Ejemplo: oposicion sin fecha de examen oficial

```
oposiciones:
  exam_date: '2026-10-01'
  exam_date_approximate: true    ← prevision

convocatoria_hitos:
  [completed] Convocatoria publicada en BOE
  [completed] Cierre plazo inscripcion
  [current] Listas definitivas admitidos
  ← NO hay hito "Examen" porque no hay fecha oficial
```

La landing mostrara "Examen previsto: octubre de 2026 (fecha aproximada)" en el hero, pero el timeline NO mostrara un hito de examen.

### Ejemplo: oposicion con fecha de examen confirmada

```
oposiciones:
  exam_date: '2026-05-23'
  exam_date_approximate: false   ← confirmada

convocatoria_hitos:
  [completed] Convocatoria publicada en BOE
  [current] Listas definitivas admitidos
  [upcoming] 2026-05-23 Examen   ← SI hay hito porque la fecha es oficial
```

## 5. Crear hitos para oposiciones que no tienen

Si una oposicion tiene `seguimiento_url` pero 0 hitos:

1. Leer la pagina de seguimiento con WebFetch
2. Extraer todos los eventos/documentos publicados con fechas
3. Crear hitos siguiendo el orden cronologico
4. Clasificar cada uno como `completed`, `current` o `upcoming`

**Hitos tipicos de un proceso selectivo:**

| Orden | Hito | Status tipico |
|-------|------|--------------|
| 1 | Convocatoria publicada en [diario] | completed |
| 2 | Apertura plazo de inscripcion | completed |
| 3 | Cierre plazo de inscripcion | completed |
| 4 | Listas provisionales admitidos/excluidos | completed |
| 5 | Fin plazo subsanacion | completed |
| 6 | Listas definitivas admitidos | completed/current |
| 7 | Composicion tribunal | completed |
| 8 | Examen | upcoming/current (solo si fecha oficial) |
| 9 | Resultados | upcoming (solo si fecha oficial) |

**IMPORTANTE:** Solo incluir hitos que tengan fecha oficial publicada. No crear hitos con fechas estimadas o inventadas (ver seccion 4e).

## 6. Marcar como revisado

### Opción A — Desde panel admin (recomendado)
En `/admin/oep-signals` pulsar **Aplicar** (si se han aplicado los cambios a BD) o **Descartar** (si es falso positivo). El botón actualiza el `status` de la señal — pero **NO aplica cambios a BD automáticamente**, los cambios los haces TÚ siguiendo este manual.

### Opción B — Vía BD directa

```javascript
// Marcar señal oep-signals como applied
await supabase
  .from('oep_detection_signals')
  .update({ status: 'applied', reviewed_at: new Date().toISOString(), admin_notes: '...' })
  .eq('id', '<signal_uuid>')

// Marcar checks hash_change antiguos como revisados (compatibilidad)
await supabase
  .from('convocatoria_seguimiento_checks')
  .update({ change_reviewed: true, reviewed_at: new Date().toISOString() })
  .eq('oposicion_id', '<uuid>')
  .eq('has_changed', true)
  .eq('change_reviewed', false)

// Resetear el status de la oposicion (solo si era 'changed' por hash)
await supabase
  .from('oposiciones')
  .update({ seguimiento_change_status: 'ok' })
  .eq('id', '<uuid>')
```

## 7. Verificar la landing

La landing se regenera automaticamente cada 24h (ISR con `revalidate = 86400`).

Para forzar regeneracion inmediata, llamar a la API de revalidacion:

```bash
curl "https://www.vence.es/api/revalidate?secret=<REVALIDATION_SECRET>&path=/auxiliar-administrativo-baleares"
```

O esperar 24h a que se regenere sola.

## 8. Oposiciones sin hitos (pendientes de crear)

Verificar periodicamente que todas las oposiciones activas con `seguimiento_url` tengan al menos los hitos basicos:

```javascript
// Oposiciones activas sin hitos
const { data: ops } = await supabase
  .from('oposiciones')
  .select('slug, estado_proceso, seguimiento_url')
  .eq('is_active', true)
  .not('seguimiento_url', 'is', null)

for (const op of ops) {
  const { count } = await supabase
    .from('convocatoria_hitos')
    .select('*', { count: 'exact', head: true })
    .eq('oposicion_id', op.id)

  if (count === 0) console.log('SIN HITOS:', op.slug)
}
```

## 9. Flujo completo: cuando el admin dice "revisa oposiciones" o hay señales en 🎯 OEPs

### Paso 1: Auditoría con agentes paralelos

Lanzar 4-5 agentes en paralelo (uno por grupo de 3-4 oposiciones). Cada agente:
1. Recibe datos BD (estado, plazas, hitos, seguimiento_url)
2. Hace WebFetch a la seguimiento_url
3. Busca WebSearch si la web no da info suficiente
4. Compara y reporta discrepancias

Agrupar por afinidad: Estado (INAP), Justicia (MJusticia), CCAA examen próximo, CCAA inscripción cerrada, resto.

### Paso 2: Clasificar cada oposición

Para cada una, determinar en qué caso cae:

| Caso | Señal típica | Acción |
|------|-------------|--------|
| **A. Proceso en curso, datos correctos** | Sin discrepancias | Marcar revisado. Nada que hacer. |
| **B. Proceso en curso, datos incorrectos** | Plazas mal, estado mal, hitos desactualizados | Corregir datos BD (estado, plazas, hitos, fechas). |
| **C. Proceso acabado, HAY nueva OEP** | Nombramientos hechos + nueva convocatoria publicada | Archivar fila vieja (slug-YYYY), crear fila nueva con datos de la nueva OEP, redirect 301. |
| **D. Proceso acabado, NO hay nueva OEP** | Nombramientos hechos, sin convocatoria nueva | **Transicionar a modo captación** (ver Paso 3). |
| **E. OEP detectada que no tenemos** | Señal regional_scan con oposicion_id=NULL | Decidir si crear nueva oposición en Vence (nueva landing, temario). |

### Paso 3: Transicionar a modo captación (Caso D)

Cuando un proceso se ha acabado y NO hay nueva convocatoria, la landing debe **mirar al futuro** para captar usuarios que se están preparando.

**Buscar previsiones:**
1. WebSearch "auxiliar administrativo [CCAA] OEP [año+1] plazas previsión"
2. Buscar en BOE/boletín autonómico si hay OEP aprobada con plazas pendientes de convocar
3. Buscar en fuentes tipo Adams, OpositaTest, OpoBusca las previsiones

**Actualizar la fila en BD:**
```javascript
await supabase.from('oposiciones').update({
  // Mirar al futuro
  estado_proceso: 'oep_aprobada',  // o 'sin_oep' si no hay OEP
  plazas_libres: 64,               // previsión próxima OEP
  plazas_discapacidad: null,       // desconocido aún
  is_convocatoria_activa: false,
  oep_decreto: 'OEP 2025 Junta de Andalucía',
  oep_fecha: '2025-10-15',         // fecha decreto OEP si existe
  exam_date: null,                  // desconocido
  inscription_deadline: null,       // desconocido
  // Actualizar textos landing
  landing_description: 'Prepárate para la próxima convocatoria de Auxiliar Administrativo de [CCAA]. X plazas previstas en la OEP [año].',
}).eq('slug', '<slug>')

// Limpiar hitos viejos y poner previsión
await supabase.from('convocatoria_hitos').delete().eq('oposicion_id', '<uuid>')
await supabase.from('convocatoria_hitos').insert([
  { oposicion_id: '<uuid>', order_index: 1, status: 'completed', fecha: '2025-10-15', titulo: 'OEP aprobada (X plazas previstas)' },
  { oposicion_id: '<uuid>', order_index: 2, status: 'upcoming', fecha: '2026-06-01', titulo: 'Convocatoria (estimación)' },
  { oposicion_id: '<uuid>', order_index: 3, status: 'upcoming', fecha: '2027-03-01', titulo: 'Examen (estimación)' },
])
```

**Objetivo:** un usuario que busca "auxiliar administrativo andalucía 2026" llega a la landing y ve:
- "64 plazas previstas"
- "OEP aprobada, pendiente de convocatoria"
- "Prepárate ya con nuestros tests y temario"
- Timeline con estimación de convocatoria y examen
→ Convierte a premium porque empieza a prepararse antes de que salga la convocatoria.

### Paso 4: Marcar revisado

- En `/admin/oep-signals`: pulsar Aplicar o Descartar en cada señal procesada
- Si había checks hash_change: marcar revisados en `convocatoria_seguimiento_checks`
- Resetear `seguimiento_change_status = 'ok'` en oposiciones afectadas

### Paso 5: Verificar landing

La landing se regenera automáticamente cada 24h (ISR). Para forzar:
```bash
curl "https://www.vence.es/api/revalidate?secret=<REVALIDATION_SECRET>&path=/auxiliar-administrativo-andalucia"
```

## 10. Escaneo regional (Sensor 4 — detect-regional-oeps)

Cron semanal (lunes 08:00 UTC) que escanea ~30 fuentes regionales:
- 1 estado + 17 CCAA + Ceuta/Melilla + 10 top ayuntamientos
- Tabla: `detection_sources` (URLs genéricas de "convocatorias en curso")
- LLM extrae TODAS las convocatorias C1/C2 de cada listado
- Cruza contra `oposiciones` existentes
- Si no match → señal `regional_scan` con `oposicion_id=NULL` (OEP nueva)

### Admin: ver detecciones regionales
`/admin/oep-signals` → filtro "🌍 Nuevas regionales" → muestra OEPs no cubiertas por Vence.

### Ampliar fuentes
```javascript
// Insertar nueva fuente regional
await supabase.from('detection_sources').insert({
  source_type: 'ayuntamiento',
  region_name: 'Ayto. Córdoba',
  boletin_name: 'BOP Córdoba',
  listing_url: 'https://www.cordoba.es/...',
  position_groups: ['C1', 'C2'],
})
```

Seed inicial: `scripts/seed-detection-sources.js` (30 fuentes).

## 11. Filosofia de landings: siempre activas para captar

**Regla: NUNCA desactivar una landing solo porque no haya convocatoria activa.**

Aunque una OEP haya terminado (nombramientos) y no haya nueva convocatoria, la landing sigue activa (`is_active=true`) porque:
- Google la tiene indexada con autoridad SEO acumulada
- Usuarios buscan "auxiliar administrativo [CCAA]" antes de que salga la convocatoria
- La landing muestra la previsión de plazas de la próxima OEP para ir captando leads

### Que mostrar según el estado

| Estado | Que mostrar en landing |
|--------|----------------------|
| `inscripcion_abierta` / `inscripcion_cerrada` | Datos completos: plazas, fechas, hitos, temario, tests |
| `pendiente_examen` / `examen_realizado` | Datos + countdown al examen o resultados |
| `resultados` / `nombramientos` | "Proceso anterior finalizado. Próxima OEP: X plazas previstas (estimación)" |
| `oep_aprobada` (sin convocatoria) | "OEP aprobada con X plazas. Pendiente de convocatoria. Prepárate ya." |
| `sin_oep` | "Se esperan X plazas en próxima OEP. Empieza a prepararte." |

### Campos a mantener actualizados (aunque no haya convocatoria)

```
is_active = true                    -- SIEMPRE, landing nunca se desactiva
is_convocatoria_activa = false      -- Solo true si hay inscripción/examen activo
estado_proceso = 'sin_oep'          -- O 'oep_aprobada' si hay decreto
plazas_libres = N                   -- Previsión o dato OEP (si existe)
oep_decreto = '...'                 -- Si hay OEP aprobada
oep_fecha = '...'                   -- Fecha del decreto OEP
```

### Cuando archivar (crear fila -YYYY)

Solo archivar si hay **nueva convocatoria/OEP** que reemplaza a la anterior:
1. Crear nueva fila con slug canónico (sin año)
2. Renombrar vieja a slug-YYYY + `is_active=false`
3. Redirect 301 en next.config.mjs

Si NO hay nueva OEP → mantener la fila actual con estado actualizado. No archivar.

## 12. Cambios cosmeticos (falsos positivos)

A veces el hash cambia sin novedad real (timestamps, tokens de sesion, contenido dinamico de la web). Indicadores de cambio cosmetico:

- `content_length` casi identico (diferencia < 100 bytes)
- Hash cambia cada dia pero no hay documentos nuevos
- La pagina es un portal generico (no ficha del proceso)

En estos casos: marcar como revisado sin hacer cambios en hitos.
