# Manual: Importar Examen Oficial Completo

> End-to-end: PDF en mano → preguntas activas en BD verificadas por IA.
> Cubre legislativas + ofimáticas + psicotécnicas (texto, tabla e imagen).
> Derivado de la importación Madrid 12/04/2026 (100 preguntas, 18/05/2026).

Manuales complementarios:
- `docs/manual-preguntas-oficiales.md` — formato de pregunta oficial, lifecycle, question_official_exams
- `docs/maintenance/revisar-preguntas-con-agente.md` — verificación Sonnet §14
- `docs/maintenance/importar-preguntas-scrapeadas.md` — patrones generales de import

---

## 0. Principio fundamental: **Importar `draft`, activar tras verificación**

`is_active` es **GENERATED** desde `lifecycle_state IN ('approved','tech_approved')`. **NUNCA** se setea manualmente.

**El flujo correcto activa las preguntas SOLAS** tras pasar la verificación IA:

```
INSERT con lifecycle_state='draft'   → is_active=false (oculta a estudiantes)
        │
        ▼
Verificación 5 agentes Sonnet  →  ai_verification_results (sin tocar questions)
        │
        ▼
Pipeline de transición automática:
  · 3/3 ok + confianza alta + legi → transition → 'approved'      → is_active=true ✅
  · 3/3 ok + confianza alta + tech → transition → 'tech_approved' → is_active=true ✅
  · bad_explanation con explanation_fix → UPDATE + retest → approved
  · wrong_article → 'needs_human'                                    is_active=false
  · bad_answer (no errata oficial) → 'needs_human'                  is_active=false
  · bad_explanation sin fix → permanece 'draft' + flag bad_explanation
```

**Anti-patrón a evitar:** INSERT con `lifecycle_state='approved'` o `'tech_approved'` directamente (saltarse la verificación). Madrid 18/05/2026 lo hizo así y obligó a parches retroactivos. NO REPETIR.

> 🚨 **Anti-patrón GRAVE (SCS Canarias 02/06/2026) — el "sello en blanco" que engaña al gate.**
>
> El gate de `transition_question_state` exige una fila en `ai_verification_results` con `answer_ok+explanation_ok=TRUE` y `article_ok/options_ok` no-FALSE para promover a `approved` (salvo `reason_code` `admin_%`). **El gate solo es tan fiable como la honestidad de esa fila: quien la escribe controla el candado.**
>
> En SCS se importaron 73 preguntas como `draft` (correcto) PERO acto seguido se **insertaron 73 filas `ai_verification_results` con `ai_provider='official_import'` marcando todo OK "porque es un examen oficial"** — sin auditoría real — y se transicionó a `approved`. El gate encontró esas filas, las dio por buenas y publicó 73 preguntas **sin verificación**. Al revisarlas de verdad después: 4 con fallo real (respuesta dudosa, 3 opciones ciertas, opción mal extraída, imagen ausente) y ~46 vinculadas a un artículo que **no responde la pregunta**.
>
> **NUNCA auto-generes la fila de verificación en el import.** La autoridad de la plantilla oficial cubre **solo** la respuesta del examen original; NO cubre: (a) errores de TU extracción del PDF (opciones cortadas/garbled, letra correcta mal leída, artefactos OCR como "CTRL+AA", imágenes no importadas), (b) **desfase por reformas** posteriores (la respuesta correcta del año del examen pudo cambiar), (c) preguntas que dependen de una imagen no importada. Todo eso solo lo caza una **auditoría independiente real** (agentes ciegos + revisión humana), que es lo único que debe escribir la fila `ai_verification_results`.

## 0.1 Resumen de fases

```
1. Localizar PDFs oficiales       → curl + estructura de directorios
2. Extraer texto + plantilla      → pdftotext
3. Construir JSON estructurado    → un único archivo de referencia
4. Verificar leyes / artículos    → crear faltantes, ampliar topic_scope
5. Importar preguntas EN 'draft'  → ocultas, esperan verificación
6. Manejar figuras psicotécnicas  → pdftoppm + magick crop + Storage
7. Enunciados / tablas compartidas → content_data.text_passage + tables[]
8. Verificar con 5 agentes Sonnet → workflow §14.3 (agente INSERTA, no toca questions)
9. Pipeline de activación         → transition_question_state según resultado IA
10. Marcar bad_explanation residual → flag, NO ocultar
11. Cache invalidate + convocatoria a config
```

---

## 1. Localizar PDFs oficiales

> 🚫 **REGLA CRÍTICA — solo TURNO LIBRE / INGRESO LIBRE.**
>
> **NUNCA importar exámenes de procesos de estabilización** (Ley 20/2021),
> consolidación, ni ningún proceso extraordinario. SOLO convocatorias de
> ingreso libre ordinarias.
>
> **Razón** (Manuel, 18/05/2026): los exámenes de estabilización valoran
> experiencia previa, suelen ser más fáciles y tienen temario reducido o
> distinto. El público real de Vence prepara turno libre — importar
> estabilización **contamina la preparación** del aspirante real.
>
> **Antes de descargar PDFs, mira el título del proceso.** Descartar si
> contiene: "estabilización", "Ley 20/2021", "consolidación", "extraordinario".
> Buscar: "turno libre", "ingreso libre", "concurso-oposición ordinario",
> "OEP ordinaria".
>
> Si la única opción disponible es estabilización (caso CARM DGX00C18 /
> DGX00C22 que entraron antes de fijar esta regla), **confirmar con Manuel
> antes** de proceder.
>
> **Material ya activo en BD se queda** (decisión 19/05/2026): no retirar
> retroactivamente exámenes de estabilización ya en producción (ej: TP
> 2024-03-02 OEP 2022 estabilización, 84 preg activas; CARM DGX00C18 /
> DGX00C22). La regla solo bloquea **futuras importaciones**.

Cada CCAA publica `cuestionario` + `plantilla correctora` por ejercicio. Buscar con:
- `site:comunidad.madrid` o `sede.<ccaa>.es` + año + número de orden BOCM
- Páginas privadas (adams, opositatest, mad.es) suelen tener los enlaces

Estructura de directorios convencional:

```
data/examenes-oficiales/
└── <slug-oposicion>/
    └── <AA-MM-DD convocatoria DD MES AAAA - OEP AAAA-AAAA>/
        ├── 1_cuestionario.pdf
        ├── 1_plantilla_correctora.pdf
        ├── 2_cuestionario.pdf
        ├── 2_plantilla_correctora.pdf
        └── examen.json              ← estructurado, fuente de verdad
```

---

## 2. Extraer texto

```bash
pdftotext -layout 1_cuestionario.pdf 1_cuestionario.txt
pdftotext -layout 1_plantilla_correctora.pdf -    # ver respuestas correctas
```

La plantilla incluye preguntas normales + **preguntas de reserva** (5 por ejercicio típicamente).

---

## 3. JSON estructurado

Un único archivo `examen.json` con:

```json
{
  "metadatos": {
    "examen": "Auxiliar Administrativo <CCAA>",
    "convocatoria": "Orden XX/YYYY (BOCM ...)",
    "oep": "OEP YYYY-YYYY",
    "plazas": NNN,
    "fecha_examen": "AAAA-MM-DD",
    "fuente_pdf_*": "https://..."
  },
  "primera_parte": {
    "preguntas": [ { "numero": 1, "tipo": "psicotecnica|legislativa|ofimatica", ... } ],
    "reserva": [ ... ]
  },
  "segunda_parte": { ... }
}
```

Sirve como fuente de verdad para los scripts de import.

---

## 4. Verificar leyes y artículos en BD

Antes de importar, comprobar que cada pregunta legislativa tiene su **artículo correctamente vinculado**:

```js
// Para cada (law_short_name, article_number) referenciado en el examen
const { data } = await supabase
  .from('articles')
  .select('id, article_number, title, content')
  .eq('law_id', LAWS.X)
  .eq('article_number', 'N')
  .single();
```

### Crear leyes faltantes

```js
// Constraint: type ∈ ('law', 'regulation', 'code'). NO existe 'decree'.
// Obligatorio: slug (auto-generar con slugify del short_name).
await supabase.from('laws').insert({
  name: 'Decreto XXX/YYYY, ...',
  short_name: 'Decreto XXX/YYYY <CCAA>',
  slug: slugify(short_name),       // ⚠️ NOT NULL
  year: YYYY,
  type: 'regulation',              // ⚠️ NO 'decree' (constraint check)
  scope: 'regional',
  is_active: true,
  boe_url: 'https://www.bocm.es/...',
  boe_id: 'BOCM-A-YYYY-N',
  verification_status: 'pendiente',
});
```

### Ampliar topic_scope

Si el artículo existe pero no está en el scope del tema:

```js
// Leer el array existente y mergearlo (NO sobreescribir)
const { data: existing } = await supabase
  .from('topic_scope').select('article_numbers')
  .eq('topic_id', TOPIC_ID).eq('law_id', LAW_ID).single();

const merged = Array.from(new Set([...(existing.article_numbers || []), 'N']))
  .sort((a,b) => parseInt(a)-parseInt(b));

await supabase.from('topic_scope')
  .update({ article_numbers: merged })
  .eq('id', existing.id);
```

---

## 5. Importar preguntas (CRÍTICO)

### 5.1 Lifecycle inicial: SIEMPRE `draft` al INSERT

`is_active` es **GENERATED** desde `lifecycle_state`. NO se setea manualmente. Al importar, **todas las preguntas van en `draft`** (= `is_active=false`, ocultas a estudiantes) y se activan después vía pipeline tras la verificación IA.

