# Manual: Importar Preguntas Scrapeadas

## Resumen del Proceso

Este manual documenta el proceso para importar preguntas scrapeadas de OpositaTest u otras fuentes a la base de datos de Vence, asegurando calidad y correcta vinculación con artículos.

## ⚠️ PRINCIPIO CRÍTICO: Usar Temario Oficial del Boletín

**ANTES de importar preguntas a cualquier oposición, es OBLIGATORIO:**

1. **Obtener el temario oficial del boletín** (BOE, BOP, BOCYL, BOJA, DOG, DOGV, BORM, BOCM…) de la convocatoria correspondiente
2. **Verificar la estructura de temas** (numeración, títulos, epígrafes)
3. **Alinear la BD con el temario oficial**, NO con la estructura de OpositaTest

### ¿Por qué es crítico?

- **OpositaTest puede tener una numeración/estructura diferente al temario oficial**
- Los usuarios estudian según el temario oficial de la convocatoria
- Una discrepancia en la numeración o contenido **confunde al opositor**
- El contenido de cada tema debe coincidir EXACTAMENTE con el boletín oficial

### Ejemplo de discrepancia detectada:

| OpositaTest | BOE Oficial (C1 Administrativo) |
|-------------|--------------------------------|
| Tema 2: La Corona | Tema 4: La Corona |
| Tema 3: Las Cortes | Tema 5: Las Cortes |

### Fuente oficial:

Cada oposición tiene su `programa_url` en la tabla `oposiciones` apuntando al PDF oficial del boletín:

```sql
SELECT slug, programa_url, boe_reference, diario_oficial
FROM oposiciones WHERE slug = 'SLUG_OPOSICION';
```

**Siempre verificar contra ese PDF antes de importar preguntas o modificar topic_scope.**

## PRINCIPIO FUNDAMENTAL: Importar Desactivadas, Activar Tras Revisión

**Todas las preguntas importadas se insertan desactivadas** (visibilidad oculta hasta que un proceso explícito las apruebe).

**Tras la migración lifecycle (fase A-D, 2026-05-03)** la fuente de verdad es `lifecycle_state` (8 estados: `draft`, `needs_review`, `needs_human`, `quarantine`, `approved`, `tech_approved`, `retired_duplicate`, `retired_irreparable`). El default del schema es `'draft'`. El sync trigger `tg_questions_lifecycle_sync_active` mantiene `is_active` derivado automáticamente: `is_active = lifecycle_state IN ('approved', 'tech_approved')`. Ver `docs/roadmap/sistema-desactivacion-preguntas.md` para diseño completo.

**Razones:**
- **Seguridad:** Ningún usuario ve preguntas sin verificar (respuesta incorrecta, artículo equivocado, explicación pobre)
- **Sin presión:** Se puede importar en bloque sin pararse a revisar cada pregunta durante la importación
- **Invariante por construcción:** `lifecycle_state='draft'` ⇒ `is_active=false`, garantizado por el sync trigger. Imposible que se desincronicen
- **Activación por bloques:** Tras importar, se verifican con agentes tema a tema; las que pasan se transicionan a `approved`/`tech_approved` vía función SQL `transition_question_state()`

**Flujo:**
```
1. Importar (NO pasar is_active; el default lifecycle_state='draft' lo deja invisible)
   → lifecycle_state: 'draft' (automático)
   → is_active: false (sincronizado por trigger)
   → deactivation_reason: 'Pendiente de revisión post-importación' (legacy, eliminado en fase F)
   → topic_review_status: 'pending' (legacy)

2. Verificar con agentes (artículo + respuesta + explicación)
   → Agentes Opus/Sonnet en paralelo por batches
   → Llaman al endpoint /api/topic-review/verify (que internamente llama a transition_question_state)

3. Las 'perfect' transicionan a 'approved' / 'tech_approved'
   → lifecycle_state: 'approved' o 'tech_approved'
   → is_active: true (sincronizado por trigger)
   → history audit row con reason_code='ai_verified_perfect' o 'ai_verified_tech_perfect'

4. Las que fallen quedan en needs_review/needs_human/quarantine (invisibles)
   → Pipelines de fix-batch o intervención manual desde admin panel
```

**Al insertar preguntas, usar siempre:**
```javascript
{
  is_active: false,
  deactivation_reason: 'Pendiente de revisión post-importación',
  topic_review_status: 'pending',
  // ... resto de campos
}
```

## ANTES DE IMPORTAR: Limpieza de Enunciados (OBLIGATORIO)

Cada fuente de scraping puede incluir basura en los enunciados (coletillas, URLs, metadatos). Antes de insertar, revisar una muestra de preguntas y limpiar patrones específicos de la fuente.

**Consultar el manual de scraping de cada fuente para los patrones concretos:**
- TuTestDigital: ver `docs/scraping/tutestdigital-api-manual.md` → sección "Limpieza de Enunciados"
- OpositaTest: ver `docs/scraping/opositatest-api-manual.md`

**Regla universal:** Limpiar ANTES de calcular el content_hash y ANTES de insertar. Si se importa sin limpiar, hay que corregir con UPDATE masivo post-importación.

**Tres pasos en el orden correcto:**

```javascript
// 1) Quitar basura sin paréntesis (TEST LEY X, TEMARIO OFICIAL, etc.)
const noJunk = stripInlineJunk(raw)

// 2) Extraer hints y limpiar coletillas entre paréntesis (TEST XXX), (Ley Y), (art. N)
const parsed = parseQuestion(noJunk)

// 3) Inyectar la ley si tras limpiar queda "Según el artículo N" sin mención de ley
const final = ensureLawContext(parsed.question, lawFullName)
```

Ver `docs/scraping/tutestdigital-api-manual.md`:
- "Basura SIN paréntesis al final del enunciado" (`stripInlineJunk`)
- "Contextualización de ley tras la limpieza" (`ensureLawContext`)

## Parseo de Referencia a Artículo (OpositaTest)

El endpoint `/questions/{id}/reason` de OpositaTest devuelve dos campos:
- `reason.content` → HTML con la explicación completa
- `reason.title` → referencia al artículo, formato `"*Art. 6 Ley 39/2015"` (guardado como `explanationTitle`)

El `explanationTitle` contiene la referencia al artículo de la ley en la que se basa la pregunta. **Es la clave para vincular la pregunta al `primary_article_id` correcto** en nuestra BD durante la importación.

### Parseo a campos estructurados

Tras descargar, parsear `explanationTitle` en dos campos para facilitar el mapeo:

```javascript
function parseArticleRef(title) {
  if (!title) return { law_ref: null, article_ref: null };
  // "*Art. 6 Ley 39/2015" → { article_ref: "6", law_ref: "Ley 39/2015" }
  // "*Art. 288 TFUE"      → { article_ref: "288", law_ref: "TFUE" }
  // "*Art. 50 EA Valencia" → { article_ref: "50", law_ref: "EA Valencia" }
  const m = title.match(/\*?Art\.?\s*([\d.]+(?:\.\d+)?)\s+(.+)/i);
  if (m) return { article_ref: m[1], law_ref: m[2].trim() };
  // Sin match → metadato (derogada, fuera temario)
  return { law_ref: null, article_ref: null, meta: title.replace('*', '').trim() };
}
```

Cada pregunta del JSON queda con:
```json
{
  "explanationTitle": "*Art. 6 Ley 39/2015",
  "article_ref": "6",
  "law_ref": "Ley 39/2015",
  ...
}
```

### Casos especiales del `explanationTitle`

| Valor | Significado | Acción |
|-------|-------------|--------|
| `*Pregunta derogada` | Ley reformada, pregunta ya no vigente | Importar con `is_active: false`, campo `isRepealed: true` |
| `*Fuera de temario` | No entra en el temario actual | Descartar o importar desactivada |
| `*Art. 9.2 CE + comentario` | Referencia compuesta | Parsear primer artículo, ignorar comentario |
| `*Art. 103 CE, art. 110 CE` | Referencia múltiple | Vincular al primer artículo; los demás se citan en la explicación |

### Mapeo `law_ref` → `laws.short_name`

Los nombres de ley de OpositaTest no siempre coinciden con nuestros `short_name`. Mapeo manual necesario:

```javascript
const LAW_MAP = {
  'CE': 'CE',
  'Ley 39/2015': 'Ley 39/2015',
  'Ley 40/2015': 'Ley 40/2015',
  'EA Valencia': 'Estatuto Autonomía CV',  // verificar short_name en BD
  'Ley 5/1983 Valencia': 'Ley 5/1983 CV',  // verificar
  'Ley 4/2021 Valencia': 'Ley 4/2021 CV',  // verificar
  'TFUE': 'TFUE',
  'TUE': 'TUE',
  'LO 3/2007': 'LO 3/2007',
  // ... completar según la oposición
};
```

