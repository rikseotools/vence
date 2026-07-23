# Manual de Monitoreo BOE y Creación de Leyes Nuevas

Este documento describe dos flujos relacionados:

1. **Monitoreo y sincronización** de cambios detectados en leyes ya existentes en BD (cron `check-boe-changes` → `change_status: 'changed'` → revisar y sincronizar).
2. **Creación de leyes nuevas** a partir de la URL del BOE (orden anual nueva, ley nueva publicada, sustitución de orden anterior).

Si la ley **ya existe** en BD y el cron detectó un cambio, sigue las secciones 1–6.
Si necesitas **crear una ley nueva** desde una URL del BOE (típicamente porque se ha publicado una orden anual o porque un usuario reporta que falta), salta a la sección **"Crear ley nueva desde URL del BOE"** al final del manual.

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

## 1bis. Antes de sincronizar: ¿la ley está derogada? ¿es un falso positivo?

Antes de tratar un `change_status='changed'` como un cambio real, **clasifica de qué tipo es**. Los `changed` que dispara el cron son de cuatro tipos:

| Tipo | Qué es | Acción |
|---|---|---|
| **Reforma real** | El BOE modificó uno o más artículos | Sincronizar (§2–§3) y revisar preguntas (§4) |
| **Derogación** | La ley fue derogada por otra norma | Ver «¿La ley está derogada?» abajo |
| **Falso positivo de fecha** | La fecha cambió pero la ley no | Ver «¿Es un falso positivo?» abajo |
| **Derogada ya conocida** | Ley con `is_derogated=true`; el BOE solo refleja una derogación vieja | `change_status='reviewed'` y nada más |

Las dos comprobaciones siguientes son **obligatorias** para descartar los tres últimos tipos antes de sincronizar.

### ¿La ley está derogada?

El cron `check-boe-changes` detecta que cambió la fecha de "Última actualización" del BOE, pero **no distingue una modificación de una derogación**. Una ley puede llevar años derogada y seguir con `is_active=true` en BD. Antes de sincronizar, abrir la `boe_url` y mirar la cabecera del texto consolidado:

- `"Norma derogada, con efectos de DD/MM/YYYY, por ..."` → la ley está **derogada**. NO sincronizar. Si la sustituye un texto refundido con preguntas vinculadas, seguir "Migrar una ley derogada a su texto refundido" (más abajo). Si solo es derogación sin sustituta con preguntas, marcar `is_derogated=true` + `is_active=false` + `change_status='reviewed'`.
- `"Norma derogada, excepto las disposiciones finales X, Y..."` → derogación parcial; mismo tratamiento.

### ¿Es un falso positivo del detector?

El detector produce **falsos positivos**: la fecha `last_update_boe` en BD a veces se "corrige" sola (deriva del `date_byte_offset` cacheado, extracción inconsistente) y dispara un `changed` sin que la ley haya cambiado. Señal típica: la fecha del BOE **coincide** con la que ya tienes y **no hay ninguna modificación de los años recientes** en el listado de modificaciones del texto consolidado. Si es falso positivo → `change_status='reviewed'` sin sincronizar.

**Patrón de fecha obsoleta.** Otra fuente de falso positivo: en BD se guardó como `last_update_boe` la **fecha propia de la ley** (la de su promulgación — «Ley 2/2011, de 11 de marzo» → `11/03/2011`) en lugar de la fecha de «Última actualización publicada el» del consolidado del BOE (`18/03/2011`, la de publicación). El cron ve `11/03 → 18/03` y marca `changed`, pero la ley no se ha tocado. Señal: la fecha BOE nueva está a pocos días de la promulgación y el consolidado no lista ninguna modificación posterior. → `change_status='reviewed'`.

> **Los falsos positivos no son tiempo perdido.** Revisar cada `changed` es de facto una auditoría del catálogo de leyes. El 22/05/2026, 5 falsos positivos destaparon 2 leyes derogadas que llevaban años marcadas como activas (Ley 2/2009 Aragón con 55 preguntas vivas; Ley 29/2006 Medicamentos). Trata cada `changed` como una oportunidad de auditar, no como una molestia.

## 1ter. El badge de «Monitoreo» parpadea pero `change_status='changed'` = 0

**El badge del nav "Monitoreo" tiene DOS fuentes, no una** (`hooks/useLawChanges.ts` → `hasUnreviewedChanges || hasOutdatedLaws || hasDiscrepancies`):

1. **Cambios de leyes** — `laws.change_status='changed'` (lo de §1). Vía `/api/law-changes?readonly=true`.
2. **Discrepancias de verificación de artículos** — `/api/verify-articles/stats-by-law` → `hasDiscrepancies`. Una ley "no OK" (`calculateIsOk` en `lib/api/verify-articles/ai-helpers.ts`) enciende el badge: hay `title_mismatch`, `content_mismatch`, `missing_in_db`, o `extra_in_db` real > 0, **o** `boe_count=0`.

**Por eso, si miras solo `change_status='changed'`, ves 0 y el badge sigue parpadeando: lo enciende la segunda fuente.** Para ver qué leyes tienen discrepancia de verificación (RDS, **no** el snippet Supabase congelado de §1):

```bash
node -e '
const fs=require("fs"),p=require("./backend/node_modules/postgres");
const u=fs.readFileSync(".env.local","utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim();
function calcIsOk(su){ /* ESPEJO de lib/api/verify-articles/ai-helpers.ts::calculateIsOk.
  ⚠️ Si tocas allí, actualiza aquí: el 20/07 este snippet estaba DESFASADO (le faltaba
  `known_quirk`) y dio 12 leyes en rojo cuando la función real daba 10. Se diagnosticaron
  como problemas leyes que el badge ya consideraba OK. */
  if(!su)return false; if(su.no_consolidated_text)return true;
  const boe=(su.boe_count??su.total_boe??null); if(boe===0)return false;
  if(typeof su.message==="string"&&su.message.includes("No se encontraron artículos"))return false;
  if(((su.title_mismatch||0)>0)||((su.content_mismatch||0)>0))return false;   // contenido: nunca se exonera
  const missing=(su.missing_in_db||0);
  if(missing>0){ const declarado = su.deliberate_subset===true
      && typeof su.subset_note==="string" && su.subset_note.trim().length>0;
    if(!declarado) return false; }                                            // subset deliberado + justificado
  if(su.known_quirk===true) return true;                                      // residual de extra_in_db
  return Math.max(0,((su.extra_in_db||0)-(su.structure_articles||0)))===0; }
rows.filter(r=>calcIsOk(r.su)===false).forEach(r=>console.log(r.short_name, JSON.stringify(r.su).slice(0,160)));
  await s.end();})();'
```

### Import parcial DELIBERADO: `deliberate_subset` (20/07)

Hay leyes que se importan a propósito **en parte**, porque los temas solo escopan un subconjunto
(del TRLPI solo los 30 artículos que examina `auxiliar_biblioteca_estado`, de 212). Antes eso daba
`missing_in_db > 0` **para siempre** y encendía el badge sin remedio — y un badge siempre encendido
no avisa de nada.