| Tabla | Campo inicial | Resultado |
|---|---|---|
| `questions` (legi + ofi) | `lifecycle_state: 'draft'` (default) | `is_active=false` |
| `psychometric_questions` | `is_active: false`, `is_verified: false`, `deactivation_reason: 'Pendiente de revisión post-importación'` | oculta |

```js
// INSERT correcto en questions
await supabase.from('questions').insert({
  question_text, option_a, option_b, option_c, option_d, correct_option,
  explanation, primary_article_id,
  lifecycle_state: 'draft',          // ⚠️ SIEMPRE draft inicialmente
  is_official_exam: true,
  exam_source, exam_date, exam_entity, exam_position, difficulty,
});

// INSERT correcto en psychometric_questions
await supabase.from('psychometric_questions').insert({
  category_id, section_id, question_subtype, question_text,
  option_a, option_b, option_c, option_d, correct_option, explanation,
  is_active: false,                  // ⚠️ falsa inicialmente
  is_verified: false,
  deactivation_reason: 'Pendiente de revisión post-importación',
  is_official_exam: true,
  exam_source, exam_date, content_data,
});
```

**Después de la verificación (§9)**, el pipeline transiciona automáticamente:
- Legi 3/3 ok → `draft → approved` (vía `transition_question_state`) → se activa sola
- Tech 3/3 ok → `draft → tech_approved` → se activa sola
- Problema → permanece `draft` o pasa a `needs_human`

**⚠️ ANTI-PATRÓN REAL (Madrid 18/05/2026):** importar directamente en `approved`/`tech_approved` saltándose la verificación. Genera:
- Preguntas visibles SIN verificación IA registrada
- Inconsistencia tipo: legi acabó en `tech_approved` que es semánticamente para técnicas
- Necesidad de **parche retroactivo** vía transición intermedia (`tech_approved → needs_review → approved`), porque la transición directa entre estados terminales positivos es **ilegal**

Si ya cometiste el error y necesitas reclasificar:
```js
// tech_approved → needs_review → approved (NUNCA directo)
await supabase.rpc('transition_question_state', {
  p_question_id: id, p_expected_state: 'tech_approved', p_new_state: 'needs_review',
  p_reason_code: 'admin_marked_problem', p_notes: 'Reclasificación lifecycle (paso intermedio)',
});
await supabase.rpc('transition_question_state', {
  p_question_id: id, p_expected_state: 'needs_review', p_new_state: 'approved',
  p_reason_code: 'admin_marked_perfect', p_notes: 'Lifecycle corregido',
});
```

### 5.2 Formato literal de `exam_source` (CRÍTICO)

La función `getExamPart()` en `lib/api/official-exams/queries.ts:140` busca **literalmente** las cadenas `"Primera parte"` o `"Segunda parte"` en `exam_source`. Si no aparecen, la pregunta cae a fallback y se mezcla entre partes.

| ❌ Mal | ✅ Bien |
|---|---|
| `"... - Reserva 1ª parte"` | `"... - Primera parte (Reserva)"` |
| `"... - Reserva 2ª parte"` | `"... - Segunda parte (Reserva)"` |

Las reservas deben tener **"Primera parte"** o **"Segunda parte"** en el texto (para que el filtro las clasifique) **y** `"Reserva"` (para que `isReserva` se calcule bien — el flag se deduce de `examSource?.includes('Reserva')`).

### 5.3 Pattern matching de psicotécnicas

`psychometric_questions` no tiene `exam_position`. Se filtra por `exam_source LIKE` en `lib/api/official-exams/queries.ts:121`. **El pattern debe ser específico** para no colisionar con otras oposiciones de la misma comunidad:

| ❌ Mal | ✅ Bien | Por qué |
|---|---|---|
| `%Auxiliar Administrativo Madrid%` | `%Auxiliar Administrativo Comunidad de Madrid%` | Colisiona con "Auxiliar Administrativo Ayuntamiento de Madrid" |
| `%CyL%` | `%Auxiliar Administrativo CyL%` | Colisiona con TCAE CyL |

Al añadir una oposición nueva: actualizar ambos mapeos:
- `oposicionToExamPosition` (para legi/ofi)
- `oposicionToExamSourcePattern` (para psico) — en `lib/api/official-exams/queries.ts` y `lib/api/psychometric-test-data/queries.ts`

### 5.4 NO añadir "📚 Fuente:" con URL externa cuando la pregunta tiene `primary_article_id`

El componente `OfficialExamLayout` ya renderiza un botón nativo **"Ver 📚 <Ley> - Artículo N"** que abre el artículo en modal interno. Si la explicación añade **además** un `📚 **Fuente:** [Art. N - BOE](url)`, sale duplicado y el enlace abre tab externa (mala UX).

**Política actualizada (18/05/2026):**
- Preguntas legislativas con `primary_article_id` → **NO añadir bloque `📚 Fuente:`** al final.
- Preguntas técnicas (Win11/Office) con ley virtual → **SÍ añadir** `📚 Fuente:` (Microsoft Support) porque no hay botón nativo a "artículo real".

### 5.5 Registro en `question_official_exams`

Imprescindible para que la pregunta aparezca en el simulacro. Una pregunta puede tener varias entradas (si aparece en múltiples convocatorias):

```js
await supabase.from('question_official_exams').insert({
  question_id: id,                                  // o psychometric_question_id
  exam_date: '2026-04-12',
  exam_source: 'Examen ... - Primera parte',
  exam_part: 'primera',                             // 'primera' | 'segunda' | 'reserva' | ...
  question_number: N,
  oposicion_type: 'auxiliar-administrativo-madrid', // ⚠️ SLUG (guion), NO underscore
  is_reserve: false,
});
```

⚠️ **`oposicion_type` usa guion (slug), no underscore.** Convención:
- `questions.exam_position` → underscore (`auxilio_judicial`)
- `question_official_exams.oposicion_type` y `exam_cases.oposicion_type` → guion (`auxilio-judicial`)
- Si copias desde `exam_position`, transforma: `.replaceAll('_', '-')`.

### 5.6 Dedup cross-oposición — antes de cualquier INSERT en `questions`

**⚠️ CRÍTICO:** una pregunta puede aparecer en EL MISMO EXAMEN reimportado varias veces (raro pero posible) o, más común, **la MISMA pregunta legislativa aparece en distintas oposiciones** que comparten temario (AJ y TP comparten LOPJ/LEC/LECrim; Estado y CCAA comparten Ley 39/2015, 40/2015, CE…).

**Regla:** si una pregunta a importar ya existe en `questions` (otra oposición, otra fecha) — NUNCA insertar duplicado en `questions`. Solo insertar en `question_official_exams` con la nueva aparición.

**Flujo recomendado antes del INSERT:**

1. **Normalizar texto** de cada pregunta candidata (lowercase + sin acentos + sin puntuación + espacios colapsados + primeros ~120 chars significativos).
2. **Cargar de BD** preguntas con potencial match: misma `primary_article_id` o misma ley/artículo, cualquier `exam_position`.
3. **Comparar** con Levenshtein/Jaccard sobre texto normalizado + las 4 opciones. Match con similarity > 0.85 → duplicado.
4. **Si duplicado:**
   - NO insertar en `questions`.
   - SÍ insertar fila adicional en `question_official_exams` con la nueva `exam_date`/`exam_source`/`question_number`/`oposicion_type`.
   - El UNIQUE `(question_id, exam_date, exam_source)` previene duplicar la MISMA aparición.
5. **Si nueva:** INSERT en `questions` + INSERT en `question_official_exams` (1 fila inicial).

**Reporte final mínimo (al terminar import):**
```
Examen X — Y preg totales:
  Nuevas insertadas: A
  Duplicadas (registradas como aparición cruzada): B
  Dudosas (similarity 0.70-0.85, requieren revisión manual): C
```

**Verificación post-import:**
```sql
-- Preguntas con apariciones en >1 examen (cross-oposición confirmadas)
SELECT q.id, q.question_text, count(qoe.id) as apariciones
FROM questions q
JOIN question_official_exams qoe ON qoe.question_id = q.id
GROUP BY q.id, q.question_text
HAVING count(qoe.id) > 1
LIMIT 20;
```

Estas preguntas son material **cross-oposición de oro**: aparecieron en exámenes oficiales de ≥2 oposiciones, son las más confiables para el simulacro.

---

## 6. Preguntas psicotécnicas con figuras

### 6.1 `pdfimages` vs `pdftoppm`

- **`pdfimages -png`** extrae imágenes raw incrustadas, **PIERDE** las letras A/B/C/D que son texto del PDF, no parte de la imagen.
- **`pdftoppm -r 200`** renderiza la página completa como PNG, **preserva** texto y figuras juntos.

```bash
pdftoppm -r 200 -f 5 -l 5 1_cuestionario.pdf p5hd -png
# → p5hd-05.png (1654x2339)
```

### 6.2 Recortar con coordenadas correctas

Detectar Y de cada label con análisis de densidad de píxeles oscuros en columna izquierda:

```js
// Buscar bloques de texto en x=[100,200], y>400 (post-header)
// Estos son los "16.", "17.", "18.", ...
```

Por cada label en y_label, hacer crop:
- Empezar ~60px arriba del label (para incluir cabeceras A B C D)
- Altura ~220-240px (para abarcar serie + alternativas sin solapar la siguiente)

