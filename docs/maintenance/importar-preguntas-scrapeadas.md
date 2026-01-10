# Manual: Importar Preguntas Scrapeadas

## Resumen del Proceso

Este manual documenta el proceso para importar preguntas scrapeadas de OpositaTest u otras fuentes a la base de datos de Vence, asegurando calidad y correcta vinculación con artículos.

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
  is_active: true,
  is_official_exam: false,
  tags: ['Subtema', 'Tema XXX', 'Bloque X']
}
```

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

## 9. Ejemplo de Explicación Didáctica

**Original (scrapeada):**
> Ley 39/2015, artículo 26.3. No requerirán de firma electrónica...

**Mejorada:**
> **Art. 26.3 Ley 39/2015 - Excepciones a la firma electrónica**
>
> La regla general es que los documentos electrónicos requieren firma.
>
> Sin embargo, HAY DOS EXCEPCIONES:
> 1. Documentos MERAMENTE INFORMATIVOS → no necesitan firma
> 2. Documentos que NO FORMEN PARTE DE UN EXPEDIENTE → no necesitan firma
>
> La opción C es incorrecta porque los documentos dispositivos SÍ requieren firma.
>
> **Ejemplo:** Un folleto informativo NO necesita firma. Una resolución SÍ la necesita.

## 10. Siguiente Paso: Verificar con Agente

Una vez importadas las preguntas, el siguiente paso es verificarlas con el agente de Claude Code.

**Ver:** [revisar-temas-con-agente.md](./revisar-temas-con-agente.md)

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
