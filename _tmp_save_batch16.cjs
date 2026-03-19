require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.113 mocion censura mismo periodo sesiones
  const exp1 = `**Articulo 113.4 de la Constitucion Espanola:**

> "Si la mocion de censura no fuere aprobada por el Congreso, **sus signatarios** no podran presentar otra durante el **mismo periodo de sesiones**."

**Articulo 73.1 CE** (Periodos de sesiones):
> "Las Camaras se reuniran anualmente en dos periodos ordinarios de sesiones: el primero, de **septiembre a diciembre**, y el segundo, de **febrero a junio**."

**Por que B es correcta:**
La mocion fracasada se presento en octubre y la nueva se propone en diciembre. Ambos meses caen dentro del **mismo periodo de sesiones** (septiembre-diciembre). Sin embargo, el art. 113.4 solo prohibe presentar otra mocion a los **signatarios** de la primera. Si los nuevos proponentes son **signatarios distintos**, no les afecta la prohibicion.

**Por que las demas son incorrectas:**

- **A)** "Si, en todo caso". Falso: no en todo caso. Los mismos signatarios de la mocion fallida NO pueden presentar otra en el mismo periodo de sesiones (octubre y diciembre estan en el mismo periodo).

- **C)** "No, a no ser que los proponentes sean los signatarios de la primera". Falso: dice exactamente lo contrario de lo que establece la CE. Son precisamente los signatarios de la primera los que NO pueden presentar otra.

- **D)** "En ningun caso". Falso: si pueden, siempre que sean signatarios distintos. La prohibicion es personal (afecta a quienes firmaron), no absoluta.

**Dos claves del art. 113.4:**
1. La prohibicion es **personal** (solo para los signatarios de la mocion fallida)
2. La prohibicion es **temporal** (solo durante el mismo periodo de sesiones)`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "32115ed1-31ca-4df9-92f7-92d417b71a03");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.113 mocion censura (" + exp1.length + " chars)");

  // #2 - RD 203/2021 art.14 subsanacion 10 dias
  const exp2 = `**Articulo 14.1 del RD 203/2021** (Subsanacion por no usar medios electronicos):

> "Si existe la obligacion del interesado de relacionarse a traves de medios electronicos y aquel no los hubiese utilizado, el organo administrativo [...] requerira la correspondiente subsanacion, advirtiendo [...] que, de no ser atendido el requerimiento en el plazo de **diez dias**, se le tendra por **desistido** de su solicitud o se le podra declarar **decaido** en su derecho al tramite correspondiente."

**Por que A es correcta:**
El art. 14.1 fija expresamente un plazo de **10 dias** para subsanar. Si el obligado a relacionarse electronicamente presenta algo en papel, se le da 10 dias para corregirlo. Si no lo hace: desistimiento o decaimiento.

**Por que las demas son incorrectas:**

- **B)** "Veinte dias". Falso: 20 dias es el plazo de las alegaciones en el procedimiento sancionador (art. 89.5 Ley 39/2015) o el de informacion publica (art. 83 Ley 39/2015), pero no el de esta subsanacion.

- **C)** "Quince dias". Falso: 15 dias habiles es el plazo general de notificacion cuando se intenta dos veces (art. 44 Ley 39/2015), no el de subsanacion por medios electronicos.

- **D)** "Cinco dias". Falso: 5 dias es un plazo que aparece en otros contextos (subsanacion de defectos menores), pero el art. 14.1 del RD 203/2021 fija claramente 10 dias.

**Consecuencias de no subsanar en 10 dias:**
- **Desistimiento**: si era una solicitud de iniciacion
- **Decaimiento**: si era un tramite dentro del procedimiento ya iniciado`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "73bd57b2-e802-4b9b-8d0f-e421b7b30c89");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RD 203/2021 art.14 subsanacion (" + exp2.length + " chars)");
})();
