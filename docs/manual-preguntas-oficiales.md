# Manual: Añadir Preguntas de Exámenes Oficiales

## Resumen del Proceso

1. Comparar pregunta del JSON con la base de datos
2. Verificar si existe y si las opciones coinciden
3. Buscar el artículo que fundamenta la respuesta
4. Verificar que el artículo está en `topic_scope` para las oposiciones relevantes
5. Crear explicación didáctica con buen formato
6. Insertar la pregunta con todos los metadatos

---

## 1. Estructura de la Pregunta

### Campos obligatorios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `question_text` | string | Texto completo de la pregunta |
| `option_a` | string | Opción A |
| `option_b` | string | Opción B |
| `option_c` | string | Opción C |
| `option_d` | string | Opción D |
| `correct_option` | integer | **0=A, 1=B, 2=C, 3=D** |
| `explanation` | string | Explicación didáctica (markdown) |
| `primary_article_id` | uuid | ID del artículo que fundamenta la respuesta |
| `is_active` | boolean | `true` |
| `is_official_exam` | boolean | `true` para preguntas oficiales |
| `exam_source` | string | Fuente del examen |
| `exam_date` | date | Fecha de la **convocatoria** (YYYY-MM-DD) - NO la fecha de realización del examen |
| `difficulty` | string | `easy`, `medium`, `hard` |

### Sistema de respuestas

```
correct_option = 0  →  A
correct_option = 1  →  B
correct_option = 2  →  C
correct_option = 3  →  D
```

### Formato de exam_source

```
Examen [Oposición] - OEP [Años] - Convocatoria [Fecha]
```

Ejemplos:
- `Examen Auxiliar Administrativo Estado - OEP 2023-2024 - Convocatoria 9 julio 2024`
- `Examen Auxiliar Administrativo Estado - OEP 2023-2024 - Convocatoria 9 julio 2024 (Reserva 1)`

---

## 2. Comparar con Base de Datos

### Buscar pregunta existente

```javascript
const { data } = await supabase
  .from('questions')
  .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, is_official_exam')
  .ilike('question_text', '%' + pregunta.substring(0, 40) + '%');
```

### Casos posibles

| Caso | Acción |
|------|--------|
| No existe | Crear nueva |
| Existe con opciones iguales | Marcar como oficial si no lo está |
| Existe con opciones en diferente orden | Desactivar y crear nueva |
| Existe con respuesta incorrecta | Desactivar y crear nueva correcta |

### Detectar opciones reordenadas

Si el texto de la pregunta es igual pero las opciones están en diferente posición, la pregunta en BD puede tener la respuesta correcta en otra letra. Verificar que el **contenido** de la respuesta correcta sea el mismo, no solo la letra.

---

## 3. Buscar Artículo Vinculado

### Buscar la ley

```javascript
const { data: laws } = await supabase
  .from('laws')
  .select('id, short_name, name')
  .or('short_name.ilike.%366/2007%,name.ilike.%366/2007%');
```

### Buscar el artículo

```javascript
const { data: articles } = await supabase
  .from('articles')
  .select('id, article_number, title, content')
  .eq('law_id', lawId)
  .eq('article_number', '4');
```

### Verificar que el artículo explica la pregunta

Leer el contenido del artículo y confirmar que contiene la respuesta correcta textualmente o conceptualmente.

---

## 4. Añadir Leyes Nuevas (si no existe)

Si la ley no existe en la base de datos:

### 4.1 Buscar la URL del BOE

```javascript
// Buscar en https://www.boe.es/buscar/
// Formato típico: https://boe.es/eli/es/o/2021/12/09/pcm1382/con
```

### 4.2 Insertar la ley

```javascript
const { data, error } = await supabase
  .from('laws')
  .insert({
    name: 'Orden PCM/1382/2021, de 9 de diciembre, por la que se regula...',
    short_name: 'Orden PCM/1382/2021',
    year: 2021,
    type: 'law',
    scope: 'national',
    is_active: true,
    boe_url: 'https://boe.es/eli/es/o/2021/12/09/pcm1382/con',
    boe_id: 'BOE-A-2021-20477',
    verification_status: 'pendiente'
  })
  .select('id')
  .single();
```

### 4.3 Sincronizar artículos desde BOE

1. Ir a `/admin/monitoreo`
2. Buscar la ley por nombre
3. Pulsar el botón "Sincronizar BOE"

### 4.4 Actualizar mapeos

Añadir la ley en `lib/lawMappingUtils.ts`:

```typescript
// En SLUG_TO_SHORT_NAME:
'orden-pcm-1382-2021': 'Orden PCM/1382/2021',

// En SHORT_NAME_TO_SLUG:
'Orden PCM/1382/2021': 'orden-pcm-1382-2021',
```

---

## 5. Verificar topic_scope (IMPORTANTE: TODAS las oposiciones)

El artículo debe estar en `topic_scope` para que la pregunta aparezca en los tests de ese tema.