**Flujo de vinculación:**
1. Parsear `explanationTitle` → `law_ref` + `article_ref`
2. Mapear `law_ref` → `laws.short_name` via `LAW_MAP`
3. Buscar `articles` con `law_id` + `article_number = article_ref`
4. Si existe → `primary_article_id = articles.id`
5. Si no existe → marcar para revisión (puede faltar el artículo en BD)

**Señal de que falta el paso 3:** preguntas activas en BD que contienen la regex `/(?:según|de acuerdo con|conforme a) el art[íi]culo \d+[^,.]*[,.]/i` sin mencionar el nombre de la ley a continuación. Se puede detectar con un sanity check post-importación.

## ANTES DE IMPORTAR: Detección de Duplicados (OBLIGATORIO)

Muchas preguntas scrapeadas ya existen en la BD (de otras oposiciones que comparten leyes). Importar duplicados degrada la experiencia del usuario. Hay que detectarlos ANTES de hacer el trabajo de verificación y mejora.

### Por qué el content_hash NO es suficiente

La BD tiene un `content_hash` (SHA-256 del texto normalizado) con constraint único. Pero esto solo detecta duplicados **exactos**. Diferencias mínimas (un espacio, un guión, "Señale" vs "De acuerdo con") generan hashes distintos aunque la pregunta sea la misma.

**Ejemplo real:** De 146 preguntas de CE scrapeadas, el hash detectó 0 duplicados. Con comparación por similitud se encontraron 104 duplicados reales.

### Nivel 0 - Opciones barajadas (IMPORTANTE)

Muchas fuentes barajan las opciones A/B/C/D de la misma pregunta. Esto genera preguntas que parecen "nuevas" porque el `correct_option` cambia (A→C, etc.) y el texto de las opciones está en distinto orden, pero son la misma pregunta.

**Detección:** Normalizar y ordenar las 4 opciones alfabéticamente. Si la pregunta normalizada + opciones ordenadas coinciden → DUPLICADO.

```javascript
function normalizeOptions(opts) {
  return opts.map(o => normalize(o)).sort().join('|||');
}

// Duplicado si: misma pregunta + mismas opciones (en cualquier orden)
const key = normalize(question) + '###' + normalizeOptions([optA, optB, optC, optD]);
```

**Variante:** Mismas opciones pero pregunta ligeramente reformulada. Comparar solo opciones ordenadas y, si coinciden, verificar similitud de pregunta (>50% Jaccard de palabras).

**IMPORTANTE - Distinción legislativas vs psicotécnicas:**
- **Legislativas:** Mismo enunciado + opciones DIFERENTES = pregunta NUEVA (no duplicado). Es habitual que varias preguntas compartan enunciado ("Según el art. X...") pero pregunten sobre aspectos distintos con opciones diferentes. Solo es duplicado si las opciones (ordenadas) también coinciden.
- **Psicotécnicas:** Mismo enunciado + mismas opciones barajadas = DUPLICADO seguro. Las opciones salen de un cálculo concreto y no hay variación posible.

### Proceso de detección en 4 niveles

```javascript
const crypto = require('crypto');

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

function jaccard(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 2));
  const wb = new Set(b.split(' ').filter(w => w.length > 2));
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 0 : intersection / union;
}
```

**Nivel 1 - Exacto normalizado:** Normalizar texto (quitar tildes, puntuación, espacios extra) y comparar. Detecta ~67% de duplicados.

```javascript
const dbNormSet = new Set(dbQuestions.map(q => normalize(q.question_text)));
if (dbNormSet.has(normalize(scraped.question))) → DUPLICADO
```

**Nivel 2 - Similitud alta (>=80% Jaccard):** Comparar palabras significativas. Detecta preguntas reformuladas ("Señale la respuesta..." vs "De acuerdo con..."). Estos son CASI SEGURO duplicados pero revisar uno a uno.

**Nivel 3 - Similitud media (60-80%):** Podrían ser duplicados o no. HAY QUE comparar las opciones de respuesta manualmente:

```javascript
// Si la pregunta Y las opciones son sobre el mismo artículo y concepto → DUPLICADO
// Si preguntan sobre artículos distintos o conceptos distintos → NUEVA
// Ejemplo: "Art 10 CE" vs "Art 24 CE" con 75% similitud → NO duplicado
// Ejemplo: "169 artículos" vs "169 artículos" con opciones diferentes → DUPLICADO (redundante)
```

### Criterio para similitud media

Cuando dos preguntas tienen 60-80% de similitud:
1. **¿Preguntan sobre el mismo artículo/concepto?** → Comparar opciones
2. **¿Las opciones son sobre lo mismo?** → DUPLICADO (aunque opciones difieran, aburre al usuario)
3. **"correcta" vs "incorrecta" en el mismo tema?** → NO duplicado (preguntan opuesto)
4. **Mismo inicio pero artículo distinto?** → NO duplicado

### Contra qué comparar

Comparar contra TODA la BD (`questions` activas), no solo contra las del tema. Porque las preguntas se comparten entre oposiciones vía artículos.

```javascript
let allDbQuestions = [];
let page = 0;
while (true) {
  const { data: qs } = await supabase.from('questions')
    .select('id, question_text').eq('is_active', true)
    .range(page * 1000, (page + 1) * 1000 - 1);
  if (!qs || qs.length === 0) break;
  allDbQuestions.push(...qs);
  page++;
  if (qs.length < 1000) break;
}
```

### Resultado esperado

La detección clasifica cada pregunta en:
- **Barajadas:** Descartar sin más (mismas opciones en distinto orden)
- **Exacto:** Descartar sin más
- **Alta similitud (>=80%):** Verificar con agentes Sonnet (rápido, ~30 por batch). La mayoría son falsos positivos en psicotécnicas (mismo formato, distinto contenido)
- **Media similitud (60-80%):** Verificar con agentes Sonnet también
- **Nueva (<60%):** Seguro nueva, proceder con importación

## 0. Identificar el Topic Correcto (IMPORTANTE)

**ATENCIÓN:** El `topic_number` puede repetirse para diferentes oposiciones. Por ejemplo:
- `topic_number: 204` para `position_type: 'administrativo'` → Protección de Datos
- `topic_number: 204` para `position_type: 'auxiliar_administrativo'` → Podría ser otro tema

### Verificar el topic correcto antes de importar:

```javascript
// SIEMPRE verificar que el topic es para la oposición correcta
const { data: topics } = await supabase
  .from('topics')
  .select('id, topic_number, title, position_type')
  .eq('topic_number', 204);

console.log('Topics con número 204:', topics);
// Verificar que el position_type corresponde a tu oposición:
// - 'administrativo' → Administrativo C1
// - 'auxiliar_administrativo' → Auxiliar C2
```

### Estructura de numeración por oposición:

**Administrativo C1** (`position_type: 'administrativo'`):
- Bloque I: topics 1-11 (Constitución, Corona, Cortes, etc.)
- Bloque II: topics 201-204 (Atención público, Documento, Admin electrónica, Protección datos)
- Bloque III: topics 301-307 (Fuentes derecho, Acto admin, Procedimiento, etc.)
- Bloque IV: topics 401-409 (Personal funcionario)
- Bloque V: topics 501-506 (Presupuestos)
- Bloque VI: topics 601-608 (Informática)

**Auxiliar C2** (`position_type: 'auxiliar_administrativo'`):
- Bloque I: topics 1-11 (similar a C1)
- Bloque II: topics 12-19 (Informática)

### Usar siempre el topic_id (UUID), no el topic_number:

```javascript
// MAL - puede insertar en topic equivocado
const topicNumber = 204;

// BIEN - usar siempre el UUID específico
const TOPIC_ID = '45b9727b-66ba-4d05-8a1b-7cc955e7914c'; // Protección Datos - Administrativo
```

## 1. Estructura de los Archivos Scrapeados

Las preguntas scrapeadas se almacenan en `/preguntas-para-subir/` organizadas por tema:

```
preguntas-para-subir/
├── Tema_2,_Documento,_registro_y_archivo/
│   ├── Documento.json      (30 preguntas)
│   ├── Registro.json       (49 preguntas)
│   └── Archivo.json        (75 preguntas)
```

Cada JSON tiene esta estructura:
```json
{
  "tema": "Tema 2, Documento, registro y archivo",
  "subtema": "Documento",
  "source": "opositatest",
  "questionCount": 30,
  "questions": [
    {
      "question": "Texto de la pregunta...",
      "options": [
        {"letter": "A", "text": "Opción A"},
        {"letter": "B", "text": "Opción B"},
        {"letter": "C", "text": "Opción C"},
        {"letter": "D", "text": "Opción D"}
      ],
      "correctAnswer": "B",
      "explanation": "Explicación con referencia al artículo..."
    }
  ]
}
```

## 2. Verificar Leyes y Artículos (ANTES de importar)

### 2.1 Verificar que todas las leyes existen

