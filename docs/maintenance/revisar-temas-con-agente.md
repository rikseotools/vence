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

### Comando básico:
```
Verifica las preguntas del tema 204 de administrativo C1
```

### Con opciones:
```
Verifica las primeras 10 preguntas del tema T12 de auxiliar C2
Verifica las preguntas pendientes del tema 204
Verifica todas las preguntas del bloque II de administrativo
```

### El agente hará:
1. Buscar las preguntas del topic
2. Para cada pregunta:
   - Leer el artículo vinculado
   - Analizar si articleOk, answerOk, explanationOk
   - Determinar el estado (perfect, bad_answer, etc.)
   - Guardar en `ai_verification_results`
   - Actualizar `questions.topic_review_status`
3. Reportar resumen

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
- ai_model: 'claude-opus-4-5' (o el modelo actual)
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

## 8. Formato de las Explicaciones

Al corregir explicaciones, seguir este formato:

### Estructura obligatoria:
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
El agente puede lanzar múltiples verificaciones en background.

**¿Qué pasa si una pregunta no tiene artículo?**
Se marca como error y se reporta. Hay que vincularla primero.

**¿Qué pasa si una pregunta hace referencia a una imagen?**
Se desactiva la pregunta (`is_active: false`) ya que sin la imagen no se puede verificar ni explicar correctamente.

**¿Los resultados son iguales que los de la web?**
Sí, se guardan en las mismas tablas con el mismo formato.
