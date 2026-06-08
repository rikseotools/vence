# Manual: Resolver Cambios Detectados en Seguimiento de Convocatorias

## Resumen

Cuando el admin dice "el seguimiento ha detectado cambios" o se ven badges de **🎯 OEPs** en el sidebar admin, seguir este manual para sincronizar las landing pages con la realidad.

## Arquitectura actual (desde 06/04/2026): sistema multi-sensor

Todas las alertas de convocatorias se centralizan en **`/admin/oep-signals`** con los sensores activos:

| Sensor | Qué detecta | Score base | Cron |
|--------|-------------|------------|------|
| `llm_semantic` | Entidades OEP extraídas con Claude Haiku (año, plazas, BOC ref, fechas, estado) sobre `oposiciones.seguimiento_url` del catálogo | 40 | L-V 10:00 UTC |
| `generic_source` | Cambios en fuentes genéricas/portales fuera de catálogo (`generic_source_checks`) — hash + filtro LLM. Aquí se dan de alta URLs de cuerpos NUEVOS (ver §10) | 50 | Diario |
| `timeline_silence` | Hitos `current` con fecha pasada +3 días sin avance | 70 | Diario 7:00 UTC |
| `hash_change` | SHA-256 del contenido de la página cambió (sensor antiguo, integrado como complemento) | 30 | L-V 9:00 UTC |
| ~~`regional_scan`~~ | **RETIRADO 01/06/2026** (56% error + falsos positivos). Descubrimiento de cuerpos nuevos → on-demand por Claude. Ver §10 | — | — |

**Score final** (con bonus por evidencias): 0-100. Score ≥ 60 → badge rojo, 40-59 → amarillo, <40 → normal.

**Flujo:** cada sensor genera señales en la tabla `oep_detection_signals`. El admin las revisa en `/admin/oep-signals` y decide `Aplicar` (requiere acción manual siguiendo este manual) o `Descartar` (falso positivo). El badge 🎯 OEPs tiene además un sub-badge **morado** para `discovered_processes` (ver §10).

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
    order_index: 7,       // Siguiente numero disponible (sin duplicar)
    // ── Fase 8 (campana 🔔) ──
    severity: 'critical', // critical=campana+email | important=solo campana | cosmetic=nada
    notify_status: 'pending' // pending=NO notifica. Pasar a 'verified' SOLO tras
                             // confirmar la fuente oficial → dispara la campana (ver §7b.0)
  })
```

> **Severidad (criterio Manuel):** `critical` = lo que el opositor espera/actúa
> (apertura de convocatoria/inscripción, fecha de examen, **listas de admitidos
> provisionales**, **plantilla del examen** una vez hecho, resultados). `important`
> = avances sin acción inmediata (tribunal, aulas, ampliación de plazo). `cosmetic`
> = no afecta (maquetación). Un hito nace `notify_status='pending'`: NO notifica
> hasta que tú (Claude) lo verificas (§7b.0).

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

### 4e-bis. Captar el siguiente ciclo: hito de PREVISIÓN DE PLAZAS desde la OEP

**Principio:** una vez celebrado el examen, la oposición NO debe quedar "muerta" (estado `resultados`/`nombramientos`). El siguiente ciclo de captación de leads empieza **en cuanto se publica la OEP** del año siguiente — que sale **meses antes** que la convocatoria y **ya trae el reparto de plazas por cuerpo**. Eso es contenido *forward-looking* real para seguir captando a quien empieza a preparar el próximo proceso.

**Dos documentos, no confundir:**
- **OEP (Oferta de Empleo Público)** = decreto/acuerdo del Consejo de Gobierno, publicado en DOCM/BOE/boletín autonómico. Fija el **nº de plazas por cuerpo/escala** (turno libre + reserva discapacidad + promoción interna). Sale primero.
- **Convocatoria** = las bases concretas (inscripción + fechas + examen). Sale después, normalmente con el mismo nº de plazas que la OEP.

**Qué hacer cuando el examen del ciclo en curso ya pasó y hay OEP nueva publicada:**
1. **Localizar el decreto de la OEP en el boletín oficial** (no en academias: dan cifras contradictorias y mezclan ordinaria/estabilización y años). Leer la **tabla de distribución por cuerpo** y extraer la cifra EXACTA del cuerpo objetivo, distinguiendo **turno libre** (lo que importa para nuestra landing) de promoción interna, y el desglose acceso general / reserva discapacidad.
2. **Añadir/actualizar un hito `upcoming`** del tipo:
   > *"Próxima OEP [año]: N plazas previstas del cuerpo [X] (pendiente convocatoria)"* — descripción con el desglose verificado + **enlace al decreto**, `severity='important'`.
3. **Etiquetar SIEMPRE como "previstas / pendiente convocatoria"** (no son plazas convocadas; el reparto definitivo de turno libre lo fija la convocatoria).
4. **Coherencia con el test de plazas:** el test `oposicionesDataConsistency` cruza el hito `order_index=1` con `plazas_libres`. El hito de previsión debe ir en un `order_index` posterior (es el último del timeline), de modo que NO altere ese cruce. Si en cambio se decide **pivotar la oposición al nuevo ciclo** (estado→`oep_aprobada`, `plazas_libres`→cifra OEP, `exam_date`→`NULL`+`approximate`), entonces actualizar también `seo_description`/`landing_description` y re-ejecutar los tests de §6a del manual de crear-oposiciones.

**Ejemplo real verificado (CLM, 04/06/2026):** examen del ciclo OEP 2023-2024 celebrado 14/10/2025 (estado `resultados`). Nueva **OEP 2025** aprobada por Acuerdo 09/12/2025, publicada en **DOCM nº 240 de 12/12/2025** (ref `2025_9540`). Leída la tabla "Turno libre" del decreto: **Cuerpo Auxiliar (C2) = 327 plazas de turno libre** (305 acceso general + 9 reserva discapacidad general + 13 reserva discapacidad intelectual). Se actualizó el hito de previsión con esa cifra + enlace al decreto. Convocatoria esperada en 2026.

#### Procedimiento de ROLLOVER al nuevo ciclo (examen pasado + OEP nueva publicada)

Cuando el proceso vigente ya terminó (examen celebrado, estado `resultados`/`nombramientos`) y hay **OEP nueva publicada**, se **pivota la oposición al nuevo ciclo** para que la landing deje de mostrar un proceso muerto y capte leads del siguiente. La landing ya se reconfigura sola al estado `oep_aprobada` (caja "Ver OEP en [diario]", hero "Examen pendiente de confirmación"). Pasos (validado en CLM, 04/06/2026):

1. **Verificar la cifra en el decreto del boletín** (no academias) — turno libre del cuerpo objetivo, con desglose acceso general / reserva discapacidad.
2. **Backup de los hitos del ciclo anterior** (`SELECT * → /tmp`) por si hay que revertir.
3. **Retirar los hitos del ciclo cerrado** y dejar un timeline limpio del nuevo ciclo: hito `#1` `completed` *"OEP [año] aprobada (DOCM/BOE nº…, fecha): N plazas previstas del cuerpo [X]"* con enlace al decreto. (El usuario que prepara el nuevo proceso no necesita el calendario del proceso anterior.)
4. **Pivotar la fila `oposiciones`** al nuevo ciclo de forma coherente:
   - `estado_proceso='oep_aprobada'`
   - `plazas_libres` / `plazas_discapacidad` → cifras del cuerpo en la OEP (turno libre)
   - `exam_date=NULL`, `exam_date_approximate=false` (sin fecha aún; combinación válida = "sin fecha conocida")
   - `inscription_start=NULL`, `inscription_deadline=NULL` (aún no hay convocatoria)
   - `convocatoria_dogv=NULL`, `convocatoria_fecha=NULL`, `convocatoria_numero=NULL` (la OEP NO es convocatoria)
   - `oep_decreto` / `oep_fecha` → el acuerdo/decreto de la OEP
   - `boe_reference` / `boe_publication_date` → publicación de la OEP en el boletín
   - `seo_description` / `landing_description` → marco "OEP [año]: N plazas previstas, convocatoria pendiente". **N debe ser coherente con `plazas_libres`** (la regla del test: `plazas_libres`, o `+disc`, o `+interna`).