```javascript
const neededLaws = ['Ley 39/2015', 'RD 203/2021', 'RD 1708/2011'];

for (const lawName of neededLaws) {
  const { data: law } = await supabase
    .from('laws')
    .select('id, short_name, boe_url')
    .eq('short_name', lawName)
    .single();

  if (law) {
    console.log('✅ ' + lawName + (law.boe_url ? ' (con BOE URL)' : ' (SIN BOE URL)'));
  } else {
    console.log('❌ ' + lawName + ' - NO EXISTE');
  }
}
```

**Si falta una ley:**
1. Ir a http://localhost:3000/admin/monitoreo
2. Añadir la ley con su URL del BOE
3. Clonar artículos desde el BOE

**Si la ley existe pero NO tiene BOE URL:**
```javascript
await supabase
  .from('laws')
  .update({ boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-XXXX-XXXXX' })
  .eq('short_name', 'RD 203/2021');
```

### 2.2 Verificar que todos los artículos existen

```javascript
const needed = {
  'Ley 39/2015': ['6', '16', '17', '26', '27', '28'],
  'RD 203/2021': ['37', '38', '51', '59', '60'],
};

for (const [lawName, arts] of Object.entries(needed)) {
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', lawName)
    .single();

  const { data: articles } = await supabase
    .from('articles')
    .select('article_number')
    .eq('law_id', law.id);

  const existing = articles.map(a => a.article_number);
  const missing = arts.filter(a => !existing.includes(a));

  if (missing.length > 0) {
    console.log('❌ ' + lawName + ' - Faltan: ' + missing.join(', '));
  }
}
```

**Si faltan artículos:**
1. Ir a http://localhost:3000/admin/monitoreo
2. Buscar la ley
3. Clonar los artículos faltantes desde el BOE

**IMPORTANTE:** No continuar con la importación hasta tener TODOS los artículos necesarios.

## 3. Crear Topic Scope

Antes de importar preguntas, el tema debe tener un `topic_scope` que defina qué leyes y artículos abarca.

### 2.1 Analizar las preguntas para identificar leyes

Crear un script para detectar leyes mencionadas en las explicaciones:

```javascript
// analyze-tema.cjs
const fs = require('fs');
const path = '/ruta/al/tema/';
const files = fs.readdirSync(path).filter(f => f.endsWith('.json'));
const lawArticles = {};

files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path + file));

  data.questions.forEach(q => {
    const exp = (q.explanation || '').toLowerCase();

    // Detectar Ley 39/2015
    if (exp.includes('39/2015')) {
      if (!lawArticles['Ley 39/2015']) lawArticles['Ley 39/2015'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => lawArticles['Ley 39/2015'].add(a.match(/\d+/)[0]));
    }

    // Añadir más leyes según necesidad...
  });
});

console.log('Leyes y artículos detectados:');
Object.entries(lawArticles).forEach(([law, arts]) => {
  console.log(`${law}: ${Array.from(arts).sort((a,b) => a-b).join(', ')}`);
});
```

### 2.2 Verificar leyes en la BD

```sql
-- Verificar que las leyes existen
SELECT id, short_name, name FROM laws
WHERE short_name IN ('Ley 39/2015', 'RD 203/2021', 'Ley 16/1985');
```

### 2.3 Crear topic_scope

```javascript
// Usando Supabase service key
const scopeData = [
  { short_name: 'Ley 39/2015', articles: ['6', '16', '17', '26', '27', '28'] },
  { short_name: 'RD 203/2021', articles: ['37', '38', '40', '46', '48', '51', '53'] },
  // ...más leyes
];

for (const scope of scopeData) {
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', scope.short_name)
    .single();

  await supabase
    .from('topic_scope')
    .insert({
      topic_id: 'UUID_DEL_TEMA',
      law_id: law.id,
      article_numbers: scope.articles
    });
}
```

## 3. Importar Preguntas con Verificación

### 3.1 Proceso de verificación por pregunta

Para cada pregunta:

1. **Leer el artículo de la BD** que corresponde a la pregunta
2. **Verificar que la respuesta es correcta** comparando con el texto del artículo
3. **Mejorar la explicación** para que sea didáctica:
   - Citar el artículo específico (ej: "Art. 26.3 Ley 39/2015")
   - Explicar por qué las otras opciones son incorrectas
   - Añadir ejemplos prácticos si es útil
   - Usar formato con bullet points para claridad
4. **Vincular al artículo correcto** usando `primary_article_id`
5. **Añadir tags** para identificar el grupo: `['Documento', 'Tema 202', 'Bloque II']`

### 3.2 Estructura de la pregunta en BD

```javascript
{
  question_text: 'Texto de la pregunta...',
  option_a: 'Opción A',
  option_b: 'Opción B',
  option_c: 'Opción C',
  option_d: 'Opción D',
  correct_option: 1,  // 0=A, 1=B, 2=C, 3=D
  explanation: 'Explicación didáctica mejorada...',
  primary_article_id: 'UUID_DEL_ARTICULO',
  difficulty: 'medium',  // easy, medium, hard, extreme
  is_active: false,  // SIEMPRE false al importar
  deactivation_reason: 'Pendiente de revisión post-importación',
  topic_review_status: 'pending',
  is_official_exam: false,
  tags: ['Subtema', 'Tema XXX', 'Bloque X']
}
```

> **IMPORTANTE:** Nunca importar con `is_active: true`. Las preguntas se activan automáticamente cuando pasan la verificación con agentes y se marcan como `perfect`.

### 3.3 Mapeo de respuestas

```
Letra → correct_option
A → 0
B → 1
C → 2
D → 3
```

## 4. Script de Ayuda para Obtener Artículos

```javascript
// get-articles.cjs
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const laws = ['Ley 39/2015', 'RD 203/2021'];

  for (const lawName of laws) {
    const { data: law } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', lawName)
      .single();

    const { data: articles } = await supabase
      .from('articles')
      .select('id, article_number, title')
      .eq('law_id', law.id)
      .in('article_number', ['26', '27', '28'])  // artículos relevantes
      .order('article_number');

    console.log('\n📜 ' + lawName + ':');
    articles?.forEach(a => {
      console.log(`   Art. ${a.article_number} | ${a.id} | ${a.title}`);
    });
  }
})();
```

## 5. Verificación de Contenido

Antes de insertar, **siempre verificar contra el artículo en la BD**:

```javascript
const { data } = await supabase
  .from('articles')
  .select('content')
  .eq('id', 'ARTICLE_UUID')
  .single();

console.log(data.content);
// Comparar con la explicación de la pregunta
```

## 6. Evitar Duplicados

La BD tiene un `content_hash` único. Si una pregunta ya existe, dará error:
```
duplicate key value violates unique constraint "idx_questions_content_hash"
```

Esto es correcto - evita preguntas duplicadas.

## 7. Checklist por Tema

- [ ] Analizar JSONs para identificar leyes y artículos
- [ ] Verificar que las leyes existen en BD
- [ ] Crear topic_scope para el tema
- [ ] Para cada pregunta:
  - [ ] Verificar respuesta correcta contra artículo en BD
  - [ ] Mejorar explicación (didáctica, estructurada)
  - [ ] Vincular a artículo correcto
  - [ ] Añadir tags apropiados
  - [ ] Insertar en BD
- [ ] Verificar conteo final de preguntas por artículo

## 8. Proceso de Verificación Pregunta a Pregunta

### Flujo obligatorio para cada pregunta:

```
1. LEER la pregunta del JSON scrapeado
2. IDENTIFICAR qué ley y artículo menciona la explicación
3. CONSULTAR el artículo en nuestra BD (no en el BOE)
4. VERIFICAR que la respuesta marcada es correcta según nuestro artículo
5. REDACTAR explicación didáctica mejorada
6. INSERTAR con el article_id correcto
```

### Ejemplo de verificación completa:

**Paso 1 - Pregunta scrapeada:**
```
Pregunta: "Los documentos con antigüedad superior a 100 años de personas físicas..."
Respuesta marcada: D (Integran el Patrimonio Documental)
```

**Paso 2 - Identificar artículo:**
La explicación menciona "Ley 16/1985, artículo 49.4"

**Paso 3 - Consultar artículo en BD:**
```javascript
const { data } = await supabase
  .from('articles')
  .select('content')
  .eq('id', 'd401136d-0f9f-42d3-89fc-a1a4d275534e')
  .single();

console.log(data.content);
// → "4. Integran asimismo el Patrimonio Documental los documentos
//    con una antigüedad superior a los cien años..."
```

**Paso 4 - Verificar:**
- Art. 49.4 dice "**Integran**" (no "pueden integrar")
- Confirma "cien años" y "entidades particulares o personas físicas"
- ✅ Respuesta D es CORRECTA

**Paso 5 - Explicación didáctica:**
```
Art. 49.4 Ley 16/1985 - Patrimonio Documental de particulares

El Patrimonio Documental se forma por documentos según antigüedad y origen:
• Entidades PÚBLICAS → desde cualquier época (art. 49.2)
• Entidades SINDICALES, RELIGIOSAS, culturales privadas → 40 años (art. 49.3)
• PARTICULARES y personas físicas → 100 AÑOS (art. 49.4)

El verbo "INTEGRAN" indica obligatoriedad, no opcionalidad.
```