Para declararlo hacen falta **las dos cosas a la vez** (si falta una, sigue encendido):

```json
"deliberate_subset": true,
"subset_note": "auxiliar_biblioteca_estado T10 escopa 30 arts explícitos de 212."
```

**Lo que este flag NO puede hacer, por diseño:**
- **No tapa una discrepancia de CONTENIDO** (`content_mismatch` / `title_mismatch`). Que un artículo
  que SÍ tenemos diga algo distinto del boletín es siempre un defecto, sea la ley parcial o no.
- **No tapa `boe_count=0`.**
- **No vale sin justificación escrita**, para que no se use como interruptor de apagar avisos.

Garantías fijadas en `__tests__/verify-articles/calculateIsOk.test.ts` (13 tests).

### ⚠️ `boe_count=0` / "No se encontraron artículos" NO es benigno: RE-VERIFICA, no suprimas

Un `boe_count=0` guardado suele ser un **fallo transitorio de descarga** en el momento del cron (BOE devolvió una página parcial), y **enmascara discrepancias reales** que había debajo. La tentación es "reclasificarlo" para apagar el badge — **es un error, oculta problemas de contenido reales.** El camino correcto es **re-verificar** (el endpoint re-descarga, re-extrae, compara y persiste un resumen fresco):

```bash
# El GET es público (sin auth). Contra prod re-descarga BOE y persiste el resumen en RDS.
curl -s "https://www.vence.es/api/verify-articles?lawId=<UUID>"
```

**Antes de re-verificar, comprueba también que el `boe_url` es el correcto** — un `boe_url` que apunta a otro documento produce `boe_count=0` permanente.

> **Caso real 2026-07-13.** El badge parpadeaba con `change_status='changed'`=0. La segunda fuente marcaba 5 leyes con `boe_count=0` ("No se encontraron artículos"). Parecían falsos positivos del extractor — **no lo eran**. Re-verificando: 4 leyes tenían discrepancias reales tapadas por el 0 transitorio (drift de contenido + artículos faltantes), y una (**Ley 2/2007 Archivos Ext**) tenía el **`boe_url` apuntando a otra ley** (`BOE-A-2007-9963` = una Resolución de aprobados de Agentes de Hacienda, en vez de `BOE-A-2007-10663`), con solo 3 de sus 55 artículos en BD. Si se hubiera "apagado" el badge, se habría ocultado todo eso. **El badge estaba haciendo su trabajo.** Regla: `boe_count=0` → re-verificar y arreglar `boe_url`, nunca suprimir.

### ✅ `known_quirk: true` — artefacto de conteo del extractor ya revisado (apaga el badge sin falsear)

A veces la discrepancia **no es de contenido**: el extractor del BOE cuenta como "artículo extra" algo que no lo es (típico: la **nota de supresión** de un apartado por una reforma queda como una entrada suelta → `db_count = boe_count + 1`, `extra_in_db: 1`). El contenido en BD es correcto y su pregunta también. Aquí **NO se debe** tocar el contenido correcto para "cuadrar" el matcher, ni suprimir el badge a mano borrando el summary.

La vía limpia: tras verificar que el contenido es correcto, escribir en `last_verification_summary` el flag **`known_quirk: true`** + un `message` que explique el artefacto. `calculateIsOk` (`lib/api/verify-articles/ai-helpers.ts`) lo trata como OK y el badge se apaga — es **simétrico a `no_consolidated_text`**.

**Guardarraíles del flag (defensa en profundidad, no es un bypass ciego):**
- `known_quirk` **solo exonera el residual de `extra_in_db`**. NUNCA silencia `content_mismatch`, `title_mismatch`, `missing_in_db` ni `boe_count=0` — esas discrepancias de contenido siguen encendiendo el badge aunque el flag esté puesto.
- Si más adelante hay una reforma real, la caza la **fuente #1** (`change_status='changed'`, detector de fecha, independiente del summary), y una re-verificación completa reescribe el summary fresco (sin `known_quirk`) → el problema real re-emerge. El flag no puede tapar un cambio futuro.
- Debe ser el booleano estricto `true` (un `1`/truthy accidental no exonera).

Ejemplo de summary aceptado:

```json
{
  "known_quirk": true,
  "db_count": 133, "boe_count": 132, "matching": 132, "extra_in_db": 1,
  "content_mismatch": 0, "missing_in_db": 0,
  "message": "Art 49 correcto y su pregunta también. El extractor incluye la nota de supresión del apartado 4 (Ley 5/2025) como extra; artefacto del extractor, no error de contenido.",
  "verified_at": "..."
}
```

> **Caso real 2026-07-18.** Única señal de Monitoreo = **Ley 4/2019 Galicia** con `extra_in_db: 1` (art. 49: el extractor cuenta la nota de supresión del apartado 4 por la Ley 5/2025). Contenido verificado correcto y ya marcado `known_quirk: true`, pero `calculateIsOk` no honraba el flag → el badge parpadeaba de forma crónica por un caso ya resuelto. Fix: `calculateIsOk` honra `known_quirk` **solo** para el residual de conteo, manteniendo intactas las discrepancias duras y `boe_count=0`. Tests en `__tests__/api/verify-articles/stats-by-law.test.ts`.

### Método de reconciliación ley↔BOE (por cada discrepancia)

1. **Re-verificar** para tener el estado honesto (re-descarga BOE, persiste summary).
2. **Clasificar cada `content_mismatch`** comparando el artículo BD con el BOE del **mismo número** y buscando en qué número del BOE encaja mejor el contenido BD:
   - **Mismo-número / reforma** (el título casa en ese número) → **alinear** el contenido al texto oficial. Usar `extractArticlesFromBOE` (excluye bien las `<p class="nota_pie">`, que son notas de modificación, NO articulado — no meterlas). NO usar una re-extracción "a mano" del bloque entero: colarías el historial de modificaciones.
   - **Renumeración** (el asunto del artículo BD ya no está en ese número del BOE) → buscar la **frase clave de cada pregunta** en el BOE vivo, localizar su artículo real, **re-alojar** `primary_article_id` + **explicación nueva** citando el artículo vigente + corregir la cita "artículo N" del enunciado. Si la reforma dejó la respuesta **no literal** → `needs_human` (`transition_question_state`, reason `ai_detected_wrong_article`), nunca falsear.
3. **`missing_in_db`**: añadir con `POST /api/verify-articles/add-missing` (aditivo puro: inserta solo los que faltan, no desactiva ni sobrescribe). Incluir el **preámbulo** (`article_number='preámbulo'`, `title='Preámbulo'`): **204 leyes lo guardan y 161 preguntas cuelgan de preámbulos** → un "missing: preámbulo" es un HUECO real, no un quirk.
4. **Auditar las preguntas** de todo artículo tocado contra el texto vigente (¿la clave sigue literal tras la reforma?).
5. **Títulos = clon EXACTO del BOE.** No enriquecer con paréntesis ("Objetivos generales (Coeducación)"): en el BOE se llaman así de verdad y los distingue el número de artículo. Fuente única, sin fuzzy-match.

