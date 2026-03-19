require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 57.4 de la Constitucion Espanola:**

> "Aquellas personas que teniendo **derecho a la sucesion** en el trono contrajeren matrimonio contra la expresa prohibicion del Rey y de las Cortes Generales, quedaran excluidas en la sucesion a la Corona por si y sus descendientes."

**Por que C es correcta:**
La pregunta se refiere al **Rey** (que ya ocupa el trono), no a una persona con derecho a la sucesion. El art. 57.4 solo afecta a quienes aun no son monarcas pero estan en la linea sucesoria. El Rey reinante no puede ser "excluido de la sucesion" porque ya ha accedido al trono. Seguiria ostentando el titulo de Rey de Espana.

**Por que las demas son incorrectas:**

- **A)** "Se abrira la sucesion al trono" - Falso. La sucesion no se abre por contraer matrimonio prohibido. Solo se abre por muerte, abdicacion o incapacidad del Rey.

- **B)** "Las Cortes proveeran a la sucesion" - Esto corresponde al art. 57.3, que solo se activa cuando se extinguen **todas** las lineas de sucesion, no por un matrimonio prohibido.

- **D)** "Quedara excluido de la sucesion el y sus descendientes" - Esta es la trampa principal. Parafrasea el art. 57.4, pero ese articulo se aplica a "personas que teniendo derecho a la sucesion", no al Rey que ya reina. Sus descendientes si podrian verse afectados, pero el propio Rey no pierde la Corona.

**Clave:** Distinguir entre el Rey (ya tiene la Corona) y los sucesores (tienen derecho a la sucesion). El art. 57.4 solo afecta a los segundos.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "6d4b8806-d7ff-405b-9013-a89e488cef23");

  if (error) console.error("Error:", error);
  else console.log("OK - CE art.57 guardada (" + explanation.length + " chars)");
})();
