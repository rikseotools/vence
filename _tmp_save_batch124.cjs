require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE arts.119-120 principios judiciales Privacidad no es principio
  const exp1 = `**Articulos 119 y 120 de la Constitucion Espanola:**

> Art. 119: "La justicia sera **gratuita** cuando asi lo disponga la ley y, en todo caso, respecto de quienes acrediten insuficiencia de recursos para litigar."

> Art. 120: "1. Las actuaciones judiciales seran **publicas** [...]. 2. El procedimiento sera predominantemente **oral** [...]. 3. Las sentencias seran siempre **motivadas** y se pronunciaran en **audiencia publica**."

**Por que C es la respuesta (Privacidad NO es un principio constitucional del procedimiento judicial):**
La CE consagra el principio de **publicidad** de las actuaciones judiciales (art. 120.1), que es precisamente lo contrario de la "privacidad". Las actuaciones judiciales son publicas como regla general. La "privacidad" no aparece en ningun articulo de la CE como principio procesal. Es una trampa que invierte el principio real.

**Por que las demas SI son principios constitucionales:**

- **A)** "Motivacion". **SI**: art. 120.3 CE. Las sentencias seran "siempre **motivadas**". La motivacion es una garantia esencial: el juez debe explicar las razones de su decision.

- **B)** "Gratuidad". **SI**: art. 119 CE. La justicia sera **gratuita** cuando la ley lo disponga y siempre para quienes acrediten insuficiencia de recursos (justicia gratuita).

- **D)** "Oralidad". **SI**: art. 120.2 CE. El procedimiento sera "predominantemente **oral**", sobre todo en materia criminal.

**Principios constitucionales del procedimiento judicial:**
- **Publicidad** (art. 120.1) - no privacidad
- **Oralidad** (art. 120.2) - predominante, sobre todo penal
- **Motivacion** (art. 120.3) - sentencias siempre motivadas
- **Gratuidad** (art. 119) - para insuficiencia de recursos

**Clave:** El principio constitucional es la **publicidad** (no la privacidad). Las actuaciones judiciales son publicas como regla general.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ba025614-6de1-48f1-b72b-5f4797a52b77");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE principios judiciales privacidad (" + exp1.length + " chars)");
})();
