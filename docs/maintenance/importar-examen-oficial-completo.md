# Manual: Importar Examen Oficial Completo

> End-to-end: PDF en mano → preguntas activas en BD verificadas por IA.
> Cubre legislativas + ofimáticas + psicotécnicas (texto, tabla e imagen).
> Derivado de la importación Madrid 12/04/2026 (100 preguntas, 18/05/2026).

Manuales complementarios:
- `docs/manual-preguntas-oficiales.md` — formato de pregunta oficial, lifecycle, question_official_exams
- `docs/maintenance/revisar-temas-con-agente.md` — verificación Sonnet §14
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
  oposicion_type: 'auxiliar-administrativo-madrid',
  is_reserve: false,
});
```

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
