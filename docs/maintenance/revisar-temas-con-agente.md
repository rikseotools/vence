# Manual: Revisar Temas con Agente de Claude Code

## Resumen

Este manual documenta cómo usar el agente de Claude Code para verificar preguntas de oposiciones. El agente analiza cada pregunta contra su artículo vinculado y determina si:
- El artículo está correctamente vinculado
- La respuesta marcada es correcta
- La explicación es correcta

**Ventaja principal:** Usa tu suscripción de Claude Code (gratis), en lugar de la API de Anthropic (de pago).

## 1. Mapeo de Oposiciones y Topics

### Auxiliar Administrativo del Estado (C2)
`position_type: 'auxiliar_administrativo'`

| Bloque | Topics | Descripción |
|--------|--------|-------------|
| **Bloque I** | T1-T16 | Temas generales (Constitución, Cortes, Gobierno, etc.) |
| **Bloque II** | T101-T112 | Temas específicos (Atención ciudadano, Informática, Ofimática) |

**Detalle de topics:**
```
BLOQUE I - Temas Generales:
  T1:  La Constitución Española de 1978 [4e93bf25]
  T2:  El Tribunal Constitucional. La reforma de la Constitución. La Corona [28c6ba47]
  T3:  Las Cortes Generales [f6019c53]
  T4:  El Poder Judicial [deace357]
  T5:  El Gobierno y la Administración [e64110cd]
  T6:  El Gobierno Abierto y la Agenda 2030 [c4e5a1c9]
  T7:  Ley 19/2013 de Transparencia [24316a04]
  T8:  La Administración General del Estado [fdf6181d]
  T9:  La Organización territorial del Estado [6047ed41]
  T10: La organización de la Unión Europea [9fa3e8bb]
  T11: Las Leyes del Procedimiento Administrativo [4ceac74e]
  T12: La protección de datos personales [4596812b]
  T13: El personal funcionario [81fcb655]
  T14: Derechos y deberes de los funcionarios [ca398540]
  T15: El presupuesto del Estado en España [e5c7a2cb]
  T16: Políticas de igualdad [7eaa247f]

BLOQUE II - Temas Específicos:
  T101: Atención al ciudadano [9268d250]
  T102: Los servicios de información administrativa [84a70f79]
  T103: Concepto de documento, registro y archivo [9b2d8bc2]
  T104: Administración electrónica y servicios al ciudadano [f1964780]
  T105: Informática básica [1ae9a8a0]
  T106: Sistema operativo Windows 11 [bf188c31]
  T107: El explorador de Windows 11 [877ae801]
  T108: Procesadores de texto: Word [8e6a56b9]
  T109: Hojas de cálculo: Excel [d10712ca]
  T110: Bases de datos: Access [d65be1ce]
  T111: Correo electrónico [385bb1d1]
  T112: La Red Internet [79035b41]
```

### Administrativo del Estado (C1)
`position_type: 'administrativo'`

| Bloque | Topics | Descripción |
|--------|--------|-------------|
| **Bloque I** | T1-T11 | Organización del Estado |
| **Bloque II** | T201-T204 | Organización de Oficinas Públicas |
| **Bloque III** | T301-T307 | Derecho Administrativo General |
| **Bloque IV** | T401-T409 | Gestión de Personal |
| **Bloque V** | T501-T506 | Gestión Financiera |
| **Bloque VI** | T601-T608 | Informática Básica y Ofimática |

