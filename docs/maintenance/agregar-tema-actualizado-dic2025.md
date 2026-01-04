# Guía Actualizada: Añadir Preguntas de un Tema (Diciembre 2025)

Este documento describe el proceso completo para añadir preguntas scrapeadas a la base de datos, basado en el flujo probado con el Tema 1 (Constitución Española).

---

## ⚠️ REQUISITO CRÍTICO: Usar Temario Oficial del BOE

**ANTES de añadir preguntas a cualquier oposición, es OBLIGATORIO:**

1. **Obtener el temario oficial del BOE** de la convocatoria correspondiente
2. **Verificar la estructura de temas** (numeración, títulos, contenido)
3. **Alinear la BD con el temario oficial**, NO con la estructura de OpositaTest

### ¿Por qué es crítico?

- OpositaTest puede tener una estructura diferente al temario oficial
- Los usuarios estudian según el temario oficial de la convocatoria
- Una discrepancia en la numeración confunde a los opositores
- El contenido de cada tema debe coincidir exactamente con el BOE

### Ejemplo de discrepancia detectada:

| OpositaTest | BOE Oficial (C1 Administrativo) |
|-------------|--------------------------------|
| Tema 2: La Corona | Tema 4: La Corona |
| Tema 3: Las Cortes | Tema 5: Las Cortes |

### Proceso correcto:

1. Descargar PDF del temario oficial del BOE
2. Crear/actualizar `topics` en BD con la estructura oficial
3. Mapear preguntas de OpositaTest al tema CORRECTO según BOE
4. Verificar que el UI muestre la estructura oficial

---

## Resumen del Proceso

### ⚠️ REGLA FUNDAMENTAL: PARAR SI FALTA ALGO

**Claude debe PARAR y avisar al usuario si detecta que faltan leyes o artículos.**
El usuario añadirá lo faltante desde `/admin/monitoreo`. NO intentar añadir manualmente.

### ⚠️ REGLA FUNDAMENTAL: NO DETECTAR ARTÍCULOS CON SCRIPTS

**Claude debe usar su conocimiento de IA para identificar a qué ley pertenece cada artículo DE CADA PREGUNTA.**

❌ **NO hacer:** Usar regex/scripts para detectar automáticamente qué artículos pertenecen a qué ley.

✅ **SÍ hacer:** Leer la explicación de cada pregunta y usar conocimiento legal para determinar la ley correcta.

**¿Por qué es peligroso usar scripts?**
- Una explicación puede mencionar artículos de MÚLTIPLES leyes
- Ejemplo: "Artículo 86 LOPJ... procedimiento del artículo 781 bis de la Ley 1/2000"
- Un script detectaría erróneamente que el art. 781 es de LOPJ cuando es de la LEC
- Esto causa asignaciones incorrectas de artículo→ley→topic_scope

**Proceso correcto:**
1. Leer la explicación de la pregunta
2. Identificar cuál es la LEY PRINCIPAL que la pregunta está evaluando
3. Identificar el ARTÍCULO PRINCIPAL de esa ley
4. Asignar manualmente o verificar con conocimiento legal

### Pasos en orden:

1. **Analizar preguntas scrapeadas** - Extraer TODAS las leyes y artículos referenciados
2. **Verificar leyes en BD** - ¿Existen todas? ¿Tienen `boe_url`?
   - Si falta ley → PARAR, informar, usuario la añade en `/admin/monitoreo`
3. **Verificar artículos en BD** - Para cada ley, ¿existen los artículos necesarios?
   - Si faltan artículos → PARAR, informar, usuario los añade en `/admin/monitoreo` → Verificar artículos → Añadir faltantes
4. **Configurar topic_scope** - Solo cuando TODO existe
5. **Comparar duplicados** - Identificar preguntas nuevas vs existentes
6. **Subir preguntas** - Solo las nuevas, mapeadas a sus artículos

---

## 1. Scrapear Preguntas

### Ejecutar el scraper

```bash
node scripts/opositatest-auto.cjs
```

El scraper guarda los JSON en `preguntas-para-subir/[Tema]/[Subtema].json`

### Estructura del JSON generado

