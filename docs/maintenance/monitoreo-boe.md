# Manual de Monitoreo de Leyes del BOE

Este documento describe cómo investigar y resolver los cambios detectados en leyes del BOE.

## Resumen del Flujo

1. **Cron detecta cambio** → `change_status: 'changed'`
2. **Revisar qué cambió** → Verificar artículos
3. **Sincronizar si hay diferencias** → Actualizar BD desde BOE
4. **Comprobar preguntas afectadas** → Ver si hay que actualizar el catálogo
5. **Marcar como revisado** → `change_status: 'reviewed'`

## 1. Ver Leyes con Cambios Pendientes

### Desde la UI
Ir a `/admin/monitoreo` → Filtrar por "Cambio BOE"

### Desde Claude Code
```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data } = await supabase
    .from('laws')
    .select('id, short_name, name, change_status, change_detected_at, last_update_boe')
    .eq('change_status', 'changed')
    .order('change_detected_at', { ascending: false });

  console.log('=== LEYES CON CAMBIOS PENDIENTES ===');
  console.log('Total:', data?.length || 0);

  data?.forEach(l => {
    console.log('\n-', l.short_name);
    console.log('  Detectado:', l.change_detected_at);
    console.log('  Fecha BOE:', l.last_update_boe);
  });
})();
SCRIPT
```

## 2. Verificar Artículos de una Ley

Compara artículo por artículo el contenido del BOE con nuestra BD.

### Desde la UI
En `/admin/monitoreo` → Click en "Verificar artículos"

### Desde Claude Code
```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });

(async () => {
  const lawId = 'UUID_DE_LA_LEY';

  // Añadir &includeDisposiciones=true para incluir disposiciones en la verificación
  const response = await fetch(`http://localhost:3000/api/verify-articles?lawId=${lawId}`);
  const data = await response.json();

  if (data.success && data.comparison) {
    const s = data.comparison.summary;
    console.log('BOE:', s.boe_count, 'artículos');
    console.log('BD:', s.db_count, 'artículos');
    console.log('Coinciden:', s.matching);
    console.log('Contenido diferente:', s.content_mismatch);
    console.log('Faltan en BD:', s.missing_in_db);

    if (s.content_mismatch > 0) {
      console.log('\n=== ARTÍCULOS CON DIFERENCIAS ===');
      data.comparison.details.content_mismatch?.forEach(d => {
        console.log('- Art.', d.article_number, '-', d.title);
        console.log('  Similitud:', d.similarity + '%');
      });
    }
  }
})();
SCRIPT
```

## 3. Sincronizar Ley desde BOE

Actualiza nuestra BD con el contenido actual del BOE.

### Desde la UI
En `/admin/monitoreo` → Click en "Sincronizar BOE"

### Desde Claude Code
```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });

(async () => {
  const lawId = 'UUID_DE_LA_LEY';

  const response = await fetch('http://localhost:3000/api/verify-articles/sync-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Añadir includeDisposiciones: true para sincronizar también disposiciones
    body: JSON.stringify({ lawId })
  });

  const data = await response.json();

  if (data.success) {
    console.log('✅ Sincronización completada');
    console.log('   Añadidos:', data.stats?.added || 0);
    console.log('   Actualizados:', data.stats?.updated || 0);
    console.log('   Sin cambios:', data.stats?.unchanged || 0);
  } else {
    console.log('❌ Error:', data.error);
  }
})();
SCRIPT
```

## 4. Comprobar Preguntas Afectadas

**IMPORTANTE:** Antes de marcar como revisado, verificar si los artículos modificados tienen preguntas vinculadas.

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const articleId = 'UUID_DEL_ARTICULO_MODIFICADO';

  // Buscar preguntas con primary_article_id
  const { data: primaryQuestions } = await supabase
    .from('questions')
    .select('id, question_text, is_active')
    .eq('primary_article_id', articleId);

  // Buscar en question_articles
  const { data: linkedQuestions } = await supabase
    .from('question_articles')
    .select('question_id, questions(id, question_text, is_active)')
    .eq('article_id', articleId);

  console.log('Preguntas con primary_article_id:', primaryQuestions?.length || 0);
  console.log('Preguntas en question_articles:', linkedQuestions?.length || 0);

  if (primaryQuestions?.length > 0) {
    console.log('\n=== PREGUNTAS AFECTADAS ===');
    primaryQuestions.forEach(q => {
      console.log('\n- ID:', q.id);
      console.log('  Activa:', q.is_active);
      console.log('  Texto:', q.question_text?.substring(0, 100));
    });
  }
})();
SCRIPT
```