> **NUNCA `sync-all` en modo `sync` con renumeración**: sobrescribe contenido Y **desactiva** los artículos que no están en el BOE → deja preguntas huérfanas. Usar align targeted + `add-missing`.
>
> **Orden/documento administrativo sin articulado parseable y sin uso** (0 scope, 0 preguntas; el extractor saca 0 por numeración ordinal no estándar) → marcar el summary con `no_consolidated_text:true` y mensaje honesto, como las normas regionales ya suprimidas. No es fabricar: es clasificar un doc no verificable.

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

### Si hay preguntas afectadas — workflow

No todas las preguntas vinculadas a la ley están afectadas, ni todas se tratan igual.

**Paso 1 — Acota a la parte reformada.** Una reforma toca artículos o apartados concretos. La CE art. 69 tenía 63 preguntas vinculadas, pero la reforma de 2026 solo cambió el apartado 69.3 → solo 5 necesitaban arreglo. Haz un keyword-scan de enunciados/opciones/explicaciones por la frase o el concepto que cambió, y revisa solo los aciertos.

**Paso 2 — ¿Cambio de redacción o de fondo?**
- **Solo redacción** (la reforma reescribe palabras sin cambiar la regla — la CE quitó «o agrupación de ellas»): **ninguna respuesta cambia**; solo hay que actualizar el texto citado en enunciados, opciones y explicaciones que reproduzcan literalmente el artículo antiguo.
- **Cambio de fondo** (cambia la regla, un número, un plazo): las **respuestas correctas pueden cambiar**. Mucho más grave — verifica cada pregunta contra el texto nuevo.

**Paso 3 — ¿Oficial o no oficial?** Mirar `question_official_exams`.
- **No oficial:** se puede editar enunciado/opciones para hacerla literal al artículo vigente.
- **Oficial:** es un registro histórico de un examen real — **nunca se modifica su texto**. Su corrección se juzga contra la **fecha del examen**, no contra hoy (una pregunta del examen del 17/04/2021 sobre una ley derogada el 30/04/2021 era correcta ese día).

**Revincular una pregunta a la ley vigente** (cuando la ley vieja se derogó y la sustituye otra) es un cambio de **4 partes**, no solo el `primary_article_id`:
1. `primary_article_id` → el artículo equivalente de la ley vigente.
2. El **enunciado**, si nombra la ley/artículo viejos («Según el art. 34 de la Ley 18/2011…»).
3. La **opción correcta**, si cita el texto literal viejo — la ley nueva puede haber **reformulado** el precepto (RD-ley 6/2023 art. 50 cambió «el documento acreditativo» → «la información acreditativa»); hay que reescribir la opción al texto nuevo.
4. La **explicación**, citando el artículo nuevo.

Antes de revincular, descarga el contenido del artículo nuevo y compáralo palabra por palabra — solo revincula si responde la pregunta de forma fiel. *(Para migrar de golpe todas las preguntas de una ley a su texto refundido, ver «Migrar una ley derogada a su texto refundido».)*

**Pregunta oficial sobre una ley derogada** → no se puede actualizar (falsearía el examen real) ni dejar activa (enseña contenido derogado) → **desactivar** por el lifecycle (no toques `is_active`, es columna GENERATED):

```
transition_question_state(
  p_question_id, p_expected_state, p_new_state='retired_irreparable',
  p_reason_code='admin_law_derogated', p_changed_by, p_ai_verification_id, p_notes)
```

El registro en `question_official_exams` se conserva como dato histórico.

> **Hueco sistémico conocido (22/05/2026):** hoy **nada automático** detecta «una ley pasó a derogada → revisar sus preguntas». Se caza a mano en este flujo. Hasta que el cron lo haga, conviene un barrido periódico: preguntas activas cuyo `primary_article_id` pertenece a una ley con `is_derogated=true`.

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

2. Buscar en el BOE del dia que ley causo el cambio
   → WebFetch a https://www.boe.es/boe/dias/YYYY/MM/DD/
   → Identificar la ley organica o ley que modifica la ley detectada
   → Entender el contexto del cambio (ej: LO 1/2026 de multirreincidencia)

3. Guardar el contenido ANTES de sincronizar
   → Guardar el contenido actual de los articulos afectados en un JSON temporal
   → Esto permite comparar antes/despues y documentar los cambios

4. "verifica los artículos de [LEY]"
   → Claude ejecuta /api/verify-articles
   → Muestra diferencias encontradas
   → ⚠️ verify puede dar falsos "matching" si el cambio es pequeño
     (ej: añadir 1 letra a un art de 10K chars supera el umbral de similitud)

5. "sincroniza [LEY] desde el BOE"
   → Claude ejecuta /api/verify-articles/sync-all
   → Muestra artículos añadidos/actualizados
   → SIEMPRE ejecutar sync-all, no confiar solo en verify para decidir
     si hay cambios (sync puede encontrar más diffs que verify)

6. Comparar antes/despues y documentar
   → Generar documento en docs/fixes/boe-cambios-YYYY-MM-DD-[nombre].md
   → Incluir: ley que motiva el cambio, articulos antes/despues, preguntas afectadas

7. "hay preguntas sobre los artículos modificados?"
   → Claude busca en questions y question_articles
   → Si hay, revisar una a una si siguen siendo validas con el nuevo texto
   → Actualizar explicaciones con referencia a la nueva redaccion

8. Identificar oposiciones afectadas
   → Buscar en topic_scope que topics usan la ley modificada
   → Listar oposiciones (position_type) de esos topics

9. Revalidar cachés → seguir docs/maintenance/cache-revalidation.md
   → Consultar la tabla "Qué revalidar según el tipo de cambio" (fila "Sincronización de ley desde BOE")
   → Resumen: hay que revalidar tags de datos (temario + teoria) Y páginas ISR (purge-cache)

10. Enviar newsletter a usuarios de oposiciones afectadas
    → Usar plantilla 'cambio-legislativo' (ver abajo)
    → Un email diferente por oposicion (el impacto puede variar)
    → Enviar test a manueltrader@gmail.com primero
    → Luego enviar a todos los elegibles

11. "marca [LEY] como revisada"
    → Claude actualiza change_status a 'reviewed'
