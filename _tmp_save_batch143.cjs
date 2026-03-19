require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 47/2003 art.46 creditos limitativos nulos de pleno derecho
  const exp1 = `**Articulo 46 de la Ley 47/2003 (LGP) - Caracter limitativo de los creditos:**

> "Los creditos para gastos son **limitativos**. No podran adquirirse compromisos de gasto ni adquirirse obligaciones por cuantia superior al importe de los creditos autorizados en los estados de gastos, siendo **nulos de pleno derecho** los actos administrativos y las disposiciones generales con rango inferior a ley que incumplan esta limitacion."

**Por que C es correcta:**
La opcion C reproduce textualmente el art. 46 LGP. Los creditos son **limitativos**: no se puede gastar mas de lo autorizado. Si se hace, el acto es **nulo de pleno derecho**. Este es uno de los principios presupuestarios mas importantes.

**Por que las demas son incorrectas (reguladas en otros articulos):**

- **A)** "Los creditos se destinaran exclusivamente a la finalidad especifica para la que hayan sido autorizados". Esto describe el principio de **especificidad cualitativa** (art. **42** LGP), no el de limitatividad (art. 46). La especificidad determina a **que** se destina el credito; la limitatividad determina **cuanto** se puede gastar.

- **B)** "Los creditos que en el ultimo dia del ejercicio no esten afectados al cumplimiento de obligaciones ya reconocidas, quedaran anulados de pleno derecho". Esto describe el principio de **anualidad o temporalidad** (art. **49** LGP). Se refiere a que los creditos caducan al final del ejercicio, no a la limitacion cuantitativa.

- **D)** "Solo podran contraerse obligaciones derivadas de adquisiciones, obras, servicios [...] que se realicen en el propio ejercicio presupuestario". Esto describe tambien la **temporalidad** (art. **47** LGP). Las obligaciones deben corresponder al ejercicio en curso, salvo excepciones.

**Principios presupuestarios de los creditos (LGP):**

| Principio | Articulo | Contenido |
|-----------|----------|-----------|
| Especificidad cualitativa | Art. 42 | Destino exclusivo a su finalidad |
| **Limitatividad** | **Art. 46** | **No superar el importe autorizado** |
| Temporalidad | Art. 47 | Obligaciones del propio ejercicio |
| Anualidad | Art. 49 | Creditos se anulan al fin de ejercicio |

**Clave:** Art. 46 = limitatividad (cuanto). No confundir con especificidad (que), ni con temporalidad/anualidad (cuando).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ba719e2f-5f62-4ef2-a388-aa6f93bd8b05");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LGP art.46 limitativos (" + exp1.length + " chars)");
})();