### Verificar topic_scope existente

```javascript
const { data: scopes } = await supabase
  .from('topic_scope')
  .select(`
    id, article_numbers,
    topics(id, topic_number, title, position_type),
    laws(short_name)
  `)
  .eq('law_id', lawId);
```

### Verificar inclusión

- Si `article_numbers` es `null` → incluye todos los artículos de la ley
- Si `article_numbers` es array → verificar que incluye el artículo específico

### Oposiciones disponibles

| position_type | Oposición | Temas típicos de registro/admin |
|---------------|-----------|--------------------------------|
| `auxiliar_administrativo` | Auxiliar Administrativo del Estado | Tema 103, 104 |
| `administrativo` | Administrativo del Estado | Tema 202, 203 |
| `tramitacion_procesal` | Tramitación Procesal | (verificar si aplica) |

### IMPORTANTE: Añadir topic_scope a TODAS las oposiciones relevantes

Buscar temas equivalentes en todas las oposiciones:

```javascript
const { data: topics } = await supabase
  .from('topics')
  .select('id, topic_number, title, position_type')
  .or('title.ilike.%registro%,title.ilike.%electrónic%,title.ilike.%documento%')
  .order('position_type');
```

Añadir topic_scope para cada oposición donde aplique:

```javascript
await supabase
  .from('topic_scope')
  .insert({
    topic_id: 'uuid-del-tema',
    law_id: 'uuid-de-la-ley',
    article_numbers: null  // null = todos los artículos
  });
```

### Ejemplo: Orden PCM/1382/2021 (Registro Electrónico)

| Oposición | Tema | Aplica |
|-----------|------|--------|
| auxiliar_administrativo | 103 - Concepto de documento, registro y archivo | Si |
| administrativo | 202 - Documento, Registro y Archivo | Si |
| tramitacion_procesal | 29, 30 - Registro Civil | No (diferente tipo de registro) |

---

## 5. Crear Explicación Didáctica

### Formato (Markdown)

```markdown
**Respuesta correcta: A) [Texto de la opción].**

El artículo X.Y del [Ley] establece literalmente:

> "[Cita textual del artículo]"

**Puntos clave:**
- Punto importante 1
- Punto importante 2
- Punto importante 3

[Contexto adicional si es necesario]

📚 **Fuente:** [Título descriptivo del recurso](URL_ESPECÍFICA)
```

### Elementos de una buena explicación

1. **Indicar la respuesta correcta** al inicio
2. **Citar el artículo** textualmente si es posible
3. **Explicar por qué** las otras opciones son incorrectas (opcional)
4. **Dar contexto** sobre la normativa
5. **Puntos clave** para recordar
6. **⚠️ OBLIGATORIO: Fuente específica** que responda la pregunta

### ⚠️ CRÍTICO: Requisito de Fuentes Específicas

**TODAS las explicaciones deben incluir una fuente verificable** que responda directamente a la pregunta.

#### ❌ MAL: Fuentes genéricas

```markdown
📚 **Fuente:** [Soporte de Microsoft Office](https://support.microsoft.com/es-es/office)
📚 **Fuente:** [Ayuda de Windows](https://support.microsoft.com/es-es/windows)
📚 **Fuente:** [BOE](https://www.boe.es)
```

Estas fuentes son páginas principales que NO responden la pregunta específica.

#### ✅ BIEN: Fuentes específicas

```markdown
📚 **Fuente:** [Función CONCAT - Soporte Microsoft](https://support.microsoft.com/es-es/office/funci%C3%B3n-concat-9b1a9a3f-94ff-41af-9736-694cbd6b4ca2)
📚 **Fuente:** [Mostrar u ocultar el panel de lectura en Outlook](https://support.microsoft.com/es-es/office/usar-y-configurar-el-panel-de-lectura-para-obtener-una-vista-previa-de-los-mensajes-2fd687ed-7fc4-4ae3-8eab-9f9b8c6d53f0)
📚 **Fuente:** [Art. 116 CE - BOE](https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229&p=20240910&tn=1#a116)
```

Estas fuentes llevan **directamente** a la página que explica el concepto preguntado.

#### Proceso para encontrar fuentes específicas

1. **Identificar el concepto específico** de la pregunta
2. **Buscar en la documentación oficial** usando términos específicos
3. **Verificar que la URL responde la pregunta** antes de incluirla
4. **Preferir URLs permanentes** (con IDs de artículo, no búsquedas)

#### Ejemplos por tipo de pregunta

| Tipo | Cómo encontrar la fuente |
|------|--------------------------|
| **Legislativa** | Buscar en BOE el artículo específico con `#aXX` |
| **Office 365** | Buscar en support.microsoft.com la función exacta |
| **Windows 11** | Buscar en support.microsoft.com la característica específica |
| **Psicotécnica** | No requiere fuente externa (es cálculo/lógica) |

#### Herramientas de búsqueda