**Paso 6 - Insertar:**
```javascript
await supabase.from('questions').insert({
  question_text: '...',
  correct_option: 3,  // D
  explanation: '...',  // explicación mejorada
  primary_article_id: 'd401136d-0f9f-42d3-89fc-a1a4d275534e',
  tags: ['Documento', 'Tema 202', 'Bloque II']
});
```

## 9. Formato de Explicación Didáctica (OBLIGATORIO)

Las explicaciones scrapeadas suelen ser solo citas del artículo. Hay que reescribirlas con formato didáctico. Usar agentes Sonnet en paralelo (batches de 14 preguntas).

### Formato obligatorio

```markdown
> **Art. X [Ley]**
> "Cita textual relevante del artículo"

**Por qué [LETRA] es correcta:** Explicación clara.

**Por qué las demás son incorrectas:**
- **A)** Razón concreta
- **B)** Razón concreta
- **C)** Razón concreta
```

### Reglas

- Sin emojis
- Markdown con **, >, -
- Cita del artículo con blockquote (>)
- Omitir la letra correcta del bloque de incorrectas
- Para preguntas "Ninguna es correcta": explicar por qué cada opción falla
- Para preguntas "Señale la incorrecta": explicar que la correcta es la afirmación falsa
- Para preguntas de fechas/estructura: no hace falta blockquote, explicación directa
- Ser conciso pero completo

### Ejecución con agentes paralelos

Dividir las preguntas en batches de ~14 y lanzar agentes Sonnet en paralelo. Cada agente genera las explicaciones y un script de actualización en /tmp.

```
Batch 1 (Q1-Q14)  → agente Sonnet → /tmp/update_explanations_batch1.cjs
Batch 2 (Q15-Q28) → agente Sonnet → /tmp/update_explanations_batch2.cjs
Batch 3 (Q29-Q42) → agente Sonnet → /tmp/update_explanations_batch3.cjs
```

Los scripts deben usar paths absolutos a node_modules (scripts en /tmp no encuentran node_modules del proyecto).

## 10. OBLIGATORIO: Verificación Post-Inserción con Agente

**CRITICO:** Después de insertar preguntas y mejorar explicaciones, es OBLIGATORIO verificarlas con el agente de Claude Code. No se considera un tema completado hasta que pasa esta verificación.

El agente compara cada pregunta contra su artículo vinculado y verifica:

1. **articleOk** - El artículo vinculado es correcto para esta pregunta
2. **answerOk** - La respuesta marcada como correcta es realmente correcta según el artículo
3. **explanationOk** - La explicación es correcta, didáctica y con formato markdown

Las preguntas que fallen se corrigen antes de dar el tema por bueno.

**Ver:** [revisar-preguntas-con-agente.md](./revisar-preguntas-con-agente.md)

### 10.1 Patrón "ciclo completo con contexto completo" (post-16/04/2026, RECOMENDADO)

Cuando el scraper tiene baja calidad de vinculación artículo↔contenido (caso TuTestDigital — ver `docs/scraping/tutestdigital-api-manual.md`), **no fiarse del `primary_article_id` extraído mecánicamente**. En lugar de procesar en cadena (insertar → verificar → reasignar → reescribir → re-verificar), hacer una sola pasada por agente con contexto completo:

**Inputs al agente por cada lote (8-15 preguntas):**
1. Las preguntas con su `correct_letter` y `explanation` original.
2. **TODOS los artículos del scope del tema** (no solo el artículo que el scraper asignó).

**Outputs del agente** por cada pregunta, en una sola pasada:
- `article_number` correcto del scope (no el que dijo el scraper)
- `answer_correct_letter` (puede diferir si el scraper se equivocó)
- `question_text_final` con `ensureLawContext` aplicado
- `explanation_final` didáctica con formato §8.1
- `decision: "ready" | "deactivate"` con `deactivate_reason`

**Por qué funciona mejor que el flujo en cadena:**
- Múltiples agentes parciales (uno solo ve el artículo asignado) discrepan entre sí cuando el artículo está mal vinculado.
- Un agente con contexto completo puede reasignar al artículo correcto del scope con criterio §3.1 estricto.

**Incidente que motiva el patrón (15/04/2026):** en T23 Aux. Admin. Extremadura el scraper había asignado mal 22 de 24 preguntas. Tres rondas de agentes parciales discreparon. Una sola ronda con todo el scope (arts 42-65 del Decreto 225/2014) dio resultado decisivo: 9 ready directas + 7 recuperables tras reasignación + 8 verdaderamente no rescatables.

### 10.2 Recuperación tras `deactivate` (post-16/04/2026)

Antes de aceptar `deactivate` como definitivo, hacer **un pase de recuperación**. El agente revisa cada pregunta marcada `deactivate` y determina:

- ¿Existe en el scope **otro artículo** cuyo contenido sí justifica la respuesta marcada? → Si sí, **reasignar** + reescribir explicación + reactivar.
- ¿La respuesta marcada **no se puede justificar con ningún artículo** del scope? → Mantener desactivada con motivo explícito.

**Ejemplo real (T23):** de 15 preguntas inicialmente `deactivate`, 7 eran recuperables reasignándolas a otro artículo del Decreto 225/2014 (notificaciones art. 55 vs comparecencia art. 60, etc.). 8 quedaron definitivamente fuera porque su respuesta correcta no aparecía en ningún artículo del Decreto.

**Patrón típico recuperable:**
- Scraper cita "art. 47" pero el contenido pregunta sobre "plazo notificación electrónica" → respuesta sí está en art. 55.4. Reasignar.

**Patrón típico no recuperable:**
- Pregunta dice "Según art X, la normativa supletoria es Y" pero ningún artículo del scope establece supletoriedad. La premisa es inventada.

### 10.3 Re-tag entre temas (post-16/04/2026)

Si el scraper colocó preguntas en el **tema equivocado** (caso T1→T2: 8 preguntas tageadas T1 sobre arts 23-30 que pertenecen al epígrafe T2), **NO desactivarlas**. Re-taggear:

```javascript
const newTags = q.tags.map(t => t === 'T1' ? 'T2' : t);
await s.from('questions').update({
  tags: newTags,
  topic_review_status: 'pending',
  verification_status: null,
  is_active: false,
  deactivation_reason: null
}).eq('id', q.id);
```

Después se procesan junto con las del tema correcto en el mismo lote.

**Cómo detectarlo:** el agente del flujo "ciclo completo" devuelve `decision: deactivate` con `deactivate_reason` mencionando "fuera del scope" + número de artículo concreto. Si ese artículo encaja en el scope de otro tema del mismo programa → re-tag, no descartar.

## 11. Preguntas sin artículo legal (conceptos teóricos)

Algunas preguntas del temario no se basan en un artículo de una ley concreta, sino en conceptos teóricos (ej: elementos de la comunicación, tipos de documentos, conceptos de ofimática). Estas preguntas SÍ tienen cabida si el epígrafe del tema las incluye, pero no tienen un artículo legal al que vincularse.

### Solución: Ley virtual con artículos temáticos

1. **Crear una ley virtual** (`is_virtual: true`) con un nombre descriptivo:
```javascript
await supabase.from('laws').insert({
  name: 'Conceptos de comunicación y atención al ciudadano',
  short_name: 'Comunicación y Atención Ciudadano',
  description: 'Conceptos teóricos de comunicación aplicados a la información administrativa',
  is_virtual: true,
  is_active: true,
  type: 'law', scope: 'national',
  slug: 'comunicacion-atencion-ciudadano'
});
```

2. **Crear artículos temáticos** dentro de la ley virtual (uno por concepto):
   - Art 0: Estructura (índice de los artículos)
   - Art 1: Elementos del proceso de comunicación
   - Art 2: El código en la comunicación
   - Art 3: Canales de comunicación
   - etc.

3. **Redactar el contenido** de cada artículo para que responda las preguntas vinculadas. El contenido debe ser didáctico y contener la información que justifica cada respuesta correcta.

4. **Vincular las preguntas** al artículo temático correspondiente (NO al Art 0 genérico).

5. **Añadir la ley virtual al topic_scope** del tema.

### Reglas importantes:
- **NUNCA** vincular preguntas teóricas al Art 0 de otra ley (ej: no vincular "elementos de la comunicación" al Art 0 del Decreto 21/2002).
- **El Art 0** solo debe contener la estructura/índice, NO contenido sustantivo.
- Cada pregunta debe tener un artículo cuyo contenido justifique la respuesta correcta.
- Verificar que el epígrafe del tema realmente incluye esos conceptos teóricos antes de importar las preguntas.

## 12. Aislamiento de preguntas de exámenes oficiales por oposición (CRÍTICO)