### Si hay preguntas afectadas:
1. Revisar si el cambio invalida la pregunta
2. Actualizar la explicación si es necesario
3. Desactivar la pregunta si ya no es válida (`is_active: false`)

## 5. Marcar Ley como Revisada

### Desde la UI
En `/admin/monitoreo` → Click en "Marcar como revisado"

### Desde Claude Code
```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const lawId = 'UUID_DE_LA_LEY';

  const { error } = await supabase
    .from('laws')
    .update({
      change_status: 'reviewed',
      reviewed_at: new Date().toISOString()
    })
    .eq('id', lawId);

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Ley marcada como revisada');
  }
})();
SCRIPT
```

## 6. Ver Artículos Actualizados Recientemente

Para saber qué artículos cambiaron en una sincronización:

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const lawId = 'UUID_DE_LA_LEY';

  const { data } = await supabase
    .from('articles')
    .select('id, article_number, title, updated_at')
    .eq('law_id', lawId)
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('=== ARTÍCULOS ACTUALIZADOS RECIENTEMENTE ===');
  data?.forEach(a => {
    console.log('\n- Art.', a.article_number, '-', a.title);
    console.log('  Actualizado:', a.updated_at);
    console.log('  ID:', a.id);
  });
})();
SCRIPT
```

## Ejemplo Completo: Revisar Cambios del BOE

```
1. "hay cambios en el monitoreo BOE?"
   → Claude lista leyes con change_status: 'changed'

2. "verifica los artículos de [LEY]"
   → Claude ejecuta /api/verify-articles
   → Muestra diferencias encontradas

3. "sincroniza [LEY] desde el BOE"
   → Claude ejecuta /api/verify-articles/sync-all
   → Muestra artículos añadidos/actualizados

4. "hay preguntas sobre el artículo [X]?"
   → Claude busca en questions y question_articles
   → Si hay, las lista para revisión

5. "marca [LEY] como revisada"
   → Claude actualiza change_status a 'reviewed'
```

## Sincronización de Disposiciones

Además de artículos, el extractor BOE puede capturar **disposiciones** (adicionales, transitorias, derogatorias y finales). Por defecto NO se extraen para mantener backward compatibility.

### Cuándo incluir disposiciones

Incluir disposiciones cuando una ley tiene preguntas que referencian disposiciones concretas (ej: DF 1ª de la LOPDGDD sobre el carácter orgánico de la ley).

### Formato en BD

Las disposiciones se almacenan en la tabla `articles` con `article_number` en formato `DA_[tipo]_[ordinal]`:

| Ejemplo BOE | `article_number` en BD |
|-------------|----------------------|
| Disposición adicional primera | `DA_adicional_primera` |
| Disposición transitoria segunda | `DA_transitoria_segunda` |
| Disposición derogatoria única | `DA_derogatoria_única` |
| Disposición final primera | `DA_final_primera` |
| Disposición adicional vigésima tercera | `DA_adicional_vigésima_tercera` |

### Sincronizar con disposiciones

```bash
# Via API (añadir includeDisposiciones: true)
curl -X POST http://localhost:3000/api/verify-articles/sync-all \
  -H 'Content-Type: application/json' \
  -d '{"lawId": "UUID_DE_LA_LEY", "includeDisposiciones": true}'

# Via verificación
curl "http://localhost:3000/api/verify-articles?lawId=UUID&includeDisposiciones=true"
```

### Actualizar topic_scope

**IMPORTANTE:** Después de sincronizar disposiciones, si hay preguntas vinculadas a ellas, hay que añadir el `article_number` correspondiente al array `article_numbers` del `topic_scope`:

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const topicId = 'UUID_DEL_TOPIC';
  const lawId = 'UUID_DE_LA_LEY';

  const { data: scope } = await supabase.from('topic_scope')
    .select('id, article_numbers')
    .eq('topic_id', topicId)
    .eq('law_id', lawId)
    .single();

  const updated = [...(scope.article_numbers || []), 'DA_final_primera'];

  const { error } = await supabase.from('topic_scope')
    .update({ article_numbers: updated })
    .eq('id', scope.id);

  console.log(error ? '❌ ' + error.message : '✅ topic_scope actualizado');
})();
SCRIPT
```

