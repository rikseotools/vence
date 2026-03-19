require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.125 recurso extraordinario de revisión documentos posteriores
  const exp1 = `**Articulo 125.1 de la Ley 39/2015 (LPAC) - Recurso extraordinario de revision:**

> Art. 125.1: "Contra los actos **firmes** en via administrativa podra interponerse el recurso extraordinario de revision [...] cuando concurra alguna de las circunstancias siguientes:
> a) Que al dictarlos se hubiera incurrido en **error de hecho**, que resulte de los propios documentos incorporados al expediente.
> **b) Que aparezcan documentos de valor esencial** para la resolucion del asunto que, **aunque sean posteriores**, evidencien el error de la resolucion recurrida.
> c) Que en la resolucion hayan influido **esencialmente** documentos o testimonios declarados falsos por **sentencia judicial** firme, anterior o posterior a aquella resolucion.
> d) Que la resolucion se hubiese dictado como consecuencia de prevaricacion, cohecho, violencia, maquinacion fraudulenta u otra conducta punible y se haya declarado asi en virtud de sentencia judicial firme."

**Por que D es correcta (documentos posteriores que evidencien error):**
La opcion D reproduce la letra b) del art. 125.1: documentos de **valor esencial** que, aunque sean posteriores a la resolucion, demuestren que hubo un error. Es una de las cuatro causas tasadas del recurso extraordinario de revision.

**Por que las demas son incorrectas (alteran los terminos del articulo):**

- **A)** "Error de hecho **o de derecho** [...] documentos incorporados **unicamente con posterioridad** a la incoacion." Falso por dos errores: (1) el art. 125.1.a) solo habla de error de **hecho**, no de derecho; (2) los documentos deben estar "incorporados al expediente", no "unicamente con posterioridad". Anadir "de derecho" y "unicamente con posterioridad" altera el sentido.

- **B)** "Hayan influido **parcialmente** documentos [...] declarados falsos por **auto** judicial." Falso por dos errores: (1) el art. 125.1.c) dice "influido **esencialmente**", no "parcialmente" (la influencia debe ser esencial); (2) dice "**sentencia** judicial firme", no "auto". Un auto no es una sentencia.

- **C)** "Omision del **procedimiento** legalmente establecido." Falso: la omision del procedimiento no es causa del recurso extraordinario de revision. La prescindencia total del procedimiento es causa de **nulidad de pleno derecho** (art. 47.1.e), no del recurso extraordinario de revision. Son vias distintas.

**Causas del recurso extraordinario de revision (art. 125.1):**

| Letra | Causa | Plazo |
|-------|-------|-------|
| a) | Error de **hecho** en documentos del expediente | 4 anos |
| b) | **Documentos** esenciales posteriores | 3 meses |
| c) | Documentos/testimonios falsos (**sentencia**) | 3 meses |
| d) | Prevaricacion, cohecho, etc. (sentencia) | 3 meses |

**Clave:** Las causas estan tasadas y no admiten analogia. No confundir "hecho" con "derecho", "esencialmente" con "parcialmente", ni "sentencia" con "auto".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "4222ecd7-616d-4f28-a47e-294294f70707");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.125 revision extraordinaria (" + exp1.length + " chars)");
})();
