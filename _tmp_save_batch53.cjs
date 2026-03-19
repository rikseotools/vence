require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.103.1 principios Administracion Publica
  const exp1 = `**Articulo 103.1 de la Constitucion Espanola:**

> "La Administracion Publica sirve con objetividad los intereses generales y actua de acuerdo con los principios de **eficacia**, **jerarquia**, **descentralizacion**, **desconcentracion** y **coordinacion**, con sometimiento pleno a la ley y al Derecho."

**Por que D es correcta:**
La **coordinacion** es uno de los 5 principios de actuacion de la Administracion Publica enumerados expresamente en el art. 103.1 CE.

**Por que las demas son incorrectas:**

- **A)** "Independencia". Falso: la independencia **no** aparece en el art. 103.1. La Administracion Publica no es independiente; esta sometida al principio de jerarquia y al control del Gobierno (art. 97 CE).

- **B)** "**Eficiencia**". Falso: esta es la **trampa principal**. El art. 103.1 dice "**eficacia**", no "eficiencia". Son conceptos distintos:
  - **Eficacia** = lograr los objetivos propuestos
  - **Eficiencia** = lograr los objetivos con el minimo de recursos

  La CE usa "eficacia". La "eficiencia" aparece en otras normas (ej: art. 7 Ley 40/2015), pero **no** en el art. 103.1 CE.

- **C)** "Neutralidad". Falso: la neutralidad **no** aparece en el art. 103.1. Lo que si menciona el articulo es la "**objetividad**" ("sirve con objetividad"), pero objetividad y neutralidad son conceptos diferentes.

**Los 5 principios del art. 103.1 CE:** eficacia, jerarquia, descentralizacion, desconcentracion, coordinacion.

**Clave:** No confundir **eficacia** (art. 103.1 CE) con **eficiencia** (no esta en el art. 103.1).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "798f9868-5f1e-4658-a3a7-2f573f602238");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.103.1 principios (" + exp1.length + " chars)");
})();