5. **Re-ejecutar tests** `oposicionesDataConsistency` + `oposicionDataCompleteness` (deben quedar verdes) y **revalidar** tags `landing`+`temario`.
6. Cuando se publique la **convocatoria** del nuevo ciclo, actualizar de nuevo (estado→`convocada`/`inscripcion_abierta`, fechas, inscripción, hitos del proceso) — vuelta al flujo normal del manual.

**Caso CLM (04/06/2026):** ciclo OEP 2023-2024 (234 plz, examen 14/10/2025) → pivotado a **OEP 2025** (`oep_aprobada`, 305 acceso general + 22 discapacidad = 327 turno libre, examen pendiente, boletín DOCM nº 240 12/12/2025). Backup en `/tmp/clm_hitos_backup_2024.json`. 19/19 tests verdes, landing en vivo mostrando "OEP 2025 · 327 plazas previstas".

**Estado de la detección automática (honesto, 04/06/2026):** existe infraestructura de señales (`lib/api/oep-signals/`) que el seguimiento usa, PERO **el cron `check-seguimiento` está DESACTIVADO** (`.github/workflows/check-seguimiento.yml.DISABLED`) y la detección genera señales **genéricas de cambio de hash**, NO un clasificador "OEP publicada". Por tanto el rollover es **manual** (lo dispara una persona al ver la señal o la noticia). **Pendiente (automatización):** (a) reactivar el cron; (b) clasificador que distinga "OEP publicada en el boletín" → señal específica → propuesta de rollover con la cifra ya extraída del decreto.

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

### 4f. Turno libre vs promoción interna (CRÍTICO)

Muchas CCAA (Galicia, CyL, Andalucía, Madrid, etc.) y el Estado convocan **dos
oposiciones en paralelo** con procedimientos distintos: **turno libre** y
**turno de promoción interna**. Publican listas de admitidos, tribunales,
exámenes y resultados por separado, **a veces el mismo día en el mismo BOE/DOG**.

**En Vence cada oposición tiene `tipo_acceso`** (`libre`, `promocion_interna`,
`estabilizacion`, etc.). Los hitos que añadas a un registro deben corresponder
**exclusivamente** a ese turno.

**Regla**: al aplicar una señal OEP que crea un hito tipo "Listas de admitidos"
o similar, verificar que el DOG/BOE origen indique turno **libre** (o ambos).
Si el documento es solo de promoción interna, **NO añadir el hito** a la
oposición libre.

**Caso real (Galicia, 14/04/2026)**: el DOG 27/03/2026 publicó listas
provisionales de admitidos y excluidos de promoción interna C1/C2. Un sensor
añadió el hito al timeline de `auxiliar-administrativo-galicia` (tipo_acceso
libre), contradiciendo la realidad. Isabel lo detectó al recibir newsletter.

**Heurísticas para distinguir turno en el texto del DOG/BOE**:
- `"turno de promoción interna"`, `"promoción interna"`, `"acceso interno"` → NO aplicar a libre
- `"turno libre"`, `"acceso libre"`, `"por el sistema de oposición libre"` → aplicar a libre
- Si el texto menciona ambos turnos → se pueden aplicar a ambas oposiciones SI existen entradas separadas

El test `__tests__/integration/oposicionesDataConsistency.test.ts` detecta este
error: oposiciones con `tipo_acceso=libre` que tienen hitos con títulos que
mencionan "promoción interna".

### 4g. Integridad cruzada: exam_date ↔ landing_description ↔ hitos

La información de fechas y plazas aparece en 3 sitios que deben coincidir:

| Campo / ubicación | Qué contiene |
|---|---|
| `oposiciones.exam_date` | Fecha oficial o estimada del primer ejercicio |
| `oposiciones.landing_description` | Texto SEO que menciona mes/año y plazas |
| `convocatoria_hitos` con título "Primer ejercicio" o "Examen" | Fecha del hito |

**Regla**: si la landing dice *"previsto septiembre 2026"* y `exam_date =
2026-10-01`, hay un bug en uno de los dos. El test detecta estas
contradicciones automáticamente en CI.

**Cuando actualices una fecha, hazlo en los 3 sitios** o al menos ejecuta el
test antes de commitear para detectar desajustes.

### 4g-bis. Integridad cruzada: inscription_start / inscription_deadline ↔ hitos

Los plazos de inscripción aparecen en dos sitios que **DEBEN** coincidir:

| Campo / ubicación | Qué contiene |
|---|---|
| `oposiciones.inscription_start` | Fecha oficial de apertura del plazo de presentación de solicitudes |
| `oposiciones.inscription_deadline` | Fecha oficial de cierre del plazo |
| `convocatoria_hitos` con título tipo "Apertura plazo de inscripción" / "Inicio plazo solicitudes" | Fecha = `inscription_start` |
| `convocatoria_hitos` con título tipo "Cierre plazo de inscripción" / "Fin plazo solicitudes" | Fecha = `inscription_deadline` |

**Regla:** al añadir un hito de apertura/cierre de inscripción, **siempre** actualizar también la columna correspondiente en `oposiciones`. Y a la inversa: si actualizas `inscription_*`, asegúrate de que el hito refleja la misma fecha (o créalo si no existe).

**Por qué importa:** la columna `inscription_*` la consume el banner global de "Inscripción abierta" (componente `OpenInscriptionBanner.tsx`) y la landing pública del hero. Si solo metes el hito pero no la columna, el banner es ciego a esa convocatoria y la landing muestra "Inscripción no abierta" aunque sí lo esté.

**Caso real (27/05/2026):** auditoría disparada por el lanzamiento del banner detectó:
- `auxiliar-administrativo-diputacion-cadiz`: hito cierre 22/02/2024 presente, columna `inscription_deadline = NULL` → backfill desde BOE-A-2024-1395 (inicio 26/01, cierre 22/02).
- `auxiliar-enfermeria-gva`: hitos apertura 13/03/2026 y cierre 27/03/2026 presentes, ambas columnas NULL → backfill desde DOGV 10321.

**⚠️ Footgun de driver pg con DATE en Node.js:**

La columna `inscription_*` y `convocatoria_hitos.fecha` son `date` (sin TZ). El driver `pg` las devuelve como objeto `Date` JS interpretado como medianoche UTC; si haces `.toISOString().slice(0,10)` desde Madrid (TZ +01) **te muestra el día anterior**. Verifica SIEMPRE con `::text` o `::date::text` en SQL, no con `.toISOString()` en Node:

```js
// ❌ MAL — resta 1 día
console.log(row.inscription_deadline.toISOString().slice(0, 10))

// ✅ BIEN — usa el cast SQL
const q = await c.query(`SELECT inscription_deadline::text FROM oposiciones WHERE …`)
console.log(q.rows[0].inscription_deadline)  // YYYY-MM-DD sin TZ shift

// ✅ BIEN — desactivar el parser DATE de pg al inicio del script
const { types } = require('pg')
types.setTypeParser(1082, v => v)  // 1082 = OID de DATE
```

El test `__tests__/integration/oposicionesDataConsistency.test.ts` cubre esta regla y debería fallar si alguien rompe la sincronía sin querer.

### 4h. Detección de hitos con fechas estimadas (deuda §4e)

Los hitos **upcoming** cuya descripción contiene `estimada | aproximada | prevista | tentativa | pendiente` violan §4e — ningún hito debe existir sin fecha oficial publicada. Detectar y limpiar periódicamente:

```js
const { data } = await supabase
  .from('convocatoria_hitos')
  .select('id, oposicion_id, titulo, fecha, status, descripcion, oposiciones(slug)')
  .eq('status', 'upcoming')
  .or('descripcion.ilike.%estimad%,descripcion.ilike.%aproximad%,descripcion.ilike.%previsto%,descripcion.ilike.%previsi%,descripcion.ilike.%tentativ%,descripcion.ilike.%pendiente%')

for (const h of data) {
  console.log(`[${h.oposiciones.slug}] ${h.status} ${h.fecha} — ${h.titulo}`)
}
```

**Fechas-centinela.** Además de la descripción, sospechar de hitos `upcoming` con fecha **placeholder**: `31/12` de cualquier año, o día `01`/`15` (primero o mitad de mes). No es prueba automática — un examen real puede caer un día 1 — pero todo hito con esas fechas debe verificarse contra el boletín oficial; si no hay fecha oficial publicada, se borra (§4e).

Para cada hito detectado:
1. Borrarlo del timeline (`DELETE FROM convocatoria_hitos WHERE id = '<uuid>'`).
2. Si la previsión tiene valor SEO para la landing, trasladar a `oposiciones.exam_date + exam_date_approximate=true` (solo para el **primer ejercicio**) o a `landing_description` (para cualquier otro hito).
3. Reindexar `order_index` con el script de §4d (opcional pero recomendado si quedan huecos).

**Incidente que motiva esta sección (14/04/2026):** audit de 3 oposiciones con `seguimiento_change_status=changed` detectó que las 3 tenían hitos upcoming con "Fecha estimada" violando §4e. Un escaneo global encontró 18 hitos en 10 oposiciones. Patrón generalizado a limpiar.

### 4i. Detección de landings con fechas caducas

Cuando pasa tiempo, el texto de `landing_description` puede quedar desfasado: la landing dice *"examen previsto junio 2025"* y ya estamos en 2026. Esto es peor que un hito estimado porque afecta directamente al SEO y a la captación.

**Detección:**

```js
const { data: ops } = await supabase
  .from('oposiciones')
  .select('slug, landing_description, estado_proceso, exam_date, updated_at')
  .eq('is_active', true)

const now = new Date()
for (const op of ops) {
  const text = op.landing_description || ''
  // Buscar referencias a años/meses antiguos
  const yearMatch = text.match(/\b(20\d{2})\b/g)
  if (yearMatch) {
    const oldYears = yearMatch.filter(y => parseInt(y) < now.getFullYear())
    if (oldYears.length) console.log(`[${op.slug}] menciona años antiguos: ${oldYears.join(',')}`)
  }
}
```

Para cada landing con año antiguo:
1. Reescribir `landing_description` con fecha actualizada (si la oposición sigue activa).
2. Si el proceso ya terminó y no hay nueva OEP → aplicar §9 Paso 3 (transición a modo captación).
3. Verificar que coincide con `exam_date` (§4g).

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

### Convención para `admin_notes` (post-14/04/2026)
Al aplicar o descartar una señal, escribir en `admin_notes` **una línea** que resuma la acción real tomada:

- Si se aplicaron cambios: *"Aplicado: añadidos hitos X, Y. exam_date → 2026-06-15. Revalidado landing."*
- Si fue falso positivo cosmético: *"Descartado: cambio cosmético (timestamps dinámicos). Sin novedad real en la fuente."*
- Si requiere futura acción: *"Aplicado parcial: faltan listas definitivas oficiales. Reauditar en 2 semanas."*

Sirve de trazabilidad para que el siguiente operador entienda el historial sin tener que volver a consultar la fuente.

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

Para forzar regeneracion inmediata, usar el endpoint `/api/purge-cache`:

```bash
curl -X POST "https://www.vence.es/api/purge-cache" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -d '{"path": "/auxiliar-administrativo-carm"}'
```

**IMPORTANTE:** El secret es el `CRON_SECRET` de `.env.local` (no `REVALIDATION_SECRET`). Se envia en el header `x-cron-secret`.

Siempre forzar la revalidacion despues de actualizar hitos o estado de la oposicion — no esperar 24h si los usuarios van a recibir un email con el link a la landing.

## 7b. Notificar a los usuarios

> Hay DOS canales: **(7b.0) la campana 🔔 in-app** (automática, Fase 8) y **(7b.1) el email newsletter** (manual, abajo). La campana es el canal por defecto; el email solo para hitos críticos.

### 7b.0 Campana automática (Fase 8) — lo haces TÚ al verificar el hito

**Mecanismo:** cuando un hito de `convocatoria_hitos` pasa a `notify_status='verified'` (y `severity != 'cosmetic'`), un trigger (`tg_hito_fanout_alerts`) crea automáticamente un aviso en `user_oposicion_alerts` para **cada usuario que sigue esa oposición** con la campana activada (su **target** actual **o** una **favorita**). La campana 🔔 (`NotificationBell`) lo muestra al instante.

**GUARDARRAÍL (innegociable):** un aviso NO sale de un dato sin verificar. Por eso el hito nace `pending` y **solo TÚ (Claude) lo pasas a `verified`**, y SOLO después de confirmar la fuente oficial (BOE/boletín/sede) — que es justo lo que ya haces en §2-§3 de este manual. El cron NUNCA pone `verified`.

**⚠️ COMPROBACIÓN PREVIA OBLIGATORIA (antes de poner `verified`):** el aviso de la campana lleva al usuario a **nuestra landing** (`/<slug>`). Como vas a mandar ahí a cientos/miles de opositores, **verifica que la landing está correcta ANTES de disparar**:
1. Abre `https://www.vence.es/<slug>` y comprueba que el **timeline "📅 Estado del Proceso Selectivo"** muestra los hitos **bien y al día** (el hito que vas a notificar aparece, fechas correctas, `status` coherente, sin hitos duplicados/estimados sucios — §4d/§4h).
2. Los **datos** de la landing son correctos (plazas, fechas, estado — §4g integridad cruzada).
3. Cada hito relevante **enlaza a su fuente oficial** (`convocatoria_hitos.url` → el título es un `<a>` a BOE/boletín/sede). Si al hito que notificas le falta la `url` oficial, **añádela** (§4b) antes de notificar.
4. Si la landing es ISR/cacheada, **revalida** (§Paso 5) para que el usuario vea los datos nuevos al llegar.

