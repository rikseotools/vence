require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 3 de la LO 3/1981** (Defensor del Pueblo):

> "Podra ser elegido Defensor del Pueblo cualquier **espanol mayor de edad** que se encuentre en el pleno disfrute de sus **derechos civiles y politicos**."

**Por que D es correcta:**
Reproduce literalmente el articulo 3. Tres requisitos: ser espanol, mayor de edad, y estar en pleno disfrute de derechos civiles y politicos.

**Por que las demas son incorrectas (cada una cambia algo):**

- **A)** Dos errores: dice "ciudadano espanol que **presente su candidatura**" (el articulo no exige presentar candidatura) y dice "derechos civiles y **sociales**" cuando debe ser "civiles y **politicos**".

- **B)** Dice "espanol **de origen**". Falso: el articulo dice "espanol" sin mas. No se exige ser espanol de origen (nacionalidad originaria); basta con ser espanol. Ademas dice "derechos y libertades" en vez de "derechos civiles y politicos".

- **C)** Dice "derechos **y libertades**" en vez de "derechos **civiles y politicos**". La expresion del articulo es concreta: derechos civiles y politicos, no una formula generica de "derechos y libertades".

**Clave:** Los 4 cambios tipicos en estas preguntas son: anadir "de origen", cambiar "politicos" por "sociales", sustituir la expresion exacta por una generica, o inventar requisitos adicionales (como presentar candidatura).`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "b7a37850-9932-45b1-a429-5a2d1161d71b");

  if (error) console.error("Error:", error);
  else console.log("OK - LO 3/1981 art.3 Defensor guardada (" + explanation.length + " chars)");
})();
