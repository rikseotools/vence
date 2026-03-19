require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 3 de la Ley 40/2015 (LRJSP)** (Principios generales):

> **3.2:** "Las Administraciones Publicas [...] se desarrolla para alcanzar los objetivos que establecen las leyes y el resto del ordenamiento juridico, bajo la direccion del **Gobierno de la Nacion**, de los **organos de gobierno de las Comunidades Autonomas** y de los **organos de gobierno de las Entidades Locales**, respectivamente."

**La pregunta pide la respuesta INCORRECTA.**

**Por que C es incorrecta (y por tanto la respuesta correcta):**
"Las entidades de derecho privado vinculadas o dependientes de las administraciones publicas" NO dirigen la actuacion administrativa. El art. 3.2 enumera tres organos de direccion:
1. Gobierno de la Nacion
2. Organos de gobierno de las CCAA
3. Organos de gobierno de las Entidades Locales

Las entidades de derecho privado (empresas publicas, fundaciones del sector publico, etc.) son **instrumentos** de las Administraciones, no sus organos directivos. Estan sujetas a la direccion de las AAPP, no al reves.

**Por que las demas son correctas (y por tanto NO son la respuesta):**

- **A)** "Gobierno de la Nacion" - Es el primer organo de direccion mencionado en el art. 3.2. Dirige la Administracion General del Estado.

- **B)** "Organos de gobierno de las Entidades Locales" - Es el tercer organo mencionado en el art. 3.2. Dirigen la administracion local (ayuntamientos, diputaciones, etc.).

- **D)** "Organos de gobierno de las Comunidades Autonomas" - Es el segundo organo mencionado en el art. 3.2. Dirigen la administracion autonomica.

**Clave:** La direccion administrativa corresponde a los **tres niveles de gobierno** (Estado, CCAA, EELL). Las entidades instrumentales (publicas o privadas) no son organos de direccion sino entidades dirigidas.`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "07950339-201c-41f2-8916-62491647c455");
  if (error) console.error("Error:", error);
  else console.log("OK - Ley 40/2015 art.3 principios (" + explanation.length + " chars)");
})();
