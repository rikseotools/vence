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
| `null` + `include_full_title: true` | **Ley virtual / completa** — Incluye TODAS las preguntas de esa ley. Correcto para leyes temáticas como "Windows 11", "Procesadores de texto", etc. o cuando el epígrafe cubre la ley entera. |
| `null` + `include_full_title: false` | ⚠️ **FOOTGUN** — De facto se comporta como "toda la ley" (las queries filtran `primary_article_id in articles_of_law` sin respetar el null). **Caso real** del bug inicial Andalucía T12 ↔ Ley 19/2021 IMV, que mapeaba preguntas del IMV a un tema cuyo epígrafe no las cubre. Si la intención era "ley virtual", usar `include_full_title: true` explícito. Si era "solo algunos arts", rellenar `article_numbers`. **Nunca dejar ambos vacíos.** |
| `[]` (vacío) | **Sin artículos** — No incluye nada de esa ley. Si una ley aparece con array vacío, o se eliminan los artículos específicos que correspondan, o se elimina la entrada del scope. |
| `["1","2","3"]` | **Artículos específicos** — Solo incluye las preguntas vinculadas a esos artículos de esa ley. |

## Solapamientos entre temas

Un mismo artículo puede aparecer en el scope de dos temas distintos. Hay que distinguir dos casos, porque se tratan al revés:

### Solapamiento legítimo (mantener)

Cuando dos epígrafes oficiales del programa cubren el mismo concepto **desde ángulos distintos**, ambos temas legítimamente necesitan el mismo artículo.

**Ejemplo real:** `Ley 39/2015 art 14` ("Derecho y obligación de relacionarse electrónicamente con las AAPP") aparece legítimamente en dos temas de Administrativo Seguridad Social:
- T16 "Procedimiento administrativo común" → como "derechos del interesado"
- T23 "Funcionamiento electrónico del sector público" → como obligación de relacionarse electrónicamente (literal en el epígrafe)

Ambos lo necesitan. **No eliminar.**

### Solapamiento erróneo (corregir)

Cuando el solapamiento es consecuencia de un rango **demasiado amplio** y no refleja el epígrafe real.

**Ejemplo real:** T101 "La SS en la CE. TRLGSS" tenía TRLGSS arts [1-12], y T102 "Campo de aplicación y composición del sistema SS" tenía arts [7-11]. Los arts 7-11 son "campo de aplicación" (scope natural de T102), no "normas preliminares" (scope natural de T101). T101 había "robado" contenido de T102 al tener un rango demasiado ancho. Corrección: `T101 → [1-6]`.

### Regla práctica

> **Ante duda genuina, mejor scope más extenso** — evita dejar al opositor sin cobertura de un concepto que podría preguntar.
>
> **Solo estrechar cuando el contenido extra pertenece claramente a otro tema del mismo programa** — porque un rango demasiado ancho arrastra preguntas que no corresponden al epígrafe.

## Trampa de las "leyes legislativamente separadas"

Cuando un epígrafe usa un nombre genérico (como "Ley General de la Seguridad Social") NO cubre automáticamente leyes especiales que desarrollan esa materia pero son técnicamente independientes.

**Casos comunes a vigilar:**

| Epígrafe dice... | ...pero NO incluye automáticamente... |
|---|---|
| "Ley General de la Seguridad Social" / "TRLGSS" | Ley 19/2021 del Ingreso Mínimo Vital (es ley independiente) |
| "Protección de datos" / "LOPDGDD" | Reglamento (UE) 2016/679 (RGPD — reglamento europeo distinto) |
| "Ley 39/2015" | Ley 40/2015 LRJSP (son dos leyes paralelas de la reforma 2015) |
| "Estatuto de los Trabajadores" / "ET" | TRLGSS (son dos textos refundidos distintos) |
| "Código Penal" | LO 5/2000 menores o leyes especiales penales |

**Regla:** verificar siempre que **cada concepto** del epígrafe esté cubierto por la **ley específica**, no por el nombre genérico. Si el epígrafe dice "TRLGSS" y también habla expresamente de "ingreso mínimo vital", hay que incluir **dos** entradas en `topic_scope`: una para TRLGSS (RDL 8/2015) y otra para Ley 19/2021.

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

