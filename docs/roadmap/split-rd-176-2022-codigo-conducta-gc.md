# Plan: resolver la colisión de numeración RD 176/2022 vs su Anexo (Código de Conducta GC)

**Estado:** ✅ **EJECUTADO 20/07/2026** — sin regresión. Ver §6.
**Descubierto:** 20/07/2026, al importar la rejilla de capítulos para cerrar `a689fe59`.
**Ley afectada:** `RD 176/2022 Código Conducta GC` (`49f4e827-3d90-484c-a584-6275bfd2a74c`), 113 preguntas.

## 1. El problema

La ley mete en **una sola numeración dos cuerpos normativos distintos**:

- La **parte dispositiva del RD** (6 artículos: Objeto, Código y decálogo, Ámbito, Enseñanza, Procesos selectivos, Deontología).
- El **Código de Conducta del anexo** (50 artículos, que es lo que realmente estudian los opositores).

Como existe `UNIQUE (law_id, article_number)`, los seis primeros números los ocupan los del RD y
**los arts. 1-6 del Código no existen en BD**: Honor, Integridad, Lealtad, **Valor**, Sentido de la justicia,
Imparcialidad y neutralidad. Los arts. 7-50 sí son los del Código (verificado contra el BOE consolidado:
art. 7 Responsabilidad, 8 Dignidad, 9 Espíritu de sacrificio, 10 Defensa de la Constitución — coinciden).

### Daño medido (en vivo)
- **9 preguntas aprobadas y VISIBLES mal ancladas**: las de *Lealtad* (Código art. 3) apuntan al art. 3 de BD,
  que contiene "Ámbito personal de aplicación" del RD; las de *Valor* (Código art. 4) al art. 4 =
  "Inclusión en la enseñanza". Quien abre la referencia ve un texto ajeno a la pregunta.
  IDs: `b08702bb`, `5facfee2`, `e5e5717a`, `f2d65189`, `19acd5e3`, `3d964dda`, `dbc45328`, `a46098aa`, `62e471d8`.
- **Art. 1 = Frankenstein**: título "Honor" (del Código) con el contenido del ANEXO Decálogo.
- 24 de las 113 preguntas cuelgan de la zona de colisión (arts. 1-6).

## 2. Decisión de diseño: renumerar DENTRO de la misma ley (NO crear ley nueva)

**Dato que lo decide:** el `topic_scope` de esta ley es **una única fila con `article_numbers = NULL`**
(= toda la ley), del tema `guardia_civil` "Deontología profesional: uso de la fuerza y…".

Por tanto:
- **Renumerar dentro de la ley es scope-safe**: al ser NULL, cualquier artículo de la ley entra en el tema.
  No hay que tocar `topic_scope` y no hay riesgo de perder cobertura.
- **Crear una ley nueva SÍ obligaría** a añadir una fila de scope, re-apuntar y arriesgar regresión de cobertura.
- Además, RD y Anexo son **una sola norma**: el Código es su anexo. Separarlos en dos "leyes" es peor modelo.

Esto lo diferencia del caso `Instituciones Internacionales GC`, donde sí había 6 normas realmente distintas.

### Numeración objetivo
- El **Código conserva la numeración canónica 1-50** (es lo que se cita en los exámenes y lo que estudian).
- La **parte dispositiva del RD pasa a `RD 1` … `RD 6`** (la columna `article_number` es `text`).
  Con el orden actual (`CASE WHEN article_number ~ '^[0-9]+$' THEN ::int ELSE 9999`) quedan al final: aceptable,
  son accesorios frente al Código.
- El **Decálogo** pasa a artículo propio `decalogo`, con su título real.

## 3. Pasos

1. **Snapshot previo** (fichero JSON): total preguntas (113), desglose por estado
   (77 approved / 26 tech_approved / 5 draft / 5 needs_human), visibles, y distribución por artículo.
   Es la referencia para verificar que no hay regresión.
2. **Liberar el rango 1-6**: renumerar BD arts. 2→`RD 2`, 3→`RD 3`, 4→`RD 4`, 5→`RD 5`, 6→`RD 6`
   (verificando antes que su `title`+`content` coinciden con la parte dispositiva del RD).
3. **Art. 1 (Frankenstein)**: mover su contenido (el Decálogo) al artículo `decalogo` con título correcto,
   e importar el **art. 1 del RD (Objeto)** como `RD 1`:
   > Este real decreto tiene por objeto aprobar el Código de Conducta del personal de la Guardia Civil,
   > cuyo texto se inserta a continuación.
