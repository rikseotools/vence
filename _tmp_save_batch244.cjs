require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.61.1 Rey jura ante Cortes Generales
  const exp1 = `**Articulo 61.1 de la Constitucion Espanola - Juramento del Rey:**

> "El Rey, al ser proclamado ante las **Cortes Generales**, prestara juramento de desempenar fielmente sus funciones, **guardar y hacer guardar** la Constitucion y las leyes y **respetar los derechos** de los ciudadanos y de las Comunidades Autonomas."

**Por que A es correcta (ante las Cortes Generales):**
El art. 61.1 CE establece que el Rey presta juramento al ser proclamado ante las **Cortes Generales** (ambas Camaras: Congreso y Senado). Es un acto solemne ante el poder legislativo, que representa la soberania nacional (art. 66.1 CE). El contenido del juramento incluye: (1) desempenar fielmente sus funciones, (2) guardar y hacer guardar la Constitucion y las leyes, y (3) respetar los derechos de los ciudadanos y de las CCAA.

**Por que las demas son incorrectas (organos diferentes):**

- **B)** "Ante el Pleno del **Tribunal Constitucional**." Falso: el TC (art. 159 CE) es el interprete supremo de la Constitucion, pero no es el organo ante el que el Rey presta juramento. El TC no tiene funciones ceremoniales de proclamacion real.

- **C)** "Ante el Pleno del **Tribunal Supremo**." Falso: el TS (art. 123 CE) es el organo jurisdiccional superior en todos los ordenes, pero no interviene en la proclamacion del Rey. La proclamacion es un acto parlamentario, no judicial.

- **D)** "En sesion extraordinaria del **Consejo de Ministros**." Falso: el Consejo de Ministros es un organo del poder ejecutivo (Gobierno). El Rey no presta juramento ante el Gobierno, sino ante las Cortes (poder legislativo).

**Actos solemnes ante las Cortes Generales:**

| Acto | Articulo CE |
|------|------------|
| **Proclamacion y juramento del Rey** | **Art. 61.1** |
| Juramento del Principe heredero | Art. 61.2 |
| Juramento del Regente | Art. 61.2 |

**Contenido del juramento del Rey (art. 61.1):**

| Compromiso |
|-----------|
| Desempenar fielmente sus funciones |
| Guardar y hacer guardar la Constitucion y las leyes |
| Respetar los derechos de los ciudadanos y de las CCAA |

**Clave:** El Rey jura ante las Cortes Generales (art. 61.1), no ante el TC, TS ni el Consejo de Ministros. Es un acto del poder legislativo, representante de la soberania popular.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "3a1605e3-f9de-41bb-9001-858a0a5c559e");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.61 juramento Cortes Generales (" + exp1.length + " chars)");
})();