```bash
magick p5hd-05.png -crop 1500x225+80+393 -bordercolor white -border 10 q16_serie.png
```

### 6.3 Subir a Supabase Storage

```js
const { error } = await supabase.storage.from('question-images').upload(
  `examenes-oficiales/<slug>-AAAA-MM-DD/qN_serie_figuras.png`,
  buffer,
  { contentType: 'image/png', upsert: true }
);
const { data } = supabase.storage.from('question-images').getPublicUrl(remotePath);
// data.publicUrl → guardar en psychometric_questions.image_url + content_data.image_url
```

### 6.4 No añadir texto sobre la imagen

**ERROR FRECUENTE:** componer la imagen con `magick ... -annotate +0+10 "Pregunta X - Serie..."`. Esto duplica el numerado (la UI ya muestra "Pregunta X" arriba) y confunde al usuario.

Recortar limpio. Sin anotaciones manuales.

---

## 7. Enunciados o tablas compartidas entre preguntas

> 🚨 **FLUJO DE DECISIÓN OBLIGATORIO ANTES DE IMPORTAR** (incidente 19/05/2026:
> Auxilio Judicial 2º ejercicio 2025 importado SIN vincular casos → 42 preguntas
> sin contexto cuando aparecen en tests aislados.)
>
> **Antes de escribir el script de import, lee el cuadernillo PDF y responde:**
>
> 1. ¿Las preguntas son INDEPENDIENTES entre sí (cada una con su enunciado completo)?
>    → No requieren tecnología compartida. Importar normal.
>
> 2. ¿Hay un TEXTO LARGO al inicio del PDF/ejercicio seguido de N preguntas que lo referencian (Sra. X demanda a Y... → "¿Es preceptiva la intervención de abogado?", "¿Quién es competente?"...)?
>    → **SÍ son casos prácticos.** Usa tabla `exam_cases` (§7.4 abajo).
>
> 3. ¿Las preguntas tienen un pequeño contexto compartido tipo psicotécnico ("Una empresa evalúa 4 proveedores: A=10€, B=12€...") + Q3-Q7?
>    → Usa `content_data.text_passage` (§7.1 abajo).
>
> 4. ¿Hay tablas de datos compartidas entre varias preguntas (listados + tarifas + descuentos)?
>    → Usa `content_data.tables[]` (§7.2 abajo).
>
> **Cómo detectar casos prácticos rápido en el texto extraído:**
> ```bash
> grep -nE "CASO PRÁCTICO|CASO PRACTICO|SUPUESTO PRÁCTICO|caso práctico" examen.txt
> ```
> Si devuelve líneas, **párate y usa el flujo §7.4**.
>
> **Patrones típicos por oposición:**
> - Auxilio Judicial 2º ejercicio: 2-3 casos prácticos × 10-15 preg cada uno
> - Tramitación Procesal 2º ejercicio: 1 caso práctico × 9-10 preg
> - Auxiliar Administrativo estatal y autonómicos: NO suelen tener casos prácticos (test puro)

Cuando varias preguntas (típicamente psicotécnicas Q3-Q7 estilo "supuesto verbal" o Q21-Q25 estilo "tabla de datos") **comparten un enunciado largo**:

### 7.1 `content_data.text_passage`

`ContentDataRenderer.tsx:57-63` ya soporta esto: renderiza una **caja azul** con `MarkdownExplanation`.

```js
content_data: {
  text_passage: 'Una empresa está evaluando cuatro proveedores...',
  // ... resto
}
```

El `question_text` de cada pregunta queda corto: solo la pregunta concreta ("¿Qué proveedor tiene los precios más bajos?").

**Ventajas cross-context:**
- Funciona en `OfficialExamLayout`, `PsychometricTestLayout`, `ExamReviewLayout`, `ChartQuestion`.
- En tests aleatorios (cuando la pregunta sale aislada), el contexto se ve igual que en el examen real.
- No contamina `content_hash` (cada pregunta tiene su hash único).

### 7.2 `content_data.tables[]` (plural)

Para preguntas con varias tablas (ej. Q21-Q25 = listados + tarifas + descuentos):

```js
content_data: {
  tables: [
    { title: 'Solicitudes I', headers: ['Nombre','Servicio'], rows: [...] },
    { title: 'Solicitudes II', headers: ['Nombre','Servicio'], rows: [...] },
    { title: 'Tarifas', headers: ['N','Importe'], rows: [...] },
    { title: 'Descuentos', headers: ['N','Descuento'], rows: [...] },
  ]
}
```

`ContentDataRenderer.tsx` itera el array y muestra cada una en caja naranja.

⚠️ **NO confundir con `content_data.table_data`** (singular) — ese es el formato antiguo, solo una tabla.

### 7.3 Matrices numéricas → texto, no imagen

Para preguntas tipo "comparar matriz A vs matriz B" con números (no figuras), **convertir a texto** es preferible:
- Accesibilidad (lectores de pantalla)
- Zoom infinito sin pixelado
- Indexable
- Menos peso que un PNG

Usar `content_data.tables` con dos entradas (Matriz A, Matriz B). Reservar `image_url` solo para figuras geométricas irreducibles a texto.

### 7.4 Casos prácticos (tabla `exam_cases`) — OBLIGATORIO para Auxilio Judicial / Tramitación Procesal 2º ej

**Tecnología:** tabla `exam_cases` + columna `questions.exam_case_id` (FK).

**Schema `exam_cases`** (`db/schema.ts:2217`):
- `id` UUID
- `case_title` TEXT (ej. "Caso práctico 1: Filtraciones vivienda")
- `case_text` TEXT — el ENUNCIADO COMPLETO del caso narrativo
- `exam_date` DATE
- `oposicion_type` TEXT (`'auxilio_judicial'`, `'tramitacion_procesal'`, ...)
- `is_active` BOOLEAN

**Renderizado automático:**
- `OfficialExamLayout.tsx:1578-1600` detecta cuando una pregunta es **la primera de un grupo de `exam_case_id`** y muestra el enunciado en caja ámbar al inicio del grupo. Las siguientes preguntas del mismo `exam_case_id` NO repiten el enunciado.
- `ExamReviewLayout.tsx:294-306` lo muestra al inicio de la revisión.
- En tests aislados (TestLayout aleatorio, por ley, por tema) **NO se carga `exam_case_id`** — para evitar mostrar preguntas sin contexto, **`getOfficialExamQuestions()` filtra:** preguntas con `exam_case_id` solo aparecen cuando `parte === 'supuesto'`. Otros endpoints adaptive deben aplicar el mismo filtro.

**Workflow al importar 2º ejercicio caso práctico:**

1. **Identificar los N casos** del PDF (`grep "CASO PRÁCTICO"` o leer manualmente).
2. **Para cada caso**, INSERT en `exam_cases`:
   ```js
   const { data: ec } = await supabase.from('exam_cases').insert({
     case_title: 'Caso práctico 1: Filtraciones y conciliación',
     case_text: 'Dª Sonia Sánchez García con domicilio en...',  // todo el texto del caso
     exam_date: '2025-09-27',
     oposicion_type: 'auxilio_judicial',
     is_active: true,
   }).select('id').single();
   ```
3. **Mapear cada pregunta a su `exam_case_id`** según el número:
   - Caso 1: preguntas 105-119
   - Caso 2: preguntas 120-134
   - Caso 3: preguntas 135-144
4. **INSERT preguntas** con `exam_case_id` apuntando al `id` correcto del `exam_case` creado.
5. El `question_text` de cada pregunta puede ser CORTO (solo la pregunta concreta, sin repetir el caso). Si es largo (incluye el contexto duplicado), no pasa nada pero ocupa más espacio.

**Verificación post-import:**
```bash
node -e "
require('dotenv').config({path:'.env.local'});
const s = require('@supabase/supabase-js').createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('questions').select('exam_case_id', {count:'exact', head:true})
  .eq('exam_position', 'auxilio_judicial').eq('exam_date', '2025-09-27')
  .ilike('exam_source', '%Segunda parte%')
  .not('exam_case_id', 'is', null).then(r => console.log('Con exam_case_id:', r.count));
"
```

**Reglas finales:**
- ⚠️ NUNCA importes preguntas de 2º ejercicio AJ / TP / cualquier "caso práctico" **sin crear primero los `exam_cases`**.
- ⚠️ NUNCA dupliques el caso en cada `question_text`. Confía en la tabla.
- ⚠️ Si una pregunta del caso aparece aislada (test por ley), **NO debe mostrarse al usuario** porque carece de contexto. El filtro está aplicado por construcción en los 6 endpoints de tests aislados (§7.4.bis abajo).

### 7.4.bis Filtro `isNull(exam_case_id)` en endpoints de tests aislados (consolidado 19/05/2026)

**Aprendizaje 19/05/2026** — al importar los primeros casos prácticos (AJ 2025 + AJ 2024 + TP 2025) descubrimos que las 86+ preguntas con `exam_case_id` aparecían sin contexto en TODOS los modos de test isolado (aleatorio, por tema, por leyes, falladas, simulacro generado). Solo `OfficialExamLayout`/`ExamReviewLayout` cargan el caso y lo renderizan.

**Solución desplegada** (commit `4850285e`) — añadido `isNull(questions.examCaseId)` al WHERE de **6 endpoints**:

| Archivo | Función | Uso |
|---|---|---|
| `lib/api/random-test/queries.ts` | `getRandomTestQuestions` | Test aleatorio por temas |
| `lib/api/random-test-data/queries.ts` | conteo por tema | Sidebar UI |
| `lib/api/topic-data/queries.ts` | preguntas por tema | Test por tema |
| `lib/api/user-failed-questions/queries.ts` | `getUserFailedQuestions` + `getFailedQuestionsByTopic` | Repasar falladas |
| `lib/api/filtered-questions/queries.ts` | 5 ramas (por leyes, oficial, dificultad…) | Test por leyes |
| `lib/api/simulacro/queries.ts` | distribución 110 preg | Simulacro generado |

**NO modificar:** `getOfficialExamQuestions()` (sigue mostrando con contexto), `test-review` (revisión post-test ya tiene el case del simulacro original), `law-stats` (no devuelve preguntas).

**Test anti-regresión:** `__tests__/integration/examCaseExclusion.test.ts` — 11 tests (5 contra BD real + 6 estáticos que leen cada archivo y verifican que contiene `isNull(questions.examCaseId)`). Si alguien añade un endpoint nuevo y olvida el filtro, o lo elimina por refactor accidental, el test falla.

**Al añadir un endpoint nuevo que cargue preguntas para tests aislados:**
1. Importar `isNull` de `drizzle-orm`.
2. Añadir `isNull(questions.examCaseId)` al WHERE.
3. Añadir el archivo al array `endpoints` de la suite de tests.

### 7.4.ter Defense in depth: huérfanas marcadas como "Supuesto práctico" (19/05/2026)

**Bug detectado 19/05/2026** — 74 preguntas de 3 convocatorias CARM (DGX00C18 2020, DGX00C22 2023, DGX00L19 2024) habían sido importadas con `exam_source` que contenía "Supuesto práctico" pero **sin** crear las filas correspondientes en `exam_cases` ni vincular `exam_case_id`. Como `exam_case_id` era NULL, el filtro del §7.4.bis las dejaba pasar a tests aislados — donde aparecían sin contexto narrativo, irresolubles para el opositor. Detectado por dispute de usuaria (`a831b79a`, Marta), resuelto importando los 6 supuestos y vinculando (ver memoria `project_carm_supuestos_pendientes`).

**Tres capas de defensa añadidas tras el incidente:**

**1. Test de integración (observabilidad)** — `__tests__/integration/supuestoPracticoOrphans.test.ts`:

- Test por etiqueta: query `exam_source ILIKE '%Supuesto práctico%' AND exam_case_id IS NULL AND lifecycle_state IN ('approved','tech_approved')` debe devolver 0 filas. Si devuelve ≥1, imprime IDs y falla.
- Test heurístico por texto: busca preguntas visibles cuyo `question_text` contenga frases que requieren contexto (`"mencionados en el supuesto"`, `"del supuesto anterior"`, `"según los datos del supuesto"`, etc.) y `exam_case_id IS NULL`. Si encuentra alguna, falla con listado.
- Sanity check: al menos 1 pregunta vinculada a exam_cases existe (control positivo).

**2. Trigger BD (prevención por construcción)** — migration `database/migrations/2026-05-19-supuesto-practico-require-exam-case.sql`:

`BEFORE INSERT OR UPDATE` en `public.questions`. Rechaza con `RAISE EXCEPTION` (ERRCODE `check_violation`) cualquier fila que cumpla:

```
NEW.exam_source ILIKE '%Supuesto práctico%'
AND NEW.exam_case_id IS NULL
AND NEW.lifecycle_state IN ('approved', 'tech_approved')
```

El mensaje del error incluye `id`, `exam_source` y un HINT con la solución. Smoke tests aplicados al desplegar: UPDATE prohibido bloqueado ✅, UPDATE inocuo pasa ✅, INSERT prohibido bloqueado ✅.

**3. Filtro en endpoints (ya existente §7.4.bis)** — sigue evitando que las que sí tienen `exam_case_id` aparezcan en tests aislados sin contexto.

**Implicación para importaciones nuevas:**

- **Crear primero la fila en `exam_cases`** con el texto narrativo del supuesto.
- **Importar las preguntas con `exam_case_id` ya seteado**. Si se importa primero como `draft` con `exam_case_id NULL`, está bien (el trigger solo bloquea visibilidad → approved/tech_approved sin vincular). Pero el paso de activación debe ir DESPUÉS del UPDATE de `exam_case_id`.
- **Patrón canónico (orden):**
  1. INSERT exam_case → obtener id.
  2. INSERT questions con `exam_case_id = <nuevoId>` y `lifecycle_state = 'draft'`.
  3. Verificación IA (no toca lifecycle).
  4. Transición a `approved` vía `transition_question_state`. El trigger valida que `exam_case_id` esté seteado.

Si el trigger rechaza una transición legítima (falso positivo: `exam_source` contiene literalmente "Supuesto práctico" pero la pregunta NO depende de contexto), la solución es **cambiar el `exam_source`** para que no contenga ese literal — no relajar el trigger. La etiqueta es la fuente de verdad del criterio.

---

## 8. Verificación con agentes Sonnet (workflow §14.3)

### 8.1 Preparar payload

Exportar las preguntas + artículo vinculado + contenido del artículo a JSON en `/tmp`, agrupadas en 5 lotes de ~20 preguntas cada uno:

```
/tmp/<slug>_<fecha>_lote1_leg_X_Y.json    (~20 leg primera parte)
/tmp/<slug>_<fecha>_lote2_leg_resto.json  (~15 leg + reservas)
/tmp/<slug>_<fecha>_lote3_ofi_X_Y.json    (~18 ofi)
/tmp/<slug>_<fecha>_lote4_ofi_resto.json  (~17 ofi + reservas)
/tmp/<slug>_<fecha>_lote5_psico.json      (~30 psico)
```

### 8.2 Lanzar 5 agentes Sonnet paralelos

Prompt clave (resumen):

```
1. Lee /tmp/<lote>.json
2. Para cada pregunta evalúa article_ok, answer_ok, explanation_ok (criterios §3.1 y §8.1)
3. INSERT en ai_verification_results con ai_provider='claude_code', ai_model='claude-sonnet-4-6'
4. NO transiciones lifecycle. NO modifiques questions.
5. Propón fixes en explanation_fix / correct_option_should_be / correct_article_suggestion
6. Reporta sumario al final
```

**Diferencia legi vs ofi vs psico:**
- Legi: `article_ok` aplica, evaluar contra `articles.content`.
- Ofi (técnicas): `article_ok = null`, evaluar `answer_ok` contra conocimiento Microsoft.
- Psico: usar `psychometric_question_id` (no `question_id`), `article_ok = null`.
- Psico con imagen: `confidence='media'` (el agente no ve la imagen), `answer_ok=true` por defecto según plantilla oficial.

**Volumen validado (Madrid 18/05/2026):**
- 100 preguntas en ~6 min wall-clock (5 lotes paralelos).
- 0 errores BD, 0 wrong_article reales, 1 bad_answer (errata oficial documentada).

### 8.3 Pipeline de activación + fixes

El pipeline transiciona `draft → approved/tech_approved` (que ACTIVA la pregunta automáticamente vía la columna GENERATED) solo si pasa la verificación. Patrón canónico:

```js
// Para cada verificación IA Sonnet, decidir destino según el veredicto:
for (const av of avs) {
  const allOk = av.answer_ok && av.explanation_ok && (av.article_ok || av.article_ok === null);

  // Caso 1: 3/3 ok + alta confianza → activar (vía transition_question_state)
  if (allOk && av.confidence === 'alta') {
    const targetState = isTechnical(av) ? 'tech_approved' : 'approved';
    const reasonCode = isTechnical(av) ? 'ai_verified_tech_perfect' : 'ai_verified_perfect';

    await supabase.rpc('transition_question_state', {
      p_question_id: av.question_id,
      p_expected_state: 'draft',
      p_new_state: targetState,
      p_reason_code: reasonCode,
      p_ai_verification_id: av.id,
    });
    // is_active pasa a true automáticamente vía GENERATED

    // Campos legacy (admin UI sigue dependiendo de ellos)
    await supabase.from('questions').update({
      verified_at: new Date().toISOString(),
      verification_status: 'ok',
      topic_review_status: targetState === 'tech_approved' ? 'tech_perfect' : 'perfect',
    }).eq('id', av.question_id);
    continue;
  }

  // Caso 2: explanation_ok=false con fix usable → aplicar fix y luego activar
  if (av.explanation_ok === false && av.explanation_fix && av.explanation_fix.length > 100) {
    await supabase.from('questions')
      .update({ explanation: av.explanation_fix, updated_at: new Date().toISOString() })
      .eq('id', av.question_id);
    await supabase.from('ai_verification_results')
      .update({ fix_applied: true, fix_applied_at: new Date().toISOString() })
      .eq('id', av.id);
    // Si el resto (answer, article) está ok → activar
    if (av.answer_ok && (av.article_ok || av.article_ok === null)) {
      await supabase.rpc('transition_question_state', {
        p_question_id: av.question_id, p_expected_state: 'draft',
        p_new_state: isTechnical(av) ? 'tech_approved' : 'approved',
        p_reason_code: 'auto_fix_applied', p_ai_verification_id: av.id,
      });
    }
    continue;
  }

  // Caso 3: wrong_article o bad_answer (no errata oficial) → needs_human
  if (av.article_ok === false || (av.answer_ok === false && !isOfficialErrata(av))) {
    await supabase.rpc('transition_question_state', {
      p_question_id: av.question_id, p_expected_state: 'draft',
      p_new_state: 'needs_human',
      p_reason_code: av.article_ok === false ? 'ai_detected_wrong_article' : 'ai_detected_bad_answer',
      p_ai_verification_id: av.id,
      p_notes: 'Sugerencia agente: ' + (av.correct_article_suggestion || av.correct_option_should_be),
    });
    continue;
  }

  // Caso 4: bad_explanation SIN fix usable → permanece en draft con flag
  await supabase.from('questions').update({
    topic_review_status: 'bad_explanation',
    verification_status: 'problem',
    verified_at: new Date().toISOString(),
  }).eq('id', av.question_id);
  // NO transicionar — sigue en draft (oculta) hasta que un humano reescriba
}

// Invalidar cache prod
await fetch('https://www.vence.es/api/admin/revalidate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET },
  body: JSON.stringify({ tag: 'questions' }),
});
```

