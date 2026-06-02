# Manual: Revisar Preguntas con Agente de Claude Code

> **Nota de nomenclatura (22/05/2026):** este manual se llamaba "Revisar Temas". La unidad de revisión es la **pregunta** (cada pregunta se verifica contra su artículo); el *tema* es solo el criterio para agrupar lotes. Renombrado a "Revisar Preguntas" — fichero `revisar-preguntas-con-agente.md`.

## ⚠️ NOTA POST-LIFECYCLE (2026-05-03)

A partir de la migración lifecycle (fase A-D, ver `docs/roadmap/sistema-desactivacion-preguntas.md`), el sistema bajo el capó usa una **state machine de 8 estados** (`draft`, `needs_review`, `needs_human`, `quarantine`, `approved`, `tech_approved`, `retired_duplicate`, `retired_irreparable`). Los 12+ valores de `topic_review_status` que aparecen en este manual se mapean automáticamente:

| topic_review_status legacy | lifecycle_state |
|---|---|
| `perfect` | `approved` |
| `tech_perfect` | `tech_approved` |
| `bad_*`, `tech_bad_*`, `wrong_answer` | `needs_review` |
| `wrong_article*`, `all_wrong`, `bad_article` | `needs_human` |
| `invalid_structure`, `bad_options` | `quarantine` |
| `pending` (active) | `approved` (legacy grandfather, cron 90d) |
| `pending` (deact) | `draft` |

**Cambios operativos:**
- `is_active` ahora se sincroniza automáticamente desde `lifecycle_state` vía trigger (no se setea manualmente)
- Toda transición de estado pasa por la función SQL `transition_question_state()` que crea audit row en `question_lifecycle_history`
- El campo `deactivation_reason` (texto libre) será reemplazado en fase F por `reason_code` (taxonomía cerrada en `lib/constants/lifecycleReasons.ts`)

El flujo del agente sigue funcionando igual; los cambios son transparentes para el orquestador.

---

## Resumen

Este manual documenta cómo usar el agente de Claude Code para verificar preguntas de oposiciones. El agente analiza cada pregunta contra su artículo vinculado y determina si:
- El artículo está correctamente vinculado
- La respuesta marcada es correcta
- La explicación es correcta

**Ventaja principal:** Usa tu suscripción de Claude Code (gratis), en lugar de la API de Anthropic (de pago).

---

## ▶ Procedimiento operativo v2.1 — el flujo a seguir

> **Empieza por aquí.** Esta es la secuencia canónica para revisar preguntas. Las secciones §1-§18 son el detalle; esto es el índice de ejecución. Versión del método: **v2.1** (§17.2).
>
> **Modelo:** agentes `sonnet` (Opus cuesta 5×; Haiku falla). Lotes de ~20-50 preguntas por agente, en paralelo.

1. **Extraer** las preguntas del tema/lote → JSON en `/tmp` con enunciado + opciones + `correct_option` + artículo vinculado **completo, sin truncar** (§16.4, hallazgo 5). Script base: §4.

2. **Verificar** — N agentes Sonnet en paralelo con el prompt v2.1 del §4: identificar primero el artículo que responde literalmente, `article_ok` con **test inverso** (§3.1), `answer_ok` contra la LEY (no contra el artículo vinculado), `options_ok` (§3.2), `explanation_ok` (§8.1). Los agentes escriben resultados (JSON o INSERT en `ai_verification_results`); **no** modifican `questions`. Estampar `review_method_version` (§17).

3. **Auditar** — 2ª pasada independiente y **ciega** (otro agente, sin ver la 1ª) sobre las preguntas marcadas como defectuosas (§15.1).

4. **Adjudicar** — donde verificación y auditoría discrepen, decide Opus o un humano: la auditoría sola tuvo ~17% de falsos negativos (§18.1). No tomar el veredicto de la auditoría por defecto.

5. **Reparar** las defectuosas confirmadas — agentes Sonnet. El diagnóstico debe recoger **TODOS** los defectos (enunciado, opciones, artículo, explicación), no solo el titular (§18.3 pto 1). La cita en blockquote debe ser copia **literal** del artículo — verificar con `quoteIsLiteral` (§18.3 pto 2).

6. **Aplicar** — UPDATE de los campos editables + transición lifecycle si la pregunta estaba oculta (§11) + invalidar cache (`tag: 'questions'`).

7. **Re-verificar DESPUÉS de aplicar**, sobre la pregunta viva en BD, con agente independiente (§18.3 pto 3). Si encuentra defectos → volver al paso 5. **Iterar hasta una pasada completamente limpia** (§18.3 pto 4). El lote no se cierra hasta entonces.

**Una pregunta está perfecta cuando:** la respuesta correcta lo es de verdad + el artículo vinculado es el que regula la pregunta + las opciones dicen lo que dice la ley + la explicación es exacta y no afirma nada falso. **NO se exige cita byte-perfecta:** una condensación que dice lo mismo es válida (§3.2). Lo que se corrige es el error real (texto inventado, derogado, de otro artículo, verbo/plazo cambiado), no la coma de menos.

---

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

### Para leyes virtuales/técnicas:

> ⚠️ **ACTUALIZADO (02/06/2026): las leyes virtuales/técnicas YA TIENEN contenido y `article_ok` SÍ aplica.**
> Las leyes virtuales de ofimática/informática (`Excel 365` —27 arts—, `Word 365`, `Informática Básica`, `La Red Internet`, `Outlook 365`, `Access 365`) tienen **artículos contenedores granulares con contenido real** (13k–23k caracteres: atajos, funciones, hardware, protocolos…). Por tanto la pregunta técnica se verifica **igual que una legislativa**: hay que comprobar que el **artículo contenedor cubre literalmente** el supuesto (`article_ok`, criterio §3.1), además de `answer_ok` y `explanation_ok`.
>
> La diferencia con una ley normal es **solo el estado visible final** (`tech_approved` en vez de `approved`) y la **fuente** (Microsoft Support en español, §8.1 fuentes), NO que se salte `article_ok`.

Matriz vigente (igual que «leyes normales», pero el estado verde es `tech_*`):

| articleOk | answerOk | explanationOk | Estado |
|-----------|----------|---------------|--------|
| ✅ | ✅ | ✅ | `tech_perfect` → `tech_approved` |
| ✅ | ✅ | ❌ | `tech_bad_explanation` |
| ✅ | ❌ | ✅ | `tech_bad_answer` |
| ✅ | ❌ | ❌ | `tech_bad_answer_and_explanation` |
| ❌ | — | — | `wrong_article` (artículo contenedor no cubre el supuesto → re-mapear al artículo virtual correcto, p.ej. atajos→art.5/150, gráficos→art.190) |

**Regla de oro técnica:** una pregunta de ofimática colgada del **primer** artículo de la ley virtual (representativo) NO tiene `article_ok` — hay que mapearla al artículo que **contiene su epígrafe** (incidente import oficial SCS 02/06/2026, ver `importar-examen-oficial-completo.md` §16.3).

### 3.1 Criterio estricto para `article_ok` (post-14/04/2026)

**Regla:** `article_ok = true` **SOLO** si el artículo vinculado contiene **literalmente** el supuesto, lista o regla por la que se pregunta, de modo que permita justificar por qué cada opción A/B/C/D es correcta o incorrecta citando *ese* artículo.

**Casos en los que `article_ok` debe ser `false` aunque el artículo esté "relacionado":**
- Apunta a **Preámbulo / Exposición de Motivos** (no contiene contenido normativo resolutivo).
- Apunta a **disposición adicional, transitoria, derogatoria o final** que no resuelve el supuesto.
- Apunta a un artículo "del mismo tema" pero que no enumera el supuesto concreto preguntado (típico cuando la pregunta es sobre causas/requisitos/plazos tasados y el artículo vinculado es uno introductorio o de principios).

**Test rápido obligatorio:** *"¿Puedo justificar por qué cada opción A/B/C/D es correcta o incorrecta citando exclusivamente este artículo?"* Si la respuesta es no → `article_ok = false` y proponer `correct_article_suggestion` con el artículo que sí contiene el supuesto.

**Test inverso obligatorio (post-22/05/2026):** el test anterior es **necesario pero no suficiente**. Un artículo equivocado que comparte palabras clave con la respuesta marcada lo pasa igualmente. Añadir SIEMPRE el test inverso:

> *"¿El supuesto EXACTO que pregunta el enunciado está literalmente en este artículo? ¿La respuesta marcada es la correcta según la LEY — no según el artículo que casualmente está vinculado?"*

Si el enunciado pregunta por un derecho, regla, lista o plazo concreto y ese contenido vive en OTRO artículo, `article_ok = false` **aunque** el artículo vinculado "encaje" superficialmente con la respuesta marcada. Para poder responder a este test el agente necesita poder leer otros artículos de la ley, no solo el vinculado (ver §4, prompt actualizado). Ver incidente §16.

**Incidente que motiva la regla (14/04/2026):** la pregunta `a41b8cf6...` (Ley 1/1998 CyL, causas de supresión de municipios) tenía `primary_article_id` apuntando al Preámbulo. El agente leyó la EM, no encontró contradicción con la respuesta marcada y validó `article_ok=true, answer_ok=true, explanation_ok=true` con confianza **alta**. Resultado: la opción "Falta de candidatos" parecía la falsa, pero el art. 13.d) sí contempla "falta reiterada de candidatos" como causa de supresión — fallo detectado por una impugnación de usuaria, no por la verificación.

### 3.2 Criterio para `options_ok` — literalidad de las opciones presentadas como correctas (post-22/05/2026, calibrado con simulación)

