# Build — Auxiliar Administrativo de la Universidad de Almería (C2) · tarea T-044

> Estado vivo de la construcción. La ficha corta vive en `docs/roadmap/tareas-pendientes.md` (T-044);
> aquí está el detalle operativo: fuentes, estructura y gotchas por documento.

**Convocatoria:** `BOE-A-2026-14723` (Resolución de 30/06/2026 del Rectorado) + BOJA nº132 de 10/07/2026.
21 plazas, subgrupo C2, concurso-oposición libre. **Examen: no antes del 1/09/2026** (fecha por fijar).
Ejercicio 1 = test de 50 preguntas + 2 supuestos prácticos · Ejercicio 2 = práctica informática 2h30.

## Estado (20/07)

| Fase | Estado |
|---|---|
| Temario literal (Anexo II) clonado a `topics.epigrafe` | ✅ 24 temas |
| `topic_scope` de lo ya existente en BD | ✅ 15/24 temas · **8.481 preguntas** sin generar ninguna |
| T13 Ley 14/2011 de la Ciencia importada del BOE | ✅ 6 artículos · **12 preguntas approved (lote 1)** |
| Recon de las 8 normas propias de la UAL | ✅ **12 documentos, todos localizados y accesibles** |
| Importar las normas UAL | ✅ **12 de 12** — **303 artículos UAL**; **los 24 temas tienen normativa, 0 huecos** |
| Generar banco (T13 + normas UAL + temas finos) | ⬜ pendiente |
| Publicar (`is_active=true`, `disponible=true`) | ✅ **PUBLICADA Y VIVA 20/07** — 24 temas disponibles, landing y temario verificados en producción (HTTP 200 + contenido) |

**PUBLICADA el 20/07**: los 24 temas están `disponible=true` y la oposición `is_active=true`. Verificado en producción: landing y temario responden 200 con contenido real.

## Veredicto del recon: CONSTRUIBLE

Los 12 documentos de las 8 normas propias existen, son **descargables sin login** y **todos tienen
estructura aprovechable**. No hay ningún bloqueante que obligue a replantear la oposición.

## Las 12 fuentes (verificadas leyendo el PDF, no el snippet del buscador)

| Tema | Documento | Fuente | Estructura |
|---|---|---|---|
| T11 | Bases de Ejecución Presupuestaria 2026 | `ual.es/application/files/5717/6778/0854/Bases_de_Ejecucion_Presupuesto_2026.pdf` | Títulos/Capítulos con artículos + tablas presupuestarias |
| T12 | Reglamento de concursos a cuerpos docentes | `ual.es/application/files/8217/1110/9514/Normativa_Concurso_Cuerpos_Docentes_Universitarios.pdf` | 10 arts + disposiciones (CG 21/03/2024) |
| T14 | Reglamento de provisión de puestos PTGAS | **BOJA** `juntadeandalucia.es/boja/2025/244/BOJA25-244-00021-16984-01_00330584.pdf` | 27 arts en 5 capítulos |
| T15 | Reglamento de Cartas de Servicios | `ual.es/application/files/4816/1337/4305/spec_reglamento_cartas_de_servicios_2019.pdf` | 10 arts en 4 títulos (CG 03/05/2019) |
| T18-A | Matrícula Grado y Máster 2026-27 | `ual.es/download_file/bc5839b4-6994-4362-9d8e-92518ba6b145/83587` | 38 arts |
| T18-B | Matrícula Doctorado 2026-27 | `ual.es/download_file/9b678bf5-5f44-4661-bf33-9d763c617818/83587` | 15 arts |
| T18-C | Aspectos económicos de las matrículas 2026-27 | `ual.es/download_file/3ffafecd-64be-41f7-b0c2-960c354022f8/83587` | 21 arts + anexo de tarifas |
| T19 | Normativa de permanencia | `ual.es/download_file/162840/83587` | 12 arts (CG 19/06/2025 + Consejo Social 23/06/2025) |
| T22-A | Política de Seguridad de la Información | `ual.es/download_file/51129/78527` | **15 apartados, SIN articulado** (CG 05/11/2025) |
| T22-B | Normas de uso de los sistemas de información | `ual.es/download_file/38256/78527` | **13 apartados, SIN articulado** (CG 15/07/2024) |
| T22-C | Normas de protección de datos en concurrencia competitiva | `ual.es/download_file/38253/78527` | 5 arts (CG 14/02/2023) |
| T23 | Reglamento de Administración Electrónica | `ual.es/application/files/5216/2339/8556/Reglamento_Administracion_Electronica.pdf` | 30 arts en 6 títulos (BOJA nº40 de 02/03/2021) |