**Detalle de topics:**
```
BLOQUE I - Organización del Estado (11 temas):
  T1:  La Constitución Española de 1978 [dacccf96]
  T2:  La Jefatura del Estado. La Corona [d3a0dc1e]
  T3:  Las Cortes Generales [c706e4da]
  T4:  El Poder Judicial [6ccb17a1]
  T5:  El Gobierno y la Administración [854703b4]
  T6:  El Gobierno Abierto. Agenda 2030 [2ad46169]
  T7:  La Ley 19/2013 de Transparencia [ffd10cc2]
  T8:  La Administración General del Estado [4eaaf512]
  T9:  La Organización Territorial del Estado [19bb533a]
  T10: La Administración Local [68e40211]
  T11: La Organización de la Unión Europea [3282c50b]

BLOQUE II - Organización de Oficinas Públicas (4 temas):
  T201: Atención al Público [cd87e866]
  T202: Documento, Registro y Archivo [724683b7]
  T203: Administración Electrónica [4a2dd652]
  T204: Protección de Datos Personales [45b9727b]

BLOQUE III - Derecho Administrativo General (7 temas):
  T301: Las Fuentes del Derecho Administrativo [c37c2d0f]
  T302: El Acto Administrativo [d17fcc5f]
  T303: Las Leyes del Procedimiento Administrativo [6c8eb734]
  T304: Los Contratos del Sector Público [6be5f664]
  T305: Procedimientos y Formas de la Actividad Administrativa [bf5af91a]
  T306: La Responsabilidad Patrimonial [892eb191]
  T307: Políticas de Igualdad [026c85a2]

BLOQUE IV - Gestión de Personal (9 temas):
  T401: El Personal al Servicio de las Administraciones Públicas [215832ab]
  T402: Selección de Personal [99946758]
  T403: El Personal Funcionario [e56b2d29]
  T404: Adquisición y Pérdida de la Condición de Funcionario [78ab5fd4]
  T405: Provisión de Puestos de Trabajo [aea9bac3]
  T406: Las Incompatibilidades y Régimen Disciplinario [523811be]
  T407: El Régimen de la Seguridad Social de los Funcionarios [8abfe801]
  T408: El Personal Laboral [096a87d7]
  T409: El Régimen de la Seguridad Social del Personal Laboral [1b98a38f]

BLOQUE V - Gestión Financiera (6 temas):
  T501: El Presupuesto [8e203ad7]
  T502: El Presupuesto del Estado en España [c3217fd8]
  T503: El Procedimiento de Ejecución del Presupuesto de Gasto [12e98818]
  T504: Las Retribuciones e Indemnizaciones [f8313330]
  T505: Gastos para la Compra de Bienes y Servicios [81105000]
  T506: Gestión Económica y Financiera [fb06a9fd]

BLOQUE VI - Informática Básica y Ofimática (8 temas):
  T601: Informática Básica [9ded027d]
  T602: Sistema Operativo Windows [f811268c]
  T603: El Explorador de Windows [4e3b9482]
  T604: Procesadores de Texto: Word 365 [c42058be]
  T605: Hojas de Cálculo: Excel 365 [ef58e487]
  T606: Bases de Datos: Access 365 [66875cd4]
  T607: Correo Electrónico: Outlook 365 [f2b977d1]
  T608: La Red Internet [5c687f25]
```

### Tramitación Procesal
`position_type: 'tramitacion_procesal'`

| Bloque | Topics | Descripción |
|--------|--------|-------------|
| **Bloque I** | T1-T15 | Organización del Estado y Justicia |
| **Bloque II** | T16-T31 | Derecho Procesal y Registral |
| **Bloque III** | T32-T37 | Informática y Ofimática |

**Detalle de topics:**
```
BLOQUE I - Organización del Estado y Justicia (15 temas):
  T1:  La Constitución Española de 1978 [a6351c86]
  T2:  Igualdad y no discriminación por razón de género [06c477d8]
  T3:  El Gobierno y la Administración [a03d6129]
  T4:  Organización territorial del Estado [3c612900]
  T5:  La Unión Europea [30210e71]
  T6:  El Poder Judicial [31d21a36]
  T7:  Organización y competencia de los órganos judiciales (I) [4b1c1304]
  T8:  Organización y competencia de los órganos judiciales (II) [95fe0811]
  T9:  Carta de Derechos de los Ciudadanos ante la Justicia [d6a9235e]
  T10: La modernización de la oficina judicial [3a4b2f43]
  T11: El Letrado de la Administración de Justicia [f5c65f8b]
  T12: Los Cuerpos de funcionarios al servicio de la Administración de Justicia [d907ed53]
  T13: Ingreso y promoción en los Cuerpos Generales [52b48079]
  T14: Situaciones administrativas de los funcionarios [01d4eb8c]
  T15: Libertad sindical [d7f9e00d]

BLOQUE II - Derecho Procesal y Registral (16 temas):
  T16: Los procedimientos declarativos en la LEC [f835d5dd]
  T17: Los procedimientos de ejecución en la LEC [0d009a83]
  T18: Los procesos especiales en la LEC [a6a3254e]
  T19: La jurisdicción voluntaria [75bad5e6]
  T20: Los procedimientos penales en la LECrim (I) [e49ea815]
  T21: Los procedimientos penales en la LECrim (II) [b4968b59]
  T22: El recurso contencioso-administrativo [1324b6cc]
  T23: El proceso laboral [0aaa1da5]
  T24: Los recursos [59c8d846]
  T25: Los actos procesales [c5515577]
  T26: Las resoluciones de los órganos judiciales [118fe411]
  T27: Los actos de comunicación con otros tribunales y autoridades [f39d2db8]
  T28: Los actos de comunicación a las partes [b4c78d91]
  T29: El Registro Civil (I) [0ec311d3]
  T30: El Registro Civil (II) [fd78eafd]
  T31: El archivo judicial y la documentación [0f3cafc9]

BLOQUE III - Informática y Ofimática (6 temas):
  T32: Informática básica [ed9b6e44]
  T33: Introducción al sistema operativo Windows [4901e831]
  T34: El explorador de Windows [ceea82be]
  T35: Procesadores de texto: Word 365 [e9eb6f92]
  T36: Correo electrónico: Outlook 365 [8c874c7d]
  T37: La Red Internet [8947cfd0]
```