La matriz de 8 estados (`articleOk × answerOk × explanationOk`) **no tiene ninguna dimensión para "una opción está mal redactada"**. Una pregunta con respuesta correcta, artículo correcto y explicación didáctica sale `perfect` aunque una opción esté distorsionada respecto al texto legal.

**Regla (calibrada):** comprobar la literalidad **solo de las opciones que la pregunta presenta como correctas** — NUNCA de los distractores:
- La **opción marcada como correcta**.
- En preguntas tipo **"todas las anteriores son correctas"**: además, **cada sub-opción** (A, B, C), porque la pregunta las presenta a todas como afirmaciones correctas. Compararla **token a token** con el artículo — las distorsiones sutiles (un sujeto estrechado, una preposición cambiada) se escapan "a ojo" (ver §16.4, hallazgo 4).
- Los **distractores** (opciones diseñadas para ser falsas) NO se comprueban: que no reproduzcan el texto legal es precisamente su función. Flaggear un distractor por "no estar en el artículo" genera falsos positivos.

Para esas opciones-presentadas-como-correctas, verificar que reproducen fielmente el texto legal — no una paráfrasis que cambie el sentido.

**Modos de fallo típicos (todos vistos en el incidente §16):**
- Cambiar un verbo: "garantizar" ↔ "defender", "deberá" ↔ "podrá".
- Estrechar o ampliar un sujeto: "en unos y otros" → "entre las personas responsables".
- Añadir texto que no existe en la norma: "...o desde que deviniesen ejecutivas".
- Cambiar un plazo o su anclaje: "quince días desde la adopción" → "quince días desde la iniciación".

**Por qué la calibración:** la primera versión de esta regla decía "cada opción A/B/C/D". La simulación §16.4 demostró que eso genera ~37% de falsos positivos — el agente flaggeaba distractores legítimos por no aparecer en el artículo. Un verificador que oculta preguntas buenas es peor que inútil (ver §15.8).

**Cómo reportarlo:** mientras `ai_verification_results` no tenga columna propia `options_ok` (mejora de esquema **pendiente**), si una opción-presentada-como-correcta falla, la pregunta **NO es `perfect`**: el agente la enruta a `needs_review` y detalla en el campo `explanation` del INSERT qué opción y qué palabra concreta falla. En preguntas no oficiales se corrige la opción; en oficiales NO se toca el enunciado (ver manual de impugnaciones §7.3).

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

NO te limites a comparar contra el artículo vinculado: el vínculo puede ser el equivocado.

Para CADA pregunta, en este orden:
1. IDENTIFICA por el enunciado qué artículo responde LITERALMENTE la pregunta.
   Si necesitas leer otros artículos de la ley, consúltalos en la BD con el snippet de abajo.
2. article_ok — ¿el artículo VINCULADO es ese? Aplica el test del §3.1 Y el test inverso:
   "¿el supuesto exacto del enunciado está literalmente en este artículo?"
3. answer_ok — ¿la respuesta marcada es la correcta SEGÚN LA LEY? (no según el artículo vinculado)
4. options_ok (§3.2) — comprueba la literalidad SOLO de las opciones presentadas como
   correctas: la opción marcada y, si la pregunta es tipo "todas las anteriores son
   correctas", cada sub-opción A/B/C. NO compruebes los distractores. ¿reproducen
   fielmente el texto legal, sin verbos / sujetos / plazos cambiados ni texto inventado?
5. explanation_ok (§8.1) — ¿cumple isDidactic?
6. Veredicto: FALSO_POSITIVO solo si los 4 checks pasan; si no, NECESITA_CORRECCIÓN.

Snippet para consultar cualquier artículo de una ley:
node -e "
const B='/home/manuel/Documentos/github/vence/node_modules/';
require(B+'dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const {createClient}=require(B+'@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const {data:l}=await s.from('laws').select('id').eq('short_name','Ley 39/2015').single();
  const {data}=await s.from('articles').select('article_number,title,content')
    .eq('law_id',l.id).eq('article_number','53');
  console.log(JSON.stringify(data,null,2));
})();
"

PREGUNTAS A REVISAR:
[lista de preguntas con contexto del artículo vinculado + topic_scope]

Responde con formato:
PREGUNTA [ID]: [FALSO_POSITIVO / NECESITA_CORRECCIÓN]
- article_ok / answer_ok / options_ok / explanation_ok: [✅/❌ cada uno]
- Motivo: [explicación]
- Si corrección: artículo correcto, nueva respuesta (A/B/C/D), opción a corregir, y por qué
```

### Helper canónico para cambiar estado (post-lifecycle 2026-05-03)

**OBLIGATORIO desde fase E**: cualquier mutación de visibilidad de pregunta debe ir vía función SQL `transition_question_state()`. UPDATE directo a `is_active` falla con "column 'is_active' can only be updated to DEFAULT" (es GENERATED).

```javascript
/**
 * Transiciona una pregunta a un nuevo lifecycle_state vía función SQL.
 * - Lee lifecycle_state actual para optimistic check (anti-race con verificaciones IA concurrentes)
 * - Llama a transition_question_state() (valida transiciones legales, rechaza terminales)
 * - El sync trigger actualiza is_active automáticamente desde lifecycle_state
 * - Opcionalmente actualiza campos legacy para compat (topic_review_status, verified_at, verification_status)
 *
 * Estados destino válidos:
 *   'approved'             — pregunta válida, ley normal (visible)
 *   'tech_approved'        — pregunta válida, ley técnica/virtual (visible)
 *   'needs_review'         — IA detectó problema con fix sugerido (oculta)
 *   'needs_human'          — requiere decisión humana (artículo wrong, ambiguous, etc.) (oculta)
 *   'quarantine'           — estructural roto (opciones vacías, etc.) (oculta)
 *   'retired_irreparable'  — imagen no disponible, derogada, anulada (oculta, terminal)
 *   'retired_duplicate'    — duplicada de otra mejor (oculta, terminal)
 *
 * Reason codes (taxonomía cerrada en lib/constants/lifecycleReasons.ts):
 *   'ai_verified_perfect', 'ai_verified_tech_perfect',
 *   'ai_detected_bad_explanation', 'ai_detected_bad_answer', 'ai_detected_wrong_article',
 *   'admin_marked_perfect', 'admin_marked_problem',
 *   'admin_image_unavailable', 'admin_duplicate_of', 'admin_law_derogated', 'admin_exam_annulled',
 *   'auto_fix_applied', 'structural_invalid'
 */
async function transitionQuestion(supabase, questionId, newState, reasonCode, opts = {}) {
  // 1. Leer estado actual (optimistic check anti-race)
  const { data: cur } = await supabase
    .from('questions')
    .select('lifecycle_state')
    .eq('id', questionId)
    .single();

  if (!cur) return { error: `Pregunta ${questionId} no encontrada` };
  if (cur.lifecycle_state === newState) return { skipped: 'same_state', state: newState };

  // 2. Transición vía función SQL (single source of truth, audit row en history)
  const { error } = await supabase.rpc('transition_question_state', {
    p_question_id: questionId,
    p_expected_state: cur.lifecycle_state,
    p_new_state: newState,
    p_reason_code: reasonCode,
    p_changed_by: opts.changedBy ?? null,
    p_ai_verification_id: opts.aiVerificationId ?? null,
    p_notes: opts.notes ?? null,
  });

  if (error) return { error: error.message };

  // 3. (Opcional) Actualizar campos legacy para compat
  //    NO setear is_active — el sync trigger lo deriva de lifecycle_state automáticamente
  if (opts.legacyTopicReviewStatus) {
    await supabase
      .from('questions')
      .update({
        topic_review_status: opts.legacyTopicReviewStatus,
        verified_at: new Date().toISOString(),
        verification_status: ['approved', 'tech_approved'].includes(newState) ? 'ok' : 'problem',
      })
      .eq('id', questionId);
  }

  return { success: true, from: cur.lifecycle_state, to: newState };
}
```

### Actualización masiva de resultados (post-lifecycle):
```javascript
// Falsos positivos - mover a approved (ley normal) o tech_approved (ley virtual/técnica)
for (const id of falsosPositivosIds) {
  const r = await transitionQuestion(supabase, id, 'approved', 'admin_marked_perfect', {
    legacyTopicReviewStatus: 'perfect',
    notes: 'Falso positivo — confirmado en review manual'
  });
  if (r.error) console.warn(`[${id}] ${r.error}`);
}

// Correcciones - actualizar respuesta + transicionar a approved
for (const { id, nuevoValor, nuevaExplicacion } of correcciones) {
  // 1. Update de campos editables (respuesta, explicación) — NO toca lifecycle_state ni is_active
  await supabase.from('questions')
    .update({ correct_option: nuevoValor, explanation: nuevaExplicacion })
    .eq('id', id);

  // 2. Transición de estado vía helper
  await transitionQuestion(supabase, id, 'approved', 'admin_marked_perfect', {
    legacyTopicReviewStatus: 'perfect',
    notes: `Corrección aplicada: respuesta → ${'ABCD'[nuevoValor]}`
  });
}

// Errores no corregibles automáticamente - mover a needs_human (visible solo en admin)
for (const id of errorsRequiriendoHumano) {
  await transitionQuestion(supabase, id, 'needs_human', 'admin_marked_problem', {
    legacyTopicReviewStatus: 'wrong_article',  // o el legacy code apropiado
    notes: 'Detectado por agente — requiere decisión humana'
  });
}
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

### 5.1 Trazabilidad multifase: convención de `ai_provider` (post-16/04/2026)