```bash
# Para Office/Windows - buscar en Google con site:
site:support.microsoft.com "CONCAT" excel

# Para BOE - ir al artículo específico
https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229#a116
```

### Ejemplo completo

```markdown
**Respuesta correcta: A) Un número suficiente de plazas.**

El artículo 4.2.d) del Real Decreto 366/2007 establece literalmente:

> "Las Oficinas de Atención al Ciudadano, en el caso de disponer de plazas de aparcamiento, reservarán **un número suficiente de plazas**, convenientemente señalizadas, destinadas en exclusividad a personas con movilidad reducida, con dimensiones adecuadas para el acceso lateral y posterior a los vehículos, garantizando la existencia de itinerarios accesibles entre las plazas y la propia Oficina."

**Puntos clave:**
- No se establece un porcentaje fijo (2%, 5% o 7%)
- Se exige un "número suficiente" que garantice la accesibilidad
- Las plazas deben estar señalizadas y tener dimensiones adecuadas
- Debe existir itinerario accesible entre las plazas y la Oficina

Este Real Decreto regula las condiciones de accesibilidad y no discriminación de personas con discapacidad en sus relaciones con la Administración General del Estado.

📚 **Fuente:** [Real Decreto 366/2007, Art. 4 - BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2007-6239#a4)
```

### Ejemplo para pregunta de informática (Office 365)

```markdown
**Respuesta correcta: B) CONCAT**

La función **CONCAT** en Excel 365 une el contenido de varias celdas o cadenas de texto en una sola.

**Sintaxis:**
`=CONCAT(texto1, [texto2], ...)`

**Características:**
- Puede concatenar hasta 253 argumentos de texto
- Admite rangos de celdas (ej: `=CONCAT(A1:A5)`)
- Reemplaza a la antigua función CONCATENAR

**Por qué las otras opciones son incorrectas:**
- A) ADJUNTAR: No es una función de Excel
- C) ENLAZAR: No es una función de concatenación
- D) UNIFICAR: No existe en Excel

📚 **Fuente:** [Función CONCAT - Soporte Microsoft](https://support.microsoft.com/es-es/office/funci%C3%B3n-concat-9b1a9a3f-94ff-41af-9736-694cbd6b4ca2)

📋 *La pregunta original se refería a Office 2016, actualizada a Office 365 conforme al programa vigente.*
```

---

## 6. Insertar la Pregunta

### Query de inserción

```javascript
const { data, error } = await supabase
  .from('questions')
  .insert({
    question_text: 'Texto de la pregunta...',
    option_a: 'Opción A',
    option_b: 'Opción B',
    option_c: 'Opción C',
    option_d: 'Opción D',
    correct_option: 0, // 0=A, 1=B, 2=C, 3=D
    explanation: 'Explicación en markdown...',
    primary_article_id: 'uuid-del-articulo',
    is_active: true,
    is_official_exam: true,
    exam_source: 'Examen Auxiliar Administrativo Estado - OEP 2023-2024 - Convocatoria 9 julio 2024',
    exam_date: '2024-07-09',
    difficulty: 'medium'
  })
  .select('id')
  .single();
```

### Desactivar pregunta existente (si es necesario)

```javascript
await supabase
  .from('questions')
  .update({ is_active: false })
  .eq('id', 'uuid-pregunta-antigua');
```

---

## 7. Detectar Preguntas Obsoletas

### Causas de obsolescencia

1. **Normativa derogada** - La ley o artículo ya no está vigente
2. **Normativa modificada** - El contenido del artículo ha cambiado
3. **Respuesta incorrecta** - Error en la plantilla original del examen

### Cómo verificar

1. Comprobar que la ley sigue vigente
2. Comprobar que el artículo no ha sido modificado
3. Verificar la respuesta contra el texto actual del artículo

### Acción para preguntas obsoletas

- Desactivar (`is_active: false`)
- NO eliminar (mantener historial)
- Documentar el motivo

### Caso especial: Windows 10 → Windows 11

El programa oficial actual exige **Windows 11**, por lo que las preguntas de Windows 10 están obsoletas. En estos casos:

1. **Actualizar el texto** de la pregunta cambiando "Windows 10" por "Windows 11"
2. **Vincular al artículo correcto** de la ley virtual "Windows 11" (ID: `932efcfb-5dce-4bcc-9c6c-55eab19752b0`)
3. **Activar la pregunta** (`is_active: true`)
4. **Añadir nota en la explicación** al final:
   ```
   📋 *La pregunta original se refería a Windows 10, actualizada a Windows 11 conforme al programa vigente.*
   ```

#### Artículos de Windows 11 disponibles:

| Artículo | Título | ID |
|----------|--------|-----|
| Art. 1 | Fundamentos del Sistema Operativo Windows 11 | `514fe942-d773-4ef0-9812-c759e84f93a1` |

#### Para preguntas del Explorador de archivos:

Usar la ley "Explorador de archivos Windows 11" (ID: `9c0b25a4-c819-478c-972f-ee462d724a40`):

| Artículo | Título | ID |
|----------|--------|-----|
| Art. 1 | Explorador de archivos de Windows 11 | `ce107473-519a-477f-8dba-de78f83a4302` |

#### topic_scope de Windows 11:

| Oposición | Tema | Descripción |
|-----------|------|-------------|
| auxiliar_administrativo | 106 | Introducción al sistema operativo Windows 11 |
| tramitacion_procesal | 33 | Introducción al sistema operativo Windows |

#### Formato de explicación para preguntas actualizadas:

```markdown
**Respuesta correcta: X) [Texto de la opción].**

[Explicación técnica del concepto]

**Características principales:**
- Punto 1
- Punto 2
- Punto 3

**Por qué las otras opciones son incorrectas:**
- A) [Razón]
- B) [Razón]
- etc.

📋 *La pregunta original se refería a Windows 10, actualizada a Windows 11 conforme al programa vigente.*
```

---

## 8. Checklist Final

Antes de insertar una pregunta oficial, verificar:

- [ ] **Verificar si ya existe** la pregunta en BD (evitar duplicados)
- [ ] Texto de la pregunta coincide con el examen original
- [ ] Opciones en el orden correcto (A, B, C, D)
- [ ] `correct_option` usa el sistema 0-3 (0=A, 1=B, 2=C, 3=D)
- [ ] Artículo vinculado existe y contiene la respuesta
- [ ] Artículo está en `topic_scope` para las oposiciones relevantes
- [ ] Explicación cita el artículo y es didáctica
- [ ] **⚠️ Fuente específica incluida** (URL que responde la pregunta, NO genérica)
- [ ] `is_official_exam: true`
- [ ] `exam_source` con formato correcto
- [ ] `exam_date` en formato YYYY-MM-DD (fecha de **convocatoria**, no del examen)
- [ ] `difficulty` asignada
- [ ] `exam_position` con el `positionType` de la oposición (ej: `auxiliar_administrativo_madrid`). Sin esto, las preguntas NO aparecen en el filtro "Solo preguntas oficiales".
- [ ] **Añadir registro en `question_official_exams`** (ver sección 12)
- [ ] **Verificar configuración** (solo la primera vez que se importan oficiales para una oposición nueva):
  - [ ] `lib/config/oposiciones.ts` → La oposición debe existir aquí (fuente de verdad). Los nombres se derivan automáticamente.
  - [ ] `lib/config/exam-positions.ts` → Añadir el `positionType` en `EXAM_POSITION_MAP` (variantes de exam_position) y en `HOT_ARTICLE_TARGET_MAP` (variantes de target_oposicion). Sin esto el conteo de preguntas oficiales es 0 y los hot articles no se muestran.

---

## 9. Ubicación de JSONs de Exámenes Oficiales

```
data/examenes-oficiales/
├── auxiliar-administrativo-estado/
│   ├── OEP 2018-2019/
│   ├── OEP 2020/
│   ├── OEP 2021-2022/
│   └── OEP-2023-2024/
│       └── Convocatoria 9 julio 2024.json
└── [otras oposiciones]/
```

### Estructura del JSON

```json
{
  "metadatos": {
    "examen": "...",
    "convocatoria": "...",
    "oep": "...",
    "tipo_acceso": "...",
    "modelo": "..."
  },
  "primera_parte": {
    "preguntas": [
      {
        "numero": 1,
        "pregunta": "...",
        "opciones": {
          "a": "...",
          "b": "...",
          "c": "...",
          "d": "..."
        },
        "respuesta_correcta": "a"
      }
    ]
  },
  "segunda_parte": {
    "preguntas": [...]
  },
  "resumen": {
    "total_preguntas_primera_parte": 60,
    "total_preguntas_segunda_parte": 50,
    "pregunta_anulada": "..."
  }
}
```

---

## 10. Preguntas Psicotécnicas (Tabla separada)

Las preguntas psicotécnicas van en la tabla `psychometric_questions`, NO en `questions`.

### 10.1 Diferencia con preguntas legislativas

| Aspecto | Legislativas (`questions`) | Psicotécnicas (`psychometric_questions`) |
|---------|---------------------------|------------------------------------------|
| Requiere artículo | Sí (`primary_article_id` NOT NULL) | No |
| Categorías | Por tema/ley | Por tipo cognitivo |
| Componente | ChartQuestion | Componentes especializados |

### 10.2 Categorías, Secciones y Subtypes Psicotécnicos

**IMPORTANTE:** Cada `question_subtype` debe usar su `category_id` y `section_id` específicos.

