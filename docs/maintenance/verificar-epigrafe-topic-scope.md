# Verificar Epígrafe vs Topic Scope de un Tema

## Contexto

Cada tema de cada oposición tiene:

1. **Epígrafe** → Texto oficial del programa (BOE). Se almacena en `topics.description`.
2. **topic_scope** → Mapeo de qué artículos de qué leyes forman ese tema. Se almacena en la tabla `topic_scope` vinculado al `topic_id`.
3. **Artículos** → Fuente de verdad. El contenido legal real (tabla `articles`).

El topic_scope determina qué preguntas se muestran para un tema. Si el scope es incorrecto, el tema mostrará preguntas que no corresponden al epígrafe o le faltarán preguntas relevantes.

## Arquitectura

```
topics (description = epígrafe oficial)
   ↓ topic_id
topic_scope (law_id + article_numbers)
   ↓ law_id + article_numbers
articles (contenido legal)
   ↓ primary_article_id
questions (preguntas vinculadas a artículos)
```

### Páginas involucradas

- **Temario** (`/[oposicion]/temario/tema-X`) → Muestra el epígrafe y los artículos del scope. Usa `lib/api/temario/queries.ts`.
- **Test** (`/[oposicion]/test/tema/X`) → Carga preguntas según el scope. Usa `lib/api/topic-data/queries.ts`.

## Oposiciones disponibles

| position_type | Slug URL | Temas |
|---|---|---|
| `auxiliar_administrativo` | `auxiliar-administrativo-estado` | 28 (T1-T16 + T101-T112) |
| `administrativo` | `administrativo-estado` | 45 |
| `tramitacion_procesal` | `tramitacion-procesal` | 37 |
| `auxilio_judicial` | `auxilio-judicial` | 26 |

## Procedimiento de Verificación

### Paso 1: Obtener el epígrafe del tema

```js
const { data: topic } = await supabase
  .from('topics')
  .select('id, topic_number, title, description, position_type')
  .eq('topic_number', NUMERO_TEMA)
  .eq('position_type', 'POSITION_TYPE')
  .single();

console.log('Título:', topic.title);
console.log('Epígrafe:', topic.description);
```

El campo `description` contiene el epígrafe oficial del BOE. Es lo que se muestra en la página del tema como subtítulo.

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