```

## Notificar a usuarios de cambios legislativos

Cuando un cambio del BOE afecta a articulos con preguntas o temario de oposiciones, hay que avisar a los usuarios.

### Plantilla 'cambio-legislativo'

Plantilla en BD con header rojo (vs azul de convocatorias). Variables:

| Variable | Descripcion | Auto? |
|----------|-------------|-------|
| `userName` | Nombre del usuario | Si |
| `nombreOposicion` | Nombre de la oposicion | No |
| `titulo` | Titulo corto (aparece en subject y header) | No |
| `descripcion` | Texto explicativo del cambio con HTML | No |
| `cambiosHtml` | HTML con items `<li>` de cambios concretos | No |
| `mensajeMotivacional` | Mensaje en caja azul | No |
| `ctaUrl` | URL boton verde "Practicar test" | No |
| `temarioUrl` | URL boton azul "Ver temario" | No |

### Diferencia con 'novedad-convocatoria'

| Plantilla | Cuando usar | Header |
|-----------|-------------|--------|
| `novedad-convocatoria` | Hitos de convocatoria (examen, listas, plazas) | Azul |
| `cambio-legislativo` | Modificacion de leyes que afecta al temario | Rojo |

### Cuando enviar newsletter por cambio legislativo

| Situacion | Enviar? |
|-----------|---------|
| Ley modificada con preguntas vinculadas | Si |
| Ley modificada con temario en oposiciones activas | Si |
| Cambio menor orgánico (sin preguntas afectadas) pero con usuarios en oposiciones que usan la ley | Si — como "tu temario está actualizado" (confianza/marketing) |
| Ley modificada sin preguntas ni temario | No |
| Cambio menor (fechas, erratas) sin impacto en temario | No |

**Caso real (17/04/2026):** RD 204/2024 modificado (nueva oficina en DG Libertad Religiosa). 0 preguntas afectadas, pero 165 usuarios en Auxilio Judicial + Tramitación Procesal recibieron newsletter "temario actualizado" con detalle de artículos. El valor no era el contenido del cambio sino transmitir que Vence monitoriza y actualiza.


### Email diferente por oposicion

Si un cambio legislativo afecta a varias oposiciones, preparar un email por cada una:
- Adaptar `nombreOposicion` y URLs
- Adaptar `cambiosHtml` al impacto especifico (ej: Tramitacion Procesal → LECrim + CP, Policia → solo CP)
- Enviar test a admin primero, luego masivo

## Crear ley nueva desde URL del BOE

Este flujo se usa cuando hay que **incorporar una ley nueva** que no existe todavía en BD. Casos típicos:

- **Órdenes anuales** que se publican cada año (cotización SS, IPREM, presupuestos generales). Cada ejercicio tiene su propia orden con número y año en el slug (`orden-pjc-178-2025` → `orden-pjc-297-2026`). NO es una "actualización" de la del año anterior — es una ley distinta, hay que crearla nueva.
- **Leyes nuevas** publicadas que afectan a temarios existentes (reforma de un código, ley orgánica que toca un tema).
- **Usuario reporta que falta una ley** que sí debería estar en el temario.

> ⚠️ **Cuándo NO usar este flujo:** si la ley ya existe en BD y solo cambió su contenido (modificación parcial), usa "Sincronizar Ley desde BOE" (sección 3). El criterio: si el slug y el `boe_url` son el mismo → es actualización. Si cambian → es ley nueva.

> 🏛️ **Fuente NO-BOE (norma autonómica: BOC, DOGV, DOG, BOJA, BOCM…) — el sync NO sirve, hay que insertar a mano (SCS Decreto 105/2000, 02/06/2026).**
>
> El endpoint `sync-all` solo parsea el **BOE consolidado**. Para una norma autonómica publicada en su boletín (p.ej. Decreto 105/2000 de Canarias en el BOC) **no funciona** y hay que crear los artículos manualmente:
> 1. `laws.insert` con `scope='regional'`, `is_virtual=false` (es ley real), `slug` propio, y en `boe_url` la URL del **boletín autonómico** (BOC/DOG…). `verification_status='actualizada'` (verificada a mano contra el boletín).
> 2. **Obtener el texto VERBATIM del boletín** — NO uses `WebFetch` para el articulado (resume/parafrasea, prohibido §"PROHIBIDO truncados"). Descarga el HTML crudo (`curl -sL <url> -o f.html`), quita `<script>/<style>/<tags>`, y **parte por `Artículo N.-`** programáticamente (evita transcripción manual = evita errores).
> 3. `articles.insert` por artículo con `content` **íntegro literal** (sin truncar). Verifica `shortCount` (§ Paso 3). Para `title_number`/`chapter_number`/`section_number` y la estructura de títulos y secciones, ver [`../database/estructura-leyes.md`](../database/estructura-leyes.md).
> 4. Vincular las preguntas + (si procede) `topic_scope` + revalidar.
>
> Nota: muchos boletines autonómicos tienen también un visor "juriscan/legislación" que puede dar **timeout** o estar tras login (vLex) — el HTML del propio número del boletín suele ser la fuente libre más fiable.
>
> 🇪🇺 **Reglamentos/Directivas UE — NO uses EUR-Lex, usa el espejo del BOE (23/07/2026).** `eur-lex.europa.eu` es una SPA JavaScript: `WebFetch` (HTML y PDF) devuelve **vacío** y `curl` da el shell sin articulado. El **BOE espeja el DOUE** con id `DOUE-*`: `curl -sL "https://www.boe.es/buscar/doc.php?id=DOUE-L-2004-81035"` trae el Reglamento 852/2004 **íntegro** (mismo strip de tags + partir por capítulos/artículos). Localiza el id `DOUE-*` con `WebSearch` (dominio `boe.es`). Gotcha: el HTML del BOE puede traer algún **scanno** ("cadena de *filo*" por "frío") → corrígelo al término oficial.
>
> 📄 **Guías/PDF oficiales (contenido editorial con fuente) — `pdftotext`.** Cuando la materia editorial SÍ tiene una fuente oficial en PDF (p.ej. una *Guía de Buenas Prácticas Higiénico-Sanitarias* de una Consejería), `curl -sL <pdf> -o g.pdf && pdftotext -layout g.pdf g.txt` extrae el texto **verbatim** (WebFetch el PDF lo trunca/rechaza). Sirve para poblar un **contenedor editorial por materia** (`is_virtual=true`, ver el PRINCIPIO de leyes virtuales en `crear-nueva-oposicion.md`), citando la guía como fuente en el `content`. Caso real: T11 APSP CARM (higiene alimentaria) — memoria `project-apsp-bloque-ii-build`.
>
> ⚠️ **Antes de improvisar la fuente, LEE este manual y `crear-nueva-oposicion.md` §0.bis (normativo vs editorial) + su PRINCIPIO de leyes virtuales por materia.** Lección 23/07: se rehízo a ciegas un método ya documentado aquí. `generar-preguntas-con-ia.md` usa aún `supabase-js` en sus ejemplos (Supabase CONGELADO post-cutover RDS): consulta con `postgres`/`pg` + `DATABASE_URL`, no con `@supabase/supabase-js`.

### Paso 1: INSERT de la nueva ley en `laws`

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Verificar que NO existe ya
  const { data: existing } = await supabase.from('laws')
    .select('id').eq('slug', 'SLUG_DE_LA_LEY').maybeSingle();
  if (existing) { console.log('Ya existe:', existing.id); return; }

  // INSERT
  const { data: created, error } = await supabase.from('laws').insert({
    name: 'Nombre completo oficial del BOE',
    short_name: 'Abreviatura (ej: Orden PJC/297/2026)',
    description: 'Descripción corta',
    slug: 'orden-pjc-297-2026',
    year: 2026,
    type: 'law',
    scope: 'national',     // 'national' | 'autonomic' | 'local' | 'eu'
    is_active: true,
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2026-7296',
    verification_status: 'pendiente',
    is_derogated: false,
    current_version: '1.0',
    last_update_boe: '31/03/2026',  // formato DD/MM/YYYY
  }).select('id, slug').single();

  if (error) { console.error('❌ Error INSERT:', error); return; }
  console.log('✅ Ley creada:', created.id, '|', created.slug);
})();
SCRIPT
```

