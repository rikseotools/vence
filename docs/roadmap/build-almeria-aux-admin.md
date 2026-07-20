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
| T13 Ley 14/2011 de la Ciencia importada del BOE | ✅ 6 artículos (falta banco) |
| Recon de las 8 normas propias de la UAL | ✅ **12 documentos, todos localizados y accesibles** |
| Importar las normas UAL | 🟡 **5 de 12 importadas** (T12, T15, T19, T22-C, T23 = 70 artículos) |
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

## Siguiente paso

Quedan **4 documentos** por importar, los tres más laboriosos:
- **T11** Bases de Ejecución Presupuestaria — mezcla articulado con tablas presupuestarias.
- **T14** Provisión PTGAS — hay que **consolidar** antes la modificación de junio 2026.
- **T18** las tres resoluciones de matrícula (38 + 15 + 21 arts), **anuales**.
- **T22-A y T22-B** — sin articulado formal: van como contenedor editorial con la estructura en
  el artículo 0, no con el troceador de "Artículo N".
Después, generar banco: T13 y las normas UAL parten de **0 preguntas**, y hay temas ya servidos pero
**finos** que también lo piden: T21 (9), T10 (18), T17 (23), T5 (49), T6 (52), T8 (52).