### Auxilio Judicial
`position_type: 'auxilio_judicial'`

| Bloque | Topics | Descripción |
|--------|--------|-------------|
| **Bloque I** | T1-T15 | Organización del Estado y Justicia |
| **Bloque II** | T16-T26 | Derecho Procesal y Registral |

**Detalle de topics:**
```
BLOQUE I - Organización del Estado y Justicia (15 temas):
  T1:  La Constitución Española de 1978 [4bf6ccf5]
  T2:  Igualdad y no discriminación [d4fe0edb]
  T3:  El Gobierno y la Administración [7cbe8d56]
  T4:  Organización territorial del Estado [674e5d04]
  T5:  La Unión Europea [5519bc68]
  T6:  El Poder Judicial [66a1f0ed]
  T7:  Órganos jurisdiccionales superiores [ad3bbe59]
  T8:  Órganos jurisdiccionales de instancia [d4107574]
  T9:  Derechos de los ciudadanos ante la Justicia [585aa83f]
  T10: Modernización de la oficina judicial [7aebca12]
  T11: El Letrado de la Administración de Justicia [427d62c1]
  T12: Los Cuerpos de Funcionarios [fbc4a6e6]
  T13: Ingreso y carrera de los funcionarios [96e85e2e]
  T14: Situaciones administrativas y régimen disciplinario [4042e561]
  T15: Libertad sindical y prevención de riesgos [91eb2578]

BLOQUE II - Derecho Procesal y Registral (11 temas):
  T16: Procedimientos civiles declarativos [43ea0b27]
  T17: Procedimientos civiles de ejecución [4d175e02]
  T18: Procedimientos penales [77729553]
  T19: Procedimientos contencioso-administrativos [b0e6fb5f]
  T20: El proceso laboral [6a7e9c4d]
  T21: Los actos procesales [4eedf505]
  T22: Resoluciones de órganos judiciales [bb3e639b]
  T23: Comunicación con tribunales y autoridades [fcc6769e]
  T24: Comunicación con las partes [0c8be0cf]
  T25: El Registro Civil [42fa985e]
  T26: El archivo judicial [5fb7d1e8]
```

## 2. Topic Scope

Cada topic tiene uno o más `topic_scope` que definen qué leyes y artículos lo componen.

**Ejemplo para Tema 204 (Protección de Datos - Administrativo C1):**
```
topic_id: 45b9727b-66ba-4d05-8a1b-7cc955e7914c
  → LO 3/2018 (LOPDGDD): 81 artículos
  → Reglamento UE 2016/679 (RGPD): 47 artículos
```

**IMPORTANTE:** El mismo número de tema puede existir para diferentes oposiciones:
- T12 en Auxiliar C2 = Protección de datos (4596812b)
- No hay T12 en Administrativo C1 (el equivalente es T204)

Siempre usar el **topic_id (UUID)**, no el topic_number.

## 3. Estados de Verificación

El agente determina uno de estos 12 estados:

### Para leyes normales (8 estados):
| articleOk | answerOk | explanationOk | Estado |
|-----------|----------|---------------|--------|
| ✅ | ✅ | ✅ | `perfect` |
| ✅ | ✅ | ❌ | `bad_explanation` |
| ✅ | ❌ | ✅ | `bad_answer` |
| ✅ | ❌ | ❌ | `bad_answer_and_explanation` |
| ❌ | ✅ | ✅ | `wrong_article` |
| ❌ | ✅ | ❌ | `wrong_article_bad_explanation` |
| ❌ | ❌ | ✅ | `wrong_article_bad_answer` |
| ❌ | ❌ | ❌ | `all_wrong` |

### Para leyes virtuales/técnicas (4 estados):
| answerOk | explanationOk | Estado |
|----------|---------------|--------|
| ✅ | ✅ | `tech_perfect` |
| ✅ | ❌ | `tech_bad_explanation` |
| ❌ | ✅ | `tech_bad_answer` |
| ❌ | ❌ | `tech_bad_answer_and_explanation` |

## 4. Cómo Usar el Agente

### Opción 1: Revisión individual (pocos temas)
```
Verifica las preguntas del tema 204 de administrativo C1
```

### Opción 2: Revisión masiva con agentes paralelos (RECOMENDADO)

Para revisar muchas preguntas de forma eficiente, el agente orquestador puede:
1. Extraer todas las preguntas con errores de un bloque/oposición
2. Lanzar múltiples agentes en paralelo para revisarlas
3. Consolidar resultados y actualizar la base de datos

**Comando recomendado:**
```
Revisa todas las preguntas con errores del bloque II de administrativo C1
```

El orquestador:
1. **Extrae las preguntas** con `topic_review_status` en estados de error
2. **Agrupa en lotes** de 8-12 preguntas por agente
3. **Lanza 4 agentes en paralelo** usando Task tool
4. **Cada agente analiza** comparando pregunta vs artículo
5. **Determina** si es falso positivo o necesita corrección
6. **Consolida resultados** y actualiza la BD

### Ejemplo de flujo de revisión masiva:

```
Usuario: "Revisa las 57 preguntas con errores del bloque II administrativo C1"

Orquestador:
1. Ejecuta script para extraer preguntas con error_questions.json
2. Lanza 4 agentes paralelos:
   - Agente 1: preguntas 1-15
   - Agente 2: preguntas 16-30
   - Agente 3: preguntas 31-45
   - Agente 4: preguntas 46-57
3. Cada agente devuelve:
   - FALSO_POSITIVO: pregunta está bien, actualizar a "perfect"
   - NECESITA_CORRECCIÓN: con la corrección específica
4. Orquestador actualiza BD con los resultados
5. Reporta resumen: "54 falsos positivos, 2 corregidas, 1 explicación actualizada"
```

### Estados de error a revisar:
```javascript
const errorStates = [
  'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
  'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
  'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
];
```

### Script para extraer preguntas con errores:
```javascript
// get_error_questions.cjs
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const errorStates = [
    'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
    'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
    'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
  ];

  // Obtener topics del bloque deseado
  const { data: topics } = await supabase
    .from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'administrativo')
    .gte('topic_number', 201)
    .lte('topic_number', 204);

  const allQuestions = [];

  for (const topic of topics || []) {
    // Obtener scope del tema
    const { data: scope } = await supabase
      .from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', topic.id);

    // Obtener article IDs
    let articleIds = [];
    for (const s of scope || []) {
      const { data: arts } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', s.law_id)
        .in('article_number', s.article_numbers || []);
      articleIds.push(...(arts?.map(a => a.id) || []));
    }

    if (articleIds.length === 0) continue;

    // Obtener preguntas con errores
    const { data: questions } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, topic_review_status, primary_article_id,
        articles!inner(id, article_number, title, content, law_id,
          laws!inner(id, short_name, name))
      `)
      .eq('is_active', true)
      .in('primary_article_id', articleIds)
      .in('topic_review_status', errorStates);

    for (const q of questions || []) {
      allQuestions.push({
        id: q.id,
        topic_number: topic.topic_number,
        question_text: q.question_text,
        option_a: q.option_a, option_b: q.option_b,
        option_c: q.option_c, option_d: q.option_d,
        correct_option: q.correct_option,
        correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
        explanation: q.explanation,
        topic_review_status: q.topic_review_status,
        article_content: q.articles?.content,
        law_short_name: q.articles?.laws?.short_name
      });
    }
  }

  require('fs').writeFileSync('error_questions.json', JSON.stringify(allQuestions, null, 2));
  console.log('Total preguntas con errores:', allQuestions.length);
}

