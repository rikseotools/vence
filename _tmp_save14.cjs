require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 1 de la Constitucion Espanola:**

> **1.1:** "Espana se constituye en un Estado social y democratico de Derecho, que propugna como valores superiores de su ordenamiento juridico la libertad, la justicia, la igualdad y el pluralismo politico."
> **1.2:** "La soberania nacional reside en el pueblo espanol, del que emanan los poderes del Estado."
> **1.3:** "La forma politica del Estado espanol es la **Monarquia parlamentaria**."

La pregunta pide senalar la **incorrecta**.

**Por que A es incorrecta:**
Dice "la forma politica del Estado espanol es la **democracia** parlamentaria". Falso: el art. 1.3 dice "**Monarquia** parlamentaria", no democracia. El cambio de una sola palabra invalida la opcion.

**Por que las demas son correctas:**

- **B)** "Propugna como valores superiores la libertad, la justicia, la igualdad y el pluralismo politico" - Reproduce fielmente el art. 1.1.

- **C)** "La soberania nacional reside en el pueblo espanol, del que emanan los poderes del Estado" - Reproduce fielmente el art. 1.2.

- **D)** "Espana se constituye en un Estado social y democratico de Derecho" - Reproduce fielmente el inicio del art. 1.1.

**Clave:** "Monarquia parlamentaria" es la forma politica (art. 1.3). No confundir con "democracia parlamentaria", que es un concepto distinto. Espana es ambas cosas (una democracia y una monarquia), pero la CE dice expresamente "Monarquia parlamentaria".`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "d26c8362-0095-4448-a671-1baf45bff1dc");

  if (error) console.error("Error:", error);
  else console.log("OK - CE art.1 guardada (" + explanation.length + " chars)");
})();
