# Manual: Importar Temas de Tramitación Procesal

## Resumen del Proceso

Este manual documenta el proceso para importar preguntas de Tramitación Procesal desde los JSONs scrapeados de OpositaTest.

### Principios Clave

1. **El artículo es la fuente de verdad** - Lo más importante es vincular correctamente cada pregunta con su artículo y ley
2. **Verificación completa en JSON** - Todo (artículo + explicación + respuesta) se verifica ANTES de importar
3. **topic_scope al final** - Se actualiza automáticamente después de importar, solo con artículos nuevos

## Estructura de Archivos Fuente

```
preguntas-para-subir/tramitacion-procesal/
├── Tema_1._La_Constitución_española_de_1978_(PRÓXIMAS_CONVOCATORIAS_TP_TL)/
│   ├── I._Características_generales.json
│   ├── II._Derechos_fundamentales.json
│   └── ...
├── Tema_2._.../
└── ...
```

Cada JSON tiene estructura:
```json
{
  "tema": "Tema 1. La Constitución española de 1978",
  "subtema": "I. Características generales",
  "source": "opositatest",
  "questionCount": 30,
  "questions": [
    {
      "question": "Texto...",
      "options": [{"letter": "A", "text": "..."}],
      "correctAnswer": "B",
      "explanation": "Art. 1 CE..."
    }
  ]
}
```

## Proceso Completo (5 Fases)

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUJO DE IMPORTACIÓN                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fase 0: Verificar leyes en BD y sincronizar artículos          │
│     ↓                                                           │
│  Fase 1: Preparar JSON con artículos candidatos                 │
│     ↓                                                           │
│  Fase 2: IA verifica TODO ← PREGUNTA → ARTÍCULO → LEY           │
│     ↓              (lo más importante: vincular correctamente)  │
│  Fase 3: Importar directo a BD + actualizar topic_scope         │
│     ↓                                                           │
│  Fase 4: Revisar preguntas importadas con agentes               │
│          (ver: revisar-temas-con-agente.md)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Fase 0: Verificar/Añadir Leyes a la BD

Antes de importar, verificar que TODAS las leyes referenciadas estén en la BD y sincronizadas.

#### 0.1 Identificar leyes mencionadas en los JSONs

Revisar las explicaciones y listar leyes únicas:
- CE, LOTC, LOPJ, LEC...
- Reales Decretos (RD 204/2024, RD 829/2023...)
- Leyes Orgánicas (LO 3/1981, LO 4/1981...)

#### 0.2 Verificar si la ley existe en la BD

```javascript
const { data } = await supabase
  .from('laws')
  .select('id, short_name, boe_url')
  .ilike('short_name', '%204/2024%');

console.log(data?.length ? 'Existe' : 'NO existe - hay que añadirla');
```

#### 0.3 Añadir ley nueva

Si la ley NO existe, añadirla con la URL del BOE:

```javascript
await supabase.from('laws').insert({
  name: 'Real Decreto 204/2024, de 27 de febrero...',
  short_name: 'RD 204/2024',
  description: 'Estructura orgánica básica del Ministerio...',
  year: 2024,
  type: 'regulation',  // 'law' o 'regulation'
  scope: 'national',   // 'national' o 'eu'
  is_active: true,
  boe_id: 'BOE-A-2024-3790',
  boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2024-3790',
  slug: 'rd-204-2024'
});
```

#### 0.4 Sincronizar artículos desde BOE (API oficial)

**IMPORTANTE:** Usar SIEMPRE la API de sincronización para obtener el texto oficial del BOE.

```bash
DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d'=' -f2-) npx tsx -e "
import { syncArticlesFromBoe } from './lib/api/article-sync/queries'

const result = await syncArticlesFromBoe({
  lawId: 'UUID-DE-LA-LEY',
  includeDisposiciones: true
})

console.log(result)
"
```

#### 0.5 Verificar sincronización

```javascript
const { count } = await supabase
  .from('articles')
  .select('id', { count: 'exact' })
  .eq('law_id', 'UUID-DE-LA-LEY');

console.log('Artículos sincronizados:', count);
```

---

### Fase 1: Preparar JSON para IA

Generar batches de ~20 preguntas con artículos candidatos.

```bash
node scripts/enrich-temaX-with-ai.cjs
# Genera: /tmp/temaX-batch-{1-N}.json
```