**Campos obligatorios:** `name`, `short_name`, `slug`, `year`, `boe_url`. El resto tienen defaults razonables, pero conviene rellenarlos todos para auditoría.

### Paso 2: Sincronizar artículos desde el BOE

Llamar al endpoint `/api/verify-articles/sync-all` con el `lawId` recién creado. **Funciona en producción**, no requiere dev local:

```bash
curl -s -X POST https://www.vence.es/api/verify-articles/sync-all \
  -H "Content-Type: application/json" \
  -d '{"lawId":"UUID_DE_LA_LEY_NUEVA","mode":"sync"}'
```

Respuesta esperada:

```json
{
  "success": true,
  "message": "Sincronización completada para Orden PJC/297/2026",
  "stats": {
    "boeTotal": 47,
    "dbTotal": 47,
    "added": 47,
    "updated": 0,
    "deactivated": 0,
    "unchanged": 0,
    "structureArticles": 0
  }
}
```

El endpoint hace fetch de la `boe_url`, parsea el HTML con `extractArticlesFromBOE` y crea las filas en `articles`. Si hay disposiciones (adicionales/transitorias/derogatorias/finales) que importan, añadir `"includeDisposiciones": true` al body (ver sección "Sincronización de Disposiciones" más abajo).

### Paso 3: Verificar que la sincronización es completa y sin truncados

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const lawId = 'UUID_DE_LA_LEY_NUEVA';
  const { data: arts, count } = await supabase.from('articles')
    .select('article_number, content', { count: 'exact' })
    .eq('law_id', lawId);
  let shortCount = 0;
  for (const a of (arts || [])) {
    const len = a.content?.length || 0;
    if (len < 200 && !['preámbulo','0'].includes(a.article_number)) shortCount++;
  }
  console.log('Artículos:', count, '| sospechosamente cortos (<200 chars):', shortCount);
})();
SCRIPT
```

Si `shortCount > 0`, revisar manualmente — puede haber artículos truncados que requieran corrección (ver sección "PROHIBIDO: Artículos Truncados o Parciales").

### Paso 4: Marcar la ley como verificada

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const lawId = 'UUID_DE_LA_LEY_NUEVA';
  const now = new Date().toISOString();
  const { error } = await supabase.from('laws').update({
    verification_status: 'actualizada',
    last_checked: now,
    last_verification_summary: {
      is_ok: true,
      db_count: 47,        // ajustar al count real
      boe_count: 47,
      matching: 47,
      content_mismatch: 0,
      missing_in_db: 0,
      extra_in_db: 0,
      title_mismatch: 0,
      structure_articles: 0,
      verified_at: now,
      message: 'Sincronización inicial desde BOE — N artículos importados',
      source: 'BOE-A-XXXX-XXXXX',
    },
  }).eq('id', lawId);
  console.log(error ? '❌ ' + error.message : '✅ Ley marcada como verificada');
})();
SCRIPT
```

### Paso 5 (opcional): Sustitución anual — marcar la ley anterior como histórica

Si la nueva ley **sustituye una versión anual anterior** (caso clásico: PJC/178/2025 → PJC/297/2026), no eliminar ni desactivar la antigua. Sigue siendo válida para hechos del ejercicio anterior. Marcarla con `derogated_by` + `last_verification_summary.historical: true`:

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const oldLawId = 'UUID_LEY_ANTIGUA';
  const newLawId = 'UUID_LEY_NUEVA';
  const newSlug  = 'orden-pjc-297-2026';
  const newYear  = 2026;
  const now = new Date().toISOString();

  const { error } = await supabase.from('laws').update({
    derogated_by: newLawId,
    last_verification_summary: {
      is_ok: true,
      historical: true,
      replaced_by_year: newYear,
      replaced_by_law_id: newLawId,
      replaced_by_slug: newSlug,
      note: `Vigente para el ejercicio ${newYear - 1}. Para el ejercicio ${newYear} ver ${newSlug}.`,
      verified_at: now,
    },
  }).eq('id', oldLawId);
  console.log(error ? '❌ ' + error.message : '✅ Ley antigua marcada como histórica');
})();
SCRIPT
```

> ⚠️ **NO marcar `is_active: false`** salvo que la antigua haya sido **derogada expresamente** por una norma posterior. La sustitución anual ≠ derogación: la antigua sigue siendo la ley aplicable a los hechos de su ejercicio.

### Paso 6: Migrar preguntas existentes a la nueva ley

Si había preguntas en BD que apuntaban a artículos de la ley antigua y siguen siendo válidas para el ejercicio en curso (ej: estructura de grupos de cotización que no cambia entre años), migrarlas:

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const oldLawId = 'UUID_LEY_ANTIGUA';
  const newArtId = 'UUID_DEL_ARTICULO_NUEVO_EQUIVALENTE';

  // 1. Encontrar preguntas que apuntan a artículos de la ley antigua
  const { data: oldArts } = await supabase.from('articles').select('id').eq('law_id', oldLawId);
  const { data: qs } = await supabase.from('questions')
    .select('id, question_text, explanation')
    .in('primary_article_id', oldArts.map(a => a.id));

  // 2. Para cada una: actualizar primary_article_id y reemplazar referencias textuales
  for (const q of qs) {
    const newText = q.question_text?.replace(/Orden PJC\/178\/2025[^\.]*/g,
      'Orden PJC/297/2026, de 30 de marzo, por la que se desarrollan las normas legales de cotización a la Seguridad Social...');
    const newExpl = q.explanation?.replace(/Orden PJC\/178\/2025/g, 'Orden PJC/297/2026');
    // Si las cifras (bases mínimas/máximas) cambiaron, reemplazarlas también — verificar manualmente

    await supabase.from('questions').update({
      primary_article_id: newArtId,
      question_text: newText,
      explanation: newExpl,
    }).eq('id', q.id);
  }
  console.log(`✅ ${qs.length} preguntas migradas`);
})();
SCRIPT
```

> ⚠️ **NO usar `transition_question_state`** para esto. Solo modificas contenido (`question_text`, `explanation`, `primary_article_id`), no estado del lifecycle. Un UPDATE directo es correcto.

> ⚠️ Si las cifras concretas cambian (ej: bases de cotización, IPREM), **revisar caso a caso** las explicaciones — no basta con replace global de la referencia normativa.

### Paso 7: Revalidar caché — OBLIGATORIO

Tras añadir ley nueva hay que invalidar **tags de datos + páginas ISR** (ver `cache-revalidation.md`):

