require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 13 de la Ley 38/2003** (General de Subvenciones):

El art. 13.2.b) establece como prohibicion para obtener subvenciones:

> "Haber solicitado la declaracion de concurso voluntario, haber sido declarados insolventes en cualquier procedimiento, hallarse declarados en concurso, estar sujetos a intervencion judicial o haber sido inhabilitados conforme a la Ley Concursal..."

Estas prohibiciones del apartado b) se aprecian de **forma automatica** (sin necesidad de resolucion administrativa que las declare) y **subsisten mientras concurran las circunstancias** que las determinan (es decir, mientras dure la situacion de insolvencia o concurso).

**Por que A es correcta:**
"Haber solicitado la declaracion de concurso voluntario" es una prohibicion del art. 13.2.b) que opera automaticamente: basta con que se haya producido el hecho objetivo. Y desaparece cuando la situacion concursal se resuelve.

**Por que las demas son incorrectas:**

- **B)** "Condena mediante sentencia firme" (art. 13.2.a) - Esta prohibicion depende de la duracion de la pena impuesta, no de que "concurran circunstancias". No es automatica en el mismo sentido; requiere la existencia de una sentencia firme con una pena especifica.

- **C)** "Hallarse al corriente de pago de reintegro de subvenciones" - Esto es en realidad un **requisito** (estar al corriente), no una prohibicion. La prohibicion seria no estar al corriente. Ademas, la formulacion de la opcion es enganosa.

- **D)** "Haber dado lugar a resolucion firme de contrato" (art. 13.2.d) - Es un hecho historico ya consumado. No depende de circunstancias que puedan cambiar, por lo que no encaja con "subsistiran mientras concurran las circunstancias".

**Clave:** Las prohibiciones "automaticas" del art. 13 son las que dependen de situaciones objetivas y verificables (como estar en concurso), no de decisiones administrativas previas.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "9b958285-3300-495c-a811-eb26f9fef951");

  if (error) console.error("Error:", error);
  else console.log("OK - Ley 38/2003 art.13 guardada (" + explanation.length + " chars)");
})();