| Subtype | category_id | section_id | Descripción |
|---------|-------------|------------|-------------|
| `synonym` | `f0569b20-f011-4e1b-a12f-f8b49b106b2f` | `6b5b332c-f4fc-42bd-9d1f-f934a1fd50d7` | Sinónimos |
| `antonym` | `f0569b20-f011-4e1b-a12f-f8b49b106b2f` | `6b5b332c-f4fc-42bd-9d1f-f934a1fd50d7` | Antónimos |
| `calculation` | `a0c76a3c-9a8e-4b60-994d-a159f964cc83` | `b81b6c4b-b892-4ce4-b39d-f06bcea5f88f` | Cálculos/ecuaciones |
| `percentage` | `a0c76a3c-9a8e-4b60-994d-a159f964cc83` | `b81b6c4b-b892-4ce4-b39d-f06bcea5f88f` | Porcentajes |
| `probability` | `a0c76a3c-9a8e-4b60-994d-a159f964cc83` | `b81b6c4b-b892-4ce4-b39d-f06bcea5f88f` | Probabilidades |
| `sequence_numeric` | `62014ea2-eef2-40b1-883c-39d1a73d95ff` | `f12e0e95-5428-4277-a846-09dc79e2f9a1` | Series numéricas |
| `text_question` | `af030780-6449-4bbe-a50f-34f0af7c6c9f` | `169ff2db-cb7f-4426-a9f5-09b7d55a99a2` | Orden alfabético, definiciones |
| `error_detection` | `af030780-6449-4bbe-a50f-34f0af7c6c9f` | `169ff2db-cb7f-4426-a9f5-09b7d55a99a2` | Errores ortográficos |
| `code_equivalence` | `55fd4bd0-faf2-4737-8203-4c41e30be41a` | `124249af-2a1b-4676-8598-3deae3f03a61` | Equivalencias de códigos |
| `data_tables` | `55fd4bd0-faf2-4737-8203-4c41e30be41a` | `72730b63-b10e-4777-b4bd-8fe7b69871a1` | Tablas de datos |

**Categorías resumidas:**
| Categoría | ID |
|-----------|----|
| Razonamiento verbal | `f0569b20-f011-4e1b-a12f-f8b49b106b2f` |
| Razonamiento numérico | `a0c76a3c-9a8e-4b60-994d-a159f964cc83` |
| Series numéricas | `62014ea2-eef2-40b1-883c-39d1a73d95ff` |
| Análisis de texto | `af030780-6449-4bbe-a50f-34f0af7c6c9f` |
| Interpretación datos | `55fd4bd0-faf2-4737-8203-4c41e30be41a` |

### 10.3 Subtypes y Componentes

**IMPORTANTE:** El `question_subtype` determina qué componente renderiza la pregunta.

| Subtype | Componente | Uso |
|---------|------------|-----|
| `calculation` | Inline (4 opciones) | Ecuaciones, operadores |
| `percentage` | Inline (4 opciones) | Porcentajes, fracciones |
| `probability` | Inline (4 opciones) | Probabilidades |
| `sequence_numeric` | SequenceNumericQuestion | Series numéricas |
| `sequence_letter` | SequenceLetterQuestion | Series de letras |
| `sequence_alphanumeric` | SequenceAlphanumericQuestion | Series mixtas |
| `synonym` | Inline (4 opciones) | Sinónimos |
| `antonym` | Inline (4 opciones) | Antónimos |
| `text_question` | Inline (4 opciones) | Definiciones, orden alfabético |
| `error_detection` | ErrorDetectionQuestion | Errores ortográficos |
| `word_analysis` | WordAnalysisQuestion | Análisis de palabras |
| `data_tables` | DataTableQuestion | Interpretación de tablas |
| `pie_chart` | PieChartQuestion | Gráficos circulares |
| `bar_chart` | BarChartQuestion | Gráficos de barras |

### 10.4 Insertar Pregunta Psicotécnica

```javascript
const { data, error } = await supabase
  .from('psychometric_questions')
  .insert({
    category_id: 'uuid-categoria',
    section_id: 'uuid-seccion',
    question_subtype: 'calculation',  // CRÍTICO: debe coincidir con componente
    question_text: 'Halla el valor de x en: 2(23x+9) = -6x',
    option_a: '-0,23',
    option_b: '0,45',
    option_c: '-0,35',
    option_d: '3,05',
    correct_option: 2,  // 0=A, 1=B, 2=C, 3=D
    explanation: 'Explicación didáctica...',
    difficulty: 'medium',
    content_data: { exam_source: '...', exam_date: '...' },
    is_active: true,
    is_official_exam: true,
    exam_source: 'Examen Auxiliar Administrativo Estado - OEP 2021-2022 - Convocatoria 20 enero 2023 - Primera parte',
    exam_date: '2023-01-20'
  });
```

### 10.5 Preguntas de Tablas (IMPORTANTE)

**⚠️ SIEMPRE pedir las tablas al usuario antes de procesar preguntas de interpretación de tablas.**

Las preguntas de tablas requieren los datos en `content_data.tables` (array de tablas):