main().catch(console.error);
```

### Prompt para cada agente paralelo:
```
Revisa las siguientes preguntas y determina si son FALSOS POSITIVOS o necesitan CORRECCIÓN.

Para cada pregunta:
1. Lee el artículo vinculado
2. Compara con la respuesta marcada
3. Determina: FALSO_POSITIVO (está bien) o NECESITA_CORRECCIÓN

PREGUNTAS A REVISAR:
[lista de preguntas con contexto del artículo]

Responde con formato:
PREGUNTA [ID]: [FALSO_POSITIVO / NECESITA_CORRECCIÓN]
- Motivo: [explicación]
- Si corrección: nueva respuesta correcta (A/B/C/D) y por qué
```

### Actualización masiva de resultados:
```javascript
// Falsos positivos - actualizar a perfect
await supabase
  .from('questions')
  .update({
    topic_review_status: 'perfect',
    verified_at: new Date().toISOString(),
    verification_status: 'ok'
  })
  .in('id', falsosPositivosIds);

// Correcciones - actualizar respuesta
await supabase
  .from('questions')
  .update({
    correct_option: nuevoValor, // 0=A, 1=B, 2=C, 3=D
    topic_review_status: 'perfect',
    verified_at: new Date().toISOString(),
    verification_status: 'ok',
    explanation: nuevaExplicacion
  })
  .eq('id', questionId);
```

## 5. Tablas Actualizadas

El agente escribe en las mismas tablas que la web:

### `ai_verification_results`
```sql
- question_id: UUID de la pregunta
- article_id: UUID del artículo
- law_id: UUID de la ley
- article_ok: boolean (null para técnicas)
- answer_ok: boolean
- explanation_ok: boolean
- confidence: 'alta'/'media'/'baja'
- explanation: análisis del agente
- article_quote: cita del artículo
- correct_article_suggestion: si articleOk=false
- correct_option_should_be: si answerOk=false (A/B/C/D)
- explanation_fix: si explanationOk=false
- ai_provider: 'claude_code'
- ai_model: 'claude-opus-4-6' (o el modelo actual)
- verified_at: timestamp
```

### `questions` (actualización)
```sql
- verified_at: timestamp
- verification_status: 'ok' o 'problem'
- topic_review_status: uno de los 12 estados
```

## 6. Ver Resultados

Después de la verificación, los resultados aparecen en:
```
/admin/revision-temas/[topicId]
```

Los estados se muestran con colores:
- 🟢 Verde: perfect, tech_perfect
- 🟡 Amarillo: bad_explanation, tech_bad_explanation
- 🟠 Naranja: bad_answer, tech_bad_answer
- 🔴 Rojo: bad_answer_and_explanation, all_wrong
- 🟣 Púrpura: wrong_article, wrong_article_*
- ⚪ Gris: pending

## 7. Flujo Completo

```
1. Importar preguntas (ver importar-preguntas-scrapeadas.md)
   ↓
2. Verificar con agente:
   "Verifica las preguntas del tema 204 de administrativo C1"
   ↓
3. Revisar en web: /admin/revision-temas/45b9727b-...
   ↓
4. Corregir problemas manualmente si hay
   ↓
