require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Gobierno Abierto Foro vocales Ceuta y Melilla son DOS no uno
  const exp1 = `**Composicion del Foro del Gobierno Abierto (representacion de Administraciones Publicas):**

El Foro del Gobierno Abierto incluye entre sus miembros, en representacion de las Administraciones Publicas:
> - Persona titular de la DG de Gobernanza Publica (Vicepresidencia Primera)
> - 8 vocales de la AGE (rango minimo de Subdirector General)
> - Vocales de las CCAA representadas en la Comision Sectorial
> - **Un vocal por cada Ciudad Autonoma** de Ceuta y de Melilla (2 vocales en total)
> - 4 vocales de la FEMP en representacion de Entidades Locales

**Por que B es la opcion INCORRECTA (y por tanto la respuesta):**
La opcion B dice "**Un** vocal por las Ciudades Autonomas de Ceuta **y** de Melilla". Esto sugiere un unico vocal compartido por ambas ciudades. Sin embargo, la norma establece **un vocal por cada Ciudad Autonoma**, es decir, **dos vocales**: uno por Ceuta y otro por Melilla. La trampa reduce dos vocales a uno al usar "un vocal por las" (ambas) en vez de "un vocal por cada una".

**Por que las demas SI son correctas:**

- **A)** "La persona titular de la DG de Gobernanza Publica a la que correspondera la Vicepresidencia Primera del Foro". **SI**: esta figura forma parte de la composicion del Foro con el cargo de Vicepresidencia Primera.

- **C)** "Ocho vocales en representacion de la AGE con rango al menos de Subdirector General". **SI**: la norma establece 8 vocales de la AGE con ese rango minimo.

- **D)** "Cuatro vocales designados por la FEMP en representacion de las Entidades de la Administracion Local". **SI**: la FEMP designa 4 vocales para las entidades locales que voluntariamente se incorporen.

**Clave:** Ceuta y Melilla tienen **un vocal cada una** (2 en total), no "un vocal" compartido entre ambas. La trampa esta en el singular englobante.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "902330af-af12-4d35-89fc-6e9c6a8475dd");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Gobierno Abierto Foro Ceuta Melilla (" + exp1.length + " chars)");
})();
