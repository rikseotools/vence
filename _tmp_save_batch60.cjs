require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 personalidad juridica unica (variante)
  const exp1 = `**Articulo 3.4 de la Ley 40/2015 (LRJSP):**

> "Cada una de las Administraciones Publicas del articulo 2 actua para el cumplimiento de sus fines con personalidad juridica **unica**."

**Por que B es correcta (unica):**
Cada Administracion Publica (AGE, CCAA, CCLL) actua como un **unico sujeto de derecho**. Los organos que la componen (Ministerios, Direcciones Generales, etc.) no tienen personalidad juridica propia ni separada: todos actuan bajo la personalidad unica de su Administracion.

**Por que las demas son incorrectas:**

- **A)** "Plena, para cada organo". Falso: los organos NO tienen personalidad juridica propia, ni plena ni de ningun tipo. Solo la Administracion en su conjunto la tiene, y es "unica", no "plena".

- **C)** "Solidaria". Falso: la solidaridad es un concepto de Derecho de obligaciones, no de personalidad juridica. No aparece en el art. 3.4.

- **D)** "Propia, para cada organo". Falso: cada organo NO tiene personalidad propia. Precisamente el concepto de personalidad "unica" significa que todos los organos comparten la misma personalidad juridica de la Administracion.

**Clave:** Personalidad juridica **unica** = toda la Administracion es un solo sujeto de derecho. Los organos NO tienen personalidad propia.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "5c746589-adf3-4aac-8337-e4dc84974fab");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 personalidad v2 (" + exp1.length + " chars)");

  // #2 - CE art.120 Poder Judicial actuaciones publicas oral sentencias
  const exp2 = `**Articulo 120 de la Constitucion Espanola** (Actuaciones judiciales):

> "1. Las actuaciones judiciales seran **publicas** [...]
> 2. El procedimiento sera predominantemente **oral**, sobre todo en materia criminal.
> 3. Las sentencias seran siempre **motivadas** y se pronunciaran en **audiencia publica**."

**Por que D es correcta:**
El art. 120.3 CE dice literalmente que las sentencias "se pronunciaran en **audiencia publica**". La publicidad de las sentencias es un principio constitucional sin excepciones.

**Por que las demas son incorrectas (cada una cambia una palabra clave):**

| Opcion | Dice | Art. 120 dice | Error |
|--------|------|---------------|-------|
| A | Actuaciones **privadas** | Actuaciones **publicas** | Invierte publico/privado |
| B | Procedimiento **escrito** | Procedimiento **oral** | Invierte escrito/oral |
| C | Principio de **jerarquia** | No mencionado | Concepto inventado |
| **D** | Sentencias en **audiencia publica** | Audiencia publica | **Correcta** |

- **A)** Cambia "publicas" por "**privadas**". Art. 120.1 dice "seran **publicas**, con las excepciones que prevean las leyes de procedimiento". La regla es publicidad, no privacidad.

- **B)** Cambia "oral" por "**escrito**". Art. 120.2 dice "predominantemente **oral**", no escrito. La oralidad es especialmente importante en materia criminal.

- **C)** "Principio de jerarquia es la base". Falso: el art. 120 no habla de jerarquia. El principio organizativo del Poder Judicial es la **unidad jurisdiccional** (art. 117.5 CE), no la jerarquia.

**Clave para el art. 120:** actuaciones **publicas**, procedimiento **oral**, sentencias **motivadas** y en **audiencia publica**.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e085e634-6d80-4020-80a6-4fe635409fdd");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.120 actuaciones (" + exp2.length + " chars)");
})();
