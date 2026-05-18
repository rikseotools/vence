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

---

## 10. Checklist final

Antes de cerrar la importación:

- [ ] Convocatoria añadida a `lib/config/oposiciones.ts` (entrada en `officialExams`)
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