**Problema detectado:** la constraint única de `ai_verification_results` es `(question_id, ai_provider)`. Si haces varias rondas de verificación con el mismo `ai_provider='claude_code'`, **cada upsert sobrescribe el anterior** y pierdes la traza histórica. En BD solo queda el último.

**Convención obligatoria** cuando hagas más de un pase sobre las mismas preguntas:

| Fase | `ai_provider` | Cuándo |
|---|---|---|
| Procesamiento inicial | `claude_code` | Primera pasada (asignar artículo, elegir respuesta, escribir explicación) |
| Rechequeo independiente | `claude_code_recheck` | Segundo pase con agentes ciegos al análisis anterior |
| Auditoría final | `claude_code_audit` | Tercer pase con criterio §3.1+§8.1 estricto sobre activas perfect |

Cada fase deja su propio registro con `ai_model`, `verified_at`, `confidence` y `explanation`. Así cualquiera que consulte la BD puede ver que una pregunta pasó los 3 controles, no solo el último.

**Incidente que motiva la regla (16/04/2026):** las 354 preguntas activas de Aux. Admin. Extremadura pasaron 3 fases (procesamiento + rechequeo + auditoría), pero el upsert con `ai_provider='claude_code'` sobrescribió todos los registros. Hubo que hacer pase posterior añadiendo registros con `claude_code_recheck` y `claude_code_audit` para reconstruir la traza.

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

> **El flujo canónico vigente es el "Procedimiento operativo v2.1"** del principio del manual (extraer → verificar → auditar → adjudicar → reparar → aplicar → re-verificar → iterar). El esquema de abajo es el flujo histórico simplificado (pre-v2.1) — se mantiene solo como referencia; **no es completo** (le falta la auditoría independiente y la iteración hasta pasada limpia).

```
[HISTÓRICO pre-v2.1 — usar el Procedimiento operativo v2.1 del inicio]
1. Importar preguntas (ver importar-preguntas-scrapeadas.md)
   ↓
2. Verificar con agente
   ↓
3. Revisar en web: /admin/revision-temas/[topicId]
   ↓
4. Corregir problemas
   ↓
5. Re-verificar
```

## 8. Niveles de Calidad de las Explicaciones

Al revisar preguntas, clasificar la explicación en uno de estos niveles:

| Nivel | Descripción | Acción |
|-------|-------------|--------|
| **Correcta y didáctica** | Markdown, explica por qué cada opción es correcta/incorrecta, cita del artículo con blockquote, fuente al final | Ninguna — dejar como está |
| **Correcta pero mejorable** | Contenido correcto pero sin markdown, sin análisis por opción, sin fuente | Mejorar formato y añadir análisis por opción |
| **Copia del artículo** | Transcribe literalmente el artículo sin explicar nada didácticamente | Reescribir completa — es el error más frecuente |
| **Incorrecta** | Habla de otro tema, referencia artículo equivocado, conclusión errónea | Corregir urgente |

### 8.1 Criterio estricto para `explanation_ok` (post-11/04/2026)

**Regla:** `explanation_ok = true` **SOLO** si la explicación cumple los 4 elementos del formato didáctico. De lo contrario, marcar `explanation_ok = false` y categoría `bad_explanation` (o, si ya hay otro error, el estado compuesto correspondiente).

**Checklist automatizable (regex o función):**

```javascript
function isDidactic(explanation) {
  if (!explanation) return false;
  const hasMarkdown    = /\*\*[^*]+\*\*/.test(explanation);           // **negrita**
  const hasBlockquote  = /^>\s|\n>\s/.test(explanation);               // > cita literal
  // Acepta ambos formatos: "Por qué B es correcta" y "Por qué B) es correcta"
  const hasPorQue      = /Por qué [A-D]\)?\s+es correcta/i.test(explanation);
  const hasDemas       = /Por qué las demás son incorrectas/i.test(explanation);
  return hasMarkdown && hasBlockquote && hasPorQue && hasDemas;
}
```

Una explicación que cumpla solo el contenido pero NO el formato sigue siendo `bad_explanation`. No es suficiente que la respuesta sea correcta: el opositor necesita saber POR QUÉ, y por qué NO las demás.

**Regla dura:** Si el estado de la pregunta es `perfect` en BD pero `isDidactic()` devuelve `false`, el orquestador de verificación debe **re-marcarla como `bad_explanation`** y devolverla al flujo de reescritura. El `perfect` es aspiracional.

**Excepción — preguntas tipo "señale la INCORRECTA":** en estas preguntas el encabezado correcto de la sección final es *"Por qué las demás opciones son **correctas** en su contenido"* (semántica invertida: las otras opciones SÍ son correctas y la que se señala es la falsa). El check `hasDemas` busca el literal `"...son incorrectas"` y devolverá `false` aunque la explicación sea perfectamente didáctica. NO aplicar la "regla dura" a ciegas sobre estas: si el enunciado pide señalar la opción incorrecta/falsa, verificar a mano antes de re-marcar como `bad_explanation`. Incidente: `12b568bd` (22/05/2026), explicación correcta re-flagueada por el regex.

### 8.2 Incidente (11/04/2026 — C1 T18 ET)

Durante la verificación inicial del T18 (Estatuto de los Trabajadores), los agentes marcaron 31 de 34 preguntas como `perfect` porque `article_ok`, `answer_ok` y `explanation_ok` eran `true` según el criterio laxo (contenido correcto). Pero el 88% de esas explicaciones eran **copia literal del artículo** sin análisis por opción.

**Resultado del audit manual:**
- 30 de 34 = "copia del artículo"
- 1 = "correcta pero mejorable"
- 3 = realmente didácticas (las que el agente sí había marcado como `bad_explanation` y reescrito)

**Fix aplicado:** reescritura masiva con 2 agentes en paralelo (16 + 15 preguntas) usando el formato didáctico del §8. Tras el fix: 34/34 didácticas.

**Lección:** los agentes verificadores deben usar la función `isDidactic()` como gate estricto, no la mera "correctness" del contenido.

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

**IMPORTANTE:** Si una pregunta hace referencia a una imagen que no está disponible en el sistema, **hay que jubilarla** transicionando a `retired_irreparable` (estado terminal — la pregunta no se reactivará automáticamente, hay que crear una nueva si la imagen aparece).

### Cómo identificar preguntas con imágenes:
- Texto que menciona "la imagen", "en la figura", "observa el gráfico", etc.
- Preguntas que preguntan por posiciones de celdas específicas sin contexto
- Referencias a capturas de pantalla de Excel, Word, etc.

### Acción a tomar (post-lifecycle 2026-05-03):
```javascript
// Jubilar pregunta con imagen no disponible
// NO usar UPDATE directo a is_active — falla con "column can only be updated to DEFAULT" (es GENERATED)
await transitionQuestion(supabase, questionId, 'retired_irreparable', 'admin_image_unavailable', {
  notes: 'Pregunta referencia imagen/figura/gráfico no disponible en el sistema'
});

// Opcional: eliminar verificación IA previa (no es estrictamente necesario,
// pero limpia el dashboard de calidad)
await supabase
  .from('ai_verification_results')
  .delete()
  .eq('question_id', questionId);
```

**¿Por qué `retired_irreparable` (terminal) y no `quarantine`?**
- `quarantine` = problema estructural reparable (opciones vacías, correct_option fuera de rango, etc.)
- `retired_irreparable` = pregunta no recuperable sin la imagen original; si algún día aparece la imagen, lo correcto es **crear una pregunta nueva** vinculando a esta jubilada como referencia (FK opcional). No "resucitar" la fila.

### Razón:
Sin la imagen, no se puede:
- Verificar si la respuesta marcada es correcta
- Escribir una explicación útil para el estudiante
- Garantizar la calidad de la pregunta

## 11. Lifecycle de Preguntas (post-2026-05-03, sustituye "Desactivación Automática")

Desde la migración lifecycle (fase A-F, ver `docs/roadmap/sistema-desactivacion-preguntas.md`), la visibilidad de cada pregunta se rige por un **state machine de 8 estados** y `is_active` es una columna **GENERATED** derivada automáticamente.

### Estados y visibilidad

| `lifecycle_state` | `is_active` (derivado) | Cuándo se asigna |
|---|---|---|
| `draft` | `false` | Importada, nunca verificada (default al INSERT) |
| `needs_review` | `false` | IA detectó problema recuperable + sugiere fix |
| `needs_human` | `false` | Requiere decisión humana (artículo wrong, ambiguous) |
| `quarantine` | `false` | Estructural roto reparable (opciones vacías, etc.) |
| `approved` | `true` | Verificada perfect (ley normal) — visible a estudiantes |
| `tech_approved` | `true` | Verificada perfect (ley virtual/técnica) — visible |
| `retired_duplicate` | `false` | Duplicada de otra mejor (TERMINAL — no se reactiva) |
| `retired_irreparable` | `false` | Imagen perdida, derogada, anulada (TERMINAL) |

**Invariante por construcción**: `is_active = (lifecycle_state IN ('approved', 'tech_approved'))`. Garantizado por el motor Postgres. UPDATE directo a `is_active` falla con `"column 'is_active' can only be updated to DEFAULT"`.

### Mapeo de los 12+ legacy `topic_review_status` → 8 lifecycle states