```json
{
  "tema": "Tema 1, Constitución Española de 1978",
  "subtema": "La Reforma de la Constitución Española",
  "source": "opositatest",
  "scrapedAt": "2025-12-25T21:15:52.971Z",
  "questionCount": 34,
  "questions": [
    {
      "question": "Texto de la pregunta...",
      "options": [
        { "letter": "A", "text": "Opción A" },
        { "letter": "B", "text": "Opción B" },
        { "letter": "C", "text": "Opción C" },
        { "letter": "D", "text": "Opción D" }
      ],
      "correctAnswer": "C",
      "explanation": "Explicación con referencia a ley y artículo..."
    }
  ]
}
```

---

## 2. Comparar Duplicados

### Método eficiente (recomendado)

Descargar todos los `question_text` en UNA query y comparar con Set para O(1) lookup:

```javascript
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Normalizar texto para comparación
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

(async () => {
  // 1. Descargar TODAS las preguntas existentes (solo question_text)
  const { data: existing } = await supabase
    .from('questions')
    .select('question_text');

  // 2. Crear Set con textos normalizados
  const existingSet = new Set(existing.map(q => normalize(q.question_text)));

  // 3. Cargar preguntas scrapeadas
  const scraped = JSON.parse(fs.readFileSync('./preguntas-para-subir/...json'));

  // 4. Comparar
  let duplicates = 0, newQuestions = 0;
  for (const q of scraped.questions) {
    if (existingSet.has(normalize(q.question))) {
      duplicates++;
    } else {
      newQuestions++;
    }
  }

  console.log(`Nuevas: ${newQuestions}, Duplicadas: ${duplicates}`);
})();
```

---

## 3. Verificar/Añadir Leyes al Monitoreo

### ⚠️ IMPORTANTE: Consultar el mapeo de leyes

Antes de buscar una ley en la BD, **consultar `lib/lawMappingUtils.js`** para ver cómo está registrada.

Ejemplo: LOPJ puede estar como `LO 6/1985` en lugar de `LOPJ`.

```javascript
// En lib/lawMappingUtils.js encontrarás:
'lopj': 'LO 6/1985',
'ley-organica-poder-judicial': 'LO 6/1985',
```

### Requisito

Para que una ley aparezca en `/admin/monitoreo`, debe tener `boe_url` configurado.

### Añadir ley al monitoreo

```javascript
const { data, error } = await supabase
  .from('laws')
  .update({
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-XXXX-XXXXX',
    boe_id: 'BOE-A-XXXX-XXXXX'
  })
  .eq('short_name', 'Nombre de la ley')
  .select();
```

### Verificar que aparece en monitoreo

```javascript
const { data } = await supabase
  .from('laws')
  .select('short_name, boe_url')
  .not('boe_url', 'is', null);

console.log('Leyes en monitoreo:', data.length);
```

---

## 4. Añadir Artículos

### Desde el panel admin (recomendado)

1. Ir a `/admin/monitoreo`
2. Buscar la ley
3. Click en "📋 Verificar artículos"
4. Añadir los artículos necesarios

### Verificar artículos existentes

```javascript
const { data } = await supabase
  .from('articles')
  .select('article_number')
  .eq('law_id', 'UUID-de-la-ley');

console.log('Artículos:', data.map(a => a.article_number).join(', '));
```

---

## 5. Mapear Preguntas a Artículos

### Identificar artículos desde las explicaciones

Cada pregunta tiene una `explanation` que referencia la ley y artículo. Ejemplo:

```
"Constitución Española.\nArtículo 168.\n1. Cuando se propusiere..."
→ Ley: CE, Artículo: 168
```

```
"Artículo 152 del Reglamento del Senado de 3 de mayo de 1994..."
→ Ley: Reglamento del Senado, Artículo: 152
```

### Obtener IDs de artículos

```javascript
// Obtener law_id
const { data: laws } = await supabase
  .from('laws')
  .select('id, short_name')
  .in('short_name', ['CE', 'Reglamento del Senado']);

// Obtener article_id
const { data: articles } = await supabase
  .from('articles')
  .select('id, article_number')
  .eq('law_id', 'UUID-de-la-ley')
  .in('article_number', ['166', '167', '168', '169']);
```

