require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LOPJ art.599 Pleno CGPJ competencias
  const exp1 = `**Articulo 599 de la LOPJ** (Competencias del Pleno del CGPJ):

El Pleno del CGPJ tiene una lista cerrada de competencias en el art. 599. Entre ellas:
- Propuesta de Magistrados del TC
- Nombramientos discrecionales
- Potestad reglamentaria
- **Aprobacion del Presupuesto** y recepcion de rendicion de cuentas (599.1.8a)
- **Aprobacion de la Memoria anual** (599.1.9a)
- Expedientes disciplinarios (separacion de carrera)

**Por que B es la INCORRECTA (no es competencia del Pleno):**
"Autorizar el escalafon de la carrera judicial" **no aparece** en la lista del art. 599. El escalafon judicial es una relacion ordenada de jueces y magistrados que gestiona el CGPJ a traves de otros organos, no requiere autorizacion del Pleno.

**Por que las demas son correctas (SI son del Pleno):**

- **A)** "Aprobar el presupuesto del Consejo". SI: art. 599.1.8a atribuye al Pleno la aprobacion del presupuesto del CGPJ.

- **C)** "Recepcion de la rendicion de cuentas del presupuesto". SI: art. 599.1.8a incluye tambien la recepcion de la rendicion de cuentas de la ejecucion presupuestaria.

- **D)** "Aprobar la Memoria anual". SI: art. 599.1.9a atribuye expresamente al Pleno la aprobacion de la Memoria anual.

**Truco:** Las opciones A, C y D se encuentran en la lista del art. 599 (apartados 8a y 9a). "Autorizar el escalafon" suena oficial pero no es competencia del Pleno.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "72439130-2d6c-4d5f-9e90-031b332a0e1d");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LOPJ art.599 Pleno CGPJ (" + exp1.length + " chars)");

  // #2 - LO 3/1981 art.10 quejas Defensor del Pueblo
  const exp2 = `**Articulo 10 de la LO 3/1981** (Defensor del Pueblo - Legitimacion para quejas):

> **10.1:** "Podra dirigirse al Defensor del Pueblo **toda persona natural o juridica** que invoque un interes legitimo, **sin restriccion alguna**. No podran constituir impedimento para ello la nacionalidad, residencia, sexo, minoria de edad, la incapacidad legal del sujeto, el internamiento en un centro penitenciario [...]"

> **10.3:** "**No podra presentar quejas** ante el Defensor del Pueblo **ninguna autoridad administrativa** en asuntos de su competencia."

**Por que D es correcta (NO puede presentar quejas):**
El art. 10.3 lo dice expresamente: las autoridades administrativas no pueden presentar quejas en asuntos de su competencia. El Defensor del Pueblo supervisa a la Administracion; no tendria sentido que la propia Administracion se queje ante el.

**Por que las demas son incorrectas (SI pueden presentar quejas):**

- **A)** "Menor de edad". SI puede: el art. 10.1 dice que la minoria de edad no es impedimento. Los menores tienen derecho a quejarse en defensa de sus intereses.

- **B)** "Persona condenada a pena privativa de libertad". SI puede: el art. 10.1 dice que el internamiento en un centro penitenciario no es impedimento. Los presos mantienen este derecho.

- **C)** "Nacional de Estados Unidos". SI puede: el art. 10.1 dice que la **nacionalidad** no es impedimento. Cualquier persona, sea o no espanola, puede dirigirse al Defensor del Pueblo.

**Clave:** Toda persona puede quejarse (sin restriccion de edad, nacionalidad ni situacion). La unica exclusion: **autoridades administrativas** en asuntos de su competencia.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "23452add-7dff-4d63-82d4-cd8db9c78aa3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/1981 art.10 quejas (" + exp2.length + " chars)");
})();