```bash
# Tags de datos
for tag in temario teoria laws; do
  curl -X POST https://www.vence.es/api/admin/revalidate \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: $CRON_SECRET" \
    -d "{\"tag\":\"$tag\"}"
done

# Páginas ISR específicas
for path in /leyes /leyes/SLUG_NUEVA /leyes/SLUG_ANTIGUA; do
  curl -X POST https://www.vence.es/api/purge-cache \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: $CRON_SECRET" \
    -d "{\"path\":\"$path\"}"
done
```

Si la nueva ley afecta a temarios concretos (vinculada en `topic_law_relationships` o usada por preguntas de un tema), añadir también las rutas de esos temarios y considerar enviar newsletter a los usuarios de las oposiciones afectadas (ver "Notificar a usuarios de cambios legislativos" arriba).

### Paso 8 (opcional): Vincular la ley a temas

Si la nueva ley debe aparecer formalmente como contenido oficial de un tema (no solo como referencia de algunas preguntas), insertar una fila en `topic_law_relationships`:

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { error } = await supabase.from('topic_law_relationships').insert({
    topic_id: 'UUID_DEL_TEMA',
    law_id: 'UUID_LEY_NUEVA',
  });
  console.log(error ? '❌ ' + error.message : '✅ Vinculación creada');
})();
SCRIPT
```

Y revalidar `temario` de nuevo.

### Casos reales registrados

#### 04/05/2026 — Orden PJC/297/2026 (cotización SS 2026)

- **Disparador:** feedback de usuario `cb herranz` (`5e71a32f`) reportando que la PJC/178/2025 había sido sustituida.
- **Verificación BOE:** Orden PJC/297/2026, de 30 de marzo (BOE-A-2026-7296, BOE 31/03/2026, EV 01/04/2026). No deroga expresamente la 178/2025 ("se mantiene la regulación de bases y tipos restantes prevista en la PJC/178/2025"), pero las bases mínimas/máximas y tope mensual sí se actualizan al SMI 2026.
- **Acción:**
  1. INSERT `orden-pjc-297-2026` (id `cdad0ee0-c94f-4950-a764-9a1be3e6f3d7`).
  2. `sync-all` → 47 artículos importados (boeTotal=47, dbTotal=47, added=47, sin truncados).
  3. PJC/178/2025 marcada `historical: true`, `derogated_by: cdad0ee0…`, sin desactivar.
  4. 3 preguntas (grupos de cotización art. 3) migradas: `primary_article_id` al art. 3 de la 297/2026, referencias textuales actualizadas, base mínima Grupo 3 corregida 1.391,70 → 1.435,20 €/mes.
  5. Revalidación: tags `temario`, `teoria`, `laws` + ISR `/leyes`, `/leyes/orden-pjc-297-2026`, `/leyes/orden-pjc-178-2025`.
- **Lección:** las órdenes anuales (cotización SS, IPREM, presupuestos) tienen este patrón cada año. Mantener la antigua como histórica permite que las preguntas referenciadas a hechos del ejercicio anterior sigan siendo válidas.

## Migrar una ley derogada a su texto refundido (con renumeración)

Caso distinto de la "sustitución anual" (Orden PJC) descrita arriba. Aquí una ley se **deroga** y se sustituye por su **texto refundido**, que **renumera los artículos**. El refundido tiene el mismo contenido sustantivo (solo puede "regularizar, aclarar y armonizar"), pero el articulado se reordena. NO sirve cambiar el `law_id` de las preguntas: hay que mapear artículo a artículo.

**Caso real (22/05/2026):** Ley 2/2009 Pte y Gob Aragón (derogada 21/04/2022) → Decreto Legislativo 1/2022. El refundido inlineó los arts. "21 bis/ter/quater" como 22/23/24 y desplazó todo lo posterior. 55 preguntas migradas.

### Paso 1 — Crear el texto refundido como ley nueva

INSERT en `laws` + `sync-all` desde su `boe_url` (ver "Crear ley nueva desde URL del BOE").

### Paso 2 — Construir el mapa artículo viejo → artículo nuevo

Obtener el índice del refundido (WebFetch al BOE: "lista todos los artículos con su número y rúbrica"). Construir el mapa explícito old→new.

**Verificar el mapa por contenido, no por aritmética de numeración.** Para cada artículo viejo, comparar su contenido con el del artículo nuevo mapeado mediante similitud (Jaccard de palabras u otra). Una similitud de 75-100% confirma el emparejamiento (el <100% se debe al lenguaje inclusivo que suele introducir el refundido). Cualquier par por debajo de ~70% → revisar a mano.

### Paso 3 — Migrar las preguntas (re-vincular + renumerar citas)

Para cada pregunta vinculada a un artículo de la ley vieja:

1. `primary_article_id` → artículo equivalente del refundido (vía el mapa del Paso 2).
2. **Reescribir el texto** en `question_text`, `option_*` y `explanation`:
   - Nombre de la ley vieja → nombre del texto refundido.
   - **Renumerar TODAS las citas de artículo** de esa ley, incluidas las referencias cruzadas abreviadas en la explicación ("art. 38.2" → "art. 34.2"). Conservar el apartado tras el punto.
   - NO tocar citas a otras normas (Constitución, Estatuto de Autonomía, LOPJ, etc.).
3. Hacerlo con agentes (rewrite a JSON) + **auditoría determinista antes de aplicar**: un script que verifica que no quedan residuales del nombre viejo, que el nº de citas de artículo coincide antes/después, que cada renumeración respeta el mapa y que los marcadores de otras leyes se conservan.

> ⚠️ **Concordancia de género al reemplazar nombres de norma.** "de la Ley X" → "del texto refundido…" / "del Decreto Legislativo…": cambia el artículo (`la`→`el`, `de la`→`del`) porque *texto* y *decreto* son masculinos y *ley/orden* femeninos. La auditoría debe chequear explícitamente artefactos como "la texto", "la Decreto", "el Ley" — no basta con buscar residuales del nombre viejo.

### Paso 4 — Derogar la ley vieja

`is_derogated=true`, `derogated_by=<id refundido>`, `derogated_at`, `is_active=false`, `change_status='reviewed'`. A diferencia de la sustitución anual, aquí la ley vieja **SÍ se desactiva** (fue derogada expresamente).

### Paso 5 — Mover el topic_scope y revalidar

`UPDATE topic_scope SET law_id=<refundido> WHERE law_id=<vieja>`. Revalidar `temario`/`teoria`/`laws` + rutas ISR. Después, verificar que las preguntas migradas son correctas respecto al artículo nuevo (ver `revisar-preguntas-con-agente.md`, flujo verifica → audita).

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

## Limitaciones del extractor BOE y workflow manual

El endpoint `/api/verify-articles/sync-all` funciona bien con leyes/RDs que usan **numeración arábiga estándar** (`Art. 1`, `Art. 2`…). Hay dos formatos que NO capta y requieren inserción manual con cita literal del BOE consolidado.

### Limitación 1 — Anexos no se importan

El extractor recoge artículos y (opcionalmente con `includeDisposiciones: true`) disposiciones, pero **no toca los anexos**. En muchas normas (Órdenes contables, Resoluciones de clasificación, normas con tablas/modelos) el grueso del contenido sustantivo está en los anexos.

**Síntoma:** sync devuelve `success: true` con count razonable pero faltan claramente los anexos. Por ejemplo, Orden 1/2/1996 Docs Contables AGE: `boeTotal: 12` (capítulos I-III + DF) pero la norma tiene 23 arts en 8 capítulos + Anexo I (87 notas) + Anexo II (modelos).

**Workflow de inserción manual:**

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Texto LITERAL extraído del BOE consolidado (WebFetch con prompt "copia exactamente y verbatim")
  const content = `NORMAS DE CUMPLIMENTACIÓN DE DOCUMENTOS CONTABLES