Las leyes virtuales de informática (Procesadores de texto, Hojas de cálculo, etc.) son **compartidas** entre todas las oposiciones. Si vinculas preguntas de exámenes oficiales de una oposición a estas leyes compartidas, los usuarios de OTRAS oposiciones verán esas preguntas, que pueden ser de versiones antiguas o contener referencias a documentos específicos del examen.

### Problema real (incidente 01/04/2026)

Preguntas de exámenes CyL (Excel 2013, Word 2016) vinculadas a "Hojas de cálculo. Excel" (ley compartida) aparecían en tests de Aux Estado (Excel 365). Además, preguntas de supuesto ("celda G33 del Anexo Excel") sin sentido fuera del examen CyL.

### Regla: preguntas de informática de exámenes oficiales NUNCA en leyes compartidas

Las preguntas **legislativas** de exámenes oficiales SÍ pueden estar en leyes compartidas — una pregunta sobre el Art. 103 CE es válida para cualquier oposición. El problema es **solo con informática y supuestos**:
- Versiones de software específicas (Excel 2013, Word 2016) que no aplican a otras oposiciones
- Supuestos prácticos que referencian documentos anexos del examen

Para cada oposición que tiene preguntas de informática en exámenes oficiales, crear leyes virtuales **exclusivas**:

```
Leyes compartidas (para preguntas de estudio):     Leyes exclusivas (para exámenes oficiales):
├── Procesadores de texto                          ├── Procesadores de texto - Exámenes CyL
├── Hojas de cálculo. Excel                        ├── Hojas de cálculo Excel - Exámenes CyL
├── Correo electrónico                             ├── Supuesto Word - Exámenes oficiales CyL
├── La Red Internet                                ├── Supuesto Excel - Exámenes oficiales CyL
├── Informática Básica                             ├── Windows 10 - Exámenes CyL
└── Windows 11                                     └── (etc. para cada oposición)
```

### Cuándo crear ley exclusiva

- Preguntas de informática de exámenes oficiales con versiones específicas (Excel 2013, Word 2016)
- Preguntas de "supuesto práctico" que referencian un documento anexo del examen
- Preguntas de ofimática que mencionan menús/opciones de una versión concreta

### Cuándo usar ley compartida

- Preguntas **legislativas** de exámenes oficiales (CE, LPAC, TREBEP, etc.) — válidas para todas las oposiciones
- Preguntas de estudio genéricas de informática que aplican a cualquier versión
- Preguntas teóricas sobre conceptos de informática que no dependen de versión

### Naming convention

```
{nombre-ley-compartida} - Exámenes {oposición}
Slug: {slug-ley-compartida}-{oposición}
```

Ejemplos: `procesadores-de-texto-cyl`, `hojas-de-calculo-excel-cyl`, `supuesto-word-cyl`

### NO tocar topic_scope

Las leyes exclusivas de exámenes **no se añaden al topic_scope**. El topic_scope es para el estudio de normativa actual. Las preguntas de exámenes oficiales se acceden por el modo examen (`exam_position` + `exam_date`), no por topic_scope.

## 13. Preguntas con Imágenes/Datos Visuales (Psicotécnicas)

Muchas preguntas psicotécnicas scrapeadas incluyen imágenes (tablas, diagramas de flujo, gráficos, tablas de equivalencias). Estas imágenes **NO se deben guardar como imágenes estáticas** - se deben convertir a `content_data` JSON para que los componentes React las rendericen nativamente.

### Por qué NO usar imágenes estáticas
- No son responsive ni accesibles
- No soportan dark mode
- No se pueden verificar automáticamente (los datos están "atrapados" en píxeles)
- Se rompen si cambian las URLs o se pierde el hosting

### Qué hacer: Convertir a `content_data` JSON

Los componentes psicotécnicos renderizan datos desde el campo `content_data` (JSONB):

| Tipo visual | Componente | Formato `content_data` |
|-------------|------------|----------------------|
| Tabla de datos | `DataTableQuestion` | `{ table_data: { headers: [...], rows: [[...], ...] } }` |
| Gráfico de barras | `BarChartQuestion` | `{ chart_data: [{ label, value }], chart_title }` |
| Gráfico de tarta | `PieChartQuestion` | `{ chart_data: [{ label, value, percentage }], total_value }` |
| Gráfico de líneas | `LineChartQuestion` | `{ age_groups: [...], categories: [...], chart_title }` |
| Gráfico mixto | `MixedChartQuestion` | Similar a bar/line combinado |

### Flujo para preguntas con imagen

```
1. Importar TODAS desactivadas (con y sin imagen)
2. Verificar con agentes las que NO tienen imagen (se activan solas)
3. Las que SÍ tienen imagen: procesar aparte, una a una:
   a. Leer la imagen PNG/JPG con Read (Claude es multimodal)
   b. Extraer los datos estructurados (tabla, valores, instrucciones)
   c. Convertir a content_data JSON según el componente
   d. Verificar la respuesta MANUALMENTE contra los datos extraídos
   e. Escribir explicación didáctica paso a paso
   f. Activar solo si se ha verificado al 100%
4. Las que dependen de imagen y NO se pueden verificar → desactivar
```

**IMPORTANTE:** NUNCA activar una pregunta que dependa de una imagen sin haberla verificado. Es preferible tener menos preguntas activas que tener preguntas con respuestas no verificadas.

### Tipos de imágenes en psicotécnicas (aprendizaje de Marzo 2026)

Al procesar las preguntas de "Pruebas de instrucciones" se identificaron estos tipos:

| Tipo | Ejemplo | Complejidad | `content_data` |
|------|---------|-------------|----------------|
| **Tabla de equivalencias símbolo→número** | `+ * ( % $ ¡ ) ° - ?` = 0-9 | Baja | `table_data` con headers/rows |
| **Tabla de operaciones con símbolos** | Œ=+3, Ž=÷2, ™=-5, Š=×2 | Baja | `table_data` con Símbolo/Operación |
| **Tabla de equivalencias letra→letra** | Ψ=C, Φ=A, Ω=M (letras griegas) | Baja | `table_data` con headers/rows |
| **Tabla de órdenes sobre frase** | A=mover 1a al final, B=intercambiar 3a y 6a | Media | `table_data` con Orden/Acción |
| **Tabla de clasificación** | Enciclopedia con reglas de codificación | Alta | `table_data` compleja |
| **Diagrama de flujo** | Estrella/luna/carita con transformaciones | Alta | Requiere análisis visual profundo |

### Problemas conocidos del scraping

1. **Símbolos Unicode corruptos**: El scraping puede corromper símbolos especiales. Por ejemplo, `"` (comillas tipográficas) puede convertirse en `+` o viceversa. **Siempre leer la imagen original** para verificar qué símbolos aparecen realmente.

2. **Cada pregunta puede tener su PROPIA tabla de equivalencias**: Aunque varias preguntas compartan formato, la tabla de símbolos puede ser diferente. Verificar imagen por imagen.

3. **Opciones corruptas `[object Object]`**: Algunas preguntas tienen opciones que muestran `[object Object]` en vez de texto. Son irrecuperables → desactivar.

4. **Explicaciones genéricas del scraping**: Las explicaciones scrapeadas de psicotécnicas suelen ser texto genérico ("Los ejercicios de instrucciones...") que NO resuelve la pregunta concreta. Hay que reescribirlas SIEMPRE con el paso a paso específico.

### Ejemplo real: Tabla de equivalencias → `content_data`

**Imagen original:** Tabla con `+ * ( % $ ¡ ) ° - ?` = 0-9

**`content_data` JSON:**
```json
{
  "table_data": {
    "title": "Tabla de equivalencias",
    "headers": ["+", "*", "(", "%", "$", "¡", ")", "°", "-", "?"],
    "rows": [["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]]
  }
}
```

**Explicación didáctica resultante:**
```markdown
Aplicando la tabla: **+** = 0, **%** = 3, **)** = 6, **¡** = 5, **%** = 3, **-** = 8, **(** = 2

Resultado: **0365382**

Por qué las demás son incorrectas:

- **A) 0365832**: Intercambia los dígitos 5o y 6o
- **B) 0356382**: Intercambia los dígitos 3o y 4o
- **D) 0363582**: Cambia posiciones centrales
```

### Ejemplo real: Tabla de operaciones → `content_data`

**Imagen:** Œ=suma 3, Ž=divide entre 2, ™=resta 5, Š=multiplica por 2

**`content_data` JSON:**
```json
{
  "table_data": {
    "title": "Tabla de operaciones",
    "headers": ["Símbolo", "Operación"],
    "rows": [["Œ", "Suma 3"], ["Ž", "Divide entre 2"], ["™", "Resta 5"], ["Š", "Multiplica por 2"]]
  }
}
```

**Explicación didáctica:**
```markdown
Partiendo de **0** y aplicando cada símbolo en orden:

1. **Œ** (suma 3): 0 + 3 = **3**
2. **Ž** (divide entre 2): 3 / 2 = **1,5**
3. **™** (resta 5): 1,5 - 5 = **-3,5**
4. **Š** (multiplica por 2): -3,5 x 2 = **-7**
5. **Œ** (suma 3): -7 + 3 = **-4**

Resultado: **-4**
```

