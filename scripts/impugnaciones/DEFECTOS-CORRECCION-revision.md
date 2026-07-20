# Defectos de corrección — revisión a fondo (20/07)

28 sospechas verificadas por 4 auditores independientes **y revisadas una a una por mí**.
**15 resultaron infundadas** (la clave estaba bien). Motivos COMPLETOS abajo: este fichero no
remite a ningún volcado intermedio (lección del 20/07: los `out-NN.json` se perdieron por estar en .gitignore).

## Accionables

| id | resp | ley/art | clave | veredicto | evidencia | conf |
|---|---|---|---|---|---|---|
| `0323d2fd` | 36 | RDL 8/2015 art.363 | D | CONFIRMADO doble respuesta | C es literal del art. 363.2 (70%, convivientes menos uno) y D desarrolla bien el 363.3 (2,5 veces lo del ap.2). A dice 60% (falso) y B dice 2º grado y 3 veces (falso). El enunciado pide UNA correcta. | alta |
| `3541491c` | 11 | RDL 8/2015 art.214 | B | CONFIRMADO irresoluble | La escala del art.214.2 depende de los AÑOS DE DEMORA sobre la edad ordinaria; el enunciado solo da la fecha de jubilación. Ítem huérfano de un supuesto con contexto previo. | alta |
| `f1b8536a` | 5 | Funciones del TCAE art.4 | B | relink | La clave B ('forma parte de un proceso, desligado del cual carece de sentido') es la correcta según la doctrina pacífica del PAE: el diagnóstico es la 2ª etapa del Proceso de Atenc | media |
| `721025e5` | 2 | Ley 1/2000 art.569 | D | Truncado RECONSTRUIBLE | Cortado a los 120 chars exactos. Clave D («el ejecutante podrá pedir indemnización») coincide con el art.569.3. | alta |
| `ceb409bc` | 2 | Oxigenoterapia art.3 | B | relink | No hay doble clave, que era la sospecha previa. La opción B ('antiséptico y cepillo') es la única que no incorpora un error de técnica. Las tres restantes caen por un defecto propi | media |
| `ac1da0f0` | 2 | Movilizacion y posiciones art.1 | D | MATIZO — ambigua, no doble clave | La pregunta pide un valor único pero el artículo da un RANGO («Fowler alta: ~60º-90º») en el que caen A, B y C. La clave D es correcta bajo el convenio Fowler alta=90º pero su propia teoría la contradice. Alinear artículo y pregunta, NO voltear la clave. | — |
| `bf5c3dfa` | 1 | Ley 1/2000 art.704 | B | CONFIRMADO irresoluble | Enunciado cortado en «inmuebl» a los 80 chars exactos: no hay pregunta. Parte del lote LEC 21/02. | alta |
| `ee3efe27` | 1 | Ley 1/2000 art.569 | C | Truncado RECONSTRUIBLE | Cortado en «dete» a los 120 chars exactos. La clave C («oídas las partes y el MF») es la del art.569 y es la única opción que encaja. Presentación rota, clave buena. | alta |
| `15afd376` | 1 | Oxigenoterapia art.4 | C | CORRIJO AL AUDITOR — no tocar | El auditor propuso D (Cheyne-Stokes) por conocimiento médico externo, pero el artículo NO define Cheyne-Stokes en ningún punto. Sin fuente vinculada no se cambia la clave. Es hueco de teoría. | — |
| `de6dd28e` | 1 | Movilizacion y posiciones art.2 | C | relink | La clave C (90-100 cm) es la coherente con el estándar de la unidad del paciente que manejan los temarios TCAE (cama de ~90-105 cm de ancho, 190-200 de largo, ~70 de alto): A y B c | media |
| `1e373e7c` | 1 | Termoterapia y crioterapia art.2 | A | CONFIRMADO clave incorrecta → D | El propio artículo: «si la aplicación se prolonga demasiado aparece una vasodilatación refleja (hiperemia reactiva)». Luego el frío mantenido SÍ provoca A, B y C → la correcta es D («ninguna es correcta»). | alta |
| `fef5dbd2` | 1 | Eliminacion y sondajes art.6 | A | CORRIJO AL AUDITOR — no retirar | El artículo no clasifica los vómitos (solo menciona «náusea»), así que no sostiene el veredicto «retirar». Médicamente «vómitos reflejos = de origen gástrico» es la clasificación estándar → la clave A probablemente es correcta. Hueco de teoría. | — |
| `f81a7b99` | 1 | Decreto 218/2020 Manual Identidad Corporativa JA art.8 | A | CONFIRMADO doble respuesta | El artículo dice literalmente «Noto Sans HK Regular 7 pt» (A) Y «El formato principal será 250 x 300 mm, aunque los sobres podrán ser de diversos tamaños manteniendo la proporción» (B). | alta |

## Descartadas (clave correcta, 15)