Cada pregunta en el batch incluye:
- Datos originales (question, options, correctAnswer, explanation)
- `candidateArticles`: lista de artículos posibles de la BD
- Campos vacíos para que la IA complete

---

### Fase 2: Verificación COMPLETA con IA (Agentes Paralelos)

**Esta es la fase clave.** El objetivo principal es **vincular correctamente cada pregunta con su artículo**. Los agentes verifican TODO y guardan el resultado en el JSON.

#### 2.1 Qué verifica cada agente

Para CADA pregunta del batch:

| Verificación | Descripción |
|--------------|-------------|
| **Artículo correcto** | ¿El artículo vinculado responde realmente la pregunta? |
| **Respuesta correcta** | ¿La opción marcada es correcta según el artículo? |
| **Explicación clara** | ¿La explicación es didáctica y explica el motivo de la respuesta? |

#### 2.2 Prompt para agentes

```
Verifica COMPLETAMENTE las preguntas del batch X del Tema Y.

Lee /tmp/temaY-batch-X.json

Para CADA pregunta:

1. **ARTÍCULO**: Analiza los candidateArticles y determina cuál responde la pregunta.
   - Lee el contenido del artículo en la BD
   - Verifica que el artículo citado en la explicación coincida

2. **RESPUESTA**: Verifica que correctAnswer sea realmente correcto según el artículo.
   - Si la respuesta marcada es incorrecta, corrige correctAnswer

3. **EXPLICACIÓN**: Verifica que sea didáctica y clara.
   - Debe explicar POR QUÉ la respuesta es correcta
   - Debe citar el artículo y ley correctos
   - Si es confusa o incorrecta, reescríbela

Guarda el resultado en /tmp/temaY-batch-X-verified.json con:
```json
{
  "id": "uuid-original",
  "question": "texto original",
  "options": [...],
  "correctAnswer": "B",           // Corregido si era incorrecto
  "explanation": "...",           // Mejorada si era necesario
  "verified_article_id": "uuid",  // Artículo correcto de la BD
  "verified_article_number": "24",
  "verified_law": "CE",
  "ai_verification": {
    "article_correct": true,
    "answer_correct": true,
    "explanation_improved": false,
    "confidence": "high",
    "notes": "Verificado contra Art. 24 CE"
  }
}
```

Reporta: Total verificadas, problemas encontrados, correcciones realizadas.
```

#### 2.3 Criterios de explicación didáctica

La explicación debe ser **clara y explicar el motivo de la respuesta**:

```
[Cita de la ley y artículo]

[Texto legal relevante]

[Explicación de POR QUÉ la respuesta correcta es correcta]

[Opcional: por qué las otras opciones son incorrectas]
```

**Lo importante:**
- El opositor debe entender por qué esa es la respuesta correcta
- Debe haber una conexión clara entre el artículo citado y la respuesta
- No hay formato obligatorio, solo claridad

#### 2.4 Lanzar agentes en paralelo

```javascript
// Lanzar 8 agentes para 8 batches simultáneamente
for (let i = 1; i <= 8; i++) {
  // Task tool con subagent_type: 'general-purpose'
  // Prompt: verificar batch i
}
```

#### 2.5 Fusionar resultados verificados

```javascript
const fs = require('fs');
const allQuestions = [];

for (let i = 1; i <= N; i++) {
  const verified = JSON.parse(
    fs.readFileSync(`/tmp/temaY-batch-${i}-verified.json`)
  );
  allQuestions.push(...verified);
}

// Filtrar solo las que tienen artículo verificado
const ready = allQuestions.filter(q => q.verified_article_id);
fs.writeFileSync('/tmp/temaY-ready-to-import.json', JSON.stringify(ready, null, 2));

console.log(`Listas para importar: ${ready.length}/${allQuestions.length}`);
```

---

### Fase 3: Importar a BD

Importar directamente desde el JSON verificado. El artículo vinculado ya está validado.