### Preguntas que NO se pueden convertir

Desactivar con motivo específico:
- `[object Object]` en opciones → `'Opciones corruptas por error de scraping'`
- Diagrama de flujo demasiado complejo → `'Requiere imagen no convertible a content_data'`
- Imagen no disponible → `'Imagen no disponible'`

### Detección durante importación

Al importar, verificar si la pregunta tiene `imageLocal`/`imageOriginal` en el JSON scrapeado:
- Si **tiene imagen** → importar desactivada, procesar imagen aparte antes de activar
- Si **no tiene imagen** → importar desactivada, verificar con agentes (se activan solas al pasar)

### INCIDENTE: Preguntas con cuadro/tabla activadas sin content_data (Marzo 2026)

**Qué pasó:** 39 preguntas psicotécnicas activas mencionaban "cuadro" o "tabla" en `question_text` pero tenían `content_data: {}`. Los usuarios veían una pregunta que decía "Complete el siguiente cuadro..." sin ningún cuadro visible. Imposible de resolver.

**Causa raíz:** Al importar, las preguntas con imagen se importaron con `content_data: {}` y luego se activaron sin verificar que el content_data estuviera relleno. El campo `imageLocal` del JSON scrapeado apuntaba a la imagen correcta, pero nunca se procesó.

**Lecciones aprendidas:**

1. **NUNCA activar una pregunta si `question_text` menciona cuadro/tabla/figura y `content_data` es `{}`**. Añadido al check de calidad admin (`MISSING_IMAGE_REGEX` en `/api/admin/question-quality`).

2. **Cada pregunta tiene su PROPIA imagen**. Aunque varias preguntas compartan la misma tabla de equivalencias, la instrucción debajo de la tabla varía por pregunta. No asumir que una imagen sirve para varias preguntas. Siempre mapear pregunta→imagen por opciones (A/D match).

3. **Nuevos campos en `content_data`** (añadidos en DataTableQuestion y PsychometricTestLayout):
   - `instruction`: string — instrucción única debajo de tabla (ej: "TEA + (mes invernal)")
   - `instructions`: string[] — bloque de reglas (ej: "Si es vocal mayúscula = 5, si consonante = 2...")
   - `text_passage`: string — pasaje de texto para leer (ej: texto con errores ortográficos)
   - `table_data` sin `headers`: tabla solo con rows (ej: MORTAL/LETAL, INOFENSIVO/¿?)

4. **Validación pre-activación de psicotécnicas:**
   ```javascript
   // ANTES de activar, verificar:
   const text = q.question_text || '';
   const needsVisual = /cuadro|tabla|figura|imagen|gráfico|siguiente tabla|siguiente cuadro/i.test(text);
   const hasContentData = JSON.stringify(q.content_data) !== '{}';

   if (needsVisual && !hasContentData) {
     // NO ACTIVAR — falta content_data
     console.error('Pregunta necesita datos visuales pero content_data está vacío');
   }
   ```

5. **Patrones de `question_text` que indican necesidad de imagen** (añadidos a `MISSING_IMAGE_REGEX`):
   - `tabla mostrad[oa]`, `mostrad[oa] a continuación`
   - `anexo Excel`, `anexo de Excel`, `anexo Word`, `anexo Access`
   - `columna .{1,3} del anexo`

### Arquitectura de preguntas con imágenes (actualizado 06/04/2026)

**REGLA ABSOLUTA:** NUNCA activar una pregunta que dependa de una imagen sin haberla procesado. Siempre seguir el flujo completo de esta sección.

#### Flujo OBLIGATORIO para cada pregunta con imagen

```
1. DETECTAR: ¿La pregunta tiene campo `image` en el JSON scrapeado?
   → SI: marcar como pendiente de imagen, importar DESACTIVADA
   → NO: importar normal

2. DESCARGAR la imagen desde OpositaTest (necesita JWT válido)
   → Guardar en preguntas-para-subir/{oposicion}/imagenes/{nombre}.png
   → Si JWT expirado: obtener nuevo de cookies del navegador

3. CLASIFICAR por tamaño:
   → <5KB (iconos pequeños): ir a paso 4A
   → >=5KB (imágenes grandes): ir a paso 4B
   → Tablas de datos convertibles: ir a paso 4C

4A. ICONOS <5KB → image_base64
   - Leer archivo y convertir a base64
   - Guardar en content_data: { "image_base64": "data:image/png;base64,..." }
   - El componente ContentDataRenderer lo renderiza inline
   - ACTIVAR la pregunta

4B. IMÁGENES GRANDES >=5KB → Supabase Storage
   - Subir a bucket `question-images` ruta `{oposicion}/{nombre}.png`
   - Guardar URL pública en campo `image_url` de la pregunta
   - El componente ContentDataRenderer muestra lupa + zoom modal
   - ACTIVAR la pregunta

4C. TABLAS CONVERTIBLES A DATOS → content_data table_data
   - Leer la imagen (Claude es multimodal)
   - Extraer headers y rows
   - Guardar en content_data: { "table_data": { "title": "...", "headers": [...], "rows": [[...]] } }
   - TAMBIÉN subir imagen original a Supabase Storage como backup visual
   - El componente renderiza tabla HTML responsive con dark mode
   - ACTIVAR la pregunta

5. VERIFICAR: Comprobar que la pregunta se visualiza correctamente
```

#### Dónde van las preguntas según tipo

| Tipo de pregunta | Tabla | content_data | image_url | option_a/b/c/d |
|-----------------|-------|-------------|-----------|----------------|
| **Legislativas** (leyes, CE, LPAC...) | `questions` | No necesita | No necesita | Texto |
| **Informática con tabla/anexo** (Anexo Word/Excel/Calc) | `questions` | **Sí** (`table_data` JSON) | **Sí** (backup en Storage) | Texto |
| **Informática con icono en enunciado** (<5KB) | `questions` | **Sí** (`image_base64`) | No | Texto |
| **Informática con imagen grande en enunciado** (>=5KB) | `questions` | No | **Sí** (Supabase Storage) | Texto |
| **Informática con iconos en opciones** | `questions` | No | No | **URL de imagen** (Supabase Storage) |
| **Psicotécnicas con tabla** (equivalencias, instrucciones) | `psychometric_questions` | **Sí** (`table_data` JSON) | No | Texto |
| **Psicotécnicas con icono** (<5KB) | `psychometric_questions` | **Sí** (`image_base64`) | No | Texto |
| **Psicotécnicas con diagrama/cuadro grande** (>=5KB) | `psychometric_questions` | Intentar JSON | **Sí** (`image_url` si no se puede) | Texto |

#### Campos disponibles

- **`questions.content_data`** (JSONB) — Para image_base64 (<5KB) y table_data (tablas convertibles).
- **`questions.image_url`** (TEXT) — URL pública de Supabase Storage para imágenes >=5KB.
- **`psychometric_questions.content_data`** (JSONB) — Tablas, instrucciones, image_base64.

#### Ejemplo: icono <5KB → image_base64

```javascript
const fs = require('fs');
const buffer = fs.readFileSync('/path/to/icono.png');
const base64 = buffer.toString('base64');

await supabase.from('questions').update({
  content_data: { image_base64: 'data:image/png;base64,' + base64 }
}).eq('id', questionId);
```

#### Ejemplo: imagen grande → Supabase Storage

```javascript
const buffer = fs.readFileSync('/path/to/anexo-excel.png');
await supabase.storage.from('question-images').upload('andalucia/anexo-excel.png', buffer, {
  contentType: 'image/png', upsert: true
});
const { data } = supabase.storage.from('question-images').getPublicUrl('andalucia/anexo-excel.png');

await supabase.from('questions').update({
  image_url: data.publicUrl
}).eq('id', questionId);
```

#### Ejemplo: tabla convertible → content_data + Storage

```javascript
// 1. Convertir datos de la imagen a JSON
const contentData = {
  table_data: {
    title: 'Superficies agrarias CyL',
    headers: ['Cultivo', 'Unidad', 'Campaña 18-19', 'Campaña 19-20', '% Var.'],
    rows: [
      ['Trigo', 'Has.', '865.282', '904.586', '4,5'],
      ['Cebada', 'Has.', '803.961', '786.287', '-2,2'],
    ]
  }
};

// 2. Guardar content_data
await supabase.from('questions').update({ content_data: contentData }).eq('id', questionId);

// 3. También subir imagen original como backup
await supabase.storage.from('question-images').upload('andalucia/tabla-datos.png', buffer, {
  contentType: 'image/png', upsert: true
});
```

#### Errores comunes a EVITAR