- `829ecc30` (Código Civil art.1) — La sospecha es infundada. La clasificación doctrinal es pacífica y unánime en la doctrina administrativista española: fuentes REALES o MATERIALES = lo
- `82082aed` (Ley 1/2000 art.583) — La clave C reproduce LITERALMENTE el supuesto del art. 583.3 LEC, palabra por palabra. Los distractores son todos falsos frente a ese texto: (A) es fa
- `87700f9b` (Ley 1/2000 art.520) — La pregunta es de tipo «señale la incorrecta» y funciona correctamente. Mapeo de cada opción sobre el art. 517.2 LEC: (A) pólizas de contratos mercant
- `91163a99` (Orden INT/859/2023 art.5) — La clave B (CGI, Comisaría General de Información) es la correcta: la Unidad Central de Desactivación de Explosivos TEDAX-NRBQ se encuadra orgánicamen
- `d79c9b70` (LibreOffice Writer art.3) — LibreOffice NO localiza los atajos de formato de carácter como sí hace Microsoft Word español (donde cursiva es Ctrl+K): la interfaz y la ayuda en esp
- `b4585d9e` (Eliminacion y sondajes art.3) — El artículo vinculado NO da cifra para el enema de retención (solo dice 'tiempo prolongado' / 'unos minutos según el tipo'), así que la fuente en BD n
- `97e62280` (Movilizacion y posiciones art.5) — La fuente vinculada no cubre el manejo de la silla de ruedas en rampas, de modo que la pregunta no es defendible con nuestro artículo. En cuanto al fo
- `eb6b593a` (Ley 4/2015 Estatuto Víctima art.preámbulo) — La opción B reproduce fielmente el inciso 'no obstante las remisiones a normativa especial en materia de víctimas con especiales necesidades o con esp
- `86db8b12` (Ley 1/2000 art.429) — El enunciado NO está truncado (la sospecha 'enunciado roto' es un falso positivo, probablemente por su longitud): plantea el supuesto completo del art
- `283e2df4` (Orden INT/859/2023 art.9) — El artículo vinculado atribuye expresa y únicamente la acústica forense a la Unidad Central de Criminalística (opción A). La UCI (art. 9.2.b) cubre lo
- `eecb2a38` (Movilizacion y posiciones art.7) — La férula de Kramer es, por definición en la literatura de TCAE/primeros auxilios, la férula de alambre maleable en escalera que se moldea (adapta) al
- `957b8bfe` (Movilizacion y posiciones art.2) — La cama (marco o bastidor) de Stryker es el dispositivo con dos planos entre los que se «emparedaba» al paciente para voltearlo 180° en bloque (supino
- `fdaa4495` (Termoterapia y crioterapia art.4) — El artículo describe el efecto (térmico + masaje mecánico) pero no lista indicaciones, así que no permite descartar ninguna de las tres opciones. En l
- `386e99dc` (Documentacion sanitaria art.2) — Las opciones A, B y D son especies del mismo género (historia clínica de un nivel asistencial concreto) y las tres cumplirían la función descrita, por
- `97b90926` (Movilizacion y posiciones art.1) — El enunciado ('señale la verdadera') es genérico pero autosuficiente: no está truncado. B es falsa (si el paciente colabora se le pide que FLEXIONE la

## 🐛 BUG SISTÉMICO DESTAPADO: truncamiento de enunciados a ancho fijo

Los enunciados cortados no son casos sueltos: están cortados en **exactamente 80, 100 o 120
caracteres**, a mitad de palabra. Firma determinista de un import que recortó a ancho fijo.

- **110 preguntas ACTIVAS afectadas** (233 respuestas ya servidas). Muestra de 12: 12/12 cortadas a mitad de palabra.
- **103 de las 110 son de la LEC (Ley 1/2000), importadas el mismo día: 2026-02-21.** Un solo lote defectuoso.
- **El texto original NO es recuperable desde la BD** (`exam_source` vacío, no hay campo con el crudo).
  Arreglarlo exige re-scrapear la fuente o reconstruir el enunciado desde el articulado (esto último es
  AUTORÍA, no restauración → decisión humana).
- Consulta de detección:
  ```sql
  SELECT id, length(question_text), question_text FROM questions
  WHERE is_active AND length(question_text) IN (80,100,120)
    AND question_text ~ '[a-záéíóúñ ]$';
  ```
- **OJO, no todos son irresolubles.** Al revisarlos a mano: unos pocos pierden la premisa decisiva
  (irresolubles de verdad, p.ej. `bf5c3dfa`), pero la mayoría son **cosméticos** — el sentido se entiende
  y la clave aguanta (`87700f9b` solo pierde la palabra «euros»). No degradar el lote en bloque.


---

## Cierre de los 13 accionables (20/07, tras la revisión)

| Estado | Casos | Qué se hizo |
|---|---|---|
| ✅ Resuelto | **7** | `0323d2fd` y `3541491c` ocultadas (confianza alta) · `1e373e7c` clave A→D con explicación reescrita · `f81a7b99` y `ac1da0f0` ocultadas por doble respuesta · `ee3efe27` y `721025e5` con el enunciado **restaurado íntegro** desde el JSON de origen |
| 👤 Decisión humana | **6** | `15afd376`, `fef5dbd2` (el artículo NO sostiene el veredicto: son huecos de teoría, no errores de clave) · `f1b8536a`, `ceb409bc`, `de6dd28e` (relink, confianza media) · `bf5c3dfa` (ya oculta por truncamiento) |

**Criterio aplicado para decidir qué se cerraba sin consultar:** una pregunta con **dos opciones
literalmente ciertas** puntúa mal al opositor *independientemente de qué se opine*, así que reconocer
que está rota es una decisión **técnica**. Decidir **cuál debe ser la clave** sí es editorial, y NO se
tocó: las claves quedan intactas en las cinco ocultadas.

**Lo que sigue siendo tuyo:** los cambios de clave de confianza media (`15afd376`, `fef5dbd2`) y los
tres relink. Todos con su evidencia arriba.

**Nota de método:** dos de estos casos (`ee3efe27`, `721025e5`) ya se habían resuelto solos al restaurar
los 103 enunciados truncados horas antes. Conviene **re-medir el estado antes de actuar** sobre una lista
hecha hace rato: parte del trabajo puede haber caducado.