```javascript
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
const questions = require('/tmp/temaY-ready-to-import.json');

for (const q of questions) {
  // Verificar duplicado
  const { data: existing } = await supabase
    .from('questions')
    .select('id')
    .eq('question_text', q.question)
    .single();

  if (existing) continue;

  // Insertar
  await supabase.from('questions').insert({
    question_text: q.question,
    option_a: q.options.find(o => o.letter === 'A')?.text,
    option_b: q.options.find(o => o.letter === 'B')?.text,
    option_c: q.options.find(o => o.letter === 'C')?.text,
    option_d: q.options.find(o => o.letter === 'D')?.text,
    correct_option: LETTER_TO_INDEX[q.correctAnswer],
    explanation: q.explanation,
    primary_article_id: q.verified_article_id,
    difficulty: 'medium',
    is_active: true,
    topic_review_status: 'perfect',  // Ya verificado por IA
    verification_status: 'verified',
    tags: ['Tema X', q.subtema, 'Tramitación Procesal', 'IA-Verified']
  });
}
```

---

---

### (Opcional) Actualizar Topic Scope

El `topic_scope` ya puede tener leyes y artículos configurados. Solo se añaden los **nuevos** artículos vinculados a las preguntas importadas.

```javascript
// 1. Obtener artículos únicos de las preguntas importadas
const { data: questions } = await supabase
  .from('questions')
  .select('primary_article_id, articles(law_id, article_number)')
  .contains('tags', ['Tema X', 'Tramitación Procesal'])
  .eq('is_active', true);

// 2. Agrupar por ley
const articlesByLaw = {};
questions.forEach(q => {
  if (!q.articles) return;
  const lawId = q.articles.law_id;
  if (!articlesByLaw[lawId]) articlesByLaw[lawId] = new Set();
  articlesByLaw[lawId].add(q.articles.article_number);
});

// 3. Actualizar topic_scope (merge con existentes)
for (const [lawId, artNumbers] of Object.entries(articlesByLaw)) {
  const { data: existing } = await supabase
    .from('topic_scope')
    .select('article_numbers')
    .eq('topic_id', TOPIC_ID)
    .eq('law_id', lawId)
    .single();

  const existingSet = new Set(existing?.article_numbers || []);
  const merged = [...new Set([...existingSet, ...artNumbers])];

  await supabase.from('topic_scope').upsert({
    topic_id: TOPIC_ID,
    law_id: lawId,
    article_numbers: merged
  }, { onConflict: 'topic_id,law_id' });
}
```

---

---

### Fase 4: Revisión Post-Importación con Agentes

**IMPORTANTE:** Después de importar, revisar las preguntas importadas usando el manual de revisión con agentes.

Ver: **[revisar-temas-con-agente.md](./revisar-temas-con-agente.md)**

Esta fase verifica que:
- Las preguntas importadas tengan respuestas correctas según el artículo vinculado
- Las explicaciones sean coherentes con el contenido del artículo
- No haya errores que se hayan colado en la importación

```javascript
// Extraer preguntas importadas para revisión
const { data: questions } = await supabase
  .from('questions')
  .select(`
    id, question_text, option_a, option_b, option_c, option_d,
    correct_option, explanation, topic_review_status, primary_article_id,
    articles!inner(id, article_number, title, content, law_id,
      laws!inner(id, short_name, name))
  `)
  .eq('is_active', true)
  .contains('tags', ['Tema X', 'IA-Verified']);
```

Seguir el proceso del manual de revisión para lanzar agentes paralelos y corregir cualquier error detectado.

#### 4.1 Leyes faltantes descubiertas en la revisión

Es frecuente que durante la Fase 4 se descubran preguntas vinculadas a leyes que no están en la BD (se asignaron artículos fallback durante la importación). En ese caso:

1. **Volver a Fase 0** para las leyes faltantes
2. **Buscar el BOE ID** de la ley (buscar en boe.es con el número del RD/Ley)
3. **Crear la ley** en la BD con `boe_url` (formato `https://www.boe.es/buscar/act.php?id=BOE-A-XXXX-XXXXX`)
4. **Sincronizar artículos desde BOE** usando la API:

```bash
DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d'=' -f2-) npx tsx -e "
import { syncArticlesFromBoe } from './lib/api/article-sync/queries'

const result = await syncArticlesFromBoe({
  lawId: 'UUID-DE-LA-LEY-NUEVA'
})
console.log(result)
"
```

5. **Reasignar las preguntas** al artículo correcto de la ley recién sincronizada
6. **Añadir al topic_scope** los artículos relevantes de la nueva ley
7. **Actualizar `topic_review_status`** a `perfect` y `ai_verification_results`

