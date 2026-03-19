require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 96.5 de la Ley 39/2015** (Tramitacion simplificada en procedimientos sancionadores):

> "En el caso de procedimientos de naturaleza sancionadora, se podra adoptar la tramitacion simplificada del procedimiento cuando el organo competente para iniciar el procedimiento considere que existen elementos de juicio suficientes para calificar la infraccion como **leve**, sin que quepa la oposicion expresa por parte del interesado."

**Por que D es correcta:**
El art. 96.5 solo permite la tramitacion simplificada en materia sancionadora cuando la infraccion se puede calificar como **leve**. La logica es que un procedimiento simplificado (30 dias, tramites reducidos) solo es adecuado para infracciones menores.

**Por que las demas son incorrectas:**

- **A)** "Infraccion grave" - Falso. Las infracciones graves requieren tramitacion ordinaria completa con todas las garantias.

- **B)** "Grave o muy grave" - Falso. Ni las graves ni las muy graves admiten tramitacion simplificada.

- **C)** "Muy grave" - Falso. Las infracciones muy graves son las que mas garantias procedimentales exigen, lo contrario de un procedimiento simplificado.

**Dato adicional:** A diferencia del procedimiento simplificado general (art. 96.2), en el sancionador el interesado **no puede oponerse** a la tramitacion simplificada. Esto es una particularidad del apartado 5.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "ca508a67-5d63-4a16-bb78-76b6f3eaab65");

  if (error) console.error("Error:", error);
  else console.log("OK - Ley 39/2015 art.96 guardada (" + explanation.length + " chars)");
})();
