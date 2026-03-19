require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 12.2 del RD 203/2021** (Reglamento de actuacion por medios electronicos):

> "En caso de que la sede electronica o sede electronica asociada contenga un enlace o vinculo a otra sede o sede asociada, sera el titular de **esta ultima** el responsable de la integridad, veracidad y actualizacion de la informacion o procedimientos que figuren en la misma, sin perjuicio de la debida diligencia del titular de la primera respecto de la incorporacion de los contenidos."

**Por que B es correcta:**
El responsable es el titular de la sede **de destino** (a la que apunta el enlace). La logica es clara: cada administracion es responsable de su propio contenido, aunque se acceda desde otra sede mediante un enlace.

**Por que las demas son incorrectas:**

- **A)** Dice que el responsable es el titular de la sede que **contiene** el enlace. Falso: el que pone el enlace no responde del contenido ajeno, solo tiene "debida diligencia" respecto a lo que enlaza.

- **C)** Introduce un criterio de "superioridad jerarquica" que el articulo no menciona en absoluto. La responsabilidad no depende de la jerarquia entre titulares.

- **D)** Dice que son responsables ambos titulares. Falso: el articulo atribuye la responsabilidad al titular de destino. El titular de origen solo tiene un deber de diligencia generico, no responsabilidad sobre el contenido enlazado.

**Clave:** Quien tiene el contenido, responde por el. El que enlaza solo tiene "debida diligencia" (art. 12.2 in fine).`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "38b1ad97-e27d-48e0-a3ba-beb0533ab4f6");

  if (error) console.error("Error:", error);
  else console.log("OK - RD 203/2021 art.12 guardada (" + explanation.length + " chars)");
})();
