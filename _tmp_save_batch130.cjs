require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.11 nacionalidad "cualquier" vs "ningun"
  const exp1 = `**Articulo 11.2 de la Constitucion Espanola:**

> "**Ningun** espanol de origen podra ser privado de su nacionalidad."

**Por que A es la INCORRECTA (y por tanto la respuesta):**
La opcion A dice "**Cualquier** ciudadano espanol de origen, podra ser privado de su nacionalidad". Pero el art. 11.2 CE dice exactamente lo contrario: "**Ningun** espanol de origen podra ser privado de su nacionalidad". La trampa invierte completamente el sentido del articulo cambiando una sola palabra: "cualquier" por "ningun".

Este es un derecho absoluto: un espanol de **origen** (no naturalizado) nunca puede perder la nacionalidad espanola en contra de su voluntad. Un espanol naturalizado, en cambio, si puede perderla en los casos previstos por la ley.

**Por que las demas SI son correctas (reproducen fielmente el art. 11):**

- **B)** "La nacionalidad espanola se adquiere, se conserva y se pierde de acuerdo con lo establecido por la ley". **SI**: art. 11.1 CE. Remision al Codigo Civil para regular adquisicion, conservacion y perdida.

- **C)** "En los paises iberoamericanos, aun cuando no reconozcan a sus ciudadanos un derecho reciproco, podran naturalizarse los espanoles sin perder su nacionalidad de origen". **SI**: art. 11.3 CE (segundo inciso). Privilegio especial para paises iberoamericanos.

- **D)** "El Estado podra concertar tratados de doble nacionalidad con los paises iberoamericanos o con aquellos que hayan tenido o tengan una particular vinculacion con Espana". **SI**: art. 11.3 CE (primer inciso).

**Contenido del art. 11 CE:**
1. Nacionalidad regulada por ley
2. **Ningun** espanol de origen privado de nacionalidad
3. Doble nacionalidad con paises iberoamericanos y vinculados

**Clave:** "Ningun", no "Cualquier". La CE protege absolutamente la nacionalidad de origen.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e9a1b042-d93e-4fe0-a3f3-4714ac1e661b");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.11 nacionalidad ningun (" + exp1.length + " chars)");

  // #2 - CE art.18.4 limitar uso informatica
  const exp2 = `**Articulo 18.4 de la Constitucion Espanola:**

> "La ley limitara el uso de la **informatica** para garantizar el honor y la intimidad personal y familiar de los ciudadanos y el pleno ejercicio de sus derechos."

**Por que C es correcta (la informatica):**
El art. 18.4 CE es la base constitucional de la **proteccion de datos personales** en Espana. Fue una clausula visionaria de los constituyentes de 1978 que anticipo los riesgos del tratamiento automatizado de informacion personal. La "informatica" se refiere al uso de ordenadores y sistemas automatizados para procesar datos.

**Por que las demas son incorrectas (la CE no las menciona en el art. 18.4):**

- **A)** "El uso de la publicidad". Falso: la CE no dice que la ley limitara la publicidad en el art. 18. La publicidad se regula por otras normas (Ley General de Publicidad), pero no es el objeto del art. 18.4.

- **B)** "El uso de la libertad de expresion". Falso: la libertad de expresion (art. 20 CE) tiene sus propios limites (art. 20.4: derechos del Titulo I, especialmente honor, intimidad y proteccion de la juventud), pero el art. 18.4 no habla de limitar la libertad de expresion.

- **D)** "El uso de la libertad de prensa". Falso: la libertad de prensa es una manifestacion de la libertad de informacion (art. 20.1.d CE). El art. 18.4 se refiere a la informatica (tecnologia), no a la prensa (medio de comunicacion).

**Los 4 apartados del art. 18 CE:**
1. Honor, intimidad y propia imagen
2. Inviolabilidad del **domicilio**
3. Secreto de las **comunicaciones**
4. Limitacion del uso de la **informatica**

**Clave:** Art. 18.4 = informatica (base de la proteccion de datos). No confundir con publicidad, expresion ni prensa.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "9e8b1f72-b65e-4fe0-a8e3-7150509a8d33");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.18.4 informatica (" + exp2.length + " chars)");
})();