## ⚠️ Gotchas a respetar al importar

1. **T22-C — URL indexada OBSOLETA.** Los buscadores devuelven
   `ual.es/application/files/7716/2339/8777/Normas_Proteccion_Datos_Concurrencia_Competitiva.pdf`,
   que es la versión de **29/10/2019**. La vigente —y la que cita la convocatoria— es la de
   **14/02/2023** en `download_file/38253/78527`. Mismo articulado (arts. 1-5), distinto texto:
   importar la mala mete contenido caducado sin que salte ningún error.

2. **T14 — hay una modificación posterior sin consolidar.** El texto base es del BOJA de 19/12/2025,
   pero existe una **Resolución de 1 de junio de 2026** (BOJA 2026/108/28) que lo modifica. Hay que
   cotejar y consolidar antes de importar. Mismo patrón que la Ley 14/2011 del T13.

3. **T18 son resoluciones ANUALES.** Las tres se sustituyen cada curso académico (las actuales son
   2026-27). El contenido **caduca todos los años** → conviene registrarlas como norma con fecha para
   que las cace el detector de leyes anuales caducadas (`lib/laws/staleDatedLaw.ts`), en vez de
   descubrirlo cuando un usuario falle una pregunta desactualizada. T19 (permanencia) **no** es anual.

4. **T22-A y T22-B no tienen articulado formal** (apartados numerados de política, no "Artículo N").
   Van como contenedor editorial con la estructura en el artículo 0, según la convención del proyecto
   para normas sin articulado.

5. **Todo son PDF**, no hay API. El BOUAL (`ual.es/secretariageneral/boual`) tiene índice HTML
   navegable por año, pero publica **boletines mensuales que agrupan muchas disposiciones**, no normas
   sueltas — no sirve para bajar una norma concreta. La página de normativas
   (`ual.es/secretariageneral/normativas`) es un **buscador que exige JavaScript** y no lista nada sin
   él. Por eso las URLs de arriba apuntan al documento directo: son las que funcionan.

## Importación (20/07) — `scripts/oposiciones/importar-normas-ual.cjs`

Importador reutilizable: descarga el PDF, extrae con `pdftotext -layout` y trocea por artículo.
**Hechas (5): T12** (10 arts) · **T15** (10) · **T19** (12) · **T22-C** (8) · **T23** (30) = **70 artículos**.

Tres defectos de parseo que el guardarraíl de "cuerpo casi vacío" obligó a arreglar, y que
cualquier importador de PDF de este tipo va a encontrarse:

1. **El ÍNDICE del PDF se troceaba como articulado.** Las líneas tipo
   `Artículo 1. Objeto .......... 3` producían artículos FANTASMA con cuerpo vacío: el Reglamento
   de Cartas de Servicios daba **20 artículos en vez de 10**, seis de ellos vacíos. Filtradas por
   los puntos de relleno, más deduplicación por número quedándose con el cuerpo más largo.
2. **Separador con DOS PUNTOS.** La Normativa de Permanencia escribe `Artículo 4: Tipo de
   matrícula de Doctorado` — y solo ese. Exigir punto se saltaba el artículo **en silencio**
   (11 de 12) sin que nada fallara.
3. **El último artículo se tragaba la cola** (disposiciones adicionales/transitorias/finales).
   Se corta al llegar a la primera disposición.

**Corrección al recon:** T22-C tiene **8 artículos, no 5**. La URL era la correcta (versión de
14/02/2023, verificada en la portada del PDF); lo que estaba mal era el recuento. Las cabeceras se
comprobaron una a una.

### Segunda tanda (20/07) — modo "apartados" y las tablas del presupuesto

**+4 documentos: T11** (104 arts) · **T22-A** (15 apartados) · **T22-B** (13). Total acumulado
**240 artículos** en 9 documentos. **7 de los 9 huecos cerrados.**

- **Modo `apartado`** añadido al importador para las normas de política (T22-A/B), que no tienen
  "Artículo N" sino apartados numerados. Solo abre apartado el número que toca (1, luego 2…),
  para que un "1." de una lista interna no parta el bloque por la mitad.
- **T11 son 104 artículos de texto normativo limpio** (2.074 chars de media), no un documento de
  tablas como parecía: **solo el art. 1** contiene las tablas presupuestarias (clasificación
  económica por capítulos), que `pdftotext` aplana. Es el defecto conocido de *tablas aplanadas*
  (`lib/teoria/detectFlattenedTable.ts`, runbook `tablas-articulos.md`). Como está **acotado a 1
  de 105**, se importó el resto y **ese artículo queda `is_verified=false`** para que entre por el
  flujo de reconstrucción con verificación humana. **No generar preguntas de cifras desde ese
  artículo** hasta reconstruir la tabla — nunca inventar importes.

