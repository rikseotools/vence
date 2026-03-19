require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 82.1 del TREBEP (RDL 5/2015):**

> "En las actuaciones y procedimientos relacionados con la violencia de genero o con la violencia sexual se protegera la intimidad de las victimas, en especial, **sus datos personales**, los de **sus descendientes** y los de **cualquier persona que este bajo su guarda o custodia**."

La pregunta pide senalar la **incorrecta**.

**Por que C es incorrecta:**
"Los datos personales de sus **ascendientes**" no aparecen en el articulo 82. El articulo solo protege los datos de descendientes, no de ascendientes (padres, abuelos).

**Por que las demas son correctas (si estan en el articulo):**

- **A)** "Cualquier persona que este bajo su guarda o custodia" - Si aparece expresamente en el art. 82.1 como tercer supuesto protegido.

- **B)** "Los datos de sus descendientes" - Si aparece expresamente como segundo supuesto protegido.

- **D)** "Sus datos personales" - Si aparece como primer supuesto protegido (los de la propia victima).

**Clave:** El art. 82 protege tres categorias de datos: los de la victima, los de sus **descendientes** (hijos) y los de personas bajo su guarda/custodia. Los **ascendientes** (padres) quedan fuera. La trampa esta en confundir descendientes con ascendientes.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "bcadf039-6975-4a3e-8351-feb7e5831aed");

  if (error) console.error("Error:", error);
  else console.log("OK - TREBEP art.82 guardada (" + explanation.length + " chars)");
})();
