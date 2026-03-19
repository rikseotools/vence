require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 143.2 de la Constitucion Espanola** (Iniciativa del proceso autonomico):

> **143.2:** "La iniciativa del proceso autonomico corresponde a todas las **Diputaciones** interesadas o al organo interinsular correspondiente y a las **dos terceras partes de los municipios** cuya poblacion represente, al menos, la **mayoria del censo electoral** de cada provincia o isla. Estos requisitos deberan ser cumplidos en el plazo de **seis meses** desde el **primer acuerdo** adoptado al respecto por alguna de las Corporaciones locales interesadas."

**Por que D es correcta:**
Reproduce literalmente el art. 143.2: el plazo es de **6 meses** desde el **primer** acuerdo adoptado. Ambos datos (6 meses + primer acuerdo) son imprescindibles para que la respuesta sea correcta.

**Por que las demas son incorrectas:**

- **A)** "2 meses desde el ultimo acuerdo". Doble error: el plazo no es 2 meses (es 6) y no se cuenta desde el "ultimo" acuerdo sino desde el **primero**.

- **B)** "3 meses desde el primer acuerdo". El plazo no es 3 meses. Aunque acierta en "primer acuerdo", falla en la duracion: son **6 meses**, no 3.

- **C)** "9 meses desde el ultimo acuerdo". Doble error: no son 9 meses (son 6) y no se cuenta desde el "ultimo" sino desde el **primero**.

**Datos clave del art. 143.2 CE:**
- Iniciativa: Diputaciones + 2/3 de municipios con mayoria de censo
- Plazo: **6 meses** desde el **primer** acuerdo
- Si no prospera: no puede reiterarse hasta pasados **5 anos** (art. 143.3)`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "d018ea26-cbef-46ef-9aa7-9c4699838f8e");
  if (error) console.error("Error:", error);
  else console.log("OK - CE art.143.2 plazo iniciativa (" + explanation.length + " chars)");
})();