### Crear mapeo

```javascript
const articles = {
  'CE_166': 'uuid-articulo-166',
  'CE_167': 'uuid-articulo-167',
  'CE_168': 'uuid-articulo-168',
  // ...
};

// Índice de pregunta -> clave de artículo
const questionToArticle = [
  'CE_168', // Q1 referencia Art.168
  'CE_166', // Q2 referencia Art.166
  'RC_146', // Q3 referencia Reglamento Congreso Art.146
  // ... una entrada por cada pregunta
];
```

---

## 6. Subir Preguntas

### Estructura de la tabla `questions`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `question_text` | text | Texto de la pregunta |
| `option_a` | text | Opción A |
| `option_b` | text | Opción B |
| `option_c` | text | Opción C |
| `option_d` | text | Opción D |
| `correct_option` | integer | **0=A, 1=B, 2=C, 3=D** |
| `explanation` | text | Explicación |
| `primary_article_id` | uuid | ID del artículo vinculado |
| `is_active` | boolean | true |
| `is_official_exam` | boolean | Si es de examen oficial |

### Script de subida

```javascript
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Usar service role para insert
);

// Mapeo de artículos (obtener IDs primero)
const articles = {
  'CE_167': 'uuid-del-articulo',
  'CE_168': 'uuid-del-articulo',
  // ...
};

// Mapeo pregunta -> artículo
const questionToArticle = ['CE_168', 'CE_167', ...];

// Convertir letra a número
const letterToNum = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

(async () => {
  const data = JSON.parse(fs.readFileSync('./preguntas-para-subir/...json'));

  const toInsert = data.questions.map((q, i) => ({
    question_text: q.question,
    option_a: q.options.find(o => o.letter === 'A')?.text || '',
    option_b: q.options.find(o => o.letter === 'B')?.text || '',
    option_c: q.options.find(o => o.letter === 'C')?.text || '',
    option_d: q.options.find(o => o.letter === 'D')?.text || '',
    correct_option: letterToNum[q.correctAnswer],
    explanation: q.explanation,
    primary_article_id: articles[questionToArticle[i]],
    is_active: true,
    is_official_exam: false
  }));

  // Insertar en batches de 10
  for (let i = 0; i < toInsert.length; i += 10) {
    const batch = toInsert.slice(i, i + 10);
    const { error } = await supabase.from('questions').insert(batch);
    if (error) console.error('Error:', error.message);
  }
})();
```

---

## Leyes y Artículos Comunes

### IDs de leyes principales

| Ley | short_name | UUID |
|-----|------------|------|
| Constitución Española | CE | `6ad91a6c-41ec-431f-9c80-5f5566834941` |
| Reglamento del Congreso | Reglamento del Congreso | `d7addcab-3179-4667-8037-9fcae8097faa` |
| Reglamento del Senado | Reglamento del Senado | `cfcb6187-8108-408c-9b03-653331932c4a` |

### Artículos frecuentes de la CE (Título X - Reforma)

| Artículo | UUID | Contenido |
|----------|------|-----------|
| Art.166 | `3c483b76-c161-4d8b-b71c-28958cdd82b8` | Iniciativa de reforma |
| Art.167 | `9e84e789-d982-4934-b23b-a184f7520e22` | Procedimiento ordinario |
| Art.168 | `5eef7a3b-9314-4f10-8e23-db68325e6c28` | Procedimiento agravado |
| Art.169 | `97ae2317-2dce-4784-b943-65f95728f687` | Límites temporales |
| Art.87 | `a01f332e-20c7-4a48-b4f1-13d5bb24aca4` | Iniciativa legislativa |

---

## Verificación Post-Subida

```javascript
// Contar preguntas vinculadas a los artículos del tema
const { count } = await supabase
  .from('questions')
  .select('id', { count: 'exact' })
  .in('primary_article_id', [/* array de UUIDs */]);

console.log('Preguntas del tema:', count);
```

---

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `correct_answer column not found` | Campo incorrecto | Usar `correct_option` |
| `invalid input syntax for integer` | Letra en vez de número | Convertir A→0, B→1, C→2, D→3 |
| `violates check constraint` | Valor fuera de rango | Usar 0-3, no 1-4 |
| `foreign key violation` | Artículo no existe | Crear artículo primero |

