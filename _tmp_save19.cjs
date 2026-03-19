require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 113 de la Constitucion Espanola** (Mocion de censura):

> **113.4:** "Si la mocion de censura no fuere aprobada por el Congreso, sus signatarios no podran presentar otra durante el **mismo periodo de sesiones**."

**Por que B es correcta:**
El art. 113.4 establece que, rechazada la mocion, los signatarios no pueden presentar otra "durante el mismo periodo de sesiones". El periodo de sesiones es de febrero a junio y de septiembre a diciembre (art. 73.1 CE).

**Por que las demas son incorrectas:**

- **A)** "En el plazo de 1 ano" - Falso. El articulo no establece un plazo de un ano, sino que vincula la prohibicion al periodo de sesiones. Podrian presentar otra en el siguiente periodo de sesiones, aunque no haya pasado un ano.

- **C)** "Durante dos periodos de sesiones" - Falso. La prohibicion solo abarca un periodo de sesiones (el mismo en que se rechazo), no dos.

- **D)** "En el plazo de 6 meses" - Falso. El articulo no fija ningun plazo temporal concreto en meses. La referencia es al periodo de sesiones, no a un plazo.

**Datos clave del art. 113:**
- Legitimacion: al menos 1/10 de los Diputados (35 de 350)
- Debe incluir un candidato alternativo a la Presidencia (mocion constructiva)
- Votacion: no antes de 5 dias desde la presentacion
- En los 2 primeros dias pueden presentarse mociones alternativas
- Aprobacion: mayoria absoluta del Congreso`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "332e2af8-0b86-4464-81ba-dde4544a32e4");

  if (error) console.error("Error:", error);
  else console.log("OK - CE art.113 mocion censura (" + explanation.length + " chars)");
})();
