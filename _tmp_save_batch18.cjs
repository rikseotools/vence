require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // RD 203/2021 art.49 digitalizacion
  const exp1 = `**Articulo 49 del RD 203/2021** (Digitalizacion de documentos en papel):

> "Cuando el interesado presente en papel una copia de un **documento publico administrativo** o de un **documento privado** para incorporarlo a un expediente administrativo, el proceso de digitalizacion por la Administracion Publica generara una **copia electronica** que tendra el mismo valor que la copia presentada en papel."

**Por que D es correcta:**
La opcion D reproduce fielmente el art. 49: la digitalizacion procede cuando el interesado presenta en papel una copia de un documento publico administrativo **o** de un documento privado. Ambos tipos de documento generan copia electronica con el mismo valor.

**Por que las demas son incorrectas:**

- **A)** "Copia de un documento publico administrativo [...] en todo caso". Incompleta: omite los documentos privados. El art. 49 incluye expresamente "o de un documento privado". Ademas, la coletilla "en todo caso" no aparece en el articulo y podria interpretarse de forma incorrecta.

- **B)** "Cuando asi lo considere la Administracion". Falso: no es una decision discrecional de la Administracion. El art. 49 establece que la digitalizacion se produce cuando el interesado presenta documentos en papel, no cuando la Administracion lo considere oportuno.

- **C)** "Cuando asi lo solicite el interesado". Falso: no requiere solicitud expresa del interesado. La digitalizacion se genera automaticamente cuando el interesado presenta documentos en papel para incorporarlos al expediente.

**Clave:** Dos tipos de documentos generan digitalizacion: publicos administrativos **y** privados. No es discrecional ni requiere solicitud: se digitaliza siempre que se presente papel.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "66847f7d-d510-4ae9-b618-b1fee1b5b2cc");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 203/2021 art.49 digitalizacion (" + exp1.length + " chars)");
})();