Solo cuando la landing está impecable, procede al fan-out.

**Cuándo hacerlo (durante "revisa oep"):** tras insertar/actualizar un hito notable (§4b) cuya fuente has confirmado **y con la landing verificada (arriba)**, márcalo verificado:

```javascript
// 1) Resolver la audiencia ANTES de disparar (para informar a Manuel)
const { count } = await supabase
  .from('user_oposiciones_seguidas')
  .select('*', { count: 'exact', head: true })
  .eq('oposicion_id', '<uuid_oposicion>')
  .eq('notify_bell', true)
console.log('Avisaría en campana a', count, 'usuarios')

// 2) Disparar el fan-out (poner verified) — el trigger crea los avisos
await supabase.from('convocatoria_hitos')
  .update({ severity: 'critical', notify_status: 'verified' })
  .eq('id', '<hito_id>')
```

**Política con Manuel (confirmar antes de disparar):** como el fan-out impacta a usuarios reales (cientos/miles), antes de poner `verified` **dile a Manuel qué hito vas a notificar, con qué `severity` y a cuántos usuarios**, y espera su OK. Para `critical` (que en 8d además mandará email) confirma siempre. Solo `verified` dispara; `important` = solo campana, `critical` = campana (+email cuando exista 8d). Históricos quedan `pending` (no se notifican retroactivamente).

**Idempotente y seguro:** `unique(user_id, hito_id)` evita duplicados; el trigger es fail-open + observable (`observable_events` event_type `hito_fanout_failed`) — si fallara, NO bloquea la edición del hito.

### 7b.1 Email newsletter (manual)

Cuando hay un cambio relevante (fecha de examen, listas definitivas, etc.), enviar newsletter a los usuarios de esa oposicion usando la plantilla `novedad-convocatoria`:

### Paso 1: Verificar audiencia

```javascript
// Usuarios de la oposicion
const { data: users } = await supabase
  .from('user_profiles')
  .select('id, email')
  .eq('target_oposicion', '<slug_oposicion>')
  .not('email', 'is', null)

// Excluir bloqueados
const { data: blocked } = await supabase
  .from('email_preferences')
  .select('user_id')
  .or('unsubscribed_all.eq.true,email_newsletter_disabled.eq.true')
const blockedIds = new Set((blocked || []).map(b => b.user_id))
const eligible = users.filter(u => !blockedIds.has(u.id))
console.log('Elegibles:', eligible.length)
```

### Paso 2: Enviar test al admin primero

```javascript
const res = await fetch('https://www.vence.es/api/admin/newsletters/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateSlug: 'novedad-convocatoria',
    templateVariables: {
      nombreOposicion: 'Auxiliar Administrativo CARM',
      titulo: 'Examen el 21 de junio',
      descripcion: 'Ya se han publicado las listas definitivas...',
      novedadesHtml: '<li style="padding: 8px 0;">✅ Novedad 1</li><li style="padding: 8px 0;">📅 Novedad 2</li>',
      mensajeMotivacional: 'Quedan X meses. Ahora es cuando cuenta.',
      ctaUrl: 'https://www.vence.es/<slug>/test?utm_source=email&utm_campaign=novedad',
      ctaTexto: 'Seguir practicando',
      infoUrl: 'https://www.vence.es/<slug>?utm_source=email&utm_campaign=novedad',
    },
    selectedUserIds: ['<admin_user_id>'],
    testMode: false,
  }),
})
```

### Paso 3: Verificar el email y enviar a todos

Una vez aprobado el test, enviar con `selectedUserIds` de todos los elegibles.

### Variables de la plantilla `novedad-convocatoria`

| Variable | Descripcion | Auto? |
|----------|-------------|-------|
| `userName` | Nombre del usuario | Si |
| `nombreOposicion` | Nombre completo de la oposicion | No |
| `titulo` | Titulo corto (aparece en subject y header) | No |
| `descripcion` | Texto explicativo del cambio | No |
| `novedadesHtml` | HTML con items `<li>` de novedades | No |
| `mensajeMotivacional` | Mensaje motivacional en caja azul | No |
| `ctaUrl` | URL boton verde "Seguir practicando" | No |
| `ctaTexto` | Texto del boton verde | No |
| `infoUrl` | URL boton azul "Ver toda la info" | No |
| `unsubscribeUrl` | Link de baja | Si (lo añade el sistema) |

### Cuando enviar newsletter

| Cambio | ¿Enviar? |
|--------|----------|
| Fecha de examen confirmada | Si |
| Listas definitivas publicadas | Si |
| Resultados publicados | Si |
| Cambio cosmetico en la web | No |
| Listas provisionales | Opcional |
| Nuevo hito menor | No |

## 7c. Importar las preguntas del examen (ampliar banco de preguntas)

Cuando un examen ya se ha celebrado y se publican los cuestionarios (modelos A/B) con sus plantillas correctoras provisionales, es el mejor momento para **importar las preguntas oficiales a Vence** y ampliar el banco de la oposición. Es uno de los momentos de mayor valor de la operativa de seguimiento — no quedarse solo en actualizar el timeline.

**Cuándo importar:**

- `estado_proceso = 'examen_realizado'` (o más adelante: `resultados`, `nombramientos`)
- Cuestionarios oficiales + plantilla provisional/definitiva ya publicados en la web oficial
- **Solo turno libre / ingreso libre** (regla §1 del manual de importación — NUNCA estabilización ni consolidación)

**⚠️ Si hay varios modelos (A, B, C...), descargar e importar SOLO UNO.**

Las administraciones publican habitualmente 2-4 modelos del mismo examen para evitar copias. **Las preguntas son las mismas barajadas en distinto orden** (y a veces con las opciones también barajadas). Importar varios modelos genera duplicados masivos en el banco y degrada la experiencia del usuario (la misma pregunta aparece N veces en simulacros).

Regla:
- Descargar **solo el modelo A** (o el primero disponible)
- Documentar en `exam_source` que es el modelo importado (ej: `Examen Aux Admin Estado - OEP 2024-2025 - Convocatoria 23/05/2026 (Modelo A)`)
- Conservar los PDFs de los demás modelos en `data/examenes-oficiales/<oposicion>/<fecha>/` por si surge una duda, pero **no importar sus preguntas**

**Cómo importar — flujo completo (legislativas + ofimáticas + psicotécnicas):**

Ver `docs/maintenance/importar-examen-oficial-completo.md`. Cubre:
1. Localizar PDFs oficiales (cuestionario + plantilla)
2. Extraer texto con `pdftotext`
3. Construir JSON estructurado
4. Verificar leyes / artículos (crear faltantes, ampliar `topic_scope`)
5. Importar EN `lifecycle_state='draft'` (oculto a estudiantes)
6. Manejar figuras psicotécnicas (`pdftoppm` + `magick crop` + Storage)
7. Verificar con 5 agentes Sonnet (`ai_verification_results`)
8. Pipeline de activación automática vía `transition_question_state`
9. Cache invalidate

**Variante rápida** (solo legislativas, sin imágenes ni psicotécnicas): `docs/manual-preguntas-oficiales.md`.

