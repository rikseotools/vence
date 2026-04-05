# Verificar Epígrafe vs Topic Scope de un Tema

## ⚠️ Principio fundamental

**El epígrafe DEBE ser el texto LITERAL del boletín oficial** (BOE, BOP, BOCYL, BOJA, DOG, DOGV, BORM, etc.) que publicó la convocatoria. NUNCA:

- Inventar redacciones ni resumirlas
- Copiar de webs de academias (opositatest, adams, etc.)
- Traducir ni reformular

La fuente oficial está en la columna `oposiciones.programa_url` (enlace directo al PDF del boletín).

## Contexto

Cada tema de cada oposición tiene:

1. **Epígrafe** → Texto oficial del programa (boletín oficial). Se almacena en `topics.epigrafe` (columna dedicada). También se suele guardar en `topics.description` por compatibilidad histórica.
2. **topic_scope** → Mapeo de qué artículos de qué leyes forman ese tema. Se almacena en la tabla `topic_scope` vinculado al `topic_id`.
3. **Artículos** → Fuente de verdad del contenido legal (tabla `articles`).

El topic_scope determina qué preguntas se muestran para un tema. Si el scope es incorrecto, el tema mostrará preguntas que no corresponden al epígrafe o le faltarán preguntas relevantes.

## Arquitectura

```
Boletín oficial (BOE/BOP/BOCYL/...) → oposiciones.programa_url
   ↓ (copia LITERAL)
topics.epigrafe (texto oficial)
   ↓ topic_id
topic_scope (law_id + article_numbers — debe coincidir con los conceptos del epígrafe)
   ↓ law_id + article_numbers
articles (contenido legal oficial)
   ↓ primary_article_id
questions (preguntas vinculadas a artículos)
```

### Regla de oro

> **Todo lo que el usuario ve en un tema debe poder trazarse al boletín oficial de la convocatoria.**
> Epígrafe literal → scope que refleja esos conceptos → artículos existentes → preguntas verificadas.

### Páginas involucradas

- **Temario listado** (`/[oposicion]/temario`) → Muestra `title` + `descripcion_corta`. Usa `DynamicTemarioPage`.
- **Tema individual** (`/[oposicion]/temario/tema-X`) → Muestra `title` + `description` + artículos del scope. Usa `lib/api/temario/queries.ts`.
- **Test** (`/[oposicion]/test/tema/X`) → Carga preguntas según el scope. Usa `lib/api/topic-data/queries.ts`.

## Oposiciones disponibles (17)

Para ver la lista actualizada con `programa_url`:

```sql
SELECT slug, nombre, temas_count, programa_url, boe_reference
FROM oposiciones WHERE is_active = true
ORDER BY slug;
```

**Boletín oficial por oposición** (diario_oficial en tabla `oposiciones`):
- Auxiliar/Administrativo Estado, Auxilio Judicial, Tramitación Procesal → **BOE**
- Madrid (CM) → **BOCM** (Boletín CA Madrid)
- CyL → **BOCYL**
- Andalucía → **BOJA**
- Galicia → **DOG**
- Comunitat Valenciana → **DOGV**
- Ayto Valencia → **BOP Valencia**
- CARM (Murcia) → **BORM**
- Etc.

## Procedimiento de Verificación

### Paso 1: Obtener el epígrafe del tema

```js
const { data: topic } = await supabase
  .from('topics')
  .select('id, topic_number, title, description, epigrafe, position_type')
  .eq('topic_number', NUMERO_TEMA)
  .eq('position_type', 'POSITION_TYPE')
  .single();

console.log('Título:', topic.title);
console.log('Epígrafe (oficial):', topic.epigrafe);
console.log('Description:', topic.description);
```

- **`topics.epigrafe`** es el texto literal del boletín oficial (fuente de verdad).
- **`topics.description`** se usa como subtítulo en la página individual del tema; normalmente es igual al epigrafe.
- **`topics.descripcion_corta`** es una versión reducida (1-2 oraciones) para el listado del temario.

