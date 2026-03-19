require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 21 de la Ley 50/1997** (Gobierno en funciones):

> **21.5:** "El Gobierno en funciones no podra ejercer las siguientes facultades:
> a) Aprobar el Proyecto de Ley de Presupuestos Generales del Estado.
> b) Presentar proyectos de ley al Congreso de los Diputados o, en su caso, al Senado."

**Por que C es correcta:**
Ninguna de las tres facultades mencionadas en A, B y D puede ser ejercida por el Gobierno en funciones. El art. 21.5 prohibe expresamente tanto la presentacion de proyectos de ley como la aprobacion del Proyecto de Presupuestos.

**Por que las demas describen facultades prohibidas (no una sola):**

- **A)** "Presentar proyectos de ley al Congreso" - Prohibido por el art. 21.5.b).

- **B)** "Presentar proyectos de ley al Senado" - Prohibido por el art. 21.5.b) (dice "al Congreso o, en su caso, al Senado").

- **D)** "Aprobar el Proyecto de Ley de PGE" - Prohibido por el art. 21.5.a).

Como las tres (A, B y D) estan prohibidas, la respuesta no es una en concreto sino C: "ninguna puede ser ejercida".

**Dato adicional (art. 21.4):** El Presidente en funciones tampoco puede proponer la disolucion de las Camaras, plantear la cuestion de confianza ni proponer un referendum consultivo.

**Clave:** El Gobierno en funciones se limita al "despacho ordinario de los asuntos publicos" (art. 21.3). Presentar leyes y presupuestos excede la gestion ordinaria.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "d75e7506-9257-4ec4-8d10-2857c9377210");

  if (error) console.error("Error:", error);
  else console.log("OK - Ley 50/1997 art.21 guardada (" + explanation.length + " chars)");
})();