**🚫 Anti-patrón crítico:** importar con `lifecycle_state='approved'` o `'tech_approved'` directamente, saltándose la verificación IA. **NUNCA hacerlo** (§0 del manual de importación). Siempre `draft` → verificación → transición automática.

**Por qué importar tras cada examen:**
- Cada examen oficial añade ~100 preguntas verificadas al banco de la oposición
- Los aspirantes esperan tener los exámenes recientes disponibles en el simulador
- Tener exámenes recientes es un diferenciador frente a otros portales

**Cuándo NO importar (todavía):**
- Solo está la plantilla pero NO el cuestionario en PDF descargable
- El proceso es de estabilización / consolidación / extraordinario (descartar)
- Aún no hay plantilla provisional (esperar a que se publique)

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
| **E. OEP detectada que no tenemos** | Señal `generic_source` con oposicion_id=NULL, o cuerpo nuevo descubierto on-demand (§10) | Verificar demanda. Si merece: dar de alta su `seguimiento_url` server-rendered en `generic_source_checks` para vigilancia; construir oposición Vence completa (landing+temario+preguntas) solo si se decide cubrirla. |

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

### Paso 3.5: Notificar en la campana 🔔 los hitos verificados (Fase 8)

Para cada hito **notable que hayas confirmado contra la fuente oficial** en este barrido (listas provisionales/definitivas, fecha de examen, apertura de convocatoria, plantilla, resultados):
1. **Verifica la landing PRIMERO** (`/<slug>`): timeline de hitos al día y correcto, datos correctos, enlace a la fuente oficial en el hito, y revalida si es cacheada. El aviso manda al usuario ahí — no notifiques sobre una landing desactualizada (checklist completo en **§7b.0**).
2. Pon su `severity` (criterio en §4b) y resuelve la audiencia (nº de seguidores con campana).
3. **Avisa a Manuel:** "voy a notificar `<hito>` (`severity`) a `<N>` usuarios de `<oposición>`" y espera OK.
4. Con el OK, pon `notify_status='verified'` → el trigger crea los avisos en la campana (ver **§7b.0**).

NO notifiques hitos cosméticos ni sin verificar. Históricos quedan `pending`.

### Paso 4: Marcar revisado

- En `/admin/oep-signals`: pulsar Aplicar o Descartar en cada señal procesada
- Si había checks hash_change: marcar revisados en `convocatoria_seguimiento_checks`
- Resetear `seguimiento_change_status = 'ok'` en oposiciones afectadas

### Paso 4.5: Importar las preguntas del examen (si procede)

Si el cambio detectado es que **el examen ya se ha celebrado y se han publicado cuestionario + plantilla**, el siguiente paso de la operativa es importar las preguntas al banco de Vence (no se hace solo con actualizar el timeline).

Ver §7c "Importar las preguntas del examen" — incluye:
- Cuándo importar (estado, modelo único A, solo turno libre)
- Manual completo: `docs/maintenance/importar-examen-oficial-completo.md`
- Variante rápida: `docs/manual-preguntas-oficiales.md`
- Anti-patrón: nunca insertar como `approved` directamente

Este paso suele ocupar varias horas (descarga, extracción, verificación IA con 5 agentes) y conviene planificarlo de forma independiente al resto del flujo de seguimiento. Marcar la señal como revisada en Paso 4 no implica haber importado las preguntas — son acciones separadas que conviven.

### Paso 5: Revalidar landing

Forzar regeneracion de la landing para que muestre los datos actualizados:
```bash
curl -X POST "https://www.vence.es/api/purge-cache" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -d '{"path": "/auxiliar-administrativo-carm"}'
```

### Paso 6: Enviar newsletter (si el cambio es relevante)

Si hay fecha de examen, listas definitivas o resultados, avisar a los usuarios con la plantilla `novedad-convocatoria` (ver seccion 7b).

## 10. Descubrimiento de oposiciones NUEVAS (cuerpos fuera de catálogo)

> **⛔ CAMBIO 01/06/2026 — el scraper regional `detect-regional-oeps` fue RETIRADO.** Run forzado real: 167 fuentes, 93 fallos (56% error), falsos positivos demostrados ("Listado de colaboradores", procesos finalizados, C1 de 1 plaza). El descubrimiento de cuerpos nuevos pasa a ser **on-demand por Claude**. Código borrado en `backend/src/detect-regional-oeps/`; la tabla `detection_sources` (167 filas) queda dormida sin cron que la lea. Detalle: `docs/roadmap/deteccion-convocatorias-oeps-completo.md` (banner decisión 01/06).

### Modelo actual: "Claude mete, el cron revisa"

**Los crons NO descubren** — solo revisan novedades sobre las `seguimiento_url` que ya tenemos. Meter/verificar cuerpos lo hace **Claude a mano, poco a poco**.

**Punto de partida: el universo C2 YA está registrado.** `oposiciones` tiene 146 filas: 45 activas (públicas) + **101 `coverage_level='catalogada'`** (`is_active=false`, NO públicas), de las cuales **100 ya traen `seguimiento_url`**: todos los grandes ayuntamientos (Madrid, Barcelona, Sevilla, Zaragoza, Málaga, Bilbao, Las Palmas…), todas las diputaciones, todos los cabildos, Navarra, Ceuta, Melilla, sanitarias. Listarlas:

```sql
SELECT slug, seguimiento_url FROM oposiciones
WHERE coverage_level='catalogada' AND seguimiento_url IS NOT NULL ORDER BY slug;
```

**El cron ya las vigila** (cambio 01/06): `getOposicionesForLlmScan` dejó de filtrar `is_active=true` → revisa toda `seguimiento_url` aunque `is_active=false`. `is_active` solo gobierna la visibilidad pública (no se toca, así no salen tarjetas vacías).

**Trabajo poco a poco de Claude** (cuando el admin diga *"revisa oeps"* / *"mete oposiciones"*):
1. Tomar una `catalogada` (o un hueco real si faltara algún cuerpo).
2. **Verificar su `seguimiento_url` con WebFetch**: que sea **server-rendered y específica** (ver caveat JS abajo). Si es genérica/SPA → buscar alternativa server-rendered y `UPDATE oposiciones SET seguimiento_url=...`.
3. Cuando se decida **cubrir** el cuerpo de verdad → construir landing+temario+preguntas y `is_active=true` (deja de ser `catalogada`).

> Nota: `generic_source_checks` + cron `detect-generic-sources` se reservan para **fuentes agregadoras** que NO son un cuerpo concreto (DGFP, INAP, Moncloa…). Para cuerpos C2 individuales, la `seguimiento_url` va en su fila de `oposiciones` (catalogada), que es lo que el cron de revisión vigila.

### ⚠️ Caveat JS-rendering (CRÍTICO — es el problema de raíz del roadmap)

El monitoreo hace **fetch HTML plano + hash + LLM**. Las webs **JS-rendered (SPA)** devuelven un shell de navegación vacío que nunca cambia → el monitor **nunca dispararía**. Meter una URL SPA sería una chapuza silenciosa: parece vigilada pero no detecta nada.

**Regla:** solo dar de alta URLs **server-rendered** (boletín oficial, sede electrónica con detalle, listado plano de OEP). Verificar SIEMPRE con WebFetch antes de insertar: pedir "¿lista entradas concretas con años/fechas/BOAM o solo un menú?". Si solo trae menú → es SPA, buscar alternativa server-rendered o dejarla para cuando exista el headless browser (Fase 1 del roadmap).