### Tercera tanda (20/07) — IMPORTACIÓN COMPLETA

**+4 documentos: T18-A/B/C** (38+15+21 arts) y **T14** (27). **303 artículos UAL en total y
ningún tema sin normativa.**

- **T14 — la modificación NO obligaba a consolidar.** El texto base es del BOJA de 19/12/2025 y
  existe una Resolución de 1/06/2026 (BOJA núm. 108, disp. 28). Leído el **PDF firmado**: es un
  *"donde dice / debe decir"* que afecta **solo al apartado 1.3.1 del ANEXO I (Baremo)**; el
  **articulado (arts. 1-27) no se toca**, así que el texto base vale tal cual. Si algún día se
  importa el baremo como contenido, hay que aplicarle esa corrección.
- **Cuarto defecto de parseo — remisiones en prosa.** "…lo previsto en el **artículo 38.4** de la
  Ley Orgánica 2/2023…" casa con el patrón de cabecera y fabricaba un artículo 38 **fantasma de
  15.377 chars** que se tragaba el resto del documento. Regla añadida: una rúbrica real **nunca
  empieza por un dígito** — si lo hace, lo capturado es el decimal del apartado, no un título.
- **T18-B, falsa alarma verificada:** el cuerpo menciona dos veces "curso académico 2025-26", pero
  es la **disposición derogatoria** (deroga la resolución anterior al terminar ese curso). El
  título confirma que es la de **2026-27**. Documento correcto.

## Generación de banco — lote 1 del T13 (20/07)

Primer lote con el pipeline completo de `generar-preguntas-con-ia.md` **v2.5**, las 6 fases:
`scripts/oposiciones/gen-t13-ley14-2011-batch1.cjs`. **12 preguntas `approved` y activas**
sobre la Ley 14/2011 Sección 2.ª (T13 pasa de 0 a 12).

| Fase | Resultado |
|---|---|
| 0bis · epígrafe + `topic_scope` | El epígrafe pide exactamente "Sección 2.ª Contratación del personal investigador de carácter laboral" y el scope son los 6 artículos justos. Sin sobre ni infra-scope |
| 1-5 · generación → `draft` | 12 preguntas, 2 por artículo, correcta = cita literal |
| 6 · auto-auditoría 7 checks | 12/12 tras corregir (ver abajo) |
| 7 · auditoría **ciega** Sonnet | **12/12 PERFECT** |
| 8 · transición | 12 → `approved` con `ai_verified_perfect` + `ai_verification_results` (`claude_code`) |
| 9 · re-verificación Sonnet **nuevo** | **12/12 CLEAN, lote APTO** (`claude_code_recheck`) |

**Lo que atrapó el pipeline antes de publicar** — el *tell* de longitud (§2.2-bis) tumbó **5 de 12**:
2 al generar y **3 más en la auto-auditoría, al aplicar el umbral real del manual** (±30%, ratio ≤1,4;
yo había puesto 1,6, que colaba). Es el sesgo que hacía acertables las preguntas de IA eligiendo "la
más larga" el 71% de las veces. Reescritas con distractores construidos sobre texto legal real de
artículos **vecinos** de la misma ley: obliga a saber el artículo exacto, no el tema. El auditor ciego
lo notó por su cuenta y observó que en dos preguntas **la correcta es la más corta**.

**Fase 9 no fue una formalidad**: es la única que auditó las **explicaciones** (blockquote literal,
coherencia letra↔`correct_option`, apartados citados). Salió limpia, pero ninguna fase anterior las
había mirado.

**Rendimiento**: 12 preguntas / 6 artículos = 2 por artículo. Según la curva del manual (15→11→10→8→8→5),
un 2.º lote sobre esta misma sección rendiría menos; el techo natural de una ley monotemática está
en torno al 95%.

### Lote T19 — Normativa de permanencia (20/07) + COLISIÓN DE SESIONES

12 preguntas con el mismo pipeline de 6 fases (`gen-t19-permanencia-ual-batch1.cjs`).
Fase 6 pasó **a la primera**: los distractores ya se escribieron con el umbral correcto
(ratio ≤1,4) aplicando lo aprendido en el T13 — la lección se transfiere entre lotes.
Fase 7: 12/12 PERFECT · Fase 9: 12/12 CLEAN, APTO.