5. Re-verificar si es necesario
```

## 8. Niveles de Calidad de las Explicaciones

Al revisar preguntas, clasificar la explicación en uno de estos niveles:

| Nivel | Descripción | Acción |
|-------|-------------|--------|
| **Correcta y didáctica** | Markdown, explica por qué cada opción es correcta/incorrecta, cita del artículo con blockquote, fuente al final | Ninguna — dejar como está |
| **Correcta pero mejorable** | Contenido correcto pero sin markdown, sin análisis por opción, sin fuente | Mejorar formato y añadir análisis por opción |
| **Copia del artículo** | Transcribe literalmente el artículo sin explicar nada didácticamente | Reescribir completa — es el error más frecuente |
| **Incorrecta** | Habla de otro tema, referencia artículo equivocado, conclusión errónea | Corregir urgente |

### Cómo detectar cada nivel:

**Copia del artículo** (más común):
- La explicación empieza con "Art. X de la Ley Y..." y copia el texto
- No dice POR QUÉ la respuesta es correcta
- No analiza las opciones incorrectas
- El usuario lee la explicación y no aprende nada que no sepa leyendo el artículo

**Correcta pero mejorable:**
- Dice cuál es correcta y por qué, pero en texto corrido
- No usa markdown (negrita, listas, tablas)
- No analiza CADA opción incorrecta individualmente
- Falta la fuente oficial

**Correcta y didáctica** (objetivo):
- Usa `**negrita**` para términos clave
- Analiza cada opción (A, B, C, D) con motivo
- Cita el artículo con `>` blockquote
- Incluye fuente verificada al final
- El usuario entiende por qué acertó/falló

### Formato obligatorio para explicaciones nuevas/corregidas:
1. **Párrafos separados**: No apelotonar el texto. Usar saltos de línea entre ideas.
2. **Fuente oficial verificada**:
   - Siempre incluir enlace a Microsoft Support en español al final
   - **IMPORTANTE**: Buscar y confirmar la fuente antes de usarla (usar WebSearch)
   - No inventar URLs ni usar fuentes genéricas sin verificar

### Ejemplo de explicación bien formateada:

```
La respuesta correcta es A.

"Combinar y centrar" fusiona TODAS las celdas seleccionadas en un único bloque y centra el contenido horizontalmente.

"Combinar horizontalmente" funciona de forma diferente: combina las celdas de CADA FILA de manera independiente. Por ejemplo, si seleccionas el rango A1:C3, se crearán tres celdas combinadas separadas (A1:C1, A2:C2 y A3:C3), en lugar de una sola celda grande.

Las opciones B y D son incorrectas porque "Combinar horizontalmente" sí existe y hay diferencias claras entre ambas funciones.