| `topic_review_status` legacy | `lifecycle_state` | `reason_code` (admin) | `reason_code` (IA) |
|---|---|---|---|
| `perfect` | `approved` | `admin_marked_perfect` | `ai_verified_perfect` |
| `tech_perfect` | `tech_approved` | `admin_marked_perfect` | `ai_verified_tech_perfect` |
| `bad_explanation`, `bad_answer`, `bad_answer_and_explanation`, `tech_bad_*`, `wrong_answer` | `needs_review` | `admin_marked_problem` | `ai_detected_<status>` |
| `wrong_article`, `wrong_article_bad_*`, `all_wrong`, `bad_article` | `needs_human` | `admin_marked_problem` | `ai_detected_<status>` |
| `invalid_structure`, `bad_options` | `quarantine` | — | `structural_invalid` |
| `pending` (active legacy) | `approved` | (cron grandfather 90d → `draft`) | — |
| `pending` (deact) | `draft` | — | — |

### Cómo cambiar el estado (siempre vía función SQL)

```javascript
// SIEMPRE usar el helper transitionQuestion (definido en §4) o llamar
// directamente a supabase.rpc('transition_question_state', { ... }).
// NUNCA hacer UPDATE directo a is_active (falla) ni cambiar lifecycle_state
// con UPDATE (deja entrada bypass_detected en history).

await transitionQuestion(supabase, questionId, 'approved', 'admin_marked_perfect', {
  legacyTopicReviewStatus: 'perfect',  // mantener compat hasta cleanup futuro
  notes: 'Verificada por agente en review de tema X'
});
```

### Audit trail completo

Cada transición deja una fila en `question_lifecycle_history`:
- `from_state`, `to_state`, `reason_code`, `changed_at`, `changed_by`
- `ai_verification_id` (FK opcional a `ai_verification_results`)
- `notes` (texto libre)

Trigger `tg_questions_lifecycle_audit_fallback` registra cualquier UPDATE directo a `lifecycle_state` (sin pasar por la función) como `reason_code='bypass_detected'` para detección.

### Encontrar preguntas pendientes de QA

```sql
-- Preguntas en estados que requieren acción
SELECT lifecycle_state, count(*)::int AS rows
FROM questions
WHERE lifecycle_state IN ('draft', 'needs_review', 'needs_human', 'quarantine')
GROUP BY 1 ORDER BY 2 DESC;

-- Biografía completa de una pregunta
SELECT * FROM public.get_question_lifecycle_history('<question_id>'::uuid);

-- Cuántas se beneficiarían del cron grandfather (legacy approved sin verificar > 90d)
SELECT count(*) FROM questions
WHERE lifecycle_state = 'approved' AND verified_at IS NULL
  AND created_at < NOW() - interval '90 days';
```

### Panel admin Revisión Temas (legacy, sigue funcionando)