### Paso 1b: Verificar contra el boletín oficial

```js
// Obtener el programa_url de la convocatoria
const { data: oposicion } = await supabase
  .from('oposiciones')
  .select('nombre, programa_url, boe_reference, diario_oficial')
  .eq('slug', 'SLUG_OPOSICION')
  .single();

console.log('Boletín oficial:', oposicion.diario_oficial);
console.log('Referencia:', oposicion.boe_reference);
console.log('PDF oficial:', oposicion.programa_url);
```

Abrir el PDF y comprobar que el `epigrafe` en BD es el texto LITERAL del ANEXO con el temario.

### Paso 2: Obtener el topic_scope

```js
const { data: scope } = await supabase
  .from('topic_scope')
  .select('id, article_numbers, laws:law_id(short_name, name)')
  .eq('topic_id', topic.id);

for (const s of scope) {
  console.log(
    s.laws.short_name,
    'articles:', (s.article_numbers || []).length,
    '[' + (s.article_numbers || []).join(',') + ']'
  );
}
```

### Paso 3: Comparar scope vs epígrafe

Para cada entry del topic_scope, verificar:

1. **¿Esta ley es relevante para el epígrafe?** Si el epígrafe habla de instituciones de la UE, las leyes deben ser TUE, TFUE, etc. — no la Constitución Española entera.

2. **¿Los artículos son los correctos?** Verificar que los artículos seleccionados regulan lo que dice el epígrafe. Para esto, leer el contenido de los artículos y comprobar que tratan la materia del tema.

3. **¿Falta alguna ley o artículo importante?** Si el epígrafe menciona un concepto pero no hay artículos sobre él, falta cobertura.

4. **¿Hay artículos sobrantes?** Artículos que no tienen relación con lo que dice el epígrafe.

### Paso 4: Verificar article_numbers

Dos casos especiales:

| Valor | Significado |
|---|---|
| `null` | **Ley virtual** — Incluye TODAS las preguntas de esa ley. Correcto para leyes temáticas como "Windows 11", "Procesadores de texto", etc. |
| `[]` (vacío) | **Sin artículos** — No incluye nada de esa ley. Si una ley aparece con array vacío, o se eliminan los artículos específicos que correspondan, o se elimina la entrada del scope. |
| `["1","2","3"]` | **Artículos específicos** — Solo incluye las preguntas vinculadas a esos artículos de esa ley. |

## Cómo Corregir un Topic Scope

### Eliminar una entrada
```sql
DELETE FROM topic_scope WHERE id = 'uuid-de-la-entry';
```

### Modificar los artículos de una entrada
```sql
UPDATE topic_scope
SET article_numbers = ARRAY['14', '15', '16', '17', '19']
WHERE id = 'uuid-de-la-entry';
```

### Añadir una nueva entrada
```sql
INSERT INTO topic_scope (topic_id, law_id, article_numbers)
VALUES (
  'topic-uuid',
  'law-uuid',
  ARRAY['1', '2', '3']
);
```

Para encontrar el `law_id`:
```js
const { data } = await supabase
  .from('laws')
  .select('id, short_name')
  .ilike('short_name', '%nombre_ley%');
```

## Script de Verificación Rápida

Crear archivo `check_topic_scope.cjs` en la raíz del proyecto:

```js
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // === CONFIGURAR AQUÍ ===
  const positionType = 'auxiliar_administrativo';
  const topicNumber = 10;
  // =======================

  const { data: topic } = await supabase
    .from('topics')
    .select('id, title, description')
    .eq('topic_number', topicNumber)
    .eq('position_type', positionType)
    .single();

  if (!topic) { console.log('Tema no encontrado'); return; }

  console.log('=== TEMA', topicNumber, '===');
  console.log('Título:', topic.title);
  console.log('Epígrafe:', topic.description);

  const { data: scope } = await supabase
    .from('topic_scope')
    .select('id, article_numbers, laws:law_id(short_name)')
    .eq('topic_id', topic.id);

  console.log('\n=== TOPIC SCOPE (' + scope.length + ' entries) ===');
  for (const s of scope) {
    const arts = s.article_numbers || [];
    const isNull = s.article_numbers === null;
    console.log(
      s.laws.short_name + ':',
      isNull ? 'null (ley virtual completa)' : arts.length + ' arts [' + arts.join(',') + ']'
    );
  }
})();
```

## Checklist de Verificación

- [ ] El `description` del topic coincide con el epígrafe oficial del BOE
- [ ] Cada concepto del epígrafe tiene artículos que lo cubren en el scope
- [ ] No hay leyes/artículos que vayan claramente fuera del epígrafe
- [ ] No hay entries con `article_numbers: []` vacío (o se eliminan, o se ponen artículos concretos)
- [ ] Los artículos incluyen rangos completos de capítulos relevantes (no solo los que tienen preguntas)
- [ ] El conteo de preguntas mostrado en la página es razonable para el tema
- [ ] Si un tema similar existe en varias oposiciones, cada una tiene su propio scope adaptado a su epígrafe

## Detección de Mismatches Epígrafe ↔ Topic Scope

### Opción A: Verificación manual (1 tema concreto)

Si un usuario reporta problemas con un tema específico, o hay sospecha de que el scope no coincide con el epígrafe, usar este flujo:

1. **Leer el epígrafe oficial** del topic (`topics.epigrafe`)
2. **Descomponerlo** en conceptos/secciones mencionadas. Ejemplo:
   - "Estructura y contenido" → Título Preliminar (general)
   - "Las atribuciones de la Corona" → Título II
   - "El Tribunal Constitucional" → Título IX
3. **Obtener los arts del scope actual** (`topic_scope.article_numbers`)
4. **Verificar artículo por artículo**: ¿cada art del scope corresponde a algo mencionado en el epígrafe?
5. **Verificar cobertura**: ¿todos los conceptos del epígrafe tienen arts que los cubren?

### Opción B: Verificación con agentes IA (bulk)

Para verificar muchos temas de forma sistemática, usar agentes IA. NO hay un test algorítmico fiable porque los epígrafes usan vocabulario pedagógico distinto al de los artículos legales (muchos falsos positivos).

**Prompt sugerido para agente**:

```
Revisa si el topic_scope de este tema coincide con su epígrafe oficial.

EPÍGRAFE (oficial BOE): [pegar epigrafe]

LEYES Y ARTÍCULOS DEL SCOPE ACTUAL:
- Ley X arts [1,2,3...]
- Ley Y arts [45,46...]

ARTÍCULOS (títulos) EN EL SCOPE:
[listar title de cada art del scope]

Responde:
1. ¿CADA art del scope corresponde a algo del epígrafe? (lista excesos)
2. ¿Todos los conceptos del epígrafe tienen cobertura? (lista faltantes)
3. Veredicto: CORRECTO / NECESITA AJUSTE (+ descripción)
```

### Cuándo usar cada opción

| Situación | Enfoque |
|-----------|---------|
| Usuario reporta bug concreto | Opción A (manual, 1 tema) |
| Nueva oposición recién importada | Opción B (agentes, todos los temas) |
| Auditoría periódica | Opción B (agentes, muestra aleatoria) |
| Duda puntual sobre un scope | Opción A (manual) |

### Señales de alerta (para decidir investigar)

- Epígrafe menciona "Corona" pero scope no incluye arts 56-65 CE
- Epígrafe menciona "Título III" pero el scope cubre arts de otros títulos
- Scope usa `NULL` (toda la ley) pero el epígrafe es específico
- Un art está en el scope pero su contenido no tiene relación con el epígrafe