### Leyes con disposiciones sincronizadas

| Ley | Disposiciones | Fecha |
|-----|--------------|-------|
| LOPDGDD (LO 3/2018) | 46 (23 adic + 6 trans + 1 derog + 16 finales) | 2026-02-14 |

## Leyes Excluidas del Monitoreo BOE

### Leyes de la UE (scope: 'eu')

Las leyes con `scope: 'eu'` se excluyen automáticamente del cron de verificación BOE porque usan URLs de **EUR-Lex** (`eur-lex.europa.eu`), cuyo HTML no contiene los patrones de fecha del BOE ("Última actualización publicada el DD/MM/YYYY").

Leyes EU excluidas:
- **RI Consejo** - Reglamento Interno del Consejo
- **RI Comisión** - Reglamento Interno de la Comisión
- **RP TJUE** - Reglamento de Procedimiento del TJUE

Si en el futuro se quiere monitorear leyes EU, habría que añadir un extractor de fechas específico para EUR-Lex.

## Cambios Típicos por Época del Año

| Época | Leyes Afectadas | Motivo |
|-------|-----------------|--------|
| **Enero-Febrero** | LIRPF, LIVA, LIS, LGSS | Actualizaciones fiscales de año nuevo |
| **Diciembre** | Ley de Presupuestos | Nueva ley de presupuestos |
| **Variable** | Cualquiera | Reformas legislativas, correcciones |

## Columnas Relevantes en `laws`

| Columna | Descripción |
|---------|-------------|
| `change_status` | `null`/`'ok'`, `'changed'`, `'reviewed'` |
| `change_detected_at` | Cuándo se detectó el cambio |
| `reviewed_at` | Cuándo se marcó como revisado |
| `last_update_boe` | Fecha de "Última actualización" del BOE |
| `last_checked` | Cuándo se verificó por última vez |
| `boe_url` | URL del BOE para descargar |
| `boe_content_length` | Tamaño cacheado para detección rápida |

## Estados de `change_status`

| Estado | Significado | Acción |
|--------|-------------|--------|
| `null` / `'ok'` | Sin cambios | Ninguna |
| `'changed'` | Cambio detectado | **Revisar y sincronizar** |
| `'reviewed'` | Ya revisado | Ninguna |

## Troubleshooting: Badge Rojo en Tab Monitoreo

El badge rojo de la pestaña "Monitoreo" se activa si **cualquiera** de estas condiciones es verdadera:

1. `hasUnreviewedChanges` - Leyes con `change_status: 'changed'`
2. `hasOutdatedLaws` - Leyes desactualizadas (según quick-check)
3. `hasDiscrepancies` - Leyes con discrepancias en artículos

### Verificar qué activa el badge

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });

(async () => {
  const res1 = await fetch('http://localhost:3000/api/law-changes?readonly=true');
  const data1 = await res1.json();
  console.log('1. hasUnreviewedChanges:', data1.summary?.hasUnreviewedChanges);

  const res2 = await fetch('http://localhost:3000/api/law-changes/quick-check');
  const data2 = await res2.json();
  console.log('2. hasOutdatedLaws:', data2.hasOutdatedLaws);

  const res3 = await fetch('http://localhost:3000/api/verify-articles/stats-by-law');
  const data3 = await res3.json();
  console.log('3. hasDiscrepancies:', data3.hasDiscrepancies);
})();
SCRIPT
```

### Caso especial: Leyes sin texto consolidado

Algunas leyes (resoluciones, reglamentos UE, etc.) no tienen URL de BOE o no tienen texto consolidado. Si se verifican, pueden quedar con `is_ok: false` y activar el badge.

**Solución:** Marcar como `no_consolidated_text: true`:

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const lawId = 'UUID_DE_LA_LEY';

  const { error } = await supabase
    .from('laws')
    .update({
      last_verification_summary: {
        is_ok: true,
        message: 'Sin texto consolidado en BOE (solo documento original)',
        no_consolidated_text: true,
        verified_at: new Date().toISOString()
      }
    })
    .eq('id', lawId);

  if (error) console.log('❌ Error:', error.message);
  else console.log('✅ Ley marcada como sin texto consolidado');
})();
SCRIPT
```
