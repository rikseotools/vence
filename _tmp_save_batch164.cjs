require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LBRL art.65.2 requerimiento 15 días hábiles
  const exp1 = `**Articulo 65.2 de la Ley 7/1985 (LBRL) - Requerimiento para anulacion de actos locales:**

> Art. 65.2: "El requerimiento debera ser motivado y expresar la normativa que se estime vulnerada. Se formulara en el plazo de **quince dias habiles** a partir de la recepcion de la comunicacion del acuerdo."

**Por que D es correcta (quince dias habiles):**
El art. 65.2 LBRL establece un plazo de **15 dias habiles** (no naturales) para que la Administracion del Estado o la CA formule el requerimiento. Son dos datos clave: el numero (15, no 30) y el tipo (habiles, no naturales).

**Por que las demas son incorrectas:**

- **A)** "**Treinta** dias **habiles**". Falso: acierta en el tipo (habiles) pero duplica el plazo: son 15 dias, no 30. Treinta dias es el plazo de otro tramite: la entidad local tiene un **mes** para anular el acto tras recibir el requerimiento (art. 65.1), pero el requerimiento en si debe formularse en 15 dias.

- **B)** "**Treinta** dias **naturales**". Falso: contiene **dos errores**: (1) el plazo es 15, no 30; (2) los dias son habiles, no naturales.

- **C)** "**Quince** dias **naturales**". Falso: acierta en el numero (15) pero yerra en el tipo: son dias **habiles**, no naturales. En la LBRL los plazos para requerimientos se cuentan en dias habiles.

**Plazos del art. 65 LBRL (no confundir):**

| Accion | Plazo | Tipo |
|--------|-------|------|
| **Requerimiento** (art. 65.2) | **15 dias** | **Habiles** |
| Anulacion por la entidad local (art. 65.1) | 1 mes | - |
| Impugnacion ante la jurisdiccion c-a (art. 65.3) | 1 mes (desde requerimiento) | - |

**Clave:** Requerimiento = **15 dias habiles**. No confundir con el mes que tiene la entidad local para anular el acto.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "68adab87-3169-4824-8190-4516b1d580e8");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LBRL art.65 requerimiento 15 dias (" + exp1.length + " chars)");
})();
