require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.6 registro apoderamientos validez 5 años
  const exp1 = `**Articulo 6.4 de la Ley 39/2015 - Registro electronico de apoderamientos:**

> "Los poderes inscritos en el registro tendran una **validez determinada maxima de cinco anos** a contar desde la fecha de inscripcion, con la posibilidad de que **antes de la finalizacion de dicho plazo** el **poderdante** revoque o prorrogue el poder. Las prorrogas otorgadas por el poderdante al registro tendran una validez determinada maxima de **cinco anos** a contar desde la fecha de inscripcion."

**Por que B es correcta:**
La opcion B reproduce fielmente el art. 6.4 de la Ley 39/2015 en tres aspectos clave: (1) validez maxima de **5 anos** desde la inscripcion, (2) la revocacion o prorroga debe hacerse **antes** de que finalice el plazo, y (3) es el **poderdante** (quien otorga el poder) quien puede revocar o prorrogar.

**Por que las demas son incorrectas (alteran palabras clave):**

- **A)** "Una vez **finalizado** dicho plazo el poderdante revoque o prorrogue." Falso: el art. 6.4 dice "**antes** de la finalizacion", no "una vez finalizado". La revocacion o prorroga debe hacerse **antes** de que expire el plazo de 5 anos, no despues.

- **C)** "Antes de la finalizacion de dicho plazo el **apoderado** revoque o prorrogue." Falso: el art. 6.4 dice "el **poderdante**", no "el apoderado". El poderdante es quien otorga el poder (el representado); el apoderado es quien lo recibe (el representante). Solo el poderdante puede revocar o prorrogar su propio poder.

- **D)** "Cinco anos a contar desde el **dia siguiente** a la fecha de inscripcion." Falso e incompleto: (1) el art. 6.4 dice "desde la fecha de inscripcion", no "desde el dia siguiente"; (2) omite toda la regulacion sobre revocacion y prorroga.

**Trampas en el art. 6.4 Ley 39/2015:**

| Elemento | Texto correcto | Trampas |
|----------|---------------|---------|
| Validez maxima | **5 anos** | - |
| Desde | **Fecha de inscripcion** | "Dia siguiente" (incorrecto) |
| Revocacion/prorroga | **Antes** de finalizar | "Una vez finalizado" (incorrecto) |
| Quien revoca/prorroga | **Poderdante** | "Apoderado" (incorrecto) |

**Clave:** 5 anos desde inscripcion + revocacion/prorroga ANTES de finalizar + solo el PODERDANTE puede revocar. Las opciones cambian "antes" por "despues", o "poderdante" por "apoderado".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "cd202662-a75a-4c64-9b20-147c1c797453");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.6 apoderamientos 5 anos (" + exp1.length + " chars)");

  // #2 - Word encabezado distinto segunda página (salto de sección)
  const exp2 = `**Microsoft Word - Encabezado diferente en la segunda pagina:**

> Para tener encabezados distintos en diferentes paginas de un documento Word, es necesario crear **secciones** separadas mediante un **salto de seccion "Pagina siguiente"**, y luego **desvincular** el encabezado de la nueva seccion.

**Por que D es correcta (salto de seccion + desvincular):**
El procedimiento correcto tiene 3 pasos:
1. **Cursor al final de la primera pagina** e insertar un **salto de seccion "Pagina siguiente"** desde Disposicion > Saltos > Pagina siguiente.
2. **Doble clic en el encabezado** de la nueva seccion para editarlo.
3. **Desactivar "Vincular al anterior"** en la cinta de opciones para desvincular el encabezado de la seccion anterior.

La clave es que se necesita un **salto de seccion** (no un salto de pagina simple) para poder tener encabezados independientes.

**Por que las demas son incorrectas:**

- **A)** Dice "Insertar > **Salto de pagina**" y coloca el cursor "al principio de la segunda pagina". Falso por dos motivos: (1) un **salto de pagina** simple no crea una nueva seccion, por lo que no permite encabezados diferentes; se necesita un **salto de seccion**; (2) el cursor debe colocarse al **final** de la primera pagina, no al principio de la segunda.