**Decisión Madrid 18/05/2026 (excepción):** las preguntas con `explanation_ok=false` y SIN `explanation_fix` se activaron igualmente (transición a `approved`) con flag `topic_review_status='bad_explanation'` para no bloquear el simulacro. Es una decisión de criterio: si quieres ser estricto, deja en `draft` hasta reescritura manual.

---

## 9. Casos especiales

### 9.1 Plantilla oficial vs literalidad del artículo

Ocurre: el examen oficial marca una opción como correcta pero el **texto literal del artículo** indica otra (típicamente una errata del organismo convocante reconocida).

**Política:**
- **Mantener la respuesta de la plantilla oficial** (`correct_option` apunta a la letra que dice la plantilla correctora).
- **Documentar la errata en la explicación**: "Errata importante: el texto literal del artículo dice X, pero la plantilla oficial valida Y. Es la respuesta dada por correcta en este examen oficial."
- Si Sonnet detecta `answer_ok=false` en estos casos, **NO transicionar a `needs_human`** — la decisión humana ya está tomada (plantilla oficial > literalidad).

**Ejemplo Madrid 2026 Q47 (LCSP Art. 34):** plantilla = "buena fe" (C), literal del artículo = "buena administración" (B). Mantenida en C, errata documentada.

### 9.2 Preguntas Windows 10 → Windows 11

Programa oficial actual exige Win11. Las preguntas del PDF que dicen "Windows 10" **se actualizan** a "Windows 11":
- Editar `question_text` y opciones (sustituir "Windows 10" por "Windows 11").
- Mantener `correct_option` y `option_a/b/c/d` salvo cambios reales en Win11.
- Añadir nota al final de la explicación:
  ```
  📋 *La pregunta original se refería a Windows 10, actualizada a Windows 11 conforme al programa vigente.*
  ```
- Vincular al `primary_article_id` de la ley virtual **Windows 11** (no Windows 10).

Ver `docs/manual-preguntas-oficiales.md` §7 para el patrón completo.

### 9.3 Reservas

5 preguntas de reserva por ejercicio (suelen aparecer al final de la plantilla correctora). Importarlas con:
- `question_official_exams.is_reserve = true`
- `question_official_exams.exam_part = 'reserva'` (1ª parte) o `'reserva-segunda'` (2ª parte)
- `exam_source` con `"Primera parte (Reserva)"` o `"Segunda parte (Reserva)"` (ver §5.2)

El simulacro las muestra al final con badge "Reserva".

### 9.4 Schema estructurado de `officialExams[].partes[]` (OBLIGATORIO en convocatorias nuevas)

**Contexto** — antes de 18/05/2026 cada entry tenía `description` como string libre:

```ts
{ id: 'primera', icon: '📘', title: 'Primer ejercicio',
  description: '60 preguntas (30 psicotécnicas + 30 Bloque I) + 5 reserva — 65 min' }
```

El string era decorativo: nada garantizaba que los números coincidieran con las
preguntas reales en BD. La card "Examen Oficial" (`OfficialExamLayout`) cuenta
de BD, el banner "Primer ejercicio" (`ConvocatoriaCard`) leía el string crudo.
Bug detectable solo a ojo.

**Formato preferido — campos estructurados:**

```ts
{
  id: 'primera',
  icon: '📘',
  title: 'Primer ejercicio',
  ordinaryCount: 60,          // preguntas ordinarias (sin reserva)
  reserveCount: 5,            // preguntas de reserva
  durationMin: 65,            // minutos del ejercicio
  breakdown: [                // desglose libre, debe sumar ordinaryCount
    { label: 'psicotécnicas', count: 30 },
    { label: 'Bloque I', count: 30 },
  ],
  // notes: '(1 anulada en plantilla)'  ← opcional, texto libre no-numérico
}
```

El helper `formatParteDescription(parte)` en `lib/config/oposiciones.ts`
construye el string mostrado al usuario desde estos campos. Un único lugar
genera el render → no hay forma de que dos vistas diverjan.

**Reglas:**

- `breakdown[].count` debe sumar exactamente `ordinaryCount` (zod `.refine` lo valida en build).
- Si la parte tiene un único sub-bloque (ej. "30 preguntas Bloque II Ofimática"), usa `breakdown: [{ label: 'Bloque II Ofimática', count: 30 }]` — el helper omite paréntesis cuando hay un solo item.
- `description` (string legacy) sigue aceptándose para entries antiguas no migradas, pero **toda convocatoria nueva debe usar el formato estructurado**.

> 🚨 **`note` SE RENDERIZA AL USUARIO y `oposiciones.ts` SE BUNDLEA AL CLIENTE (incidente 24/06/2026).**
>
> El campo `note` de la convocatoria lo pinta `TestHubClient` en la tarjeta del examen → **lo ve el opositor**. NUNCA metas en `note` estado de QA ni trazabilidad de import: "verificado por IA", "X/Y importadas", "pendiente importar 2º ejercicio", "N preguntas retiradas", `content_hash`/dedup, fuentes de scraping (`repasandosinpapeles.com`, `mjusticia.gob.es`…), "needs_human", fechas estimadas internas, etc. En `note` SOLO info de cara al opositor: plazas, turno, número/tipo de ejercicios.
>
> **NO sirve un "campo interno" en la config.** `lib/config/oposiciones.ts` es importado por componentes `'use client'` → **todo el objeto viaja en el JS al navegador y es visible en el código fuente**, se renderice o no. Por eso NO hay campo `internalNote` ni similar: la trazabilidad interna (recuento real, pendientes, fuentes, decisiones de QA) va en **mensajes de commit + memoria + estos manuales**, NUNCA en la config.
>
> El 24/06/2026 8 convocatorias (aux-carm, Madrid, SCS Canarias, Extremadura, Auxilio Judicial, Zaragoza, admin-carm) usaban `note` como bitácora interna; se limpiaron. (Primero se intentó moverlo a un campo `internalNote` no-renderizado, pero seguía filtrándose en el bundle del cliente → se eliminó del todo.) Antes de añadir/editar una convocatoria, relee tu `note`: *"¿quiero que el opositor lea esto en la app o en ver-código-fuente?"* Si no → fuera de la config.

**Test de coherencia:**

`__tests__/config/officialExamsCoherence.test.ts` ejecuta en CI:

1. Para cada `parte` con `breakdown`: suma debe ser `ordinaryCount` (también lo refuerza zod).
2. Para cada convocatoria 100% estructurada: `sum(ordinaryCount + reserveCount)` de todas las partes **= preguntas activas reales en BD** (suma de `questions` + `psychometric_questions` filtrando `exam_date + exam_position + is_official_exam + is_active`).

Si el test falla, no toques los números del config a ciegas: hay un desajuste entre lo que documentas y lo que importaste. Audita primero con un script directo a BD.

---

## 10. Checklist final

Antes de cerrar la importación:

- [ ] Convocatoria añadida a `lib/config/oposiciones.ts` (entrada en `officialExams` con **schema estructurado §9.4**)
- [ ] Conteo correcto: `parte=primera` devuelve psico + leg + reserva-1ª; `parte=segunda` devuelve ofi + reserva-2ª
- [ ] `exam_position` mapeado en `lib/config/exam-positions.ts` (si oposición nueva)
- [ ] Mapeo de pattern en `lib/api/official-exams/queries.ts` y `lib/api/psychometric-test-data/queries.ts`
- [ ] Imágenes subidas a `question-images/examenes-oficiales/<slug>-<fecha>/`
- [ ] Verificación Sonnet ejecutada (5 lotes)
- [ ] Fixes aplicados (`fix_applied=true` en las que tienen `explanation_fix`)
- [ ] Cache prod invalidada
- [ ] Probado en navegador local: el examen aparece en `/api/v2/official-exams/list` y el simulacro arranca
- [ ] Los conteos en UI son correctos (e.g. "60 preguntas + 5 reservas" para 1er ejercicio)

---

## 11. Anti-patrones observados (Madrid 18/05/2026)