**IMPORTANTE:** NUNCA insertar artículos manualmente con texto copiado. Siempre usar `syncArticlesFromBoe` para obtener el texto oficial completo del BOE. Ver manual de monitoreo BOE: sección "PROHIBIDO: Artículos Truncados o Parciales".

---

## Checklist por Tema

- [ ] **Fase 0**: Identificar todas las leyes en los JSONs
- [ ] **Fase 0**: Verificar que existen en la BD (con boe_id)
- [ ] **Fase 0**: Añadir leyes faltantes y sincronizar con API
- [ ] **Fase 1**: Preparar batches con artículos candidatos
- [ ] **Fase 2**: Lanzar agentes para verificación COMPLETA (lo más importante: pregunta → artículo)
- [ ] **Fase 2**: Fusionar JSONs verificados
- [ ] **Fase 3**: Importar a BD
- [ ] **Fase 3**: Actualizar topic_scope con artículos nuevos
- [ ] **Fase 4**: Revisar preguntas importadas con agentes (ver revisar-temas-con-agente.md)
- [ ] **Fase 4**: Si hay `wrong_article`, crear leyes faltantes con BOE y reasignar (ver 4.1)

---

## IDs de Leyes Comunes

```javascript
const LAWS = {
  // Constitución y orgánicas
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941',
  LOTC: '2bc32b1a-9b5f-4e11-ba0b-3b014293882c',
  'LO 3/1981': '0425df52-bf4f-4220-a27d-63a9cbaac1c4', // Defensor Pueblo
  'LO 4/1981': 'd129456b-51ab-4e09-bd30-731386c1aff5', // Estados Alarma
  'LOREG': 'd69ff916-62c3-4a31-85f0-394a88cc8adf',     // Régimen Electoral

  // Régimen Local
  'LBRL': '06784434-f549-4ea2-894f-e2e400881545',      // Ley 7/1985 Bases Régimen Local

  // Gobierno y Administración
  'Ley 50/1997': '1ed89e01-ace0-4894-8bd4-fa00db74d34a', // Ley del Gobierno
  'Ley 40/2015': '95680d57-feb1-41c0-bb27-236024815feb', // LRJSP
  'RD 204/2024': '4ac2e67f-acef-484e-a9ca-dfa59a6e68f2', // Estructura Ministerio
  'RD 829/2023': '8303adeb-1f26-4754-872b-e74fd27fc5dd', // Reestructuración

  // Artículo especial para estructura
  ARTICLE_0_CE: '2536184c-73ed-4568-9ac7-0bbf1da24dcb'
};
```

---

## Ventajas del Proceso Mejorado

| Aspecto | Proceso Anterior | Proceso Mejorado |
|---------|------------------|------------------|
| **Verificación** | 2 fases (artículo, luego explicación) | 1 fase (todo junto) |
| **Donde se corrige** | En la BD después de importar | En el JSON antes de importar |
| **Reversibilidad** | Difícil (hay que actualizar BD) | Fácil (editar JSON) |
| **Trazabilidad** | Parcial | Completa (JSON es registro) |
| **Velocidad** | Más lenta | Más rápida |

---

## Notas Importantes

1. **Artículo 0 CE**: Usar para preguntas de estructura (cuántos títulos, disposiciones, fechas)

2. **Preguntas sin artículo**: Si referencia una ley que no está en la BD, volver a **Fase 0**

3. **Duplicados**: El sistema detecta por `question_text`. Las existentes no se reimportan

4. **Confianza IA**: Revisar manualmente las de `confidence: low`

5. **Tags**: Siempre incluir `['Tema X', 'subtema', 'Tramitación Procesal', 'IA-Verified']`

6. **Leyes sin texto consolidado en BOE**: Algunos reglamentos del CGPJ (como el Reglamento 3/1995 de Jueces de Paz) no tienen texto consolidado individual en el BOE - están dentro de un documento más grande. Para estos casos:
   - La API `syncArticlesFromBoe` NO funcionará (devolverá 0 artículos)
   - **Insertar artículos manualmente** obteniendo el texto de fuentes oficiales (PDF del CGPJ, leyprocesal.com)
   - Marcar la ley con `no_consolidated_text: true` en `last_verification_summary`
   - Ver el manual de monitoreo BOE: sección "Caso especial: Leyes sin texto consolidado"