1. **Activar preguntas con opciones vacías** — Si option_a/b/c/d tiene <3 chars, la pregunta depende de una imagen en las opciones que no se procesó
2. **Describir la imagen en texto en vez de procesarla** — NO poner "El icono muestra..." en el enunciado. Usar image_base64 o Storage
3. **No descargar las imágenes** — El scraper solo guarda la referencia, hay que descargar con JWT
4. **Dejar preguntas con image_url vacío** — Si la pregunta necesita imagen, image_url o image_base64 es OBLIGATORIO antes de activar
5. **No convertir tablas a table_data** — Si la imagen es una tabla legible, SIEMPRE convertir a JSON para accesibilidad y dark mode

#### ContentDataRenderer (componente centralizado)

Renderiza automáticamente cualquier tipo de content_data visual:
- `table_data` con/sin headers → tabla HTML responsive
- `instruction` → bloque destacado (ej: "TEA + (mes invernal)")
- `instructions` → lista de reglas paso a paso
- `text_passage` → bloque de texto para leer
- `image_base64` → imagen inline (<5KB, iconos)
- `imageUrl` (prop) → imagen con zoom modal (Supabase Storage)

Usado en: ChartQuestion, ExamLayout, OfficialExamLayout, TestLayout, PsychometricTestLayout.

#### Supabase Storage (bucket `question-images`)

- Bucket público con CDN
- Ruta: `cyl-exams/{imageName}.png` para exámenes CyL
- Imágenes >5KB que no se pueden convertir a content_data
- El componente ContentDataRenderer muestra lupa + zoom modal

#### Imágenes en opciones de respuesta (iconos Word/Excel)

Algunas preguntas de exámenes oficiales tienen **iconos como opciones A/B/C/D** en vez de texto (ej: "¿Qué icono permite voltear horizontalmente?"). El scraper captura `options[].image` (objeto con `name` y `thumbs`).

**Cómo importar opciones-imagen:**

1. Descargar cada imagen de opción desde OpositaTest (`answer_thumb_big` o `answer_thumb_original`)
2. Subir a Supabase Storage: `question-images/cyl-exams/options/{imageName}.png`
3. Guardar la URL completa directamente en `option_a`, `option_b`, etc.
4. El componente `OptionContent` detecta URLs de `question-images` y renderiza `<img>` en vez de texto

```javascript
// En option_a se guarda la URL directa:
option_a: 'https://...supabase.../question-images/cyl-exams/options/6502db4f...png'
```

**Componente OptionContent** (`components/OptionContent.tsx`):
- Detecta si el valor empieza con `https://` y contiene `question-images`
- Si sí: renderiza `<img>` inline (max-h-12)
- Si no: renderiza texto tal cual (comportamiento idéntico al anterior)
- Integrado en: `ExamLayout`, `OfficialExamLayout`

**Diferencia con imágenes de enunciado:**

| Ubicación | Campo | Ejemplo |
|-----------|-------|---------|
| Enunciado: icono pequeño (<5KB) | `content_data.image_base64` | "¿Qué hace este icono?" |
| Enunciado: captura grande (supuesto) | `image_url` | Documento Anexo Word/Excel |
| Opciones: iconos de menú | `option_a/b/c/d` con URL | "¿Cuál de estos iconos...?" |

**Scraper:** Los scrapers ahora capturan `image: a.image || null` en cada opción. Si `options[].image` existe y `options[].text` está vacío, la opción es una imagen.

#### Proceso eficiente para 500+ preguntas con imagen

1. **Agrupar por imagen compartida** — Muchas preguntas usan el mismo cuadro/tabla
2. **Mapear BD → scrapeado** por opciones (option_a + option_d)
3. **Leer cada imagen ÚNICA** — no repetir lectura de la misma imagen
4. **Convertir a content_data si es posible** (tablas, instrucciones, texto)
5. **Subir a Supabase Storage si es complejo** (diagramas, capturas Word)
6. **Aplicar content_data/image_url a todas las preguntas** del grupo
7. **Verificar respuesta + explicación** con agentes Opus
8. **Activar solo si todo es perfecto**

#### Preguntas que NO se pueden convertir a content_data

- Diagramas de flujo complejos → `image_url` (Supabase Storage)
- Capturas de pantalla de Word/Excel → `image_url` (Supabase Storage)
- Sopas de letras → `table_data` con rows (cada fila es una línea de letras)
- Cuadros con formato visual específico → evaluar caso a caso

## 13. Errores Comunes al Importar (Lecciones Aprendidas)

### Error 1: No limpiar enunciados antes de insertar

Cada fuente de scraping tiene patrones de basura distintos. Si no se limpia ANTES de insertar, hay que hacer UPDATE masivo después.

**Regla:** Revisar una muestra de preguntas, identificar patrones de basura, y limpiar ANTES de calcular el content_hash y ANTES de insertar. Ver el manual de scraping de cada fuente para los patrones concretos.

### Error 2: No reescribir explicaciones ANTES de la verificación

Las explicaciones scrapeadas son casi siempre insuficientes: solo repiten la respuesta correcta sin analizar las opciones incorrectas ni citar el artículo. Si se insertan tal cual, el paso de verificación marca el 90%+ como `bad_explanation` y hay que reescribirlas todas igual.

**Regla:** Reescribir TODAS las explicaciones con agentes ANTES de la verificación (paso 6 del checklist). No confiar en que las explicaciones scrapeadas "están bien".

### Error 3: Asignar artículo solo por el número mencionado en el enunciado

La pregunta puede decir "Según el artículo 29..." pero la información real estar en otro artículo. Esto pasa cuando la fuente etiqueta mal o cuando hay artículos con contenido reorganizado.

**Regla:** Al asignar `primary_article_id`, SIEMPRE leer el contenido del artículo candidato y verificar que contiene la información que la pregunta evalúa. No confiar ciegamente en el número que aparece en el enunciado.

### Error 4: Activar preguntas antes de verificación completa

Si se activan preguntas antes de que pasen la verificación con agentes, los usuarios ven preguntas con explicaciones malas o respuestas potencialmente incorrectas.

**Regla:** NUNCA activar manualmente. El flujo es: insertar desactivadas → verificar con agentes → las `perfect` se activan automáticamente.

### Error 5: La tabla `questions` NO tiene columna `source`

**Regla:** Usar `tags` para marcar el origen: `['Tema 2', 'Estatuto Murcia', 'CARM']`. No inventar columnas que no existen en el schema.

### Error 6: Preguntas estructurales mal vinculadas a un artículo concreto

Las preguntas que tratan sobre la **estructura** de la ley (qué Título cubre qué materia, cuántos capítulos tiene un Título, dónde se regula X) **no pertenecen a un artículo concreto**. Si el pipeline las vincula al primer artículo del Título mencionado, los usuarios que filtren por ese artículo verán preguntas confusas que no responden al contenido literal del artículo.

**Incidente real (abril 2026, usuario emilopbra007):** pidió "Test del Art. 97 CE" y le apareció *"¿Qué Título de la Constitución está dedicado a la regulación del Gobierno?"*. Esa pregunta no es del Art. 97 — es sobre el Título IV completo. El pipeline TuTestDigital la vinculó al Art. 97 (primer artículo del Título IV) sin verificar el contenido. Detectadas 21 preguntas con el mismo patrón en varias importaciones (TuTestDigital Galicia abr 2026, CyL mar 2026, Tramitación Procesal feb 2026).

**Regla:** Tras detectar las palabras clave de pregunta estructural en el enunciado, **vincular al `Art. 0 (Estructura)` de la MISMA ley** (la regla "no Art 0 de OTRA ley" del apartado 11 sigue vigente, pero NO prohíbe el Art 0 de la propia ley). Si la ley no tiene `Art. 0`, crearlo con la estructura/índice como contenido.

**Keywords detectables (case-insensitive) en el enunciado:**

| Patrón regex | Ejemplo de pregunta |
|---|---|
| `qué\s+t[íi]tulo\s+.+(dedicado|trata|regula)` | "¿Qué Título de la CE está dedicado al Poder Judicial?" |
| `seg[úu]n\s+el\s+t[íi]tulo\s+[IVX]+` | "Según el Título VIII de la CE..." |
| `a\s+tenor\s+.+t[íi]tulo` | "A tenor de lo dispuesto en el Título II..." |
| `dispuesto\s+en\s+el\s+(t[íi]tulo|cap[íi]tulo)\s+[IVX0-9]+` | "...dispuesto en el Capítulo III del Título IV..." |
| `conforme\s+al\s+t[íi]tulo` | "Conforme al Título VI..." |
| `cu[áa]nt(os|as)\s+(cap[íi]tulos|secciones|art[íi]culos).+(t[íi]tulo|cap[íi]tulo)` | "¿En cuántas secciones se divide el Capítulo III del Título IV?" |

**Excepción (mantener artículo específico):** si la pregunta menciona el Título pero la respuesta correcta requiere conocer el contenido literal de UN artículo concreto (no del Título completo), vincular al artículo concreto. Verificar pregunta a pregunta antes de aplicar el mapeo masivo a Art 0.