| Anti-patrón | Síntoma | Fix |
|---|---|---|
| Importar legi como `tech_approved` | Lifecycle semánticamente incorrecto | Usar `approved` para legi. Si ya está mal: transicionar vía `needs_review` |
| `exam_source = "Reserva 1ª parte"` | Reservas mezcladas entre 1ª y 2ª parte | Cambiar a `"Primera parte (Reserva)"` |
| `examSourcePattern = '%Madrid%'` | Colisiona con Ayuntamiento | Específico: `%Comunidad de Madrid%` |
| `📚 Fuente: [art - BOE](url)` en legi | Duplicado con botón nativo + tab externa | Quitar de explicaciones de preguntas con `primary_article_id` |
| Imagen recortada incluye label "Pregunta X" añadido | Duplica el numerado de la UI | Recortar sin annotations manuales |
| `pdfimages -png` para preservar A/B/C/D | Las letras se pierden (no son parte de la imagen raw) | Usar `pdftoppm -r 200` y recortar la página completa |
| `content_data.tables[]` con tabla sin `headers` | `DataTableQuestion` crashea con TypeError | Validar defensivamente: `Array.isArray(table.headers) && table.headers.length > 0` |
| Enunciado largo duplicado en `question_text` de 5 preguntas | UX pobre cross-context, content_hash contaminado | Mover a `content_data.text_passage` |
| **Auto-insertar `ai_verification_results` `official_import` con todo OK** (SCS 02/06/2026) | Preguntas visibles sin auditoría real; el gate engañado | La fila de verificación SOLO la escribe una auditoría independiente real. Importar `draft` y verificar de verdad antes de transicionar |
| **Vincular a artículo "representativo"** (`firstArt` = el primero de la ley/ley-virtual) solo para cumplir el NOT NULL de `primary_article_id` (SCS 02/06/2026) | `article_ok` falso: el artículo no responde la pregunta; ~46/73 así en SCS | `article_ok=TRUE` exige auditar que ESE artículo fundamenta la respuesta. Mapear al artículo contenedor concreto (también las de ofimática: las leyes virtuales tienen artículos granulares por epígrafe — §16.3). Solo si NO existe contenedor → NO publicar hasta crearlo |

---

## 12. Bugs comunes del parser PDF

### 12.1 Footer "MODELO X — Página N de M" se cuela como contenido

**Síntoma:** preguntas concretas (13, 22, 31, 39, 48, 60 en Admin Estado 23/05/2026) desaparecen del JSON o aparecen partidas. El footer del PDF (`2025 - ADVO-L – MODELO A ... Página 10 de 14`) se queda dentro del enunciado o las opciones porque el detector busca "Página X de Y" sin condicionar a la presencia de "MODELO".

**Fix en el parser:** exigir ambos patrones simultáneamente:

```js
if (/MODELO\s+[A-Z]/.test(line) && /P[áa]gina\s+\d+\s+de\s+\d+/i.test(line)) return true;
```

Validar después del parse que la cuenta de preguntas extraídas coincide con la plantilla.

### 12.2 Cita "art. X.Y" en el enunciado confunde detección de opciones

**Síntoma:** una pregunta queda malformada porque su enunciado contiene "art. 49.c) del TREBEP" — el parser interpreta "c)" como el inicio de la opción C y trunca el enunciado.

**Caso real (Admin Estado 23/05/2026 Q `8eb7a4d7`):** "Don Eduardo decide disfrutar del permiso previsto en el artículo 49.**c)** del TREBEP… ¿Con cuánto tiempo deberá preavisar?" — el parser puso "c)" como opción y el enunciado quedó cortado.

**Mitigación:** después de extraer las opciones, validar que `option_c` no empieza por un fragmento del enunciado anterior. Heurística: si `option_a/b/c/d` arranca con un sustantivo común de enunciados (`del`, `de la`, `texto`, `Ley`…) — bandera roja, marcar para revisión manual.

Cuando se detecta este patrón, **el fix es re-parsear desde el PDF** (no inventar): localizar la pregunta en el `.txt` extraído por `pdftotext -layout`, copiar enunciado + 4 opciones literalmente, hacer UPDATE en BD.

### 12.3 Validación post-parse obligatoria

Antes del INSERT batch, comparar contra el conteo de la plantilla:

```js
const expectedTotal = parteUno.ordinarias + parteUno.reserva + parteDos.ordinarias + parteDos.reserva;
if (jsonExamen.length !== expectedTotal) throw new Error(`Parse incompleto: ${jsonExamen.length} vs ${expectedTotal} esperadas`);
```

Discrepancia ≠ "lo apaño con un UPDATE post-import". Re-parsear hasta que el conteo cuadre.

---

## 13. Tratamiento de cabos post-importación (taxonomía de `needs_human`)

Después del INSERT + verificación IA con agentes Sonnet, las preguntas que quedan en `needs_human` se categorizan por causa raíz. **Esta taxonomía es la guía de actuación**, no opcional.

### Categoría A — Linker falló (artículo SÍ está en BD)

**Síntoma:** la pregunta cita literalmente "art. 16 RD 951/2005" o "Ley 4/2023 art. 5" y el artículo existe en BD, pero el linker textual no lo asoció (variación de short_name, abreviatura, número con sufijo "bis").

**Plan:** consulta directa a BD por `law.short_name LIKE` + `article_number`. Si encuentra match, UPDATE `primary_article_id` + INSERT en `question_articles` + `transition_question_state needs_human → needs_review → approved` (intermedio obligatorio, no se puede saltar entre terminales).

**Caso real Admin Estado 23/05/2026:** 4 preguntas con leyes presentes que el linker no detectó (RD 951/2005, Ley 4/2023 LGTBI, Ley 39/2015, RD 364/1995).

### Categoría B — Norma citada NO está en BD

**Síntoma:** la pregunta cita una Orden, Resolución o Convenio que no existe en `laws`. Plan:

1. **Antes** de etiquetarla Cat B, verificar §14 (¿está derogada y sustituida?).
2. Si la norma vigente existe pero no está en BD, importarla siguiendo `monitoreo-boe-y-crear-leyes-nuevas.md` § "Crear ley nueva desde URL del BOE".
3. Vincular la pregunta al artículo importado y transicionar.

**Caso real:** 4 preguntas vinculadas a Orden 1/2/1996 ICALPE + Orden 1/2/1996 Documentos Contables AGE — ambas vigentes con consolidado BOE, importadas tras detectar el cabo.

### Categoría C — Norma no identificable

**Síntoma:** la pregunta cita una norma genéricamente ("RD de delegación de competencias", "instrucción interna", "circular DGP") sin identificador concreto, o cita una norma derogada hace décadas sin sustituta clara.

**Plan:** buscar la norma vigente que cubre la misma materia. Si hay match con cobertura razonable, vincular ahí con nota explicativa. Si no hay match, **dejar en `needs_human` con nota detallada en `explanation`** indicando qué norma falta — no inventar fallback temático.

**Caso real:** Q sobre "competencia para nombrar funcionarios del Cuerpo de Gestión" → vinculada a Orden TDF/469/2024 art Sexto (delegación en SE Función Pública) tras identificar la norma.

### Categoría D — Errata de plantilla provisional

**Síntoma:** Sonnet detecta `answer_ok=false` porque el texto literal del artículo dice una cosa y la plantilla otra. Si es errata reconocida, aplicar **política §9.1** (mantener respuesta de plantilla + nota documentando errata). Si es errata grave, **dejar como cabo abierto pendiente de plantilla DEFINITIVA**.

**Caso real Admin Estado:** Q6ef60118 (errata capítulo presupuestario A vs B), Qd158eb9c (plazo concurso 2 vs 3 meses). Ambas con política §9.1 + cabo abierto re-verificar al salir definitiva del INAP.

### Categoría E — Pregunta malformada por bug del parser

**Síntoma:** la pregunta tiene `question_text` truncado, una opción con contenido del enunciado, o numeración descuadrada (ver §12.2).

**Plan:** re-parsear del PDF original. NUNCA reconstruir de memoria.

**Caso real Q `8eb7a4d7`:** "49.c)" del enunciado se confundió con opción C → re-parseada del `1A_cuestionario.txt` línea 673.

### Plantilla de notas

En `transition_question_state.p_notes`, dejar trazabilidad:

```
Cabo Cat X: vinculada a <LEY> art <N> (fuente: <BOE-A-...>). <detalle si aplica>
```

Esto permite auditoría posterior y aprendizaje sistémico para siguientes importaciones.

---

## 14. Verificar vigencia antes de marcar "norma no en BD"

Antes de etiquetar una pregunta como Categoría B (importar norma nueva), **verificar siempre el estado vigente** de la norma citada por el examen. Los exámenes oficiales a veces citan normas derogadas:

- **Por descuido del organismo convocante** (la convocatoria reutiliza temarios viejos).
- **Por errata real** (cita "III Convenio" cuando lo vigente es el IV).

### Flujo de verificación

1. **WebSearch + WebFetch al BOE** de la norma citada literalmente.
2. **Estado actual:** cabecera del consolidado → `"Norma vigente"`, `"Norma derogada por..."`, o `"Modificada por..."`.
3. **Si está derogada:** identificar la norma sustituta vigente. Si la regla material de la pregunta se mantiene equivalente, vincular al sucesor y documentar la errata en `p_notes` y opcionalmente en `explanation`.

### Caso real — III Convenio Único AGE (Admin Estado 23/05/2026)

El examen cita literalmente "III Convenio Único para el personal laboral AGE". El III está **derogado desde 17/05/2019** por el IV Convenio (BOE-A-2019-7414). La regla material (grupo profesional E2 = título Bachiller) se mantiene equivalente en el art. 8 del IV.

**Acción:** importar el IV Convenio vía sync BOE → vincular Q `eb071385` al art. 8 → `p_notes` incluye: *"el examen cita literalmente III Convenio — el III está derogado desde 2019. El IV vigente mantiene grupo E2 = Bachiller. Errata de la convocatoria INAP."*

Si el opositor estudia con el material original del examen y se topa con la pregunta en simulacro, la explicación le aclara qué norma debe consultar.

---

## 15. Aprendizajes Aux Admin Ayto Zaragoza OEP 2024 (02/06/2026)