---

## 7. Configurar Topic Scope

El `topic_scope` vincula temas con leyes y artículos. **Sin esto, las preguntas no aparecerán en los tests.**

### ⚠️ CRÍTICO: Cubrir TODOS los artículos de TODAS las leyes

El topic_scope debe incluir **TODAS las leyes y artículos referenciados en TODAS las preguntas del tema**.

**Un tema puede tener preguntas de MÚLTIPLES leyes.** Por ejemplo, Tema 7 (Transparencia) podría tener:
- 150 preguntas de Ley 19/2013
- 5 preguntas que refieren CE art. 105
- 3 preguntas de Ley 40/2015

→ El topic_scope necesita **3 entradas** (una por cada ley) con sus artículos respectivos.

**Incluir tanto preguntas nuevas como duplicadas:**
- Artículos de preguntas **nuevas** que subimos
- Artículos de preguntas **duplicadas** (que ya existían en la BD y no subimos)

**¿Por qué incluir duplicadas?** Las preguntas duplicadas ya están en la BD vinculadas a sus artículos. Si el topic_scope no incluye esos artículos, esas preguntas existentes no aparecerán en los tests del tema.

**Proceso correcto:**
1. Leer TODAS las preguntas scrapeadas (nuevas + duplicadas)
2. Para cada pregunta, identificar LEY + ARTÍCULO (usando conocimiento legal, NO scripts)
3. Agrupar: {Ley1: [art1, art2...], Ley2: [art5, art8...]}
4. Crear una entrada en topic_scope por cada ley

### Estructura de topic_scope

| Campo | Descripción |
|-------|-------------|
| `topic_id` | UUID del tema en `topics` |
| `law_id` | UUID de la ley en `laws` |
| `article_numbers` | Array de números de artículo (strings) |

### Script para configurar topic_scope

```javascript
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // 1. Obtener topic_id
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('topic_number', 1) // Número del tema
    .eq('position_type', 'auxiliar_administrativo') // Tipo de oposición
    .single();

  // 2. Obtener law_id
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'CE')
    .single();

  // 3. Insertar/actualizar topic_scope
  const { error } = await supabase
    .from('topic_scope')
    .upsert({
      topic_id: topic.id,
      law_id: law.id,
      article_numbers: ['1', '2', '3', '4', '5'] // Artículos incluidos
    }, {
      onConflict: 'topic_id,law_id'
    });

  if (error) console.error('Error:', error);
  else console.log('✅ Topic scope configurado');
})();
```

### Verificar configuración

```javascript
const { data } = await supabase
  .from('topic_scope')
  .select(`
    article_numbers,
    topics!inner(topic_number, position_type),
    laws!inner(short_name)
  `)
  .eq('topics.topic_number', 1)
  .eq('topics.position_type', 'auxiliar_administrativo');

data.forEach(ts => {
  console.log(ts.laws.short_name + ':', ts.article_numbers.length, 'artículos');
});
```

### Ejemplo: Tema 1 Constitución Española

```javascript
const scopeData = [
  {
    law: 'CE',
    articles: ['1','2','3',...,'169'] // Título Preliminar + I + IX + X
  },
  {
    law: 'LO 3/1981', // Defensor del Pueblo
    articles: ['1','2','3',...,'37']
  },
  {
    law: 'Reglamento del Congreso',
    articles: ['146']
  },
  {
    law: 'Reglamento del Senado',
    articles: ['152']
  }
];
```

---

## Checklist Rápido

- [ ] Scrapear tema con `opositatest-auto.cjs`
- [ ] Comparar duplicados contra BD
- [ ] Verificar que la ley tiene `boe_url` (monitoreo)
- [ ] Añadir artículos faltantes desde admin
- [ ] Analizar explicaciones para mapear artículos
- [ ] Obtener UUIDs de artículos
- [ ] Crear array de mapeo pregunta→artículo
- [ ] Subir con `correct_option` en formato 0-3
- [ ] Verificar conteo post-subida
- [ ] **Configurar topic_scope** para vincular tema↔leyes↔artículos
