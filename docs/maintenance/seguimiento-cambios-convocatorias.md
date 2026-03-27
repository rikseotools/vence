# Manual: Resolver Cambios Detectados en Seguimiento de Convocatorias

## Resumen

Cuando el admin dice "el seguimiento ha detectado cambios" o se ven badges de CAMBIO en `/admin/seguimiento-convocatorias`, seguir este manual para sincronizar las landing pages con la realidad.

## 1. Identificar que oposiciones tienen cambios

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
| 8 | Examen | upcoming/current |
| 9 | Resultados | upcoming |

No todos los procesos tienen todos los hitos. Incluir solo los que se han publicado oficialmente o tienen fecha conocida.

## 6. Marcar como revisado

Despues de actualizar la BD:

```javascript
// Marcar los checks como revisados
await supabase
  .from('convocatoria_seguimiento_checks')
  .update({ change_reviewed: true, reviewed_at: new Date().toISOString() })
  .eq('oposicion_id', '<uuid>')
  .eq('has_changed', true)
  .eq('change_reviewed', false)

// Resetear el status de la oposicion
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

## 9. Flujo completo resumido

```
1. Admin dice "hay cambios en seguimiento" o badge CAMBIO en panel
   |
2. Identificar oposiciones con seguimiento_change_status = 'changed'
   |
3. Para cada una:
   |-- Leer pagina de seguimiento (WebFetch)
   |-- Ver hitos actuales en BD
   |-- Comparar: plazas, estado_proceso, hitos, fechas
   |-- Proponer cambios al usuario
   |
4. Con aprobacion del usuario:
   |-- Actualizar/insertar hitos
   |-- Actualizar estado_proceso si cambio de fase
   |-- Corregir plazas/fechas si hay discrepancias
   |
5. Marcar checks como revisados
   |
6. Landing se regenera en 24h (o forzar revalidacion)
```

## 10. Cambios cosmeticos (falsos positivos)

A veces el hash cambia sin novedad real (timestamps, tokens de sesion, contenido dinamico de la web). Indicadores de cambio cosmetico:

- `content_length` casi identico (diferencia < 100 bytes)
- Hash cambia cada dia pero no hay documentos nuevos
- La pagina es un portal generico (no ficha del proceso)

En estos casos: marcar como revisado sin hacer cambios en hitos.