Fuente: Microsoft Support - Combinar y separar celdas (https://support.microsoft.com/es-es/office/combinar-y-separar-celdas-5cbd15d5-9375-4540-907b-d673556e51e2)
```

### Fuentes de Microsoft Support en español:
- Excel general: `https://support.microsoft.com/es-es/excel`
- Funciones: `https://support.microsoft.com/es-es/office/funciones-de-excel-por-categoria-5f91f4e9-7b42-46d2-9bd1-63f26a86c0eb`
- Formato números: `https://support.microsoft.com/es-es/office/crear-un-formato-de-numero-personalizado-78f2a361-936b-4c03-8772-09fab54be7f4`
- Combinar celdas: `https://support.microsoft.com/es-es/office/combinar-y-separar-celdas-5cbd15d5-9375-4540-907b-d673556e51e2`
- Inmovilizar paneles: `https://support.microsoft.com/es-es/office/inmovilizar-paneles-para-bloquear-filas-y-columnas-dab2ffc9-020d-4026-8121-67dd25f2508f`
- Word general: `https://support.microsoft.com/es-es/word`
- Access general: `https://support.microsoft.com/es-es/access`
- Outlook general: `https://support.microsoft.com/es-es/outlook`
- Windows general: `https://support.microsoft.com/es-es/windows`

## 9. Formato de Respuestas en Base de Datos

El campo `correct_option` en la tabla `questions` usa índices numéricos:

| Valor | Letra |
|-------|-------|
| 0 | A |
| 1 | B |
| 2 | C |
| 3 | D |

**Ejemplo de corrección:**
```javascript
// Cambiar respuesta de B a D
await supabase
  .from('questions')
  .update({ correct_option: 3 }) // D = 3
  .eq('id', questionId);
```

## 10. Preguntas con Imágenes

**IMPORTANTE:** Si una pregunta hace referencia a una imagen que no está disponible en el sistema, **hay que desactivarla** (`is_active: false`).

### Cómo identificar preguntas con imágenes:
- Texto que menciona "la imagen", "en la figura", "observa el gráfico", etc.
- Preguntas que preguntan por posiciones de celdas específicas sin contexto
- Referencias a capturas de pantalla de Excel, Word, etc.

### Acción a tomar:
```javascript
// Desactivar pregunta con imagen no disponible
await supabase
  .from('questions')
  .update({
    is_active: false,
    topic_review_status: 'pending',
    verification_status: null,
    verified_at: null
  })
  .eq('id', questionId);

// Eliminar verificación existente
await supabase
  .from('ai_verification_results')
  .delete()
  .eq('question_id', questionId);
```

### Razón:
Sin la imagen, no se puede:
- Verificar si la respuesta marcada es correcta
- Escribir una explicación útil para el estudiante
- Garantizar la calidad de la pregunta

## 11. Preguntas Frecuentes

**¿El agente usa tokens de mi suscripción?**
Sí, usa los tokens de Claude Code (Max), no la API de Anthropic.

**¿Puedo verificar solo las pendientes?**
Sí: "Verifica solo las preguntas pendientes del tema 204"

**¿Puedo verificar en paralelo?**
Sí, el método recomendado es usar el orquestador que lanza 4 agentes en paralelo con Task tool. Ejemplo: "Revisa las 57 preguntas con errores del bloque II"

**¿Cuántas preguntas puede revisar cada agente?**
Cada agente paralelo puede revisar 10-15 preguntas de forma óptima. El orquestador distribuye automáticamente.

**¿Qué es un falso positivo?**
Una pregunta marcada con error por la IA de verificación inicial, pero que al revisarla manualmente está correcta. El orquestador las detecta y las actualiza a "perfect".

**¿Qué pasa si una pregunta no tiene artículo?**
Se marca como error y se reporta. Hay que vincularla primero.

**¿Qué pasa si una pregunta hace referencia a una imagen?**
Se desactiva la pregunta (`is_active: false`) ya que sin la imagen no se puede verificar ni explicar correctamente.

**¿Los resultados son iguales que los de la web?**
Sí, se guardan en las mismas tablas con el mismo formato.

**¿Cómo pido una revisión masiva?**
```
Revisa todas las preguntas con errores del bloque II de administrativo C1
```
El orquestador extraerá las preguntas, lanzará agentes paralelos, y actualizará la BD.

**¿Cuánto tarda una revisión masiva?**
Depende del número de preguntas. 57 preguntas con 4 agentes paralelos tarda aproximadamente 2-3 minutos.

**¿Puedo ver el progreso?**
Sí, el orquestador reporta el progreso: "Procesadas 19/57", y al final da un resumen completo.

## 12. Ejemplo Real: Revisión del Bloque II Administrativo C1

**Fecha:** Enero 2026
**Solicitud:** "Revisa todas las preguntas con errores del bloque II de administrativo C1"

### Proceso ejecutado:

1. **Extracción de preguntas:**
   - Ejecuté script `get_error_questions.cjs`
   - Resultado: 57 preguntas con errores
   - Distribución: T201 (41), T202 (5), T203 (4), T204 (7)

2. **Revisión con agentes paralelos:**
   - Lote 1: preguntas 1-19 (primer batch)
   - Lote 2: preguntas 20-28 (Agente 1)
   - Lote 3: preguntas 29-37 (Agente 2)
   - Lote 4: preguntas 38-46 (Agente 3)
   - Lote 5: preguntas 47-57 (Agente 4)

3. **Resultados:**

| Categoría | Cantidad | Detalle |
|-----------|----------|---------|
| **Falsos positivos** | 54 | Actualizadas a `perfect` |
| **Respuestas corregidas** | 2 | Preguntas 5 y 36 |
| **Explicaciones corregidas** | 1 | Pregunta 55 |

### Correcciones específicas:

**Pregunta 5** (CE Art. 55.2 - Suspensión derechos terrorismo):
- Error: Respuesta D (tiempo máximo detención preventiva)
- Corrección: Respuesta C (derecho a ser informado de razones)
- Motivo: El art. 55.2 CE permite suspender el plazo de 72h, no el tiempo máximo de detención preventiva

**Pregunta 36** (CE Art. 9.3 - Retroactividad):
- Error: Respuesta D (retroactividad no se permite nunca)
- Corrección: Respuesta C (cuando sea beneficiosa)
- Motivo: La CE solo prohíbe retroactividad de normas desfavorables; la retroactividad favorable SÍ se permite

**Pregunta 55** (LO 3/2018 Art. 4 - Exactitud datos):
- Error: Explicación confusa sobre "materia clasificada"
- Corrección: Explicación actualizada para clarificar que "materia clasificada" no está en las excepciones del art. 4.2

### Tiempo total: ~5 minutos para 57 preguntas