### Tras modificar topic_scope: revalidar cache

Cualquier cambio en `topic_scope` (INSERT/UPDATE/DELETE) **debe reflejarse en cache**, de lo contrario los usuarios seguirán viendo el temario y las preguntas antiguas hasta que caduque el ISR (hasta 24 h).

> ⚠️ **NO hay invalidación automática.** Los triggers PG fueron eliminados el 16/04/2026 (cada INSERT/UPDATE generaba ~1000 ISR Writes y disparaba la factura de Vercel). Tras tocar `topic_scope`, `topics`, `oposicion_bloques` u `oposiciones` debes lanzar manualmente:

```bash
# 1. Tag temario (datos cacheados de tema + scope + artículos)
curl -sS -X POST https://www.vence.es/api/admin/revalidate-temario

# 2. Rutas ISR afectadas (landing temario, página del tema, test)
curl -X POST https://www.vence.es/api/purge-cache \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"path": "/SLUG_OPOSICION/temario/tema-NUMERO"}'
```

Ver [docs/maintenance/cache-revalidation.md](./cache-revalidation.md) para detalle de todos los tags y rutas.

### Ampliación de scope basada en evidencia (post-16/04/2026)

Durante la importación de preguntas scrapeadas puede aparecer este patrón: el scraper insiste en preguntas que apuntan a artículos contiguos al rango actual del scope. Antes de descartarlas como "fuera de scope", **revisar si el epígrafe oficial las cubre**.

**Procedimiento:**

1. Releer el `topics.epigrafe` literal del boletín oficial.
2. Comprobar si los conceptos de las preguntas problemáticas encajan en alguno de los conceptos enumerados en el epígrafe.
3. Si encajan, ampliar el `topic_scope.article_numbers` para incluir esos artículos. NO inventar epígrafes nuevos.

**Caso real (T4 Aux. Admin. Extremadura, 16/04/2026):** el scope inicial de T4 abarcaba arts 1-42 de Ley 13/2015. Aparecieron 4 preguntas scrapeadas sobre el Registro General de Personal (arts 43-45 reales). El epígrafe oficial T4 dice *"Personal al servicio de las Administraciones Públicas de Extremadura. **Ordenación y estructura de los recursos humanos**"*. El Registro General de Personal es un instrumento de ordenación de RRHH explícitamente cubierto por ese epígrafe. **Ampliación correcta:** scope T4 → arts 1-45.

**Cuando NO ampliar:**
- Si el artículo trata una materia que el epígrafe no menciona ni implica.
- Si el artículo está cubierto por otro tema del mismo programa (riesgo de solapamiento).
- Si la regla está en disposiciones adicionales/transitorias colaterales (§3.1).

**Antes de aplicar ampliación:** verificar que ningún otro tema del mismo `position_type` ya tiene esos artículos en su scope (evitar solapamiento erróneo).

### Cobertura por contenido cuando el epígrafe es descriptivo (post-16/04/2026)

Cuando el epígrafe oficial **describe una materia sin citar leyes** (ej.: T22 CyL *"La administración electrónica en las funciones de información y atención al ciudadano. El Servicio 012. El portal web de la Junta de CyL."*), el scope no se resuelve buscando literalidad en el PDF del programa — hay que ir por contenido.

**Regla:** el `topic_scope` debe incluir todas las normas **cuyo contenido regula la materia descrita en el epígrafe**, aunque el boletín oficial no las cite. El epígrafe define la materia; el scope debe reflejar todo el marco normativo que la regula.

**Implicaciones prácticas:**

1. **No limitar la búsqueda a "Ley X/Y".** La materia puede estar regulada por Decretos, Órdenes, RDs, RDLs o resoluciones. Buscar por `nº/año` en `laws.short_name` y `laws.name` sin filtrar por tipo de norma.
   ```js
   const { data } = await supabase.from('laws')
     .select('id, short_name, name, scope')
     .or('short_name.ilike.%7/2013%,name.ilike.%7/2013%');
   ```

2. **Auditar el scope contra el epígrafe, no contra el PDF.** Para cada concepto del epígrafe, preguntarse "¿qué norma(s) lo regula(n)?" y comprobar que están vinculadas. Un scope puede ser literal-completo respecto al PDF y aun así estar incompleto respecto al epígrafe.

