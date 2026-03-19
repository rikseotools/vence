require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE nombramientos del Rey Interventor General no
  const exp1 = `**Articulos 122.3, 123.2 y 124.4 de la Constitucion Espanola:**

> Art. 122.3: "[Los] **veinte miembros** [del CGPJ seran] **nombrados por el Rey** por un periodo de cinco anos."
> Art. 123.2: "El **Presidente del Tribunal Supremo** sera **nombrado por el Rey**, a propuesta del CGPJ."
> Art. 124.4: "El **Fiscal General del Estado** sera **nombrado por el Rey**, a propuesta del Gobierno, oido el CGPJ."

**Por que D es correcta (el Interventor General del Estado NO es nombrado por el Rey):**
El Interventor General del Estado es un alto cargo de la Administracion (Intervencion General de la Administracion del Estado, dependiente del Ministerio de Hacienda), pero su nombramiento **no aparece en la Constitucion** como atribucion del Rey. Se nombra por Real Decreto del Consejo de Ministros, no por el Rey en el sentido constitucional de los arts. 62 y siguientes CE.

**Por que las demas SI son nombramientos del Rey recogidos en la CE:**

- **A)** "Los veinte miembros del Consejo General del Poder Judicial". **SI**: art. 122.3 CE. El Rey nombra a los 20 vocales del CGPJ por 5 anos (12 entre jueces/magistrados + 4 del Congreso + 4 del Senado).

- **B)** "El Presidente del Tribunal Supremo". **SI**: art. 123.2 CE. Nombrado por el Rey a propuesta del CGPJ. El Presidente del TS es tambien Presidente del CGPJ.

- **C)** "El Fiscal General del Estado". **SI**: art. 124.4 CE. Nombrado por el Rey a propuesta del Gobierno, oido el CGPJ.

**Nombramientos del Rey en la CE (poder judicial):**

| Cargo | Articulo | Propuesta de |
|-------|----------|-------------|
| 20 vocales del CGPJ | Art. 122.3 | Congreso + Senado + segun ley |
| Presidente del TS | Art. 123.2 | CGPJ |
| Fiscal General del Estado | Art. 124.4 | Gobierno (oido CGPJ) |

**Clave:** El Interventor General del Estado no tiene nombramiento regio previsto en la CE. Los tres cargos del poder judicial (vocales CGPJ, Presidente TS, FGE) si los nombra el Rey.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "65387366-1806-4a3e-8484-52e93625d0d7");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE nombramientos Rey Interventor (" + exp1.length + " chars)");
})();