Importación que destapó casos no cubiertos arriba. Cada punto es accionable para la próxima.

### 15.1 Plantilla en PDF **escaneado** (imagen) → leer con `Read(pages)` + verificación ciega OBLIGATORIA

`pdftotext` devuelve vacío en plantillas escaneadas (las burbujas marcadas son una imagen). Solución: leerla visualmente con la tool `Read` y el parámetro `pages` (renderiza la página y la transcribe).

**CRÍTICO — lección dura:** la lectura visual de una plantilla de burbujas es **propensa a error de columna** (en OEP 2024 leí Q17 como «C» cuando la marca era «A»; el art. 93.1 LPAP dice «en régimen de concurrencia» = opción A, y la opción C decía «4 años» cuando la ley dice 75). Por eso, **con plantilla escaneada la verificación ciega de CADA respuesta contra el texto de la ley es obligatoria, no muestral** (§8). La deducción jurídica del agente es el ground-truth que corrige la lectura de la imagen, no al revés. Si agente y plantilla discrepan en una pregunta determinista, releer esa fila con zoom + comprobar la ley.

Guardar la clave transcrita en un `plantilla_respuestas.txt` en el directorio del examen (no se pierde y queda auditable).

### 15.2 Resolver la ley por número con **match exacto**, nunca `ilike '%N/YYYY%'`

`laws ... ilike '%5/2015%'` casa también **`15/2015`** → se resolvió «Ley 15/2015 de Jurisdicción Voluntaria» en vez de «RDL 5/2015 (EBEP)». El art. 10 existe en AMBAS, así que el check «¿existe el artículo?» pasa en falso y la pregunta queda **mislinkada en silencio** (Cat A encubierta). El agente ciego lo cazó (el contenido del artículo no tenía relación con el enunciado).

**Regla:** al buscar una ley por su número, usar igualdad de `short_name`/`name` o búsqueda por título (`name.ilike '%Estatuto Básico%'`), no por número con substring. Tras vincular, **verificar que el contenido del artículo casa con el enunciado**, no solo que el nº existe. Refuerza [[project_import_linker_wrong_law_bug]].

### 15.3 El importador **omite en silencio** las preguntas cuya figura no tiene artículo concreto en BD

Quedan fuera sin aviso: disposiciones adicionales (`DA 2ª.4 LCSP`), reglamentos municipales no cargados, y preguntas que citan «el Título III» / «los arts. 47 y siguientes» sin un nº de artículo único. **Cómo cazarlas:** (1) contar respuestas de la plantilla (p.ej. 50 + 5 reserva = 55) vs preguntas realmente activas; (2) si no cuadra, inventario `(ley, artículo)` de CADA pregunta del cuestionario y diff contra BD. En OEP 2024 faltaban 16 (LALA, DA LCSP, Decreto 347/2002, Reglamento Órganos Territoriales, Plan Igualdad, RD 500/1990, + Q27 Título III + Q41 TRRL). Ver Cat B/C (§13) para tratarlas.

### 15.4 Pregunta sin artículo concreto → anclar al artículo de **cabecera/enumeración** del título

Q27 («¿qué NO incluye el Título III, Recursos de las provincias?») no cita un artículo. Se ancla al **art. de enumeración** del título (art. 131 TRLRHL = «La Hacienda de las provincias estará constituida por los recursos…»). Da grounding correcto al agente y al feedback del usuario. Matiz operativo de Cat C.

### 15.5 Fuentes oficiales por jurisdicción + API de datos abiertos del BOE

Para traer **artículos o disposiciones sueltas** que el sync normal no carga (DA, un artículo concreto):

```bash
# 1) listar bloques de la norma consolidada
curl -s -H "Accept: application/json" \
  "https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-2017-12902/texto/indice"
# titulos tipo "Art 56", "Disposición adicional segunda" → id de bloque: art56, da-2 ...
# 2) traer el texto de un bloque (devuelve XML)
curl -s -H "Accept: application/xml" \
  "https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-2017-12902/texto/bloque/da-2"
```

- **Nacional:** API de datos abiertos del BOE = verbatim fiable (usada para LALA, DA 2ª/3ª LCSP, RD 500/1990 arts 56/67).
- **Autonómico (Aragón):** iberley da resúmenes **fieles por apartado** pero no verbatim íntegro (límite de cita del fetcher) — suficiente para grounding + el agente valida; BOA como respaldo oficial.
- **Municipal (reglamentos, planes):** web oficial del Ayuntamiento (zaragoza.es). Documentos solo-PDF: `Read(pages)`. PDF de texto: `pdftotext` y `grep` del artículo/apartado.
- **No fiar:** `noticias.juridicas.com` falla en WebFetch por certificado; `carreteros.org` da ECONNREFUSED.

### 15.6 Supuestos prácticos: `parte: 'supuesto'` en la config + coherencia cuenta los supuestos

Además de §7.4 (tabla `exam_cases` + `exam_case_id`): en `officialExams[]` la 2ª prueba va como una parte con **`id: 'supuesto'`** (NO `'segunda'`) — el filtro de `getOfficialExamQuestions` devuelve las case-based solo cuando `parte === 'supuesto'`. El test `officialExamsCoherence` suma `ordinaryCount` de TODAS las partes (primera 50 + reserva 5 + supuesto 20 = 75) y exige que cuadre con las preguntas en BD por `exam_date`+`exam_position`. `exam_source` de los supuestos: `"… - Segunda parte (supuestos prácticos)"`. Los 3 fetchers de tests normales ya excluyen `isNull(exam_case_id)` (§7.4.bis), así que no se cuelan en tests por tema/aleatorio.

### 15.7 Limitación conocida: el modo examen **no ordena por número de pregunta**

`getOfficialExamQuestions` solo separa reserva (JS `.sort` por `isReserva`); no hay `ORDER BY` de secuencia y `questions` no tiene campo de orden (existe `question_official_exams.question_number` pero el fetch no lo usa). Los supuestos **agrupan por caso** (el `case_text` se pinta bien una vez por grupo), pero el orden interno 1→N no está garantizado. Para orden exacto habría que cablear `question_number` en la query compartida (afecta a todos los exámenes).

### 15.8 Gotcha `transition_question_state`: `p_changed_by` es UUID

Pasar `p_changed_by: null` (o un UUID real), **nunca** un string como `'claude_code'` → error `invalid input syntax for type uuid`. La autoría de Claude se deja en `p_notes`. `reason_code` para activar tras verificación: `'ai_verified_perfect'` (draft → approved es transición legal directa).

### 15.9 Cablear una oposición en el modo «Examen Oficial» = 3 ficheros (y `schemas.ts` tiene 5 enums)

Que la **tarjeta** del examen aparezca solo necesita `lib/config/oposiciones.ts` (`officialExams[]`). Pero el examen **de verdad** valida el slug `oposicion` en varios sitios.

**Estado tras la unificación (02/06/2026):** la mayoría de registros se **derivan de `OPOSICIONES`**, así que añadir una oposición C2/C1 normalmente es **solo 2 pasos**:

1. `lib/config/oposiciones.ts` → `OPOSICIONES` con su `slug`, `positionType` y (si hay examen) `officialExams[]`. De aquí se derivan automáticamente:
   - el `oposicionEnum` compartido de los 5 request-schemas (`schemas.ts`: `z.enum(OPOSICIONES.map(o => o.slug))`),
   - `oposicionToExamPosition` (`queries.ts`: `slug → positionType`).
2. `lib/config/exam-positions.ts` → `EXAM_POSITION_MAP` (positionType → variantes/aliases de `exam_position`). **Este NO se deriva**: sus valores son aliases de texto libre de cómo está guardado `exam_position` en la BD histórica (no existen en `OPOSICIONES`). Lo exige el **validador de import** (`lib/import/official-exams/validator.ts` §5.5) y `isExamPositionRegistered`. Hay que añadirlo a mano (array con su propio `exam_position`).

*(Historia: antes había un objeto `OposicionType` + 5 `z.enum([...])` + `oposicionToExamPosition`, todos hardcoded y duplicados de `OPOSICIONES`. Se desincronizaban → la tarjeta salía pero el examen daba 400 en init/save/review. Derivar de `OPOSICIONES` eliminó esa clase de bug. Cuerpos A2 fuera del catálogo C2/C1, como `gestion-estado` —0 preguntas— o `gestion-procesal`, no van en el modo examen; este último se preserva explícito en `oposicionToExamPosition` por tener preguntas legacy.)*

**Probar el flujo COMPLETO end-to-end**, no solo que salga la tarjeta: cargar preguntas (`/questions`) → iniciar sesión (`/init`) → responder → corregir (`/save-results`) → ver fallos (`/failed-questions`) → revisar (`/review`). Cada uno valida `oposicion`.

**Red de seguridad:** `__tests__/config/officialExamsRegistries.test.ts` es un **invariante** que recorre `OPOSICIONES` y falla si una oposición con `officialExams` no está en los 5 schemas + `oposicionToExamPosition` + `EXAM_POSITION_MAP`. Tras la unificación, los 2 primeros son tautológicos (derivados) y el invariante vigila sobre todo `EXAM_POSITION_MAP`, el único que se mantiene a mano. (Cuando lo añadí, destapó que valencia/canarias/carm/extremadura/administrativo-estado ya estaban rotas en init/save/review desde antes.)

### 15.11 El conteo de «preguntas oficiales» del tema cuenta TODO el scope, no solo las de tu oposición