3. **Hueco típico:** normas de desarrollo autonómico (decretos regionales sobre medios electrónicos, registros, archivos, transparencia) que no aparecen en el PDF de la convocatoria pero regulan directamente materias del programa.

**Caso real (16/04/2026):** T22 CyL *"administración electrónica … 012 … portal web Junta CyL"*.
- Scope inicial: solo Ley 2/2010 CyL (derechos de ciudadanos).
- Hueco detectado: el **Decreto 7/2013 CyL, de utilización de medios electrónicos en la Administración de CyL** regula literalmente la materia del epígrafe y existía en BD, pero no estaba en el scope. Buscarlo por literal "Ley 7/2013" en el PDF del programa habría fallado (no aparece, y además es decreto, no ley). Solo un cruce por contenido lo detecta.

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

## Script de Detección de Solapamientos Internos

Detecta automáticamente solapamientos entre temas de **la misma oposición**. Útil tras crear una oposición nueva o refinar un topic_scope existente.

```js
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // === CONFIGURAR ===
  const positionType = 'administrativo_seguridad_social';
  // ==================

  const { data: topics } = await supabase
    .from('topics').select('id, topic_number')
    .eq('position_type', positionType);
  const topicIds = topics.map(t => t.id);
  const tnByid = {}; topics.forEach(t => tnByid[t.id] = t.topic_number);

  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('topic_id, law_id, article_numbers, include_full_title, laws(short_name)')
    .in('topic_id', topicIds);

  // Agrupar entradas por ley
  const byLaw = {};
  for (const s of scopes) {
    if (!byLaw[s.law_id]) byLaw[s.law_id] = { name: s.laws?.short_name, entries: [] };
    byLaw[s.law_id].entries.push({
      topic: tnByid[s.topic_id],
      arts: s.article_numbers,
      full: s.include_full_title
    });
  }

  // Buscar artículos que aparecen en 2+ temas de la misma ley
  let totalOverlaps = 0;
  for (const [lawId, ld] of Object.entries(byLaw)) {
    if (ld.entries.length < 2) continue;
    const artToTemas = {};
    for (const e of ld.entries) {
      if (e.full) continue; // los full_title se tratan aparte
      for (const a of (e.arts || [])) {
        if (!artToTemas[a]) artToTemas[a] = [];
        if (!artToTemas[a].includes(e.topic)) artToTemas[a].push(e.topic);
      }
    }
    const overlaps = Object.entries(artToTemas).filter(([a, temas]) => temas.length > 1);
    if (overlaps.length) {
      console.log(`\n${ld.name}: ${overlaps.length} solapamientos`);
      overlaps.forEach(([a, temas]) =>
        console.log(`  art ${a} → T${temas.sort((a,b)=>a-b).join(', T')}`)
      );
      totalOverlaps += overlaps.length;
    }
  }
  console.log(`\nTotal solapamientos internos: ${totalOverlaps}`);
  console.log('(Algunos pueden ser legítimos — revisa cada uno contra el epígrafe)');
})();
```

**Cómo interpretar la salida:**

1. Si no hay solapamientos → scope limpio.
2. Si hay pocos (<10) → revisar cada uno: ¿es legítimo o erróneo? Ver sección "Solapamientos entre temas".
3. Si hay muchos (>20) → probablemente hay un rango demasiado amplio en algún tema que arrastra contenido de varios.

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

---

## Vectores de descubrimiento de bugs (lecciones reales)

El procedimiento descrito arriba es **proactivo** (vas tú a verificar). Pero los bugs reales en topic_scope se descubren también de otras formas que conviene tener presentes:

### Vector 1 — Feedback de usuario + referrer

Cuando un usuario reporta algo tipo *"pincho en X y me sale Y"*, el campo `referrer` del feedback (almacenado en `user_feedback.referrer`) suele apuntar exactamente al URL donde el componente generó el enlace mal con el scope incorrecto.

**Caso real (Carmen, Asturias T7, abr 2026):**