[Importación parcial del Anexo I del BOE-A-1996-2749 consolidado.]

**Nota 34. Fecha del gasto**

Subvenciones. Se distinguen los siguientes casos:

a.1) Subvenciones en régimen de concurrencia: Una vez aprobado el acuerdo de concesión, se indicará como fecha de gasto la fecha en la que se tenga constancia documental de que el beneficiario ha cumplido las condiciones para el pago de la subvención.
...`;

  await supabase.from('articles').insert({
    law_id: 'UUID_DE_LA_LEY',
    article_number: 'Anexo I',
    title: 'Anexo I. Normas de cumplimentación de documentos contables',
    content: content,
    is_active: true,
  });
})();
SCRIPT
```

**Reglas:**

- `article_number` = `'Anexo I'`, `'Anexo II'`, etc. (literal, sin convertir).
- Si el anexo es muy largo (>50 notas/secciones), importar **al menos** las secciones que tengan preguntas vinculadas, con cita verbatim del BOE. Documentar en el `content` que es importación parcial y dejar referencia a `BOE-A-XXXX-XXXXX` para que un humano amplíe después.
- **NUNCA resumir, parafrasear ni inventar** — aplicar la regla PROHIBIDO §"Artículos Truncados".

### Limitación 2 — Numeración ordinal en letras

Órdenes y Resoluciones modernas a menudo usan **ordinales en letras** (`Primero.`, `Segundo.`, …, `Cuadragésimo tercero.`) en lugar de `Art. 1`, `Art. 2`. El extractor no reconoce este patrón y devuelve:

```json
{"success": false, "error": "No se encontraron artículos en el BOE"}
```

**Caso real:** Orden TDF/469/2024 (BOE-A-2024-10005) — 43 artículos numerados Primero a Cuadragésimo tercero. Sync falla en bloque.

**Workflow:**

1. Identificar qué "artículo" (Primero, Sexto, etc.) necesitan las preguntas vinculadas.
2. WebFetch al consolidado pidiendo verbatim el contenido de ese artículo.
3. INSERT manual con `article_number = 'Sexto'` (literal, sin conversión).
4. Marcar la ley con `last_verification_summary.manual_verification: true` y `missing_in_db: <N>` indicando cuántos artículos faltan respecto al BOE.

```js
await supabase.from('laws').update({
  verification_status: 'actualizada',
  last_verification_summary: {
    is_ok: true, manual_verification: true,
    db_count: 1, boe_count: 43, missing_in_db: 42,
    verified_at: new Date().toISOString(),
    message: 'Importación parcial: art Sexto insertado manualmente. Extractor BOE no parsea numeración ordinal en letras. Resto pendiente de importación manual.',
    source: 'BOE-A-2024-10005',
  },
}).eq('id', lawId);
```

### Estrategia: priorizar manual sobre completo

Cuando hay limitación del extractor, **NO bloquear la importación de la pregunta** mientras se decide qué hacer con la norma entera. Importar el artículo concreto que cubre la pregunta + dejar el resto como cabo documentado en `last_verification_summary`. Lo opuesto (esperar a una importación completa antes de aprobar preguntas) deja las preguntas en `needs_human` indefinidamente.

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

## Leyes sin Texto Consolidado en BOE

### Tipos de documentos afectados

No todos los documentos normativos tienen texto consolidado en el BOE. Los casos más comunes son:

| Tipo | Ejemplo | ¿Por qué no tiene consolidado? |
|------|---------|-------------------------------|
| **Proposiciones no de Ley** | Carta de Derechos de los Ciudadanos ante la Justicia (2002) | No es una ley formal, es una resolución del Congreso |
| **Reglamentos del CGPJ** | Reglamento 3/1995 de Jueces de Paz | Están dentro de documentos más grandes, no individuales |
| **Planes y Estrategias** | Plan de Transparencia Judicial | Son documentos administrativos, no legislativos |
| **Órdenes Ministeriales antiguas** | Algunas órdenes anteriores a 2000 | El BOE no las tiene digitalizadas con texto consolidado |

### Cómo identificarlas

1. **Sin URL de BOE** - Campo `boe_url` vacío
2. **URL doc.php** - Documento original sin texto consolidado (vs `act.php`)
3. **Sync falla con 0 artículos** - `syncArticlesFromBoe` devuelve 0 artículos

### Proceso de verificación manual

Para leyes sin texto consolidado, hay que:

1. **Buscar fuente oficial alternativa**
2. **Insertar/actualizar artículos manualmente**
3. **Marcar la ley con `manual_verification: true`**

#### Fuentes alternativas por tipo