- Ejemplo confirmado SPA (NO sirve): `madrid.es/.../Oposiciones/` (buscador de oposiciones) → solo menú.
- Ejemplo confirmado server-rendered (SÍ sirve): `madrid.es/.../Oferta-de-Empleo-Publico/Ofertas-de-empleo-publico/` → lista OEP 2025/2024/2021 con BOAM y fechas.

### Cómo dar de alta / corregir una `seguimiento_url`

**Caso primario — cuerpo C2 individual (la fila ya existe como `catalogada`):** simplemente `UPDATE` su `seguimiento_url` con la URL server-rendered verificada. El cron ya la vigila (no filtra `is_active`). La fila sigue `is_active=false` (no pública) hasta que se construya su landing.

```javascript
// Verificada server-rendered con WebFetch antes de escribir
await s.from('oposiciones')
  .update({ seguimiento_url: 'https://www.madrid.es/.../Ofertas-de-empleo-publico/...' })
  .eq('slug', 'auxiliar-administrativo-ayuntamiento-madrid');
```

**Caso secundario — fuente agregadora que NO es un cuerpo concreto** (DGFP, INAP, Moncloa, un BOP entero): va en `generic_source_checks` (RLS admin → `SUPABASE_SERVICE_ROLE_KEY`), la vigila el cron `detect-generic-sources`:

```javascript
const s = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
await s.from('generic_source_checks').insert({
  source_key: 'snake_case_unico', source_name: '…', source_url: '…server-rendered…', is_active: true,
});
```

### Por qué NO poner `is_active=true` sin landing

- `is_active=true` sin landing/temario → **tarjeta vacía rota** en `/oposiciones` (el frontend filtra por `is_active`, no por `coverage_level`).
- Por eso los cuerpos registrados se quedan `catalogada` + `is_active=false` (no públicos) PERO con `seguimiento_url`, y el cron de revisión los vigila igualmente (ya no filtra `is_active`). Se pasan a `is_active=true` solo cuando se construye su landing+temario.

### Forzar un cron manualmente (smoke / tras incidente)

Endpoint admin del backend: `POST https://api.vence.es/api/v2/admin/cron/run-now` body `{"name":"<cron>"}` (requiere JWT de admin). `fireOnTick()` lanza el tick en background (responde `durationMs:1` al instante); el resultado se confirma en `observable_events` (`endpoint=<cron>`, `event_type=cron_run`) cuando termina. Cualquier `@Cron` registrado es dispatcheable por nombre.

### Badge 🎯 OEPs — dos tipos de aviso por color (desde 01/06/2026)

- **Naranja/rojo** = `oep_detection_signals` pendientes (rojo si confianza ≥60). Cambios en seguimiento de cuerpos del catálogo + nuevas OEP de las fuentes `generic_source_checks`.
- **Morado** = `discovered_processes` activos (`manuel_status IN ('new','watching')`). Procesos sembrados manualmente fuera de catálogo. Triaje por SQL bajo demanda (no hay panel; Fase 6 descartada).

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

### 11.1 Convocatorias en paralelo (activa + nueva sin terminar la anterior)

**Caso típico:** la convocatoria en curso aún no ha llegado a nombramientos (ej. examen pendiente o resultados sin publicar) y la administración publica una **segunda convocatoria** de la misma oposición (nueva OEP, nuevas plazas, nuevo BOE). Hay dos audiencias simultáneas:
- Quienes están inscritos en la convocatoria activa → necesitan info del examen, listas, temario
- Quienes quieren prepararse para la nueva convocatoria → necesitan saber plazas, plazo previsto, temario

**Regla: una sola landing canónica.** No crear `slug-YYYY` para la segunda convocatoria mientras la primera siga viva. Razones:
- Canibalización SEO entre dos páginas casi idénticas compitiendo por la misma keyword
- Doble gestión de hitos, riesgo de inconsistencias
- Es la **misma oposición** desde el punto de vista del temario y los tests (el estudiante usa los mismos recursos para ambas)

**Qué hacer en la fila activa:**
1. Mantener `oposiciones.boe_reference`, `oep_decreto`, `exam_date` etc. enfocados en la **convocatoria activa** (la que tiene examen próximo)
2. Mencionar la nueva convocatoria en `landing_description` para SEO:
   > "33 plazas... examen 6 junio 2026. Próxima convocatoria de 44 plazas (OEP 2023-2025) recién publicada en BOE."
3. NO mezclar plazas en los campos numéricos (`plazas_libres` debe reflejar solo la convocatoria activa). Si se mezclan los hitos cuentan números distintos y queda incoherente.
4. NO crear hitos de la convocatoria nueva en `convocatoria_hitos` de esta fila — sus hitos son de otro proceso

**Cuándo SÍ crear fila nueva (transición):**
Cuando la convocatoria activa llega a `nombramientos` (o `resultados` sin más actividad pendiente):
1. Renombrar la fila activa a `slug-YYYY` con `is_active=false` (manteniendo SEO histórico)
2. Crear nueva fila con slug canónico apuntando a la nueva convocatoria
3. Redirect 301 en next.config.mjs

**Pendiente técnico (renderizado):**
La landing pública aún no tiene una sección visible "Próxima convocatoria" que destaque la futura OEP — solo lo refleja en el meta description. Tarea: añadir sección condicional en el componente de landing cuando exista una próxima convocatoria documentada (ver issue de UX, sin abrir aún). Por ahora basta con `landing_description` actualizado para captar búsquedas SEO de ambas audiencias.

**Caso real 1 (Cádiz, 21/05/2026):** sensor `llm_semantic` detectó OEP 2023-2025 (44 plazas, BOE-A-2025-3221, BOP 11/02/2026) mientras la convocatoria activa (33 plazas, OEP 2021/2022, examen 06/06/2026) seguía en curso. Decisión: mantener la fila enfocada en la activa + mencionar la nueva en `landing_description`. Reauditar tras nombramientos para transicionar.

**Caso real 2 (Estado, 22/05/2026):** 3 señales `generic_source` (notas de prensa Moncloa/MTDFP) detectaron la aprobación de la OEP 2026 (RD 387/2026, BOE 07/05/2026) — Cuerpo General Auxiliar C2: 1.450 plazas turno libre + 120 promoción interna — mientras la convocatoria activa (1.700 plazas, RD 1052/2025, examen 23/05/2026) seguía en curso. Decisión: mantener campos numéricos de la convocatoria activa intactos + mencionar la OEP 2026 en `landing_description`. La convocatoria derivada debe publicarse antes de fin de 2026; reauditar entonces.

### 11.2 Falso positivo: convocatoria ya en BD detectada como novedad

Un sensor (`regional_scan`, `llm_semantic`) puede marcar como **novedad** una convocatoria que **ya existe en BD** porque lee un anuncio antiguo o un dato parcial. Antes de tratar una señal como convocatoria nueva, **cruzar contra los hitos existentes**:

1. Buscar la oposición candidata en `oposiciones` por nombre/región
2. Leer sus `convocatoria_hitos` y comparar fechas/referencias BOP con las de la señal
3. Si la fecha de la señal coincide con un hito existente → es la misma convocatoria, **descartar**