**Helper para pipelines:** la función `detectStructuralQuestion(text)` en `lib/import-cleanup.cjs` aplica los regex anteriores y devuelve `true` si la pregunta es estructural. Usar SIEMPRE en pipelines de importación antes de asignar `primary_article_id`.

```js
const { detectStructuralQuestion } = require('./lib/import-cleanup.cjs')

if (detectStructuralQuestion(question.text)) {
  // Vincular a Art 0 de la ley (no al primer art del título mencionado)
  primaryArticleId = await getOrCreateArt0(lawId)
} else {
  // Flujo normal: leer contenido del artículo candidato y verificar
  primaryArticleId = await findArticleForQuestion(question, lawId)
}
```

## 14. Checklist Completo por Tema

Flujo validado (Abril 2026):

```
0. LIMPIAR ENUNCIADOS (obligatorio para cualquier fuente)
   - Revisar muestra de preguntas e identificar patrones de basura
   - Aplicar limpieza ANTES de calcular content_hash
   - Ver manual de scraping de la fuente para patrones concretos

1. DETECCIÓN DUPLICADOS (obligatorio antes de trabajar)
   - Hash exacto (SHA-256 normalizado)
   - Opciones barajadas (normalizar y ordenar opciones)
   - Similitud Jaccard >=80% (revisar rápido)
   - Similitud 60-80% (comparar opciones manualmente)
   - Contra TODA la BD, no solo el tema

2. VERIFICAR LEYES Y ARTÍCULOS
   - Las leyes del tema existen en BD
   - Los artículos están sincronizados desde BOE (usar /api/verify-articles/sync-all)
   - El Preámbulo existe si la ley lo tiene
   - Si hay preguntas teóricas sin ley → crear ley virtual (ver sección 11)

3. VERIFICAR TOPIC SCOPE
   - Los artículos del scope corresponden al epígrafe
   - No faltan artículos que el epígrafe menciona
   - No sobran artículos que no corresponden

4. ASIGNAR ARTÍCULOS VERIFICANDO CONTENIDO
   - Para cada pregunta, leer el artículo candidato
   - Verificar que el contenido del artículo responde a la pregunta
   - NO confiar ciegamente en el número de artículo del enunciado
   - Si hay discrepancia entre el número mencionado y el contenido, vincular al artículo correcto

5. INSERTAR PREGUNTAS NUEVAS (DESACTIVADAS)
   - Solo las que no son duplicados
   - Con primary_article_id verificado contra contenido
   - Con content_hash generado (sobre texto limpio)
   - Con tags apropiados
   - is_active: false
   - deactivation_reason: 'Pendiente de revisión post-importación'
   - topic_review_status: 'pending'

6. REESCRIBIR EXPLICACIONES (ANTES de verificar, NO después)
   - Reescribir TODAS con agentes Sonnet en paralelo
   - Formato: blockquote + por qué correcta + por qué incorrectas
   - Las explicaciones scrapeadas son casi siempre insuficientes
   - Actualizar en BD

7. VERIFICACIÓN CON AGENTE (las preguntas siguen desactivadas)
   - articleOk, answerOk, explanationOk
   - Guardar en ai_verification_results con ai_provider 'claude_code'
   - Las 'perfect' se reactivan automáticamente
   - Las que fallen se corrigen y luego se reactivan
   - No dar el tema por bueno hasta que TODAS estén perfect o desactivadas con motivo

   **Para psicotécnicas y ortografía:** La tabla `ai_verification_results` acepta los 3 tipos:
   - `question_id` → preguntas legislativas (tabla `questions`)
   - `psychometric_question_id` → psicotécnicas (tabla `psychometric_questions`)
   - `spelling_question_id` → ortografía (tabla `spelling_questions`)
   
   Solo uno de los tres debe ser NOT NULL por registro. Además marcar `is_verified = true` en la tabla de origen.
   Para psicotécnicas no aplica `articleOk` (poner `true` por defecto).

8. CORRECCIÓN DE ERRORES
   - Agentes revisan preguntas con status de error
   - Falsos positivos → perfect (se reactivan)
   - Errores reales → corregir explicación/respuesta/artículo → perfect
   - Preguntas irrecuperables → desactivar con motivo específico

9. REACTIVAR TOPIC (si estaba "En elaboración")
   Si el tema estaba marcado como "En elaboración" antes de este import
   (porque no tenía leyes o preguntas), hay que reactivarlo ahora. Revisar
   TRES señales en la tabla topics:

   □ topics.is_active          → poner true
   □ topics.disponible         → poner true
   □ topics.descripcion_corta  → eliminar prefijo "En elaboracion." si existe,
                                 reescribir con una frase descriptiva del tema

   Si falta CUALQUIERA de estas tres, el tema seguirá apareciendo como
   "En elaboración" en la UI (TemarioClient lee `disponible`, TestHubPage
   lee `is_active`, y el listado muestra literalmente `descripcion_corta`).

   Después, invalidar cache:
     curl -X POST https://www.vence.es/api/admin/revalidate-temario
     curl -X POST https://www.vence.es/api/purge-cache \
       -H "x-cron-secret: $CRON_SECRET" \
       -d '{"path": "/<slug>/temario"}'

   Ver detalle en crear-nueva-oposicion.md §2.1 "Señales de En elaboración".
```

### Comando rápido:
```
Verifica las preguntas del tema [TOPIC_NUMBER] de [OPOSICION]
```

**Ejemplos:**
```
Verifica las preguntas del tema 204 de administrativo C1
Verifica las preguntas del tema T12 de auxiliar C2
```

El agente:
1. Lee cada pregunta y su artículo vinculado
2. Verifica: articleOk, answerOk, explanationOk
3. Guarda resultados en `ai_verification_results`
4. Actualiza `questions.topic_review_status`

### Flujo completo:
```
Importar preguntas → Verificar con agente → Revisar en web → Corregir problemas
```

Los resultados aparecen en: `/admin/revision-temas/[topicId]`

---

## Importar Preguntas de Ortografía/Gramática (Multi-respuesta)

Las preguntas de ortografía y gramática (GC, PN) son **multi-respuesta** y NO encajan en la tabla `questions` (que usa `correct_option` integer 0-3). Tienen su propio sistema.

### Arquitectura

| Componente | Ubicación |
|---|---|
| Tabla BD | `spelling_questions` (JSONB options, category, oposicion_slug) |
| API validación | `/api/answer/spelling` (Drizzle + Zod) |
| API sesiones | `/api/spelling/session` (crear/completar) |
| Tracking | `spelling_test_sessions` + `spelling_test_answers` |
| Componente UI | `SpellingQuestion.tsx` (multi-select checkboxes) |
| Layout | `SpellingTestLayout.tsx` (navegación, resultados) |
| Página | `/[oposicion]/test/ortografia` |
| Config | `hasSpellingTest: true` en oposiciones.ts |

### Formato de datos InnoTest (ortografía)

```json
{
  "bloque": "ortografia_tests",
  "questions": [{
    "innotest_id": 93744,
    "question": "Me <b>fié</b> de que hubiera tantas <b>vallas</b>...",
    "options": [
      { "letter": "A", "text": "fié.", "correct": true },
      { "letter": "B", "text": "vallas.", "correct": false }
    ],
    "tipoPregunta": "multi-respuesta"
  }]
}
```

**Semántica de `correct`**: `true` = es respuesta correcta = la palabra ESTÁ mal escrita. Mapear a `isCorrectlyWritten = !correct`.

### Conversión HTML → Markdown (orden crítico)

Procesar `<span>` de color **ANTES** que `<b>`/`<u>`, porque los spans envuelven tags de formato:

```
Entrada:  <span style="color:#F94646"><u>otea</u></span>
MAL:      <span>**otea**</span> → ****otea**** (incorrecto)
BIEN:     Primero span → **otea** (incorrecto), luego u/b ya no existe
```

```javascript
// 1. PRIMERO: spans de color (stripear HTML interno)
.replace(/<span[^>]*#F94646[^>]*>([\s\S]*?)<\/span>/gi,
  (_, inner) => '**' + inner.replace(/<[^>]+>/g, '') + '** (incorrecto)')
.replace(/<span[^>]*#00C951[^>]*>([\s\S]*?)<\/span>/gi,
  (_, inner) => '**' + inner.replace(/<[^>]+>/g, '') + '** (correcto)')
// 2. DESPUÉS: bold, italic, underline...
.replace(/<b>/gi, '**').replace(/<\/b>/gi, '**')
```

### Scoring

**Todo-o-nada** (como en el examen real GC): correcto solo si marca EXACTAMENTE las palabras incorrectas, ni más ni menos.

### Notas técnicas

- Supabase **no soporta upsert** con índices parciales (`WHERE source IS NOT NULL`). Usar insert directo + dedup en memoria.
- `correctAnswer` en el JSON es **poco fiable** (a veces null, a veces solo la primera letra). La verdad está en `options[].correct`.
- Las preguntas con todas las opciones `correct: false` significan que **todas las palabras están bien escritas** y no hay que marcar nada.
