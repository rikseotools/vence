require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 58 de la Ley 47/2003 (LGP)** (Incorporacion de remanentes de credito):

> Se podran incorporar a los correspondientes creditos de un ejercicio los remanentes de credito del ejercicio anterior, en los siguientes casos:
> **a)** Cuando asi lo disponga una norma de **rango legal**.
> **b)** Los procedentes de las generaciones a que se refiere el apartado 2 del articulo 53, en sus **parrafos a) y e)**.
> **c)** Los derivados de retenciones efectuadas para la financiacion de creditos extraordinarios o suplementos de credito, cuando haya sido anticipado su pago [...].
> **d)** Los que resulten de **creditos extraordinarios y suplementos de credito** que hayan sido concedidos mediante norma con rango de ley en el **ultimo mes** del ejercicio presupuestario anterior.

**Por que A es correcta:**
Reproduce literalmente el art. 58.d): se incorporan los remanentes de creditos extraordinarios y suplementos de credito concedidos por norma con rango de ley en el ultimo mes del ejercicio anterior. El requisito temporal ("ultimo mes") es clave.

**Por que las demas son incorrectas:**

- **B)** "Transferencias de credito". Las transferencias de credito (reguladas en los arts. 52-52 bis LGP) NO figuran entre los supuestos del art. 58. No generan remanentes incorporables.

- **C)** "Norma con rango reglamentario o una Ley". El art. 58.a) exige "norma de rango **legal**" (es decir, ley o norma con fuerza de ley). Anadir "reglamentario" es el error: un reglamento NO puede declarar incorporables los remanentes.

- **D)** "Generaciones de credito por la realizacion de ingresos legalmente afectados". Aunque el art. 58.b) si contempla generaciones del art. 53.2 (parrafos a y e), la formulacion de esta opcion no reproduce fielmente el texto legal y mezcla conceptos. La opcion A es la que recoge literalmente un supuesto del art. 58.

**Los 4 supuestos de incorporacion (art. 58 LGP):**
- a) Norma de rango legal
- b) Generaciones del art. 53.2.a) y e)
- c) Retenciones para creditos extraordinarios anticipados
- d) Creditos extraordinarios/suplementos del ultimo mes`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "71e29d38-d90f-41a2-947c-ea7b3774b05c");
  if (error) console.error("Error:", error);
  else console.log("OK - LGP art.58 incorporacion remanentes (" + explanation.length + " chars)");
})();
