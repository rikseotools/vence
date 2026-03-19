require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.104 compulsion directa obligacion personalisima no hacer
  const exp1 = `**Articulo 104.1 de la Ley 39/2015 (LPAC) - Compulsion sobre las personas:**

> "Los actos administrativos que impongan una obligacion personalisima de **no hacer o soportar** podran ser ejecutados por **compulsion directa** sobre las personas en los casos en que la ley expresamente lo autorice, y dentro siempre del **respeto debido a su dignidad** y a los derechos reconocidos en la Constitucion."

**Por que D es correcta (compulsion directa):**
La compulsion directa es el medio de ejecucion forzosa mas intenso, reservado para obligaciones **personalisimas de no hacer o soportar**. Solo procede cuando la ley lo autorice expresamente y siempre respetando la dignidad y derechos constitucionales.

**Por que las demas son incorrectas (medios de ejecucion diferentes):**

- **A)** "Procedimiento previsto en las normas reguladoras del procedimiento de **apremio**". Falso: el apremio sobre el patrimonio (art. **100** LPAC) se utiliza para ejecutar actos que impongan **obligaciones pecuniarias** (pago de dinero), no obligaciones personalisimas de no hacer.

- **B)** "Las Administraciones realizaran el acto, por si o a traves de las personas que determinen, a costa del obligado". Falso: esto describe la **ejecucion subsidiaria** (art. **102** LPAC), que procede cuando se trata de actos **no personalisimos** que pueden ser realizados por otra persona. Si la obligacion es personalisima, no puede encomendarse a un tercero.

- **C)** "El obligado debera resarcir los danos y perjuicios". Trampa sutil: esto corresponde al art. 104.**2**, que se aplica a las obligaciones personalisimas de **hacer** (no de "no hacer o soportar"). Si el obligado no realiza la prestacion de hacer, debe resarcir danos. La pregunta pide el medio para obligaciones de **no hacer**, que es la compulsion directa (art. 104.1).

**Medios de ejecucion forzosa (arts. 100-104 LPAC):**

| Medio | Articulo | Para que tipo de obligacion |
|-------|----------|-----------------------------|
| Apremio sobre patrimonio | Art. 100 | Obligaciones **pecuniarias** |
| Ejecucion subsidiaria | Art. 102 | Actos **no personalisimos** |
| Multa coercitiva | Art. 103 | Actos personalisimos o no |
| **Compulsion directa** | **Art. 104.1** | **Personalisimos de no hacer/soportar** |
| Resarcimiento danos | Art. 104.2 | Personalisimos de **hacer** |

**Clave:** No hacer/soportar personalisimo = compulsion directa (art. 104.1). No confundir con apremio (pecuniario), subsidiaria (no personalisimo) ni resarcimiento (hacer personalisimo).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "735dc70e-74bc-4c37-a2fb-33832509eb8e");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.104 compulsion directa (" + exp1.length + " chars)");
})();
