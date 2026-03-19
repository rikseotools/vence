require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 145 de la Constitucion Espanola** (Convenios entre CCAA):

> **145.1:** "En ningun caso se admitira la **federacion** de Comunidades Autonomas."
> **145.2:** "Los **Estatutos** podran prever los supuestos, requisitos y terminos en que las Comunidades Autonomas podran celebrar **convenios entre si** para la gestion y prestacion de servicios propios de las mismas [...]. En los demas supuestos, los **acuerdos de cooperacion** entre las Comunidades Autonomas necesitaran la **autorizacion de las Cortes Generales**."

**Por que B es correcta:**
El art. 145.2 establece literalmente que son "los Estatutos" (de Autonomia) los que pueden prever los supuestos, requisitos y terminos de estos convenios interautonimcos. No una ley ordinaria, ni un reglamento, ni un decreto ley.

**Por que las demas son incorrectas:**

- **A)** "Una ley ordinaria". Falso: el art. 145.2 reserva esta funcion a los **Estatutos de Autonomia**, que son leyes organicas (no ordinarias). El constituyente quiso que fueran los propios Estatutos los que regularan esta materia.

- **C)** "Un Reglamento". Falso: un reglamento es una norma de rango inferior a la ley. La regulacion de los convenios entre CCAA es materia estatutaria (rango de ley organica), no reglamentaria.

- **D)** "Un Decreto Ley". Falso: los decretos ley son normas del Gobierno con fuerza de ley para situaciones de urgencia (art. 86 CE). Los convenios entre CCAA se regulan en los Estatutos, no mediante decreto ley.

**Dos tipos de relaciones entre CCAA (art. 145):**

| Tipo | Regulacion | Control |
|------|-----------|---------|
| **Convenios** (gestion/servicios) | Estatutos de Autonomia | Comunicacion a Cortes |
| **Acuerdos de cooperacion** (otros) | - | Autorizacion de Cortes |`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "0bde5f5f-bbfa-4c2a-8bdf-c9390cfbb4be");
  if (error) console.error("Error:", error);
  else console.log("OK - CE art.145 convenios CCAA (" + explanation.length + " chars)");
})();
