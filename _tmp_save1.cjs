require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 55 de la Constitucion Espanola** (Suspension de derechos):

> **55.1:** Los derechos reconocidos en los articulos 17, 18.2 y 18.3, **19**, 20.1.a) y d) y 20.5, 21, 28.2 y 37.2 podran ser suspendidos cuando se acuerde la declaracion del estado de excepcion o de sitio.
>
> **55.2:** Los derechos de los articulos 17.2 y 18.2 y 18.3 pueden ser suspendidos de forma individual para personas determinadas en investigaciones de bandas armadas o terrorismo.

**Por que C es correcta:**
El derecho a circular libremente (art. 19) aparece expresamente en la lista del art. 55.1 como derecho suspendible en estado de excepcion o de sitio.

**Por que las demas son incorrectas:**

- **A)** "Podra ser limitado por motivos politicos" - Falso. El art. 19 no permite limitaciones por motivos politicos. La suspension solo procede por estado de excepcion o sitio, que son situaciones excepcionales regladas, no politicas.

- **B)** "No puede ser suspendido" - Falso. El art. 55.1 incluye expresamente el art. 19 entre los derechos suspendibles.

- **D)** "Podra ser suspendido para personas determinadas en investigaciones de terrorismo" - Falso. El art. 55.2 (suspension individual por terrorismo) solo se aplica a los arts. 17.2, 18.2 y 18.3. El derecho de circulacion (art. 19) NO esta en el 55.2, solo en el 55.1.

**Clave:** La libre circulacion se puede suspender colectivamente (55.1, excepcion/sitio) pero NO individualmente (55.2, terrorismo).`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "9553bc73-95cc-4913-a17a-d6bec1c30c4e");

  if (error) console.error("Error:", error);
  else console.log("OK - CE art.55 guardada (" + explanation.length + " chars)");
})();