```javascript
content_data: {
  tables: [{
    title: 'Tabla de Salas del Edificio',
    headers: ['Nombre Sala', 'Tipo', 'Disponibilidad', 'Capacidad', 'Equipación', 'Toma red', 'Equipos', 'Superficie', 'Decoración'],
    rows: [
      ['Nueva York', 'Sala de reuniones', 'Mañanas', '6', 'No', 'No', '8', '15', 'Estándar'],
      ['Tokio', 'Sala de reuniones', 'Tardes', '17', 'Proyector', 'Sí', '12', '45', 'Estándar'],
      // ... más filas
    ]
  }],
  exam_source: 'Examen Auxiliar Administrativo Estado - OEP 2020 - Convocatoria 26 mayo 2021',
  exam_date: '2021-05-26'
}
```

**Estructura del array `tables`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `title` | string | Título de la tabla que se mostrará |
| `headers` | string[] | Array con los nombres de las columnas |
| `rows` | string[][] | Array de arrays, cada uno es una fila de datos |

**Proceso para preguntas de tablas:**

1. **Pedir las tablas al usuario** (capturas de pantalla o datos)
2. Extraer los datos de las tablas en formato `{ title, headers, rows }`
3. **Verificar las respuestas** calculando manualmente con los datos reales
4. Insertar con `content_data.tables` para visualización
5. Crear explicaciones que muestren el cálculo paso a paso

**Las tablas NO están en el JSON** del examen, se proporcionan como material auxiliar separado.

**Múltiples preguntas con la misma tabla:** Cada pregunta debe incluir la tabla completa en su `content_data.tables`. El componente DataTableQuestion renderiza las tablas automáticamente.

### 10.6 Explicaciones Didácticas para Psicotécnicos

Formato recomendado:

```markdown
**Respuesta correcta: C) -0,35**

**Resolución paso a paso:**

**Paso 1:** [Descripción del paso]
[Cálculo]

**Paso 2:** [Descripción del paso]
[Cálculo]

**Resultado:** [Respuesta final]

**Por qué las otras opciones son incorrectas:**
- A) -0,23: [Razón]
- B) 0,45: [Razón]
- D) 3,05: [Razón]
```

### 10.7 Checklist Psicotécnicos

- [ ] **Verificar si ya existe** la pregunta en BD (evitar duplicados)
- [ ] `question_subtype` correcto (determina el componente)
- [ ] `category_id` y `section_id` válidos
- [ ] `correct_option` en formato 0-3
- [ ] Explicación con pasos detallados (resolución paso a paso)
- [ ] Para tablas: `content_data.tables` con datos reales (array de tablas)
- [ ] Para tablas: respuestas verificadas con cálculos manuales
- [ ] `is_official_exam: true`
- [ ] `exam_source` con formato correcto incluyendo "Primera parte" o "Segunda parte"
- [ ] `exam_date` en formato YYYY-MM-DD (fecha de **convocatoria**, no del examen)
- [ ] **Añadir registro en `question_official_exams`** con `psychometric_question_id` (ver sección 12)
- [ ] **Nota:** Psicotécnicos NO requieren fuente externa (son cálculos/lógica matemática)

---

## 11. Hacer Visible el Examen en la Página de Tests

Después de añadir todas las preguntas, el examen debe aparecer en la página de selección de tests.

### 11.1 Cómo Funciona el Sistema

1. **API de lista:** `/api/v2/official-exams/list` busca todos los `exam_date` + `exam_source` únicos
2. **Filtro por oposición:** Filtra por texto en `exam_source` (ej: "Auxiliar Administrativo Estado")
3. **Filtro por parte:** Busca "Primera parte" o "Segunda parte" en `exam_source`
4. **API de preguntas:** `/api/v2/official-exams/questions` obtiene las preguntas filtradas

### 11.2 Requisitos de Metadata

Para que el examen aparezca correctamente:

| Campo | Formato | Ejemplo |
|-------|---------|---------|
| `exam_date` | YYYY-MM-DD | `2023-01-20` |
| `exam_source` | Incluye oposición + parte | `Examen Auxiliar Administrativo Estado - OEP 2021-2022 - Convocatoria 20 enero 2023 - Primera parte` |
| `is_official_exam` | `true` | `true` |
| `is_active` | `true` | `true` |

### 11.3 Verificar que la API Reconoce el Examen

```bash
# Verificar que aparece en la lista
curl "http://localhost:3000/api/v2/official-exams/list?oposicion=auxiliar-administrativo-estado" | jq '.exams[] | select(.examDate == "2023-01-20")'

# Verificar que devuelve preguntas
curl "http://localhost:3000/api/v2/official-exams/questions?examDate=2023-01-20&oposicion=auxiliar-administrativo-estado&parte=primera" | jq '.metadata'
```

### 11.4 Añadir el Examen a la Página (Desplegables por Convocatoria)

El archivo `app/auxiliar-administrativo-estado/test/page.js` tiene los exámenes hardcodeados. Cada convocatoria es un **desplegable** que contiene sus partes.