4. **Importar los arts. 1-6 del Código** verbatim del BOE consolidado (BOE-A-2022-3477), con rejilla
   `title_number='I'`, `chapter_number='I'` (Cap. I Valores fundamentales): Honor, Integridad, Lealtad,
   Valor, Sentido de la justicia, Imparcialidad y neutralidad.
5. **Re-vincular las 24 preguntas** de la zona de colisión, **una a una y verificando por contenido**:
   - Sobre Honor / Integridad / Lealtad / Valor / Sentido de la justicia / Imparcialidad → nuevos arts. 1-6 del Código.
   - Sobre objeto / ámbito / enseñanza / procesos selectivos / deontología → `RD 1`…`RD 6`.
   - Sobre el Decálogo → `decalogo`.
   Guardarraíl: no se aplica un relink si el contenido del artículo destino no sustenta la pregunta.
6. **Reescribir explicaciones** de las 9 visibles mal ancladas (hoy citan el artículo equivocado).
7. **Verificación final**: mismo total (113), mismos estados (0 cambios de `lifecycle_state` como efecto
   colateral), misma cifra de visibles, `topic_scope` intacto y cobertura del tema idéntica.
8. **Invalidar caché** de `teoria`/`temario`.

## 4. Riesgos y controles

| Riesgo | Control |
|---|---|
| Perder cobertura del tema | `topic_scope` es NULL (toda la ley) → invariante; se verifica antes y después |
| Cambiar estados sin querer | El script NO toca `lifecycle_state`; se comparan los conteos por estado antes/después |
| Relink incorrecto | Cada relink exige coincidencia de contenido; si no la hay, se deja como está y se reporta |
| Colisión de `article_number` | Se libera el rango 1-6 ANTES de importar; operación en transacción |
| Ejecución parcial | Script idempotente y re-ejecutable; snapshot previo permite auditar |

## 5. Fuente

BOE-A-2022-3477, texto consolidado (PDF oficial). Estructura verificada:
Tít. I *Valores fundamentales y principios institucionales* → Cap. I *Valores fundamentales* (arts. 1-9),
Cap. II *Principios institucionales* (arts. 10-23). Tít. II *Normas de comportamiento* → Cap. I
*Normas generales* (24-32), Cap. II *Normas durante la prestación del servicio* (33-50).
La rejilla ya está aplicada a los arts. 7-50 (20/07).


## 6. Resultado de la ejecución (20/07/2026)

Ejecutado con autorización. **Cero regresión.**

### Estructura
- Parte dispositiva del RD renumerada a `RD 1`…`RD 6` (verificado antes por coincidencia de contenido).
- Art. 1 Frankenstein → artículo `decalogo`, con su título real.
- Importado `RD 1` (Objeto) y los **6 artículos del Código que faltaban**, verbatim del PDF consolidado
  BOE-A-2022-3477, con rejilla Tít. I / Cap. I: Honor, Integridad, Lealtad, Valor, Sentido de la justicia,
  Imparcialidad y neutralidad. La ley pasa de 50 a **57 artículos**.

### Preguntas
- 24 en la zona de colisión: **15 re-vinculadas**, 9 ya estaban bien (solo explicación actualizada),
  **0 fallos de guardarraíl**, 0 rotas.
- Reparto de los relinks: integridad → art. 2 (×4), lealtad → art. 3 (×5), honor → art. 1 (×2),
  valor → art. 4 (×2), sentido de la justicia → art. 5 (×1), decálogo → `decalogo` (×1).
- Las 9 que estaban **mal ancladas y visibles** ahora apuntan a contenido coherente
  (Honor→art. 1 Honor, Lealtad→art. 3 Lealtad, Valor→art. 4 Valor…).

### Verificación antirregresión
| Métrica | Antes | Después | |
|---|---|---|---|
| Preguntas totales | 113 | 113 | ✅ |
| Visibles | 103 | 103 | ✅ |
| Estados | 77 appr / 26 tech / 5 draft / 5 nh | idéntico | ✅ |
| `topic_scope` | 1 fila, `article_numbers=NULL` | idéntico | ✅ |
| Preguntas de valores del Código colgando del RD | 9 | **0** | ✅ |

Caché invalidada: `teoria` (v33), `temario` (v94), `laws` (v22) vía `/api/admin/revalidate` (bump cross-instancia).

### Pendiente menor
Las 4 preguntas en `needs_human` de esta zona quedan ahora **correctamente vinculadas y con explicación
verificada**; son candidatas a aprobación en una pasada aparte (no se tocó `lifecycle_state` en esta
operación, deliberadamente, para que la verificación antirregresión fuese limpia).
