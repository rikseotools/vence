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
| Publicar (`is_active=true`, `disponible=true`) | ⬜ pendiente |

Los temas están `disponible=false` y la oposición `is_active=false`: **nada visible en web**.

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

## Siguiente paso — GENERAR BANCO (lo caro)

La estructura está completa; lo que falta es contenido:
- **Las 12 normas UAL siguen a 0 preguntas** (303 artículos). La Ley 14/2011 ya tiene 12 (lote 1).
- **Temas servidos pero finos:** T21 (9), T10 (18), T17 (23), T5 (49), T6 (52), T8 (52).
- **No generar preguntas de cifras desde el art. 1 de las Bases de Ejecución** (tabla aplanada,
  `is_verified=false`) hasta reconstruir la tabla.
- Al publicar: registrar las **3 resoluciones de matrícula como anuales** para que
  `staleDatedLaw.ts` las cace cada curso.
Después, generar banco: T13 y las normas UAL parten de **0 preguntas**, y hay temas ya servidos pero
**finos** que también lo piden: T21 (9), T10 (18), T17 (23), T5 (49), T6 (52), T8 (52).