**Estado necesario** (ya existe):
```jsx
const [expandedConvocatorias, setExpandedConvocatorias] = useState({})

const toggleConvocatoria = (examDate) => {
  setExpandedConvocatorias(prev => ({
    ...prev,
    [examDate]: !prev[examDate]
  }))
}
```

**Plantilla para nueva convocatoria** (añadir dentro de `availableExams.length > 0`):

```jsx
{/* ===== CONVOCATORIA [AÑO] ===== */}
{availableExams.filter(e => e.examDate === 'YYYY-MM-DD').length > 0 && (
  <div className="bg-white rounded-lg shadow overflow-hidden">
    {/* Cabecera desplegable - gris si no hecho, color según % si hecho */}
    <button
      onClick={() => toggleConvocatoria('YYYY-MM-DD')}
      className={`w-full ${
        (examStats['YYYY-MM-DD-primera'] || examStats['YYYY-MM-DD-segunda'])
          ? COLOR_CLASSES[getAccuracyColor(Math.max(
              examStats['YYYY-MM-DD-primera']?.accuracy || 0,
              examStats['YYYY-MM-DD-segunda']?.accuracy || 0
            ))]
          : 'bg-gray-500 hover:bg-gray-600'
      } text-white py-3 px-4 text-left font-semibold transition-all duration-300 focus:outline-none`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="mr-2 text-lg">📋</span>
          <div>
            <div className="font-bold">Convocatoria [fecha legible]</div>
            <div className="text-xs text-white/80">OEP [años]</div>
          </div>
        </div>
        <span className={`text-xl transition-transform duration-300 ${expandedConvocatorias['YYYY-MM-DD'] ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
    </button>

    {/* Contenido expandible */}
    {expandedConvocatorias['YYYY-MM-DD'] && (
      <div className="p-3 space-y-2 bg-gray-100">
        {/* Primera parte */}
        <Link
          href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=YYYY-MM-DD&parte=primera"
          className={`block ${COLOR_CLASSES[examStats['YYYY-MM-DD-primera'] ? getAccuracyColor(examStats['YYYY-MM-DD-primera'].accuracy) : 'gray']} text-white py-3 px-4 rounded-lg font-semibold transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="mr-2 text-lg">📘</span>
              <div>
                <div className="font-bold">Primera parte</div>
                <div className="text-xs text-white/80">[Descripción]</div>
              </div>
            </div>
            <div className="flex items-center">
              {examStats['YYYY-MM-DD-primera'] ? (
                <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-bold">
                  {examStats['YYYY-MM-DD-primera'].accuracy}%
                </span>
              ) : (
                <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium">Empezar</span>
              )}
            </div>
          </div>
        </Link>

        {/* Segunda parte */}
        <Link
          href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=YYYY-MM-DD&parte=segunda"
          className={`block ${COLOR_CLASSES[examStats['YYYY-MM-DD-segunda'] ? getAccuracyColor(examStats['YYYY-MM-DD-segunda'].accuracy) : 'gray']} text-white py-3 px-4 rounded-lg font-semibold transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg`}
        >
          {/* ... mismo patrón con 📗 y parte=segunda ... */}
        </Link>

        {/* Placeholder si parte no está lista */}
        <div className="bg-gray-300 text-gray-600 py-3 px-4 rounded-lg font-semibold">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="mr-2 text-lg">📗</span>
              <div>
                <div className="font-bold">Segunda parte</div>
                <div className="text-xs">Próximamente</div>
              </div>
            </div>
            <span className="bg-gray-400/30 px-2 py-1 rounded-full text-xs font-medium">En desarrollo</span>
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

### 11.5 Parámetros de URL

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `fecha` | exam_date en formato YYYY-MM-DD | `2023-01-20` |
| `parte` | `primera` o `segunda` | `primera` |

URL completa:
```
/auxiliar-administrativo-estado/test/examen-oficial?fecha=2023-01-20&parte=primera
```

### 11.6 Stats del Usuario

Las estadísticas se guardan con clave `{examDate}-{parte}`:
- `2023-01-20-primera`
- `2023-01-20-segunda`

El componente usa `examStats['2023-01-20-primera']` para mostrar el progreso del usuario.

### 11.7 Checklist para Nuevo Examen

- [ ] Todas las preguntas tienen `exam_date` correcto (YYYY-MM-DD)
- [ ] Todas las preguntas tienen `exam_source` con oposición y parte
- [ ] Todas las preguntas tienen `is_official_exam: true`
- [ ] API `/api/v2/official-exams/list` devuelve el examen
- [ ] API `/api/v2/official-exams/questions` devuelve las preguntas
- [ ] Añadido bloque en `page.js` con fecha y enlaces correctos
- [ ] Probado en navegador: el examen aparece y se puede iniciar

---

## 12. Preguntas Repetidas en Múltiples Exámenes

### 12.1 El Problema

Una misma pregunta puede aparecer en:
- **Diferentes convocatorias** de la misma oposición (OEP 2020 y OEP 2023)
- **Diferentes oposiciones** (Auxiliar Administrativo y Tramitación Procesal)

Si duplicamos la pregunta en `questions`, tenemos problemas:
- Estadísticas de usuario separadas para la "misma" pregunta
- Mantenimiento duplicado de explicaciones
- Hot articles no se acumulan correctamente

### 12.2 Solución: Tabla `question_official_exams`

Existe una tabla de asociación que permite vincular **una pregunta** a **múltiples exámenes**:

```sql
question_official_exams
├── id                        -- UUID
├── question_id               -- FK a questions (NULL si es psicotécnica)
├── psychometric_question_id  -- FK a psychometric_questions (NULL si es legislativa)
├── exam_date                 -- Fecha de la CONVOCATORIA (NO del examen real)
├── exam_source               -- Fuente completa del examen
├── exam_part                 -- 'primera', 'segunda', etc.
├── question_number           -- Número en ese examen específico
├── oposicion_type            -- 'auxiliar-administrativo-estado', etc.
├── is_reserve                -- Si es pregunta de reserva
└── is_annulled               -- Si fue anulada en ESE examen
```

**IMPORTANTE sobre `exam_date`:**
> El campo `exam_date` en TODAS las tablas (`questions`, `psychometric_questions`, `question_official_exams`) almacena la fecha de la **CONVOCATORIA publicada en el BOE** (ej: OEP 2020, OEP 2023), NO la fecha en que se celebra el examen físicamente. La fecha real del examen muchas veces es desconocida o variable.

### 12.3 Flujo para Preguntas Repetidas

#### Caso 1: Pregunta ya existe, aparece en nuevo examen

```javascript
// 1. Buscar la pregunta existente
const { data: existing } = await supabase
  .from('questions')
  .select('id')
  .ilike('question_text', '%texto de la pregunta%')
  .single();

// 2. Si existe, solo añadir asociación al nuevo examen
if (existing) {
  await supabase
    .from('question_official_exams')
    .insert({
      question_id: existing.id,
      exam_date: '2024-07-09',
      exam_source: 'Examen Auxiliar Administrativo Estado - OEP 2023-2024 - Primera parte',
      exam_part: 'primera',
      oposicion_type: 'auxiliar-administrativo-estado',
      is_reserve: false
    });
}
```

#### Caso 2: Pregunta nueva

```javascript
// 1. Insertar la pregunta
const { data: newQ } = await supabase
  .from('questions')
  .insert({
    question_text: '...',
    // ... todos los campos
    is_official_exam: true,
    exam_source: 'Examen Auxiliar...',  // Campo legacy, mantener por compatibilidad
    exam_date: '2024-07-09'             // Campo legacy, mantener por compatibilidad
  })
  .select('id')
  .single();

// 2. También añadir a question_official_exams
await supabase
  .from('question_official_exams')
  .insert({
    question_id: newQ.id,
    exam_date: '2024-07-09',
    exam_source: 'Examen Auxiliar Administrativo Estado - OEP 2023-2024 - Primera parte',
    exam_part: 'primera',
    oposicion_type: 'auxiliar-administrativo-estado'
  });
```

### 12.4 Consultar en Qué Exámenes Apareció una Pregunta

```javascript
const { data } = await supabase
  .from('question_official_exams')
  .select('exam_date, exam_source, oposicion_type, is_annulled')
  .eq('question_id', 'uuid-de-la-pregunta');

// Ejemplo resultado:
// [
//   { exam_date: '2021-05-26', exam_source: '...OEP 2020...', oposicion_type: 'auxiliar-administrativo-estado' },
//   { exam_date: '2024-07-09', exam_source: '...OEP 2023-2024...', oposicion_type: 'auxiliar-administrativo-estado' }
// ]
```

### 12.5 Oposiciones Disponibles

| oposicion_type | Descripción |
|----------------|-------------|
| `auxiliar-administrativo-estado` | Auxiliar Administrativo del Estado (C2) |
| `administrativo-estado` | Administrativo del Estado (C1) |
| `gestion-estado` | Gestión de la Administración Civil (A2) |
| `tramitacion-procesal` | Tramitación Procesal y Administrativa |
| `auxilio-judicial` | Auxilio Judicial |

### 12.6 Checklist para Preguntas Repetidas

- [ ] Verificar si la pregunta ya existe en `questions` o `psychometric_questions`
- [ ] Si existe: **NO duplicar**, solo añadir registro en `question_official_exams`
- [ ] Si no existe: insertar pregunta Y registro en `question_official_exams`
- [ ] Mantener campos legacy (`exam_source`, `exam_date`) en la pregunta por compatibilidad
- [ ] Especificar `oposicion_type` correcto en `question_official_exams`
- [ ] Marcar `is_annulled: true` si fue anulada en ese examen específico