El panel admin sigue mostrando los 12+ valores de `topic_review_status` que se mantienen escribiéndose en paralelo a `lifecycle_state` durante el período transicional. Pendiente actualizarlo para mostrar también `lifecycle_state` (task #7 follow-up).

### Flujo para reparar una pregunta defectuosa

1. Corregir los campos editables: `correct_option`, `explanation`, `primary_article_id` (UPDATE directo está bien — NO son lifecycle)
2. Transicionar a `approved` o `tech_approved` vía `transitionQuestion()`
3. El sync (GENERATED) hace que `is_active` pase a `true` automáticamente
4. La pregunta vuelve a aparecer en los tests de estudiantes

### Al revisar con agentes — qué `lifecycle_state` asignar

| Decisión del agente | Estado destino | Reason code |
|---|---|---|
| Pregunta correcta (false positive, ya estaba bien) | `approved` o `tech_approved` | `admin_marked_perfect` |
| Aplicó fix de respuesta + ahora correcta | `approved` o `tech_approved` | `admin_marked_perfect` o `auto_fix_applied` |
| Aplicó fix de explicación + ahora correcta | `approved` o `tech_approved` | `admin_marked_perfect` o `auto_fix_applied` |
| Detectó error de respuesta/explicación pero no corrige | `needs_review` | `admin_marked_problem` |
| Artículo vinculado mal y no sabe el correcto | `needs_human` | `admin_marked_problem` |
| Imagen no disponible | `retired_irreparable` | `admin_image_unavailable` |
| Duplicada de otra | `retired_duplicate` | `admin_duplicate_of` (notes con FK a la otra) |
| Pregunta derogada / anulada en examen oficial | `retired_irreparable` | `admin_law_derogated` o `admin_exam_annulled` |
| Estructural roto (opciones vacías que se pueden recomponer) | `quarantine` | `structural_invalid` |

## 12. Preguntas Frecuentes

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

## 13. Ejemplo Real: Revisión del Bloque II Administrativo C1

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

---

## 14. Workflow paralelo Sonnet desde Claude Code (post-piloto 2026-05-04)

El piloto del 03-04/05/2026 validó un workflow distinto al §4: en lugar de orquestar agentes con `topic_review_status` legacy y aplicar fixes en el mismo paso, **se separa el rol del agente (verificación + INSERT) del rol del humano (apply masivo)**. Más seguro y escalable cuando se procesan miles de preguntas.

### 14.1 Selección priorizada por usuarios y verificación previa fuerte

Antes de lanzar agentes, filtrar para no malgastar cupo:

1. **Priorizar oposiciones por nº de usuarios activos**:
   ```sql
   SELECT target_oposicion, count(*) AS users
   FROM public.user_profiles
   WHERE target_oposicion IS NOT NULL
   GROUP BY target_oposicion ORDER BY users DESC
   ```
   Atacar las top primero (en Vence, top 3 = 62% de usuarios).

2. **Excluir preguntas ya verificadas con modelo fuerte** (Sonnet/Opus o human_verification_microsoft) para no duplicar:
   ```sql
   AND NOT EXISTS (
     SELECT 1 FROM public.ai_verification_results av
     WHERE av.question_id = q.id AND av.discarded = false
       AND (av.ai_model ILIKE '%sonnet%' OR av.ai_model ILIKE '%opus%'
            OR av.ai_provider = 'human_verification_microsoft')
   )
   ```

3. **Excluir lifecycle terminales** (`retired_*`) y limitar a `approved`/`tech_approved` si el objetivo es prevenir impugnaciones (las que ven los estudiantes).

### 14.2 Lanzamiento en paralelo desde Claude Code

5 agentes Sonnet paralelos × 50 preguntas = 250 verificadas en ~25 min wall-clock.

```
Agent({
  subagent_type: "general-purpose",
  model: "sonnet",            // claude-sonnet-4-6
  description: "Verif <oposicion>",
  run_in_background: true,    // paralelo
  prompt: "...metodología completa..."
})
```

**Por qué Sonnet 4.6 (no Opus, no Haiku):**
- Opus consume 5× más cupo del Max — agotaría el plan en pocos días para un catálogo grande.
- Haiku se queda corto en razonamiento legal — replica el problema actual de `gpt-4o-mini` (ver §5.1.2 manual impugnaciones).
- Sonnet 4.6 acertó en >95% en el piloto con metodología clara.

**Volumen real validado:**
- 1 lote de 50 preguntas: 18-45 min según complejidad (mediana ~30 min).
- 5 agentes en paralelo: cupo equivalente a ~5h-eq de uso por sesión Max.
- En sesiones de 2-3 h con 3-5 agentes paralelos: ~500-750 preguntas/día.

### 14.3 Workflow seguro: agente INSERTA, humano APLICA

**Regla bloqueante en el prompt del agente:**

```
NO transiciones lifecycle. Solo INSERT en ai_verification_results.
Si detectas bug, propón explanation_fix / correct_option_should_be /
correct_article_suggestion en el INSERT, pero NO modifiques `questions`
ni llames a transition_question_state.
```

**Justificación:** si Sonnet se equivoca al juzgar (false positive), no oculta preguntas correctas ni reescribe sobre el catálogo activo. El humano revisa los resultados y decide qué aplicar.

**Plantilla INSERT del agente:**
```sql
INSERT INTO public.ai_verification_results (
  question_id, article_id, ai_provider, ai_model,
  review_method_version,          -- p.ej. 'v2.0' — versión del método (§17)
  answer_ok, explanation_ok, article_ok, options_ok,
  explanation,                    -- análisis breve agente (≤300 chars)
  explanation_fix,                -- reescritura propuesta si bad_explanation
  correct_option_should_be,       -- 'A'/'B'/'C'/'D' si bad_answer
  correct_article_suggestion,     -- artículo correcto si wrong_article
  confidence                      -- 'alta'/'media'/'baja'
) VALUES (...)
```

### 14.4 Aplicar fixes a preguntas ya `approved` (caso post-piloto)

El endpoint `/api/admin/lifecycle/apply-fix-bulk` está diseñado para `needs_review → approved` (transiciona como parte del flujo). **NO sirve para preguntas que ya están `approved`** con bug menor detectado por agente — fallaría con "Same-state transition not allowed".

**Solución:** UPDATE directo + cache invalidate. Audit queda en `ai_verification_results.fix_applied=true`. Patrón Node + pg validado sobre 168 preguntas en una sola transacción:

```js
const candidates = await sql`
  SELECT av.id as av_id, av.question_id, av.explanation_fix
  FROM public.ai_verification_results av
  WHERE av.ai_provider = 'claude_code' AND av.ai_model = 'claude-sonnet-4-6'
    AND av.verified_at >= '<timestamp_lote>'
    AND av.explanation_ok = false
    AND av.confidence = 'alta'
    AND av.explanation_fix IS NOT NULL AND length(av.explanation_fix) > 100
    AND coalesce(av.fix_applied, false) = false
`;
await sql.begin(async (tx) => {
  for (const c of candidates) {
    await tx`UPDATE public.questions SET explanation = ${c.explanation_fix}, updated_at = now() WHERE id = ${c.question_id}`;
    await tx`UPDATE public.ai_verification_results SET fix_applied = true, fix_applied_at = now() WHERE id = ${c.av_id}`;
  }
});
// Invalidar cache producción una vez al final
await fetch('https://www.vence.es/api/admin/revalidate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET },
  body: JSON.stringify({ tag: 'questions' }),
});
```

**Para wrong_article** sí transicionar a `needs_human` (la pregunta deja de servirse hasta decisión humana sobre el artículo correcto):
```js
await sql`SELECT public.transition_question_state(
  ${qid}::uuid, ${currentState}::text, 'needs_human'::text,
  'ai_detected_wrong_article'::text, ${adminUuid}::uuid, ${avId}::uuid,
  ${'Sugerencia agente: ' + correct_article_suggestion}::text
)`;
```

### 14.5 Heurística cross-contamination para auditoría preventiva

Patrón detectado en preguntas TUE durante el piloto (caso Farida 14/04 a escala): explicaciones contienen bloques copiados de otra pregunta. Detectable masivamente con SQL si el bloque contaminante usa keywords distintivas:

```js
const histKeywords = ['Acta Única','Maastricht','Ámsterdam','Lisboa','Niza','codecisión'];
// Sospechosa: ≥3 keywords históricas en explicación pero ninguna en enunciado
const histInExpl = histKeywords.filter(k => expl.includes(k.toLowerCase())).length;
const histInEnq  = histKeywords.filter(k => enq.includes(k.toLowerCase())).length;
if (histInExpl >= 3 && histInEnq === 0) → sospechosa
```

Aplicado a 1.677 preguntas TUE/TFUE → 5 sospechosas (1 confirmada cross-contamination, 4 a reescritura didáctica). Generalizable a:
- CE: keywords "reforma 1992", "reforma 2011" en preguntas que no tratan de reformas.
- Leyes muy reformadas: keywords de fechas de modificación.
- Preguntas técnicas: keywords de funciones que no aparecen en el enunciado (caso EXTRAE→LARGO, CONTAR.SI→CONTARA).

### 14.6 Estadísticas del piloto (calibración)

| Métrica | Valor |
|---|---|
| Preguntas verificadas | 300 (6 lotes × 50) |
| Agentes simultáneos | 5 (5 lotes paralelos + 1 piloto previo) |
| Tiempo wall-clock | ~25 min para los 5 paralelos |
| Tiempo por lote | 18-45 min (mediana ~30 min) |
| `bad_answer` | **0 / 300** (catálogo factualmente sólido) |
| `bad_explanation` | 167 (56%) — formato no-didáctico §5.1 |
| `wrong_article` (variantes) | 26 (9%) |
| `perfect`/`tech_perfect` | 109 (36%) |
| Confianza alta | 278 (94%) |
| Errores INSERT BD | 0 |

**Lectura:** el catálogo Vence es factualmente correcto. El problema dominante es de **formato** (explicaciones cortas sin blockquote/análisis A-B-C-D), no de contenido erróneo. Esto cambia la prioridad: reescritura masiva de explicaciones es la mayor palanca de calidad percibida; cambios de respuesta correcta son raros.

### 14.7 Plan de fases del proyecto de revisión completa

Para escalar de los 300 del piloto a las 14k+ pendientes:

| Fase | Trabajo | Estimación |
|------|---------|------------|
| Piloto | 50 preguntas + análisis flow | ✅ 18 min |
| Ronda paralela | 5 lotes × 50 | ✅ 25 min |
| Top 3 oposiciones (62% usuarios) | 14.245 preguntas | ~30-40 sesiones de 3h |
| Top 8 oposiciones (90% usuarios) | ~20.000 preguntas | ~60-80 sesiones |
| Catálogo completo | ~80.000 preguntas | proyecto a 3-6 meses |

Distribuir en sesiones cortas, monitorizando el cupo del Max. La ROI del fix masivo de explicaciones se nota inmediatamente: bajada estimada de impugnaciones de 60-80% basado en patrón histórico (la mayoría de quejas son de bug real en explicación, no en respuesta).

---

## 15. Lecciones del piloto masivo 18/05/2026 (1.131 transiciones, 45% falsos positivos)

Esta sección documenta una sesión real donde el flujo §14 falló por saltarse la auditoría intermedia. Auditoría posterior detectó **45% falsos positivos en una muestra aleatoria de 200** (109 PERFECT / 91 FAIL). El problema NO fue de los agentes Sonnet — fue del orquestador humano (yo) que aplicó fixes sin segundo control.

### 15.1 El ciclo correcto es verifica → AUDITA → aplica

**Lo que NO debe hacerse** (lo que hicimos en el piloto fallido):
```
agente_procesamiento (Sonnet) INSERT en AVR
   ↓
orquestador APLICA con heurística regex débil
   ↓
cache invalidate (preguntas ya visibles a usuarios)
   ↓
auditoría a posteriori detecta 45% falsos positivos → revertir masivamente
```

**Lo que SÍ debe hacerse** (ciclo correcto post-piloto):
```
agente_procesamiento (Sonnet) INSERT en AVR con ai_provider='claude_code'
   ↓
agente_auditor INDEPENDIENTE (Sonnet) re-valida desde cero con criterio §3.1+§8.1 ESTRICTO
   INSERT en AVR con ai_provider='claude_code_audit'
   ↓
orquestador SOLO aplica las que pasan AMBAS verificaciones independientes
   ↓
cache invalidate (preguntas visibles solo tras doble validación)
```

**Coste**: duplica cupo IA (2 verificaciones por pregunta). **Beneficio**: pasa de 54% PERFECT a ~95% PERFECT esperado.

### 15.2 Función `isDidactic` como gate OBLIGATORIO

Antes de cualquier `transition_question_state` a `approved`/`tech_approved`, ejecutar **automáticamente**:

```javascript
function isDidactic(explanation) {
  if (!explanation) return false;
  const hasMarkdown   = /\*\*[^*]+\*\*/.test(explanation);
  const hasBlockquote = /^>\s|\n>\s/.test(explanation);
  const hasPorQue     = /Por qué [A-D]\)?\s+es correcta/i.test(explanation);
  const hasDemas      = /Por qué las demás son incorrectas/i.test(explanation);
  return hasMarkdown && hasBlockquote && hasPorQue && hasDemas;
}

if (!isDidactic(newExplanation)) {
  // NO transitionar — la explicación no cumple §8.1
  // Dejar en needs_review esperando reescritura
  return;
}
```

**Hallazgo del piloto**: pasada regex sobre 591 aprobadas no auditadas detectó 163 (28%) que no cumplían §8.1 — el problema dominante (147 casos) fue ausencia del encabezado literal `"Por qué las demás son incorrectas"`. Los agentes Sonnet a veces generan bullets sin el encabezado explícito. La regex lo detecta sin coste IA.

### 15.3 Check `laws.is_virtual` antes de elegir destino

La columna `laws.is_virtual` (boolean) distingue leyes jurídicas normales (`false`) de leyes virtuales/técnicas (`true` — Word 365, Access 365, Outlook, Windows, Informática Básica, Supuestos CyL Excel/Word, etc. — actualmente 159 leyes).

```javascript
const { data: art } = await sb.from('articles')
  .select('law_id, laws!inner(is_virtual)')
  .eq('id', primary_article_id).single();
const targetState = art.laws.is_virtual ? 'tech_approved' : 'approved';
```

**Incidente**: 70 preguntas técnicas (Word/Access/Outlook) transicionadas a `approved` por omitir este check. Corrección requirió 2 hops (`approved → needs_review → tech_approved`) porque `LEGAL_TRANSITIONS` no permite `approved → tech_approved` directo.

### 15.4 Bug recurrente del filtro de confidence

```javascript
// MAL — deja pasar 'baja', 'media' como si fueran altas
if (parseFloat(c) < 0.85) continue;  // parseFloat('baja') = NaN, NaN < 0.85 = false ❌

// BIEN
const isHigh = c === 'alta' || c === 'high' || (parseFloat(c) >= 0.85);
if (!isHigh) continue;
```

**Incidente**: 18 preguntas con `confidence='baja'` se aprobaron por este bug y hubo que revertirlas.

### 15.5 Re-vinculación de artículo (cambio `primary_article_id`) requiere también `explanation_fix`

Si un agente propone `correct_article_suggestion`, el orquestador NO puede aplicar el cambio sin actualizar también la `explanation`. La explicación previa cita el artículo viejo (en blockquote literal §8.1) y queda inconsistente con el artículo nuevo.

```javascript
// ❌ MAL — re-vincula sin tocar explanation
await sb.from('questions').update({
  primary_article_id: newArtId,
  updated_at: new Date().toISOString(),
}).eq('id', q.id);

// ✅ BIEN — solo aplicar si el agente también dio explanation_fix consistente
if (!v.explanation_fix || v.explanation_fix.length < 100) continue;  // skip
const explLower = v.explanation_fix.toLowerCase();
const lawLower = nuevoLaw.short_name.toLowerCase();
const artLower = nuevoArt.toLowerCase();
if (!explLower.includes(lawLower) || !explLower.includes(`art. ${artLower}`)) continue;
// Solo entonces:
await sb.from('questions').update({
  primary_article_id: newArtId,
  explanation: v.explanation_fix,
  updated_at: new Date().toISOString(),
}).eq('id', q.id);
```

**Incidente**: 289 re-vinculaciones aplicadas sin actualizar `explanation` → 226 hubo que revertir a `needs_review`.

### 15.6 Patrón sistémico: "Art X de LEY_A linkada a Art X de LEY_B"

Patrones reales detectados en el piloto, todos por coincidencia de número de artículo entre leyes distintas:

| Pregunta sobre | Vinculada (mal) a | Artículo correcto |
|---|---|---|
| RD 1451/2005 (rehabilitación funcionarios Justicia) | LOPJ (Audiencias) | Mismo número en RD 1451/2005 |
| LO 4/2015 (Seguridad Ciudadana) | CE (libertad ideológica/expresión/etc) | Mismo número en LO 4/2015 |
| Ley 50/1997 (Gobierno) | Ley 40/2015 (Régimen Jurídico AAPP) | Mismo número en Ley 50/1997 |
| Orden JUS/615/2012 (jornada) | LOPJ | Mismo número en Orden JUS |
| LOTC (TC) | CE Art.159 (composición TC) | Art. 16.3 LOTC |

**Regla**: NO re-vincular a "Art. X de OTRA_LEY" sin verificar que el contenido del artículo destino contiene LITERALMENTE las palabras clave del enunciado. El agente que sugiere debe leer el `article_content` candidato, no solo confiar en el número.

### 15.7 No confiar en `correct_article_suggestion` sin segundo control

El piloto demostró que cuando el agente de procesamiento (`claude_code`) confidence alta, igual el agente auditor (`claude_code_audit`) detecta el error en ~40% de casos. La confianza del agente de procesamiento NO basta — necesita segundo agente independiente que re-valide.

**Excepción**: cuando el patrón es claramente sistémico (todas las preguntas de "RD 1451/2005 art X" linkadas a "LOPJ art X" con análisis textual evidente), un script mecánico con detección por keyword en `article_content` ES seguro. Pero cuando el agente sugiere artículos heterogéneos por pregunta, hay que auditar.

### 15.8 Estadísticas reales del piloto fallido vs. lo que se espera

| Métrica | Piloto 18/05 sin audit intermedio | Esperado con audit intermedio |
|---|---|---|
| Tasa PERFECT en muestra aleatoria | 54.5% (109/200) | ≥95% |
| Falsos positivos en aplicación | 45% | <5% |
| Reversiones post-hoc | 249 (de 692 aplicadas) | <50 |
| Tiempo wall-clock | ~6 h | ~9-10 h (más auditoría) |
| Confianza en lo aprobado | Baja | Alta |

**Conclusión**: ahorrar el coste del agente auditor sale carísimo. Mejor 2× cupo IA con confianza, que 1× cupo IA + 40% reversiones + auditoría manual.

### 15.9 Pipeline de aplicación correcto (template)

```javascript
// Para cada pregunta candidata a aprobar:
const verifyAvr = await getLatest(sb, qid, 'claude_code');       // procesamiento
const auditAvr  = await getLatest(sb, qid, 'claude_code_audit'); // segundo control independiente

// AMBAS deben confirmar los 3 controles
if (!verifyAvr || !auditAvr) continue;  // falta alguno
if (!(verifyAvr.article_ok && verifyAvr.answer_ok && verifyAvr.explanation_ok)) continue;
if (!(auditAvr.article_ok && auditAvr.answer_ok && auditAvr.explanation_ok)) continue;
if (!isHighConf(verifyAvr.confidence) || !isHighConf(auditAvr.confidence)) continue;

// Gate regex isDidactic obligatorio
if (!isDidactic(verifyAvr.explanation_fix || q.explanation)) continue;

// Check is_virtual
const isVirtual = q.articles.laws.is_virtual === true;
const target = isVirtual ? 'tech_approved' : 'approved';

// Solo entonces aplicar fix y transition
// ...
```

---

## Verificación de Preguntas Psicotécnicas y Ortografía

Las psicotécnicas y ortografía NO tienen artículo vinculado. El flujo de verificación es diferente.

### Qué se verifica

| Check | Legislativas | Psicotécnicas | Ortografía |
|-------|-------------|---------------|------------|
| articleOk | Artículo correcto | N/A (poner `true`) | N/A (poner `true`) |
| answerOk | Respuesta según artículo | Respuesta correcta (hacer el cálculo, verificar sinónimo, etc.) | Todas las palabras incorrectas bien marcadas |
| explanationOk | Cita artículo + didáctica | Paso a paso + por qué correcta + por qué incorrectas | Explicación de cada palabra |

### Flujo

1. **Extraer preguntas** de `psychometric_questions` o `spelling_questions` con `is_active = false` y `deactivation_reason = 'Pendiente de revisión post-importación'`
2. **Guardar en /tmp** como JSON para que los agentes las lean
3. **Lanzar agentes Sonnet** en paralelo (batches de 50-300 preguntas por agente)
4. **Cada agente** devuelve `answerOk`, `questionOk`, `explanationOk` por pregunta
5. **Guardar en `ai_verification_results`** usando el campo correcto:
   - `psychometric_question_id` para psicotécnicas
   - `spelling_question_id` para ortografía
   - `ai_provider = 'claude_code'`
6. **Activar** las que pasen los 3 checks (`is_active = true`, `is_verified = true`)
7. **Desactivar** las que fallen con `deactivation_reason` específico

### Prompt para agente verificador (psicotécnicas)

```
For EACH question verify:
1. answerOk: Is correct_option (0=A,1=B,2=C,3=D) actually correct?
   - Calculations: do the math
   - Synonyms/antonyms: verify meaning
   - Sequences: verify the pattern
   - Analogies: verify the relationship
2. questionOk: Is the text clear, complete, standalone?
   No references to missing images/tables?
3. explanationOk: Does it explain the specific answer?
   Not generic filler?

Save results as JSON: [{id, answerOk, questionOk, explanationOk, issue}, ...]
```

### Checks adicionales para psicotécnicas (antes de activar)

```javascript
// Verificar ANTES de activar:
const NEEDS_VISUAL = /siguiente tabla|siguiente cuadro|CUADRO.BASE|observe la imagen/i;
const text = q.question_text || '';
const hasData = q.content_data && JSON.stringify(q.content_data) !== '{}';
const hasImage = !!q.image_url;

if (NEEDS_VISUAL.test(text) && !hasData && !hasImage) {
  // NO ACTIVAR — falta content_data o image_url
}
```

> ⚠️ **El regex `NEEDS_VISUAL` NO basta — incidente 22/05/2026.** La pregunta `e1f919e1` («¿qué porcentaje representa la cantidad de coches Nissan… respecto de BMW…?») necesita una tabla de datos, pero su texto **no contiene ninguna** de las frases del regex (la dependencia de datos es implícita). Pasó el gate, se activó, y la verificación IA la selló. Una usuaria la impugnó.
>
> **Regla correcta — no es un regex, es una prueba de resolubilidad:** una pregunta numérica/lógica está rota si **no se puede resolver con `question_text` + `content_data`**. El agente verificador DEBE intentar resolverla de verdad (hacer el cálculo paso a paso); si necesita un dato que no está → `answerOk=false`, `questionOk=false`, motivo «irresoluble: faltan datos». El regex de keywords solo sirve como pre-aviso, nunca como gate único.
>
> **Rubber-stamp masivo detectado:** la auditoría del 22/05/2026 encontró que **2.945 de 3.126** verificaciones de psicotécnicas en `ai_verification_results` tenían el veredicto literal «Verified OK» — sello en bloque sin resolver de verdad (de ahí que `e1f919e1`, irresoluble, saliera `answer_ok=true`). Una verificación válida deja constancia del cálculo/razonamiento concreto, nunca un «OK» lacónico. Si aparece «Verified OK» en masa, esa verificación no vale: hay que re-verificar resolviendo.

### Ejemplo real (Abril 2026 — InnoTest GC)

Importación de 3.027 preguntas psicotécnicas texto puro:
- 10 agentes paralelos × 300 preguntas = verificación completa en ~10 min
- Resultado: 96% OK, 12 respuesta incorrecta, 71 sin contexto visual, 51 explicación pobre
- 51 explicaciones reescritas con 3 agentes paralelos
- Re-verificación de las 51 corregidas: 47/51 OK, 4 corregidas manualmente
- 59 preguntas reconstruidas con content_data (tablas extraídas de explicaciones)
- 3.027 registros en `ai_verification_results` con `psychometric_question_id`

---

## 16. Incidente lote "Tema 7/Andalucía" (22/05/2026) — puntos ciegos del verificador

### 16.1 Cómo se detectó

5 impugnaciones de usuarios en un día. Una era falso positivo; las otras 4 (`c017d6fd`, `bd4979f5`, `174eba77`, `e27d2bd4`) tenían errores reales — y las 4 estaban `approved`/`is_active`, es decir, **habían pasado la verificación**. `c017d6fd`, `174eba77` y `e27d2bd4` tenían `ai_verification_results` de agentes Sonnet (`ai_provider='claude_code'`, `claude-sonnet-4-6`) con `answer_ok=true` y `article_ok=true`. El procedimiento de este manual, ejecutado tal cual por Sonnet, produjo "perfect" falsos.

Dos de ellas (`c017d6fd`, `174eba77`) venían del mismo lote de importación: 85 preguntas de la Ley 39/2015 (tags `["Tema 7","Andalucía"]`) importadas en bloque el 31/03/2026 11:00. Un muestreo ciego de 10 del lote encontró 2 más con el artículo mal vinculado (`0fdc2ac8` → debía ser art. 7, no art. 66; `f698ae69` → debía ser art. 73, no art. 71). Tasa de defecto estimada ~20%.

### 16.2 Los tres puntos ciegos

1. **`answer_ok` se evalúa contra el artículo vinculado, no contra la ley.** La tabla del §3 lo define como "Respuesta según artículo" y el prompt §4 decía "Lee el artículo vinculado y compara". Si el vínculo es erróneo, la comparación parte de una premisa falsa. En `c017d6fd` el Art. 13 (vinculado, erróneo) compartía la expresión "capacidad de obrar" con la opción marcada → el agente la dio por buena. El supuesto real ("información y orientación sobre requisitos de proyectos") está en el Art. 53.1.f.

2. **No había check de literalidad de los distractores.** La matriz de 8 estados no tiene dimensión para "una opción está distorsionada". `bd4979f5` (opción C: "entre las personas" en vez de "en unos y otros", art. 55.2) y `e27d2bd4` (opciones B/C con los verbos "garantizar"/"defender" intercambiados respecto al art. 8.1 CE) salieron `perfect`.

3. **El flujo §4 solo re-revisa preguntas ya marcadas con error** (`.in('topic_review_status', errorStates)`). Las 4 estaban `approved` — nunca habrían entrado en el pipeline. El catálogo aprobado no se audita salvo proyecto explícito (§14).

**Por qué el doble agente del §15 no lo hubiera evitado:** el agente auditor recibe las mismas instrucciones ("compara contra el artículo vinculado"). Dos agentes con el mismo punto ciego fallan los dos. El §15 corrige el error **aleatorio** (agente descuidado), no el **sistemático** (método con venda). Para corregir un punto ciego sistemático hay que cambiar el método, no repetirlo.

### 16.3 Las cuatro mejoras (incorporadas a §3.1, §3.2 y §4)

1. El agente debe poder consultar otros artículos de la ley (no solo el vinculado) e **identificar primero** cuál responde literalmente la pregunta — §4 prompt actualizado, con snippet de consulta a BD.
2. **Test inverso** obligatorio en `article_ok` — §3.1.
3. Nuevo check **`options_ok`** de literalidad de los 4 distractores — §3.2.
4. **Auditar también el catálogo `approved`** por muestreo, no solo los estados de error.

### 16.4 Validación: simulación A/B/C (22/05/2026)

Conjunto de prueba: 14 preguntas de la Ley 39/2015 / CE con ground truth conocido — 7 defectuosas (artículo mal vinculado, respuesta incorrecta u opción no literal) y 7 correctas, mezcladas. Verificadas en ciego por agentes Sonnet 4.6.

| Método | Defectos detectados | Falsos positivos | Accuracy |
|---|---|---|---|
| **Antiguo** (solo artículo vinculado) | 4/7 | 0/7 | 11/14 (79%) |
| **Nuevo v1** (`options_ok` = "cada opción A/B/C/D") | 6/7 | 2/7 | 11/14 (79%) |
| **Nuevo v2** (`options_ok` calibrado, §3.2) | 6/7 | 1/7 | **13/14 (93%)** |

**Hallazgos:**

1. **El método nuevo capta lo que el antiguo no puede.** El antiguo es estructuralmente ciego a opciones no literales: falló las preguntas tipo "todas las anteriores" con una sub-opción distorsionada (verbo cambiado, sujeto estrechado) y la pregunta cuya opción marcada añadía texto inexistente. El nuevo las cazó.

2. **El antiguo SÍ caza el artículo equivocado — si el agente es cuidadoso.** Con un prompt enfocado y solo 14 preguntas, el agente antiguo aplicó bien el §3.1 estricto y detectó los 3 casos de artículo mal vinculado. El fallo de producción (la pregunta `c017d6fd` quedó `approved`) fue por un agente menos riguroso, no por incapacidad del método. Conclusión: el §3.1 estricto es la pieza clave y ya existía; el problema es que no siempre se aplica con rigor — el prompt actualizado del §4 lo hace obligatorio.

3. **La primera versión de `options_ok` estaba mal calibrada.** Decir "comprueba cada opción A/B/C/D" provocó que el agente flaggeara distractores legítimos (2 falsos positivos: marcaba opciones diseñadas para ser falsas por "no estar en el artículo"). La regla calibrada del §3.2 — comprobar solo las opciones presentadas como correctas — eliminó esos falsos positivos sin perder ninguna detección.

4. **Punto débil que persiste:** la distorsión más sutil (`"en unos y otros"` → `"entre las personas responsables"` en una sub-opción de pregunta "todas correctas") se le escapó a las tres pasadas. Mitigación incorporada al §3.2: en preguntas "todas las anteriores son correctas", comparar cada sub-opción **token a token** contra el artículo, no "a ojo".

5. **La verificación necesita el artículo COMPLETO.** Una de las defectuosas (`23258acb`) se detectó solo al leer el art. 16.2 entero — con el contenido truncado pasaba por buena (de hecho, la auditoría ciega manual previa la dio por correcta por leer contenido truncado). El script de extracción (§4) NO debe truncar `articles.content`.

---

## 17. Versionado del método de revisión

El **modelo** y el **agente** que verifica una pregunta ya se registran (`ai_model`, `ai_provider`). Falta registrar la **versión del método** — el conjunto de criterios y prompt con el que se hizo esa verificación. Sin ese dato no se puede saber qué preguntas se verificaron con criterios viejos, ni medir si una versión nueva del método realmente mejora.

### 17.1 Tres ejes de trazabilidad

Cada fila de `ai_verification_results` debe poder responder a tres preguntas independientes:

| Eje | Columna | Ejemplo |
|---|---|---|
| ¿Qué LLM lo verificó? | `ai_model` | `claude-sonnet-4-6` |
| ¿En qué fase? | `ai_provider` | `claude_code` / `claude_code_recheck` / `claude_code_audit` (§5.1) |
| ¿Con qué criterios? | `review_method_version` *(columna nueva — ver §17.4)* | `v2.0` |

### 17.2 Changelog del método

La versión es un número; este changelog es su definición. Cada cambio de criterios o de prompt **bumpa la versión**.

| Versión | Fecha | Qué incorpora |
|---|---|---|
| `v1.0` | inicial | Leer artículo vinculado, comparar respuesta marcada. Checks `article_ok` / `answer_ok` / `explanation_ok`. |
| `v1.1` | 11/04/2026 | + §8.1: `explanation_ok` estricto con `isDidactic()` (markdown + blockquote + análisis A/B/C/D). |
| `v1.2` | 14/04/2026 | + §3.1: `article_ok` estricto (no vale Preámbulo / EM / disposición; test "¿puedo justificar citando este artículo?"). |
| `v2.0` | 22/05/2026 | + §3.1 test inverso; + §3.2 check `options_ok` (literalidad de las opciones presentadas como correctas); + §4 prompt: identificar primero el artículo correcto, con consulta a BD. Validado en simulación §16.4 (93% vs 79% del método previo). |
| `v2.1` | 22/05/2026 | + ciclo de reparación con re-verificación post-aplicación obligatoria e iteración hasta cero defectos; + check programático `quoteIsLiteral()` de literalidad de citas; + el reparador re-escanea la pregunta completa; + adjudicación de discrepancias verificación↔auditoría. Lecciones en §18. |

**Versión actual: `v2.1`.**

### 17.3 Convención de uso

1. Todo agente verificador recibe en su prompt **qué versión está aplicando** y la estampa en el INSERT: `review_method_version: 'v2.0'`.
2. Para **re-verificar lo hecho con criterios viejos**: `WHERE review_method_version IS NULL OR review_method_version < 'v2.0'`.
3. Para **medir una versión nueva** (p. ej. `v2.1`): tomar una muestra con ground truth conocido, verificar con la versión vigente y con la nueva, comparar accuracy — exactamente el A/B/C del §16.4, pero ahora reproducible y consultable por SQL.
4. **Convivencia de versiones:** el constraint único actual es `(question_id, ai_provider)`. Mientras no se amplíe (ver §17.4), una re-verificación con método nuevo sobre el mismo `(question_id, ai_provider)` **sobrescribe** la fila anterior. Para preservar la traza v1→v2, una campaña de re-verificación debe usar un `ai_provider` distinto (p. ej. `claude_code_v2`), igual que el §5.1 distingue las fases con sufijos.

### 17.4 Cambio de esquema

**Aplicado (22/05/2026):** las dos columnas ya existen en producción.

```sql
ALTER TABLE public.ai_verification_results
  ADD COLUMN review_method_version text,    -- versión del método (§17.2)
  ADD COLUMN options_ok boolean;            -- 4º check del §3.2
```

**Pendiente (cambio coordinado con código):** ampliar el constraint único de `(question_id, ai_provider)` a `(question_id, ai_provider, review_method_version)` para que convivan filas de distinta versión. Requiere actualizar **a la vez** `app/api/topic-review/verify/route.js`, que hace `upsert` con `onConflict: 'question_id,ai_provider'` — ese `onConflict` dejaría de resolver si se cambia el constraint sin tocar el código. Hasta entonces, usar un `ai_provider` distinto por campaña de re-verificación (§17.3 punto 4).

---

## 18. Lecciones del ciclo de reparación completo (22/05/2026)

El 22/05/2026 se ejecutó el ciclo completo **verificar → auditar → reparar → re-verificar** sobre las 18 preguntas defectuosas del lote "Tema 7/Andalucía" (§16). Convergió en 2 rondas (18/18 perfectas), pero el camino dejó lecciones que cambian el procedimiento.

### 18.1 Secuencia real y dónde falló cada capa

| Capa | Resultado | Fallo detectado |
|---|---|---|
| Verificación (4 agentes Sonnet) | 18 flagged de 79 | — |
| Auditoría ciega (1 agente) | 14 confirmadas, 4 "perfectas" | **3 de esas 4 eran defectos reales** — la auditoría tuvo ~17% de falsos negativos |
| Adjudicación (Opus) de las 4 discrepancias | 3 reconfirmadas como defecto, 1 borderline reparada | recupera los 3 que la auditoría perdió |
| Reparación (3 agentes Sonnet) | 18 reparaciones propuestas | — |
| Auditoría de reparaciones (2 agentes) | 18/18 aprobadas | **2 defectos NO detectados** (ver 18.2) |
| Re-verificación post-aplicación (1 agente) | 16/18 perfectas | caza los 2 que sobrevivieron |
| Ronda 2: reparar + re-verificar los 2 | 2/2 perfectas | convergido |

**Conclusión dura:** ninguna capa individual es suficiente, y la auditoría tampoco es infalible. Hicieron falta 2 rondas y la re-verificación *después* de aplicar para llegar a cero defectos.

### 18.2 Los 2 defectos que sobrevivieron a 4 capas

- **`c42bf977`** — el enunciado contenía texto inventado ("menos gravosa", "habrán de evitarse las coincidencias con los días y horas"…) que no figura en el art. 75.3. La verificación inicial SÍ lo mencionó de pasada, pero el diagnóstico consolidado solo recogió "corregir la opción B". El reparador arregló la opción y dejó el enunciado intacto. **Lección: el diagnóstico de reparación debe recoger TODOS los defectos que menciona la verificación, no solo el titular; y el reparador debe re-escanear la pregunta entera.**
- **`9907db36`** — el blockquote de la explicación reparada cerraba la cita con un punto donde el art. 96.6 tiene una coma y la frase continúa. Un solo carácter. Lo pasaron por alto el reparador y los DOS agentes de auditoría de reparaciones. **Lección: la verificación de literalidad de citas no puede depender solo de ojos de agente — necesita un check programático.**

### 18.3 Cambios de procedimiento (incorporados — método v2.1)

1. **Diagnóstico completo.** Al consolidar los hallazgos de verificación en un diagnóstico de reparación, incluir CADA defecto mencionado (enunciado, cada opción, artículo, explicación) — no solo el titular. El reparador, además, re-verifica la pregunta entera antes de dar la reparación por buena.
2. **Check programático de literalidad de citas — como SEÑAL de priorización, no como puerta.** Extraer las citas y compararlas con el `content` del artículo por código. Coste IA cero. Calibración (aprendida probándolo sobre 61 preguntas el 22/05/2026):
   - La primera versión (substring exacto, sensible a puntuación, sobre toda la línea `>`) marcó **42/61** — casi todo falsos positivos por comas, líneas de atribución ("— Art. X") y prefijos "**Art. X Ley:**".
   - Versión correcta: extraer solo el texto entre `«»` (la cita literal real), y comparar **secuencia de palabras ignorando TODA la puntuación** — el defecto real es cambio de palabra (verbo, plazo, sujeto), no de coma. Permitir truncamiento `[...]`.

```javascript
function quoteIsLiteral(explanation, articleContent) {
  const words = t => (t || '').toLowerCase()
    .replace(/[«»"*_]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')   // fuera TODA la puntuación
    .replace(/\s+/g, ' ').trim();
  const article = words(articleContent);
  const spans = [...explanation.matchAll(/«([^»]+)»/g)].map(m => m[1]);
  if (spans.length === 0) return true;   // sin cita «» — nada que comprobar aquí
  return spans.every(sp =>
    sp.split('[...]').map(words).filter(f => f.split(' ').length >= 4)
      .every(frag => article.includes(frag)));
}
```

   Aun la versión correcta marca **~30/61** — porque **muchas explicaciones del catálogo usan citas cuasi-literales** (condensadas, con conectores reescritos, sintetizadas). El check NO decide: marca candidatos. Un agente (o humano) juzga si la desviación es cosmética (condensar una elisión) o sustantiva (verbo/plazo cambiado que tergiversa la norma). El check es un **pre-filtro de priorización**, no un veredicto.

3. **La re-verificación es DESPUÉS de aplicar, sobre la pregunta viva.** Auditar la reparación *propuesta* (antes de aplicar) NO sustituye a verificar el resultado *aplicado*. El ciclo termina solo cuando una re-verificación independiente de la pregunta en BD devuelve cero defectos.
4. **Iterar hasta cero.** Si la re-verificación encuentra defectos, se repara y se re-verifica otra vez. Un lote no se cierra hasta una pasada limpia completa.
5. **Adjudicar las discrepancias.** Cuando verificación y auditoría discrepan sobre una pregunta, la decide un modelo más fuerte (Opus) o un humano — no se toma el veredicto de la auditoría por defecto (tuvo 17% de falsos negativos en este ciclo).

---

## 19. Gate de contenido en la promoción (palanca anti "false-perfect") — post-02/06/2026

**Incidente que motiva la regla (02/06/2026 — q `83daa594`, lote "Aula Plus - Legislación autonómica"):** pregunta de estilos de liderazgo cuya clave marcaba **C "Contratransferente"** (concepto psicoanalítico, no un estilo de liderazgo) cuando la correcta es **D "Autocrático, democrático y laissez-faire"** (Lewin). Había sido marcada `needs_human` por el admin y un agente de `phase_a_resolve` (`claude-sonnet-4-6`, 17/05) la devolvió a `tech_approved` con `reason_code='ai_verified_tech_perfect'` y `answer_ok=true`. **La propia nota del agente citaba el concepto correcto ("autocrático-democrático…") pero no comprobó que la clave apuntaba a C.** Falló por: (a) `options_ok` no se exigía, (b) `answer_ok=true` con artículo placeholder vacío (`article_ok=false`), (c) una sola pasada (phase_a) promovió, sin verify+recheck+audit. Mismo patrón que §3.2, §1454 (rubber-stamp) y §1478.

**Fix por construcción (aplicado a `transition_question_state`):** toda promoción **automática** a estado visible exige verificación completa. Inserción antes del UPDATE final:

```sql
IF p_new_state IN ('approved','tech_approved') AND p_reason_code NOT LIKE 'admin_%' THEN
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_verification_results av
    WHERE av.question_id = p_question_id
      AND av.answer_ok IS TRUE
      AND av.explanation_ok IS TRUE
      AND av.article_ok IS DISTINCT FROM FALSE   -- true o null (virtual) OK; false bloquea
      AND av.options_ok IS DISTINCT FROM FALSE   -- null OK por ahora (ver palanca 2/3)
      AND COALESCE(av.discarded, false) = false
  ) THEN
    RAISE EXCEPTION 'AI promotion blocked: question % lacks a passing verification (needs answer_ok+explanation_ok TRUE and article_ok/options_ok not FALSE)', p_question_id;
  END IF;
END IF;
```

- **`answer_ok` y `explanation_ok` deben ser TRUE; `article_ok` y `options_ok` no pueden ser FALSE** (true o null válidos). Esto caza el false-perfect (`83daa594`: tenía `explanation_ok=null` + `article_ok=false` → bloqueado) sin romper el pipeline vivo.
- **⚠️ Calibración crítica (02/06):** la 1ª versión exigía los 4 flags en TRUE, pero **el pipeline vivo `topic-review/verify` NO setea `options_ok`** (lo omite → null) y usa `article_ok=null` para leyes virtuales. Con la versión estricta, el gate bloqueaba **toda** promoción legítima de ese pipeline (la transición fallaba silenciosamente, capturada como warning). Por eso se relajó a `IS DISTINCT FROM FALSE`. Lección: un gate que mira flags que el productor no rellena rompe el flujo en silencio.
- **Sin verdad de referencia, no hay auto-perfect:** una pregunta con `article_ok=false` (artículo verificado como incorrecto/placeholder) no puede auto-aprobarse — requiere `admin_%` o re-vinculación. Las virtuales legítimas (`article_ok=null`) sí pasan.
- **Humanos siguen pudiendo forzar** con cualquier `reason_code` `admin_%`.
- **No afecta a preguntas ya aprobadas** (el gate solo dispara en transiciones nuevas).

**PALANCA 2/3 (pendiente, código del pipeline `app/api/topic-review/verify/route.js`):** para recuperar la protección plena contra el error "clave equivocada" (§3.2/§355), el pipeline debe **verificar y persistir `options_ok`** (hoy `determineReviewStatus` solo mira article/answer/explanation, no options; y el INSERT de `ai_verification_results` omite `options_ok`). Una vez el pipeline setee `options_ok=true` afirmativamente en los "perfect", **re-endurecer el gate** a `options_ok IS TRUE`. Además, separar la fase estructural (`keep_structural`/`keep_no_law_exists`) de la aprobación de contenido: un pase estructural NO debe conceder `ai_verified_tech_perfect` (debe enrutar a `needs_review` para verificación de contenido en 3 pasadas).

**Detector mecánico (palanca complementaria, coste IA cero).** Barrido programático bank-wide que rutea a `needs_human` defectos que los agentes dejan pasar. Alta precisión: opciones idénticas (`A===B` etc.), metadatos filtrados en opción/explicación (`(artículo N)` final, "Pregunta anulada", "por ."), corrupción OCR (`]`/`[` dentro de palabra, chars basura). Calibración 02/06: las heurísticas amplias (`[ABCD])` a media frase, camelCase intra-palabra) dan demasiados falsos positivos — restringir a TAB+letra y `]`/`[` intra-palabra. Resultado afinado sobre 91.678 activas: 26 `dup_options` + 46 `leaked_meta` + 17 `ocr` = 89 hits reales. Convertir en test de integración + cron (modelo `supuestoPracticoOrphans.test.ts`).

**Backsweep pendiente:** re-verificar preguntas promovidas vía `ai_verified_*` cuyo `ai_verification_results` sea `phase_a_resolve` con `article_ok=false` u `options_ok IS NULL`.