| Tipo de documento | Fuentes recomendadas |
|-------------------|---------------------|
| Carta de Derechos Ciudadanos | [CGPJ](https://www.poderjudicial.es/cgpj/es/Servicios/Atencion-Ciudadana/Modelos-normalizados/Carta-de-Derechos-de-los-Ciudadanos) |
| Reglamentos CGPJ | [CGPJ - Normativa](https://www.poderjudicial.es/cgpj/es/Poder-Judicial/Consejo-General-del-Poder-Judicial/Normativa/) |
| Planes judiciales | [Ministerio de Justicia](https://www.mjusticia.gob.es/) |
| Normas UE | [EUR-Lex](https://eur-lex.europa.eu/) |

#### Ejemplo: Actualizar artículos desde fuente oficial

```bash
node << 'SCRIPT'
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const LAW_ID = '5041bb0f-0c75-4693-89bb-729861f59a04'; // Carta Derechos

  // Actualizar un artículo incompleto
  const { error } = await supabase
    .from('articles')
    .update({
      content: `El ciudadano tiene derecho a obtener del Abogado y Procurador información precisa y detallada sobre el estado del procedimiento y de las resoluciones que se dicten.

El profesional deberá entregar a su cliente copia de todos los escritos que presente y de todas las resoluciones judiciales relevantes que le sean notificadas.

El ciudadano podrá consultar con su Abogado las consecuencias de toda actuación ante un órgano jurisdiccional.`,
      updated_at: new Date().toISOString()
    })
    .eq('law_id', LAW_ID)
    .eq('article_number', '38');

  if (error) console.error('Error:', error);
  else console.log('✅ Artículo actualizado');
})();
SCRIPT
```

### Marcar ley como verificada manualmente

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
      last_checked: new Date().toISOString(),
      verification_status: 'actualizada',
      last_verification_summary: {
        is_ok: true,
        no_consolidated_text: true,
        manual_verification: true,
        source: 'Nombre de la fuente oficial',
        source_url: 'https://url-de-la-fuente-oficial',
        verified_at: new Date().toISOString(),
        message: 'Verificada manualmente desde fuente oficial',
        articles_updated: ['38', '0'] // Artículos que se actualizaron
      }
    })
    .eq('id', lawId);

  if (error) console.log('❌ Error:', error.message);
  else console.log('✅ Ley marcada como verificada manualmente');
})();
SCRIPT
```

### Leyes sin texto consolidado conocidas

| Ley | ID | Fuente alternativa | Estado |
|-----|----|--------------------|--------|
| Carta de Derechos de los Ciudadanos ante la Justicia | `5041bb0f-0c75-4693-89bb-729861f59a04` | [CGPJ](https://www.poderjudicial.es/cgpj/es/Servicios/Atencion-Ciudadana/Modelos-normalizados/Carta-de-Derechos-de-los-Ciudadanos) | ✅ Verificada |
| Plan de Transparencia Judicial | `eb1fa377-56e8-442a-9502-7a7372ab3caa` | Ministerio de Justicia | ✅ Verificada |
| Instrucción 2/2003 CGPJ | `d89b1e76-e3e1-4411-970a-708fdd741c00` | CGPJ | ✅ Excluida (`boe_url = NULL`, solo existe `doc.php`) |
| Reglamento 3/1995 Jueces de Paz | *(ver BD)* | CGPJ | ✅ Excluida (`boe_url = NULL`, BOE muestra solo TEXTO ORIGINAL) |

### Leyes con URL de BOE corregida

| Ley | URL anterior (incorrecta) | URL corregida | Fecha |
|-----|--------------------------|---------------|-------|
| Reglamento 1/2005 CGPJ | `doc.php?id=BOE-A-2005-15939` | `act.php?id=BOE-A-2005-15939` | 2026-02-21 |

### Advertencia en el scraper de preguntas

Cuando se importan preguntas de temas que referencian leyes sin texto consolidado:

1. **Verificar que la ley existe** en la BD con artículos
2. **Si faltan artículos**, insertarlos manualmente ANTES de importar
3. **Marcar la ley** con `no_consolidated_text: true` para evitar alertas

Ver también: [Manual de importación de temas](./importar-tema-tramitacion-procesal.md) - Fase 0

## ⚠️ PROHIBIDO: Artículos Truncados o Parciales

### Regla Absoluta

**NUNCA insertar artículos con contenido truncado o parcial.** Los artículos en la BD deben contener el texto COMPLETO del artículo oficial.

### Por qué es crítico

1. **AI Chat** - El chatbot usa el contenido de artículos para responder preguntas. Si está truncado, dará respuestas incompletas o incorrectas.
2. **Verificación de preguntas** - Las preguntas se validan contra el contenido del artículo. Un artículo parcial puede invalidar preguntas correctas.
3. **Credibilidad** - Los usuarios confían en que el contenido es oficial y completo.

### Qué NO hacer

```javascript
// ❌ PROHIBIDO: Extraer solo partes de las explicaciones de preguntas
const content = question.explanation.match(/Artículo \d+[^]+/)[0];

// ❌ PROHIBIDO: Copiar solo algunos apartados
const content = `1. El ciudadano tiene derecho...
// (resto truncado)`;

// ❌ PROHIBIDO: Resumir o parafrasear
const content = `Este artículo habla sobre los derechos del ciudadano...`;
```

### Qué SÍ hacer

1. **Obtener texto completo de fuente oficial**:
   - BOE (texto consolidado o documento original)
   - EUR-Lex (para normativa UE)
   - CGPJ (para reglamentos e instrucciones del CGPJ)
   - Webs oficiales de organismos

2. **Verificar que el contenido es completo**:
   - Todos los apartados (1, 2, 3...)
   - Todas las letras (a, b, c...)
   - Párrafos introductorios y finales

3. **Si no se puede obtener completo**:
   - NO insertar el artículo
   - Documentar en `last_verification_summary` qué falta
   - Buscar fuente alternativa

### Ejemplo correcto: Insertar artículo completo

```javascript
// ✅ CORRECTO: Texto completo desde fuente oficial
const { error } = await supabase.from('articles').insert({
  law_id: LAW_ID,
  article_number: '3',
  title: 'Definiciones',
  content: `A efectos del presente Reglamento, se entenderá por:

1) «identificación electrónica», el proceso de utilizar los datos de identificación de una persona en formato electrónico que representen de manera única a una persona física o jurídica, o a una persona física que represente a una persona jurídica;

2) «medios de identificación electrónica», una unidad material y/o inmaterial que contenga los datos de identificación de una persona y que se utilice para la autenticación en servicios en línea;

3) «datos de identificación de una persona», un conjunto de datos que permite establecer la identidad de una persona física o jurídica, o de una persona física que represente a una persona jurídica;

// ... TODOS los 41 puntos del artículo 3 del eIDAS
`,
  is_active: true
});
```

### Verificar artículos existentes

Si sospechas que hay artículos truncados:

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

  const { data: articles } = await supabase
    .from('articles')
    .select('article_number, title, content')
    .eq('law_id', lawId);

  console.log('=== VERIFICACIÓN DE ARTÍCULOS ===');
  articles?.forEach(a => {
    const len = a.content?.length || 0;
    const warning = len < 200 ? ' ⚠️ MUY CORTO' : len < 500 ? ' ⚠️ POSIBLE TRUNCADO' : '';
    console.log(`Art ${a.article_number}: ${len} chars${warning}`);
  });
})();
SCRIPT
```

---

## Manuales relacionados

Crear/sincronizar una ley es un paso intermedio de varios flujos. Encadena con:

- **[`verificar-epigrafe-topic-scope.md`](./verificar-epigrafe-topic-scope.md)** — tras crear una ley o añadir disposiciones, añádelas al `topic_scope` de los temas cuyo epígrafe las cubra. Este manual se invoca desde ahí cuando un concepto del epígrafe no tiene norma en BD.
- **[`crear-nueva-oposicion.md`](./crear-nueva-oposicion.md)** — FASE 3d: una oposición nueva puede necesitar leyes autonómicas/locales que aún no existen en BD.
- **[`generar-preguntas-con-ia.md`](./generar-preguntas-con-ia.md)** — una ley/artículo recién creado tiene 0 preguntas; genera preguntas verificadas con IA para darle banco.
- **[`importar-tema-tramitacion-procesal.md`](./importar-tema-tramitacion-procesal.md)** — Fase 0 de importación de temas.
- **[`cache-revalidation.md`](./cache-revalidation.md)** — revalidar `teoria`/`temario` tras sincronizar artículos.
