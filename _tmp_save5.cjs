require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 168 de la Constitucion Espanola** (Procedimiento agravado de reforma):

El art. 168 exige referendum obligatorio para reformas que afecten a:
- **Titulo Preliminar** (arts. 1-9)
- **Seccion 1a, Capitulo 2o, Titulo I** (arts. 15-29: derechos fundamentales)
- **Titulo II** (arts. 56-65: La Corona)

La pregunta pide cual **NO** necesitaria referendum.

**Por que B es correcta (NO necesita referendum del 168):**
El art. 11.2 (nacionalidad) esta en el **Capitulo Primero** del Titulo I ("De los espanoles y los extranjeros", arts. 11-13), que queda **fuera** del ambito del art. 168. Su reforma seguiria el procedimiento ordinario del art. 167.

**Por que las demas SI necesitarian referendum del 168:**

- **A)** Art. 5 (capital del Estado) - Esta en el **Titulo Preliminar** (arts. 1-9), protegido por el art. 168.

- **C)** Art. 27.4 (ensenanza obligatoria y gratuita) - Esta en la **Seccion 1a del Capitulo 2o del Titulo I** (arts. 15-29), protegido por el art. 168.

- **D)** Art. 57 (sucesion a la Corona) - Esta en el **Titulo II** (La Corona), protegido por el art. 168.

**Clave:** No todo el Titulo I esta protegido por el 168, solo la Seccion 1a del Capitulo 2o (arts. 15-29). Los articulos 10-14 (Capitulo 1o) y 30-55 (Seccion 2a y Capitulo 3o) se reforman por el 167.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "2366b92a-a85d-4f8f-af64-5d0f607995ac");

  if (error) console.error("Error:", error);
  else console.log("OK - CE art.168 guardada (" + explanation.length + " chars)");
})();
