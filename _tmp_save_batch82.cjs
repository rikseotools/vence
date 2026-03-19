require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Orden HFP/134/2018 art.4.5 grupos de trabajo del Foro
  const exp1 = `**Articulo 4.5 de la Orden HFP/134/2018** (Grupos de trabajo del Foro de Gobierno Abierto):

> "Los grupos de trabajo tendran como objetivo la **realizacion de estudios** y, en su caso, la **formulacion de propuestas a la Comision Permanente**, que permitan una agil y eficaz respuesta a las cuestiones planteadas."

**Por que C es correcta:**
Los grupos de trabajo tienen una funcion **tecnica y propositiva**: realizan estudios y formulan propuestas. Pero no a cualquier organo, sino a la **Comision Permanente** (no al Pleno directamente). Son organos de trabajo especializado que alimentan las decisiones de la Comision Permanente.

**Por que las demas son incorrectas (describen funciones de otros organos):**

- **A)** "Coordinar los trabajos y velar por el cumplimiento de acuerdos del Pleno, asi como las delegadas por este". Falso: estas son funciones de la **Comision Permanente** (art. 4.3), no de los grupos de trabajo. La Comision Permanente es la que coordina y ejecuta los acuerdos del Pleno.

- **B)** "Elevar propuestas al Pleno". Falso: los grupos de trabajo no elevan propuestas al **Pleno** directamente, sino a la **Comision Permanente**. Es la Comision Permanente la que eleva propuestas al Pleno.

- **D)** "Actuar como organo ejecutivo del Foro e impulsar sus funciones". Falso: el "organo ejecutivo" es la **Comision Permanente**, no los grupos de trabajo. Los grupos de trabajo tienen funcion de estudio y propuesta, no de ejecucion ni impulso general.

**Estructura del Foro de Gobierno Abierto:**

| Organo | Funcion principal |
|--------|------------------|
| **Pleno** | Maximo organo de decision |
| **Comision Permanente** | Organo ejecutivo, coordina y eleva propuestas al Pleno |
| **Grupos de trabajo** | Estudios y propuestas a la **Comision Permanente** |

**Clave:** Grupos de trabajo = estudios + propuestas a la **Comision Permanente** (no al Pleno). No son el organo ejecutivo.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "3c02c6fc-f887-4d4b-9f3f-4c24410d7ab2");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Foro grupos trabajo (" + exp1.length + " chars)");
})();