**Caso real (Valencia, 21-22/05/2026):** `regional_scan` (80) + `llm_semantic` (75) marcaron "Auxiliar Administrativo Estabilización 176 plazas C2" como novedad. La diferencia de plazas (176 ≠ 274 en BD) disparó la alerta. Pero al cruzar con los hitos de `auxiliar-administrativo-ayuntamiento-valencia` se vio que era la **misma** convocatoria: empezó con 176 plazas (BOP 12/07/2024 = hito 1) y se amplió a 274 mediante ampliaciones posteriores (BOP 206 28/10/2025 = hito 2, BOP 228 = hito 3). El LLM había leído el anuncio original. Ambas señales descartadas como falso positivo. Lección: una discrepancia de plazas NO implica convocatoria nueva — puede ser una ampliación ya registrada en hitos.

## 12. Referencia rápida: nombres de columnas

Las tablas usan nombres en español (no en inglés). Referencia para evitar errores:

### Tabla `oposiciones`
| Columna | Tipo | Nota |
|---------|------|------|
| `nombre` | text | NO es `name` |
| `slug` | text | Identificador URL |
| `estado_proceso` | text | Ver tabla de estados en sección 3c |
| `plazas_libres` | integer | |
| `plazas_discapacidad` | integer | |
| `plazas_promocion_interna` | integer | |
| `exam_date` | date | |
| `exam_date_approximate` | boolean | |
| `seguimiento_url` | text | URL de la página oficial de seguimiento |
| `inscription_start` | date | |
| `inscription_deadline` | date | |
| `boe_reference` | text | |

### Tabla `convocatoria_hitos`
| Columna | Tipo | Nota |
|---------|------|------|
| `oposicion_id` | uuid | FK a oposiciones.id — NO es `oposicion_slug` |
| `titulo` | text | NO es `title` |
| `fecha` | date | NO es `date` |
| `descripcion` | text | |
| `url` | text | |
| `status` | text | `completed`, `current`, `upcoming` |
| `order_index` | integer | Secuencial, sin duplicados |

### Tabla `oep_detection_signals`
| Columna | Tipo | Nota |
|---------|------|------|
| `oposicion_id` | uuid | FK a oposiciones.id |
| `source_url` | text | URL de la fuente donde se detectó (coincide con `seguimiento_url` de oposiciones) |
| `status` | text | `pending`, `applied`, `dismissed`, `auto_applied` |
| `sensor_type` | text | `llm_semantic`, `timeline_silence`, `hash_change`, `regional_scan`, etc. |
| `confidence_score` | integer | 0-100 |
| `reviewed_at` | timestamp | |
| `admin_notes` | text | |

### Matchear señales con oposiciones

Las señales tienen `oposicion_id` pero a veces las queries de Supabase no resuelven bien por RLS. Para cruzar señales con oposiciones, usar `source_url` de la señal contra `seguimiento_url` de la oposición:

```javascript
// Con postgres.js (bypass RLS)
const pg = require('postgres');
const conn = pg(process.env.DATABASE_URL, { max: 1, prepare: false });
const [op] = await conn`SELECT * FROM oposiciones WHERE seguimiento_url = ${signal.source_url}`;
```

### API para contar señales pendientes

```
GET /api/admin/oep-signals/pending-count
→ { success: true, pendingCount: 6, criticalCount: 4 }
```

## 13. Cambios cosmeticos (falsos positivos)

A veces el hash cambia sin novedad real (timestamps, tokens de sesion, contenido dinamico de la web). Indicadores de cambio cosmetico:

- `content_length` casi identico (diferencia < 100 bytes)
- Hash cambia cada dia pero no hay documentos nuevos
- La pagina es un portal generico (no ficha del proceso)

En estos casos: marcar como revisado sin hacer cambios en hitos.

## 14. Debugging: cuando un sensor no produce señales esperadas

Si un sensor deja de generar señales cuando cabría esperarlo (ej. llevas días sin ver alertas aunque sabes que un BOE salió), verificar:

### 14.1 llm_semantic

```js
// Última ejecución exitosa
const { data } = await supabase
  .from('oep_detection_signals')
  .select('created_at')
  .eq('sensor_type', 'llm_semantic')
  .order('created_at', { ascending: false })
  .limit(1)
console.log('Última señal LLM:', data?.[0]?.created_at)
```

Si >48h sin producir señales: verificar cron en GitHub Actions (`.github/workflows/detect-oep-llm.yml`), cuota Anthropic, rate limits Claude Haiku.

### 14.2 timeline_silence

```js
// Hitos current con fecha pasada (deberían generar señal)
const { data } = await supabase
  .from('convocatoria_hitos')
  .select('oposicion_id, titulo, fecha, oposiciones(slug)')
  .eq('status', 'current')
  .lt('fecha', new Date().toISOString().slice(0,10))

console.log('Hitos current caducos que deberían disparar señal:', data?.length)
```

Si hay hitos `current` con fecha pasada >3 días pero sin señal correspondiente en `oep_detection_signals`, el cron `timeline_silence` puede estar caído.

### 14.3 hash_change

```js
// Oposiciones con seguimiento_url cuyo último check falló o no hay check reciente
const { data: ops } = await supabase
  .from('oposiciones')
  .select('slug, last_checked_at, seguimiento_url')
  .eq('is_active', true)
  .not('seguimiento_url', 'is', null)
  .order('last_checked_at', { ascending: true, nullsFirst: true })
  .limit(10)
```

Si `last_checked_at` es muy antiguo: el workflow `check-seguimiento.yml` puede estar fallando. Revisar runs en GitHub Actions.

**Fuentes bloqueadas por WAF (anti-bot):** algunos portales oficiales (notablemente `sede.madrid.es` del Ayuntamiento de Madrid) devuelven una página de "Access Denied" a peticiones automatizadas. Esa página de error incluye un token dinámico (`Reference 18 3a6b0117...`) que cambia en cada check → el hash cambia siempre → señales `hash_change` infinitas (ruido diario).

Desde 22/05/2026 `checkSeguimientoUrl` (`lib/api/seguimiento-convocatorias/queries.ts`) detecta esto y lo trata como **error**, no como cambio:
- Respuesta HTTP no-2xx → `error`
- Página de bloqueo aunque devuelva HTTP 200 (función `isBlockedPage`: texto corto + marcadores "access denied", "forbidden", "captcha", etc.) → `error`

Resultado: la oposición aparece con `seguimiento_change_status='error'` en `/admin/seguimiento-convocatorias` pero **no genera señal** en `/admin/oep-signals`. El sensor `hash_change` simplemente no puede monitorear esa fuente; hay que seguirla manualmente o buscar una URL alternativa accesible (no toda fuente tiene una — el Ayto. de Madrid no la tiene). No cambiar la `seguimiento_url` por una no oficial solo para silenciar el sensor; es preferible que un humano pueda abrir la URL oficial en el navegador.

### 14.4 regional_scan — ⛔ OBSOLETO (cron retirado 01/06/2026)

El sensor `regional_scan` y su cron `detect-regional-oeps` ya no existen (ver §10). El descubrimiento de cuerpos nuevos es on-demand por Claude. Para vigilar fuentes nuevas, dar de alta su URL server-rendered en `generic_source_checks` (§10) — las verás bajo el sensor `generic_source`.