**⚠️ COLISIÓN CON OTRA SESIÓN — lección operativa.** Al terminar, el T19 tenía **24** preguntas,
no 12: **otra sesión de Claude generó en paralelo su propio lote sobre la MISMA norma** (tag `T19`,
4 minutos después del mío), también con auditoría registrada. Ambos lotes cubrían los mismos
artículos y **3 eran duplicados semánticos reales** (arts. 10, 11 y 12: mismo dato, misma respuesta,
solo reformulado; en el art. 12 la ajena cubre las dos filas de la tabla y subsume a la mía).
**Se retiraron las MÍAS** (`retired_duplicate`), no las ajenas: son iguales o mejores y no procede
privilegiar el propio trabajo ni tocar el de otra sesión.

**Resultado**: T19 con **21 preguntas activas y los 12 artículos cubiertos**.

**El alcance real de la colisión era mayor**: al comprobarlo, la otra sesión había generado banco
en **9 de las 11 normas UAL** entre las 17:05 y las 17:18 del mismo día. Solo la Normativa de
permanencia tenía solape (las otras 8 las hizo únicamente ella), pero ahí se produjeron **6
duplicados semánticos**, todos retirados como `retired_duplicate` conservando los ajenos.

**Herramienta durable**: `scripts/oposiciones/detectar-duplicados-lote.cjs`. Compara la **RESPUESTA
CORRECTA** (Jaccard) entre preguntas del mismo artículo, no el enunciado — que es la razón de que el
`WHERE question_text = …` del generador no viera nada: los enunciados diferían hasta un 68% mientras
la respuesta era idéntica. Uso: `--ley "<nombre>"` o `--like '%UAL%'`.

### 🔒 Antes de generar un lote — protocolo anti-colisión

1. `SELECT max(created_at)` de las preguntas de esa ley. **Si hay actividad de hoy, parar**: otra
   sesión está en ello.
2. Correr `detectar-duplicados-lote.cjs --ley "<norma>"` **al terminar** el lote, siempre.
3. **Anunciar la norma aquí** antes de empezar, en la tabla de abajo.
4. Regla de desempate ante duplicados de dos sesiones: **retirar el propio, conservar el ajeno**,
   salvo que uno cubra estrictamente más.

| Norma en generación | Sesión | Estado |
|---|---|---|
| _(ninguna en curso)_ | — | — |
| _(ninguna en curso — **las 12 normas UAL tienen banco**)_ | — | ✅ |

### Lote Normas de Uso de los Sistemas de Información (20/07)

12 preguntas `approved` sobre los apartados 2-7 (`gen-t22b-normas-uso-ual-batch1.cjs`). Protocolo
anti-colisión aplicado: norma comprobada a 0 preguntas, anunciada en la tabla, detector pasado al
terminar (**0 duplicados en las 119 preguntas UAL**). Fase 7: 12/12 PERFECT · Fase 9: 12/12 CLEAN.

**El guardarraíl ahora ABORTA en vez de avisar** — y esa es la diferencia con el lote anterior. Se
negó tres veces a insertar hasta que los distractores cumplieron el ±30%, dejando la BD **a cero en
vez de a medias**. En el lote del T13 el mismo check solo advertía y se coló.

**`options_ok` cazó dos correctas parafraseadas**: decían "al ámbito informático" donde la norma dice
"a nivel informático y en papel", y "promoverá además" donde dice "promover". Comparación palabra a
palabra contra el texto: una condensación fiel NO basta si se puede citar literal.

**Distractores por atribución de órgano**: varios asignan la competencia a Gerencia, Consejo de
Gobierno o ATIC en vez de a la Comisión de Seguridad. Obliga a saber *quién* hace *qué*, no solo el
tema. La fase 9 lo verificó expresamente y lo señaló como bien resuelto.

### Lote Política de Seguridad de la Información (20/07) — ÚLTIMA norma sin banco

12 preguntas `approved` (`gen-t22a-politica-seguridad-ual-batch1.cjs`). Fase 7: 12/12 PERFECT ·
Fase 9: 12/12 CLEAN. Con este lote **las 12 normas propias de la UAL tienen banco**: 131 preguntas,
**0 duplicados**.

**Diseño del lote — atribución de roles.** El núcleo examinable es *quién* es *qué*: el apartado 3
define cuatro figuras (Responsable de la Información / del Servicio / del Sistema / de la Seguridad)
y el 7 asigna los cargos (7.1 Secretario General, 7.2 miembro del Equipo de Gobierno con
competencias TIC, 7.3 Director del Área TIC). Los distractores **reutilizan descripciones
literalmente correctas del texto pero atribuidas a la figura equivocada** para esa pregunta: no se
puede acertar por descarte, hay que saber la asignación exacta. Ambos auditores lo verificaron
figura por figura y lo calificaron de distractor bien construido, no de ambigüedad.

