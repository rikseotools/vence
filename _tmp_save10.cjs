require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 30 de la Ley 15/2022** (Carga de la prueba en discriminacion):

> **30.1:** "Cuando la parte actora o el interesado alegue discriminacion y aporte indicios fundados sobre su existencia, correspondera a la **parte demandada** o a quien se impute la situacion discriminatoria la aportacion de una justificacion objetiva y razonable, suficientemente probada, de las medidas adoptadas y de su proporcionalidad."
>
> **30.2:** "El organo judicial **o administrativo**, de oficio o a instancia de parte, **podra** recabar informe de los organismos publicos competentes en materia de igualdad."

**Por que A es correcta:**
Reproduce literalmente el art. 30.1: cuando hay indicios de discriminacion, la carga de la prueba se invierte y es el demandado quien debe justificar que sus medidas son objetivas, razonables y proporcionadas.

**Por que las demas son incorrectas:**

- **B)** Dice que corresponde a la **parte actora** aportar justificacion de la discriminacion. Falso: el art. 30.1 establece exactamente lo contrario. La inversion de la carga de la prueba significa que el demandante solo aporta indicios y el demandado debe justificarse.

- **C)** Tiene dos errores respecto al art. 30.2:
  1. Dice "**debera**" cuando el articulo dice "**podra**" (es potestativo, no obligatorio).
  2. Dice solo "organo judicial" cuando el articulo dice "organo judicial **o administrativo**".

- **D)** "A y C son correctas" - Como C es incorrecta por los dos errores senalados, D tambien es falsa.

**Clave:** Cuidado con el cambio de "podra" a "debera" en las opciones. Es una trampa clasica en oposiciones: lo potestativo se convierte en obligatorio.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "aa38f91a-87f5-4218-8e01-92bd0f629126");

  if (error) console.error("Error:", error);
  else console.log("OK - Ley 15/2022 art.30 guardada (" + explanation.length + " chars)");
})();