El toggle «Solo preguntas oficiales» de un test por tema aparece si `officialQuestionsCount > 0` (viene de `/api/topics/[numero]`). El **fetch** de ese filtro sirve **todas** las oficiales del scope (`is_official_exam=true`, de cualquier oposición — las leyes compartidas traen oficiales de estado/madrid/etc.; ver `filtered-questions/queries.ts` "oficiales de otra oposición"). El **conteo** debe contar lo mismo: en `lib/api/topic-data/mv-queries.ts` y `queries.ts` se suma TODO `topic_official_by_position` (no se filtra por `EXAM_POSITION_MAP`). Si se filtra por la oposición propia, el toggle queda oculto en oposiciones cuyo único oficial en el tema viene de leyes compartidas (caso Ayto Zaragoza T2: 2 propias pero 57 en scope → el toggle no salía). Conteo y fetch deben estar alineados.

### 15.10 Los supuestos prácticos se rompen visualmente sin orden determinista

`getOfficialExamQuestions` **no tenía `ORDER BY`** → las preguntas salían en orden arbitrario de BD. `OfficialExamLayout` pinta la cabecera del supuesto **cada vez que el `examCaseId` cambia respecto a la pregunta anterior**; si las de dos casos vienen entremezcladas, la cabecera salta y cada supuesto aparece **partido en trozos** (síntoma: «un supuesto con 1 pregunta y otro con muchas», aunque cada uno tenga sus 10). No era un problema de datos, era de orden.

**Regla:** (1) insertar las preguntas de supuesto **en orden de examen y agrupadas por caso** (caso 1 completo, luego caso 2…); (2) que el fetch ordene de forma estable — se añadió `.orderBy(questions.createdAt)`. Como las preguntas de supuesto **no se reutilizan** en otros tests (las excluye el filtro `exam_case_id`, §7.4.bis), su `created_at` = orden de inserción = orden de examen, estable. Las preguntas de test normales no necesitan este cuidado: su orden en el examen da igual porque se reutilizan por `topic_scope`/artículo en tests por tema.

---

## 16. Aprendizajes Aux Admin SCS Canarias 2016 (02/06/2026) — la verificación real NO es opcional

Caso real que destapó Manuel: 73 preguntas del examen SCS 2016 quedaron **visibles en producción sin haber pasado ninguna auditoría real**. Diagnóstico y reglas para que no se repita:

### 16.1 El gate de lifecycle no protege si tú fabricas la verificación
El `transition_question_state` exige una fila `ai_verification_results` "passing". Se importó `draft` (bien) pero se insertaron 73 filas `official_import` con todo OK a mano y se promovió. **El candado solo es tan honesto como esa fila.** → La fila de verificación SOLO la escribe una auditoría independiente real (§8). Nunca el importador. Ver anti-patrón en §0 y §11.

### 16.2 "Es un examen oficial" NO equivale a "está verificado"
La plantilla oficial es autoridad sobre **la respuesta del examen original del año X**, y nada más. Hay que auditar igualmente, porque la plantilla NO detecta:
- **Errores de extracción tuyos:** opción cortada o corrupta (SCS: opción C del Decreto 105/2000 llegó como «órganos para los que no desempeñan funciones», sin sentido), artefacto OCR tomado como literal (SCS: «CTRL + AA (dos veces A)»), letra correcta mal leída.
- **Desfase normativo:** la respuesta correcta en el año del examen puede haber cambiado (ojo Ley 55/2003 arts 9/9bis temporalidad 2021, importes/bases de cotización, leyes derogadas y sustituidas). Importar solo lo que **sigue correcto hoy**.
- **Dependencia de imagen no importada:** preguntas tipo «¿qué gráfico es el siguiente?» quedan irresolubles si la imagen no está (SCS: se mostraba el placeholder `[imagen de…]`). O importas el asset (§6) o no la publicas.
- **Preguntas mal planteadas como respuesta única:** varias opciones simultáneamente ciertas (SCS: «las prestaciones de la SS son… inalienables / irrenunciables / inembargables», las tres ciertas por art. 53 LGSS).

### 16.3 `article_ok` exige auditoría INDEPENDIENTE de que el artículo responde la pregunta
El fallo más extendido en SCS: para cumplir el `NOT NULL` de `primary_article_id` se vincularon ~46/73 a un artículo **representativo** (el primero de la ley, p.ej. ofimática→primer art. de la ley virtual de Excel, archivo/SS→un art. cualquiera de Ley 39/2015 o LGSS) que **no fundamenta la respuesta**. Eso NO es `article_ok`.
- **Regla:** `article_ok=TRUE` solo si ESE artículo concreto responde/soporta la pregunta, auditado de forma independiente (no por el linker, no por keyword).
- **Ofimática/informática NO son excepción** (corrección Manuel 02/06): las leyes virtuales (`Excel 365`, `Word 365`, `Informática Básica`, `La Red Internet`, `Outlook 365`, `Access 365`) tienen **artículos contenedores granulares por epígrafe** — Excel 365 tiene 27 (atajos art.5/150, gráficos art.190/6, funciones lógicas art.100, referencias art.20, errores de fórmula art.140…), Informática Básica 6 (hardware art.3, software art.4, seguridad art.5), etc. Cada pregunta técnica DEBE mapearse al artículo virtual que **contiene su sub-tema** → así tiene `article_ok` genuino y va a `tech_approved`. El error SCS fue colgarlas todas del **primer** artículo (`firstArt` → Excel art.1, Info art.0): representativo, no contenedor.
- Solo si de verdad NO existe artículo contenedor (ni de ley ni virtual) → no se da `article_ok` → no se publica hasta crear el artículo correcto.
- No basta con que el linker encuentre «un art. con ese número»: puede ser de la **ley equivocada** (ver también `revisar-preguntas-con-agente.md` y el bug del importador que cuelga por número del artículo de otra ley).

### 16.4 El auditor (agente) también se equivoca — verifica sus flags
En la revisión SCS, varios flags del agente Sonnet eran **errores del propio agente**, no de la pregunta: SUMA de Excel SÍ coacciona texto-numérico y booleanos escritos directamente como argumentos (`=SUMA("5";15;VERDADERO)=21`); en Office **en español** Guardar = Ctrl+G (no Ctrl+S); art. 9.3 Ley 55/2003 sí lista eventual «temporal, coyuntural o extraordinario». → El veredicto del agente es **input para la revisión humana**, no la decisión final. Mira el contenido real antes de retirar/aprobar. Catálogo de estos gotchas y la regla de adjudicación: [`revisar-preguntas-con-agente.md`](./revisar-preguntas-con-agente.md) §8.3/§8.4.

### 16.5 Procedimiento correcto, en una línea
Importar `draft` → **auditoría independiente real** siguiendo [`revisar-preguntas-con-agente.md`](./revisar-preguntas-con-agente.md) (procedimiento v2.1: verificar → auditar a ciegas → adjudicar → reparar → re-verificar; criterios `article_ok` §3.1, `options_ok` §3.2, `explanation_ok` §8.1) sobre respuesta-vs-ley-vigente + opciones fieles + `article_ok` genuino + explicación didáctica → escribir `ai_verification_results` con el resultado **real** → solo entonces `transition_question_state` a `approved`. Si la pregunta necesita una ley que no está en BD, créala con [`monitoreo-boe-y-crear-leyes-nuevas.md`](./monitoreo-boe-y-crear-leyes-nuevas.md) §"Crear ley nueva" (incl. el caso de fuente NO-BOE autonómica) + estructura de títulos/secciones en [`../database/estructura-leyes.md`](../database/estructura-leyes.md). Activar en el mismo paso del import = repetir el incidente.

---

## Manuales relacionados

Importar un examen oficial es el paso de mayor valor del flujo de contenido. Encadena con:

- **[`oeps-convocatorias-seguimiento.md`](./oeps-convocatorias-seguimiento.md)** — §7c/§4.5: cuándo importar (examen celebrado + cuestionario y plantilla publicados, solo turno libre, modelo único). El seguimiento de convocatorias dispara este manual.
- **[`crear-nueva-oposicion.md`](./crear-nueva-oposicion.md)** — FASE 7: si la oposición es nueva, los `officialExams[]` y los mapas de `exam-positions.ts` se configuran allí.
- **[`verificar-epigrafe-topic-scope.md`](./verificar-epigrafe-topic-scope.md)** — los `article_ref` de las preguntas importadas se cruzan contra el `topic_scope` (un examen real puede destapar huecos de scope; §"Cruzar scope con preguntas scrapeadas").
- **[`monitoreo-boe-y-crear-leyes-nuevas.md`](./monitoreo-boe-y-crear-leyes-nuevas.md)** — §4: leyes/disposiciones que el examen cita pero no están en BD se crean/sincronizan desde el BOE (incl. `includeDisposiciones: true`).
- **[`generar-preguntas-con-ia.md`](./generar-preguntas-con-ia.md)** — alternativa/complemento: para temas que el examen oficial no cubre (o materia local sin examen), generar preguntas verificadas con IA.
- **[`revisar-preguntas-con-agente.md`](./revisar-preguntas-con-agente.md)** — §8: verificación con agentes Sonnet antes de activar (lifecycle `draft` → `tech_approved`).
- **[`importar-preguntas-scrapeadas.md`](./importar-preguntas-scrapeadas.md)** y **[`manual-preguntas-oficiales.md`](../manual-preguntas-oficiales.md)** — variantes (scraping / formato rápido sin imágenes).