- Mensaje: *"¿Por qué no sale el temario y las preguntas de la Ley 39/2015? Pincho en el enlace y me sale para practicas con el Tratado de la UE"*
- Referrer: `/leyes/constitucion-espanola/avanzado?selected_articles=11&source=temario`
- Diagnóstico: ella estaba en `/auxiliar-administrativo-asturias/temario/tema-7` (Ley 39/2015), pero el `topic_scope` de ese tema apuntaba a TUE arts 13-19 → el componente generó el link a la ley incorrecta

**Workflow:**

1. Leer `referrer` del `user_feedback`.
2. Si trae query params (`selected_articles=...`, `source=temario`), reconstruir el camino: el usuario pinchó en el temario X → el href se generó desde el `topic_scope` de X.
3. Comprobar el `topic_scope` del tema origen y verificar que la ley/articles coinciden con el epígrafe.

### Vector 2 — Comparación cruzada con oposiciones hermanas

Cuando un epígrafe es **idéntico o casi idéntico** entre varias oposiciones (la misma ley estatal aparece en muchos temarios), el `topic_scope` debe ser equivalente. Si una oposición se desvía, es muy probable que sea un bug.

**Caso real (Asturias T7):**

| Oposición | Epígrafe | Cobertura |
|---|---|---|
| `administrativo_galicia` T8 | "Ley 39/2015 títulos preliminar a V" | **126 arts** ✅ |
| `auxiliar_administrativo_galicia` T7 | "Ley 39/2015 títulos preliminar a V" | **126 arts** ✅ |
| `auxiliar_administrativo_asturias` T7 | "Ley 39/2015 títulos preliminar a V" | **TUE 13-19** ❌ |

Ver que las dos de Galicia coincidían (126 arts) y Asturias estaba sola con TUE → bug obvio sin necesidad de leer el PDF.

**Script para encontrar oposiciones hermanas con epígrafe similar:**

```js
const KEYWORD = 'Ley 39/2015' // o 'Constitución Española', 'EBEP', etc.
const { data } = await supabase
  .from('topics')
  .select('position_type, topic_number, title, epigrafe')
  .eq('is_active', true)
  .ilike('title', `%${KEYWORD}%`)
  .order('position_type')

// Para cada uno, mostrar qué leyes tiene en su topic_scope.
// Buscar outliers (oposición que aparece con leyes muy distintas a las demás).
```

### Vector 3 — `programa_url` puede estar APUNTANDO MAL

El manual asume que `oposiciones.programa_url` es la fuente de verdad. **No siempre lo es:**

- Puede apuntar a una convocatoria **pasada** (la última publicada antes de la actual)
- Puede apuntar a una convocatoria **paralela** distinta (caso real: Asturias `programa_url` apunta al PDF de "Cuerpo Auxiliar para discapacidad intelectual" — 10 temas adaptados — pero la oposición en BD es la **general** con 25 temas)

**Antes de validar contra el PDF, comprobar coherencia:**

```js
// Si el PDF tiene 10 temas y BD tiene 25 → mismatch, programa_url no sirve para validar
const { data: opo } = await supabase
  .from('oposiciones')
  .select('temas_count, programa_url, boe_reference, estado_proceso')
  .eq('slug', SLUG)
  .single()

const { count: temasEnBd } = await supabase
  .from('topics')
  .select('*', { count: 'exact', head: true })
  .eq('position_type', POSITION_TYPE)
  .eq('is_active', true)
```

Si el `programa_url` apunta a un temario incoherente:
1. Buscar el BOPA/DOG/BOJA actualizado (search en `iaap.asturias.es`, `xunta.gal/dog`, etc.)
2. Si la convocatoria selectiva nueva no se ha publicado aún (`estado_proceso = oep_aprobada`), validar contra la **convocatoria anterior** (a veces solo está en BOPA/DOG, sin PDF unificado)
3. Apuntar `programa_url` al recurso correcto cuando se publique

### Vector 4 — Auditoría bulk de scope sospechoso

Para detectar topics con `topic_scope` problemático sin revisar uno a uno:

```js
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

;(async () => {
  // 1. Cargar TODOS los topics activos (paginar, Supabase trunca a 1000)
  let topics = []
  for (let from = 0;; from += 1000) {
    const { data } = await s.from('topics')
      .select('id, position_type, topic_number, title, epigrafe')
      .eq('is_active', true)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    topics.push(...data)
    if (data.length < 1000) break
  }
  console.log('Topics activos:', topics.length)

  // 2. Para cada topic, comprobar su topic_scope
  const sospechosos = { sinScope: [], scopeVacio: [], leyMismatch: [] }

  for (const t of topics) {
    const { data: scopes } = await s.from('topic_scope')
      .select('article_numbers, laws(short_name)')
      .eq('topic_id', t.id)

    if (!scopes || scopes.length === 0) {
      sospechosos.sinScope.push(`${t.position_type} T${t.topic_number}: ${t.title}`)
      continue
    }

    const totalArts = scopes.reduce((acc, sc) => acc + (sc.article_numbers?.length || 0), 0)
    const someEmpty = scopes.some(sc => !sc.article_numbers || sc.article_numbers.length === 0)
    if (totalArts === 0 || someEmpty) {
      sospechosos.scopeVacio.push(`${t.position_type} T${t.topic_number}: ${t.title}`)
    }

    // Heurística: si el título menciona "Ley X/YYYY", debe aparecer en el scope
    const m = (t.title || '').match(/Ley\s+(\d+\/\d{4}|O?\s*\d+\/\d{4})/i)
    if (m) {
      const leyToken = m[1].replace(/\s+/g, '')
      const has = scopes.some(sc => sc.laws?.short_name && new RegExp(leyToken).test(sc.laws.short_name))
      if (!has) {
        sospechosos.leyMismatch.push(
          `${t.position_type} T${t.topic_number}: título dice "${m[0]}" pero scope=${scopes.map(sc => sc.laws?.short_name).join(',')}`
        )
      }
    }
  }

  for (const [tipo, lista] of Object.entries(sospechosos)) {
    console.log(`\n═══ ${tipo} (${lista.length}) ═══`)
    lista.slice(0, 30).forEach(l => console.log('  -', l))
  }
})()
```

Casos típicos que detecta:
- `sinScope`: tema sin entradas en `topic_scope` → no muestra nada al usuario
- `scopeVacio`: tema con entradas pero `article_numbers` vacíos en alguna → sin cobertura real
- `leyMismatch`: título menciona "Ley X/YYYY" pero ninguna ley del scope coincide → bug de mapping

### Vector 5 — Tipo de bug: ¿código o datos?

Al investigar un feedback de usuario, distinguir desde el principio si es:

- **Bug de código** (componente, query, lógica): el usuario ve algo raro pero la BD está OK. Ejemplo: `FailedQuestionsReview` con `as any` que devolvía `undefined` y la API trataba `positionType` vacío como "no filtrar" → tema pintado con título de otra oposición (caso Tatiana, abr 2026).
- **Bug de datos** (BD): el código está OK pero los datos son incorrectos. Ejemplo: `topic_scope` de Asturias T7 apuntando a TUE en vez de Ley 39/2015 (caso Carmen, abr 2026).

**Pista rápida**: si el usuario afectado es uno solo o un perfil específico → más probable bug de datos (un tema concreto, una oposición concreta). Si afecta a TODOS los usuarios de una oposición → puede ser código o datos.

Ver también `docs/procedures/gestionar-feedback-bug.md` para metodología general de investigación.

## Notas de incidentes reales

### 2026-04-13 — Asturias T7 mapeado a TUE

- **Reporte**: Carmen (auxiliar_administrativo_asturias) escribió "pincho Ley 39/2015 y sale Tratado de la UE"
- **Bug**: `topic_scope` de Asturias T7 apuntaba a TUE arts 13-19 en vez de Ley 39/2015
- **Fix**: DELETE scope incorrecto + INSERT Ley 39/2015 arts 1-126 (cobertura idéntica a Galicia C1 T8 y Galicia C2 T7 con el mismo epígrafe)
- **Hallazgos paralelos**:
  - `programa_url` de Asturias apunta al PDF de discapacidad intelectual (10 temas, BOPA 23/2/2022), no al temario general de 25 temas
  - `auxiliar_administrativo_cantabria` T5 (Ley 39/2015) tiene `article_numbers` vacíos
  - `auxiliar_administrativo_asturias` T10 (EBEP) sin scope
- **Lección**: el feedback con `referrer` + comparación cruzada con Galicia llegaron al diagnóstico en minutos, sin necesidad de leer el PDF (que además estaba mal apuntado).