## 15. Acceso a portales por comunidad: técnicas específicas

### 15.1 Generalitat de Catalunya (DOGC + web.gencat.cat)

**Problema:** las URLs antiguas de `web.gencat.cat/ca/generalitat/treballar-generalitat/oposicions/convocatories` devuelven 404. El DOGC tiene el JS-render que bloquea curl/WebFetch estándar para los resultados de búsqueda.

**Patrón de URLs estables (server-rendered):**

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| `seguimiento_url` | `https://web.gencat.cat/ca/generalitat/treballar-generalitat/oposicions/funcionari/funcio-publica/convocatoria-{N}` | `.../convocatoria-870` |
| `programa_url` | `https://dogc.gencat.cat/ca/document-del-dogc/?documentId={docId}` | `...?documentId=1035641` |
| PDF directo | `https://portaldogc.gencat.cat/utilsEADOP/AppJava/PdfProviderServlet?versionId={V}&type=01` | `...?versionId=2132526&type=01` |

Donde `N` es el número de registro de la convocatoria (ej: `870` = Resolució PRE/212/2026 de 31 processos) y `docId` el ID de documento DOGC.

**Buscar documentos en el DOGC con la API REST:**

El DOGC tiene una API REST no documentada pero funcional. La forma correcta es POST a `searchDOGC`:

```python
import urllib.request, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

data = json.dumps({
    "typeSearch": "1",
    "value": "cos auxiliar administracio generalitat",   # palabras clave
    "publicationDateInitial": "01/01/2026",             # DD/MM/YYYY — opcional
    "publicationDateFinal": "30/06/2026",
    "orderBy": "3",       # 3 = más reciente primero (obligatorio)
    "page": 1,
    "numResultsByPage": 10,
    "advanced": False,
    "language": "ca",
    # el resto de campos pueden quedar vacíos / []
    "title": "", "current": "", "range": [], "issuingAuthority": [],
    "dispositionDateInitial": "", "dispositionDateFinal": "",
    "sectionDOGC": [], "thematicDescriptor": [], "organizationDescriptor": [],
    "geographicDescriptor": [], "aranese": "", "expandSearchFullText": "",
    "noCurrent": "", "subject": []
}).encode("utf-8")

req = urllib.request.Request(
    "https://portaldogc.gencat.cat/eadop-rest/api/dogc/searchDOGC",
    data=data,
    headers={
        "User-Agent": "Mozilla/5.0 Chrome/124.0.0.0",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://dogc.gencat.cat",
        "Referer": "https://dogc.gencat.cat/"
    }
)
with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
    resp = json.loads(r.read().decode("utf-8", errors="ignore"))
    for item in resp.get("resultSearch", []):
        print(f'[{item["date"]}] docId:{item["idDocument"]}')
        print(f'  {item["title"][:150]}')
        print(f'  PDF: {item["linkDownloadPDF"]}')
```

**Resultado:** devuelve `resultSearch[]` con `idDocument`, `title`, `date`, `linkDownloadPDF` (URL directa al PDF con `versionId`). El campo `orderBy` es **obligatorio** — sin él la API devuelve 500.

**Cómo identificar la convocatoria correcta:** el texto completo de la resolución PRE incluye siempre el número de convocatoria y los códigos de trámite de cada proceso (ej: "Convocatòria 870, codi tràmit 878 = Cos auxiliar d'administració C2"). Descargarlo con `pdftotext` confirma en segundos si es el documento correcto.

**URL de seguimiento tras conocer el número:** una vez identificado el número de convocatoria (ej: `870`), la URL `seguimiento_url` es siempre `https://web.gencat.cat/ca/generalitat/treballar-generalitat/oposicions/funcionari/funcio-publica/convocatoria-870`. Esta página está server-rendered, es estable y no requiere sesión.

**Caso real (08/06/2026):** `auxiliar-administrativo-catalunya` tenía `programa_url` apuntando a docId=934181 (documento incorrecto del Consell d'Aran). Buscando "auxiliar administratiu convocatoria generalitat" con fecha 01/02/2026–05/02/2026, se encontró en la primera página docId=1035641 (Resolució PRE/212/2026, convocatoria 870, tramit 878, publicada DOGC 9595 de 02/02/2026, examen previsto "primera quinzena de juny de 2026"). `seguimiento_url` correcta: `convocatoria-870`.

### 15.2 Diputación de Zaragoza (dpz.es) — SSL caducado

`dpz.es` tiene certificado SSL con cadena rota/caducada. Curl y WebFetch estándar fallan. Solución:

```js
// Playwright con ignoreHTTPSErrors
const { chromium } = require('/path/to/node_modules/playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
await page.goto('https://www.dpz.es/ciudadano/empleo-publico/nuevo-ingreso/...');
const text = await page.textContent('body');
```

O bien con Python: `ssl.CERT_NONE` en el contexto SSL (ejemplo en §15.1).

La URL de seguimiento para la OEP Auxiliar C2 DPZ: `https://www.dpz.es/ciudadano/empleo-publico/nuevo-ingreso/auxiliar-de-administracion-general-oep-2023-7-2024-10-y-2025-9` (confirmada accesible con este método, inscripción cerrada 26/03–27/04/2026, 26 plazas C2).

### 15.3 Ayuntamiento de Madrid (sede.madrid.es / www.madrid.es) — WAF Akamai

Ver §14.3. Resumen: `sede.madrid.es` y `www.madrid.es` tienen WAF Akamai que bloquea cualquier petición automatizada (curl, requests, Playwright) con 403 o "Access Denied". **No hay URL alternativa sin WAF para las fichas de proceso selectivo del Ayuntamiento de Madrid.**

Alternativa estable: usar el BOE como `seguimiento_url` para la convocatoria inicial. Aunque no es una página de seguimiento dinámica, es siempre accesible y es la publicación oficial. Para actualizaciones del proceso (listas admitidos, resultados), hay que acceder manualmente desde un navegador a `sede.madrid.es`.

```js
// Para Policía Municipal Madrid: BOE de la convocatoria
seguimiento_url = 'https://www.boe.es/buscar/doc.php?id=BOE-A-2025-25740'
```

## 16. Ver también

- `docs/maintenance/importar-examen-oficial-completo.md` — flujo end-to-end para importar exámenes oficiales (PDFs → preguntas verificadas activas). Imprescindible tras §7c.
- `docs/manual-preguntas-oficiales.md` — variante rápida: formato de pregunta oficial, lifecycle, `question_official_exams`, sin imágenes ni psicotécnicas.
- `lib/api/oposicion-scope/queries.ts` — helper que decide qué oposición ve cada usuario (fix cross-oposición del 14/04/2026). Si un usuario reporta ver preguntas fuera de su oposición, revisar ese módulo.
- `docs/maintenance/impugnaciones-claude-code.md` — manual de impugnaciones: muchas relacionadas con contenido de oposiciones.
- `docs/maintenance/verificar-epigrafe-topic-scope.md` — mapeo de leyes a temas por oposición.
- `__tests__/integration/oposicionesDataConsistency.test.ts` — test que detecta automáticamente inconsistencias `exam_date` ↔ `landing_description` ↔ hitos (§4g) + hitos con títulos que mencionan "promoción interna" en oposiciones `tipo_acceso=libre` (§4f).