**El guardarraíl abortó tres veces más** en este lote hasta cuadrar el ±30%.

## Siguiente paso — GENERAR BANCO (lo caro)

La estructura está completa; lo que falta es contenido:
- **✅ Banco propio UAL COMPLETO: 131 preguntas activas en las 12 normas, 0 duplicados.** Queda ampliarlo en volumen (303 artículos dan para mucho más) y atender los temas finos: T21 (9), T10 (18), T17 (23), T5 (49), T6 (52), T8 (52).
- **Temas servidos pero finos:** T21 (9), T10 (18), T17 (23), T5 (49), T6 (52), T8 (52).
- **No generar preguntas de cifras desde el art. 1 de las Bases de Ejecución** (tabla aplanada,
  `is_verified=false`) hasta reconstruir la tabla.
- Al publicar: registrar las **3 resoluciones de matrícula como anuales** para que
  `staleDatedLaw.ts` las cace cada curso.
Después, generar banco: T13 y las normas UAL parten de **0 preguntas**, y hay temas ya servidos pero
**finos** que también lo piden: T21 (9), T10 (18), T17 (23), T5 (49), T6 (52), T8 (52).


## PUBLICACIÓN (20/07) — y el defecto que destapó el gate

Al activar, el **gate de publicación rechazó el T10** porque su ley (`Ley 1/2026 LUA`) estaba en
`false_green`: `verification_status='actualizada'` con `boe_url` NULL y sin resumen. Al investigarlo
apareció algo bastante peor que un dato de metadatos:

- El epígrafe del T10 pide **solo el "Título V: Gobernanza de las Universidades Públicas"**.
- Su `topic_scope` apuntaba a la **ley entera** (`article_numbers = NULL`).
- Sus 18 preguntas eran de los arts. 1-21 y 101-108: **ninguna del Título V**.
- Y los arts. **88-100 ni siquiera estaban importados**.

O sea: **el tema servía justo lo que su epígrafe NO pide, y nada de lo que sí pide.** Llevaba así
desde que se creó y nadie lo habría visto sin intentar publicar. El gate se ganó el sueldo.

**Resuelto**: Título V importado del BOE consolidado (`BOE-A-2026-6643`, 13 artículos), scope acotado
a 88-100, banco generado (12 preguntas) y evidencia de verificación registrada — con nota explícita
de que **el resto del articulado sigue incompleto** y la ley NO debe marcarse como completa
(`deliberate_subset: true`).

### Cuatro rondas de auditoría y tres clases de *tell*

El lote del Título V necesitó **4 rondas** de auditor ciego. Ninguna encontró un error de clave,
cifra u órgano: todas fueron **sesgos de formato** que permiten acertar sin saber la ley.

| Ronda | Tell encontrado | Convertido en check |
|---|---|---|
| 1 | Correcta **más corta** que los distractores | ratio **simétrico** (antes solo miraba "más larga") |
| 2 | Los 3 distractores acaban en *"de dicho órgano"* y la correcta no | **uniformidad de sufijo** |
| 3 | Correcta con **dos cláusulas** frente a distractores de una | medición **en palabras**, no solo caracteres |
| 4 | — | 12/12 PERFECT |

**Lección de método:** el guardarraíl medía `correcta / más_corta` en caracteres, así que solo cazaba
la mitad del problema. Y **arreglar un sesgo puede crear otro**: al acortar una opción para cuadrar
el ratio le quité la coletilla que llevaban las otras tres y fabriqué el tell de la ronda 2. Por eso
el auditor ciego no es prescindible aunque el check automático esté verde.

### Datos de landing corregidos antes de publicar

`boe_reference` era un texto provisional (*"OEP 2026 aprobada, convocatorias 1er sem 2026"*) →
**BOE-A-2026-14723**, y `programa_url` estaba vacío → enlace al BOE. Sin esto la landing habría
salido con una referencia que no lleva a ninguna parte.

### Pendiente tras publicar

- **6 temas finos** (12-14 preguntas): T11, T12, T14, T15, T18, T21. No bloquean —ninguno vacío—
  pero un usuario los agota rápido. Siguiente prioridad de generación.
- **`exam_date` sigue NULL**: el BOE dice "no antes del 1/09/2026" y la fecha exacta la fija una
  resolución posterior del Rectorado. **No inventarla**; capturarla cuando se publique.
- **`inscription_deadline`** (29/07) no se ha tocado: las fuentes discrepan entre el 27/07 y el
  4/08 y el BOE fija "20 días naturales desde la publicación en BOJA". Verificar contra el BOJA
  antes de corregirlo — es dato de cara al usuario.