- **B)** Dice "Insertar > **Salto de encabezado**" y coloca el cursor "al principio de la segunda pagina". Falso: (1) no existe la opcion "Salto de encabezado" en Word; (2) el cursor debe colocarse al final de la primera pagina.

- **C)** Dice "Insertar > **Salto de pagina**" con cursor al final de la primera pagina. Falso: aunque el cursor esta bien colocado, un salto de pagina simple **no permite** tener encabezados diferentes. Se necesita un **salto de seccion** (Disposicion > Saltos > Pagina siguiente), no un salto de pagina.

**Diferencia entre salto de pagina y salto de seccion:**

| Tipo | Donde se inserta | Encabezados diferentes |
|------|-----------------|----------------------|
| Salto de **pagina** | Insertar > Salto de pagina | **No** |
| Salto de **seccion** | Disposicion > Saltos > Pagina siguiente | **Si** (desvinculando) |

**Clave:** Para encabezados diferentes se necesita un salto de SECCION (no de pagina). Ruta: Disposicion > Saltos > Pagina siguiente. Luego desvincular con "Vincular al anterior".`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "eae51e3f-7fef-4096-a005-773ab506a657");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Word encabezado seccion (" + exp2.length + " chars)");

  // #3 - Word 365 atajo Ctrl+Alt+1 Título 1
  const exp3 = `**Microsoft Word 365 - Atajos de teclado para estilos de titulo:**

> El atajo **Ctrl + Alt + 1** aplica el estilo "Titulo 1" en Word 365. De forma similar, **Ctrl + Alt + 2** aplica "Titulo 2" y **Ctrl + Alt + 3** aplica "Titulo 3".

**Por que B es correcta (Ctrl + Alt + 1):**
En Word 365, los estilos de titulo tienen atajos predeterminados que combinan **Ctrl + Alt + numero**. Para aplicar el estilo "Titulo 1" a un texto seleccionado, se pulsa **Ctrl + Alt + 1**. Es una combinacion de tres teclas.

**Por que las demas son incorrectas (atajos diferentes o inexistentes):**

- **A)** "**Alt + 1**." Falso: Alt + 1 no esta asignado a ningun estilo de titulo en Word 365. Falta la tecla **Ctrl** en la combinacion.

- **C)** "**Ctrl + 1**." Falso: Ctrl + 1 aplica **interlineado sencillo** (espacio entre lineas simple), no el estilo Titulo 1. Es un atajo de formato de parrafo, no de estilo. Comparar: Ctrl + 2 = interlineado doble, Ctrl + 5 = interlineado 1,5.

- **D)** "**Ctrl + Mayusculas + 1**." Falso: Ctrl + Mayusculas + 1 no es el atajo correcto para Titulo 1 en Word 365. La tecla correcta es **Alt**, no Mayusculas.

**Atajos de estilos de titulo en Word 365:**

| Estilo | Atajo |
|--------|-------|
| **Titulo 1** | **Ctrl + Alt + 1** |
| Titulo 2 | Ctrl + Alt + 2 |
| Titulo 3 | Ctrl + Alt + 3 |
| Normal | Ctrl + Mayusculas + N |

**Atajos con Ctrl + numero (NO son estilos):**

| Atajo | Funcion |
|-------|---------|
| Ctrl + 1 | Interlineado **sencillo** |
| Ctrl + 2 | Interlineado **doble** |
| Ctrl + 5 | Interlineado **1,5** |

**Clave:** Estilos de titulo = Ctrl + Alt + numero. Interlineado = Ctrl + numero (sin Alt). No confundir ambas familias de atajos.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "b0c9b600-d448-41ec-acbd-27305714b3fb");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Word 365 Ctrl+Alt+1 Titulo 1 (" + exp3.length + " chars)");
})();
