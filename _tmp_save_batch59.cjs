require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.3.4 personalidad juridica unica
  const exp1 = `**Articulo 3.4 de la Ley 40/2015 (LRJSP):**

> "Cada una de las Administraciones Publicas del articulo 2 actua para el cumplimiento de sus fines con personalidad juridica **unica**."

**Por que B es correcta (unica):**
El art. 3.4 LRJSP establece que cada Administracion Publica actua con personalidad juridica **unica**. Esto significa que toda la Administracion (con todos sus organos) es un **unico sujeto de derecho**, no una suma de personalidades separadas. Los Ministerios, Direcciones Generales, etc., no tienen personalidad propia: actuan bajo la personalidad unica de la AGE.

**Por que las demas son incorrectas:**

- **A)** "Propia". Falso: el art. 3.4 dice "unica", no "propia". Aunque intuitivamente podria parecer correcto, la ley utiliza un termino especifico que no debe confundirse. "Propia" sugiere que cada organo tiene la suya; "unica" indica que toda la Administracion comparte una sola.

- **C)** "Solidaria". Falso: la solidaridad es un concepto de Derecho de obligaciones (deudores solidarios), no de personalidad juridica. No aparece en el art. 3.4.

- **D)** "Plena". Falso: "plena" aparece en otros contextos constitucionales (ej: art. 152.3 CE sobre circunscripciones territoriales con "plena personalidad juridica"), pero no en el art. 3.4 LRJSP. La expresion correcta es "unica".

**Clave:** Personalidad juridica **unica** (no propia, ni plena, ni solidaria). Toda la Administracion = un solo sujeto de derecho.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f592ac77-1185-4979-9ad9-78998c592fb7");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 personalidad unica (" + exp1.length + " chars)");

  // #2 - Ley 50/1981 art.31 Fiscal General renovacion
  const exp2 = `**Articulo 31 de la Ley 50/1981** (Mandato del Fiscal General del Estado):

> "El mandato del Fiscal General del Estado **no podra ser renovado**, excepto en los supuestos en que el titular hubiera ostentado el cargo durante un **periodo inferior a dos anos**."

**Por que A es correcta:**
La regla general es que el mandato del FGE (4 anos) **no se renueva**. La unica excepcion es si el titular estuvo en el cargo **menos de 2 anos**. En ese caso, si puede ser renovado. Esto permite que un FGE que fue cesado prematuramente pueda volver a ser nombrado.

**Por que las demas son incorrectas:**

- **B)** "Cese por cese del Gobierno + nueva propuesta del Gobierno entrante". Falso: aunque el art. 31.1.e) permite el cese del FGE cuando cese el Gobierno que lo propuso, esto no constituye una excepcion a la prohibicion de renovacion. El nuevo Gobierno puede nombrar a un FGE, pero no "renovar" al anterior (salvo que haya estado menos de 2 anos).

- **C)** "Cese a peticion propia". Falso: la peticion propia es una causa de cese (art. 31.1.a), pero no una excepcion a la prohibicion de renovacion. Que dimitas voluntariamente no te da derecho a ser renovado.

- **D)** "Nunca podra ser renovado". Falso: la prohibicion de renovacion tiene **una excepcion**: cuando el cargo se ostento menos de 2 anos.

**Mandato del FGE:**
- Duracion: **4 anos**
- Renovacion: **NO**, salvo si estuvo menos de **2 anos** en el cargo`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "f4a5598e-e956-4072-8b06-3b04777023bc");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 50/1981 FGE renovacion (" + exp2.length + " chars)");
})();
