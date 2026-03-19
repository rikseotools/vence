require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LCSP art.235 supervisión proyectos de obra 500.000 euros
  const exp1 = `**Articulo 235 de la Ley 9/2017 (LCSP) - Supervision de proyectos de obra:**

> "Antes de la aprobacion del proyecto, cuando el **presupuesto base de licitacion** del contrato de obras sea **igual o superior a 500.000 euros**, **IVA excluido**, los organos de contratacion deberan solicitar un informe de las correspondientes oficinas o unidades de supervision de los proyectos."

**Por que D es correcta (500.000 euros):**
El art. 235 LCSP establece que la supervision de proyectos de obra es obligatoria cuando el presupuesto base de licitacion alcanza los **500.000 euros** (IVA excluido). Por debajo de esa cifra, la supervision no es preceptiva. El umbral es "igual o superior", es decir, con exactamente 500.000 ya es obligatoria.

**Por que las demas son incorrectas (umbrales diferentes):**

- **A)** "18.000 euros". Falso: 18.000 euros no aparece en el art. 235. Esta cifra se asocia a otros umbrales de la LCSP (por ejemplo, contratos menores de servicios y suministros). Es un distractor que confunde umbrales de diferentes preceptos.

- **B)** "350.000 euros". Falso: 350.000 euros aparece en otro contexto de la LCSP: es el umbral maximo para **contratos menores de obras** (art. 118.1). No tiene relacion con la supervision de proyectos. La trampa mezcla cifras de distintos articulos.

- **C)** "50.000 euros". Falso: 50.000 euros tampoco aparece en el art. 235. Es un distractor que reduce en 10 veces el umbral real. No corresponde a ningun umbral relevante de la LCSP en este contexto.

**Umbrales clave de la LCSP (para no confundir):**

| Concepto | Umbral |
|----------|--------|
| **Supervision de proyectos de obra** | **500.000 euros** |
| Contrato menor de obras | 40.000 euros |
| Contrato menor de servicios/suministros | 15.000 euros |

**Clave:** Supervision obligatoria de proyectos de obra = **500.000 euros** (IVA excluido). No confundir con los 40.000 de contratos menores de obras.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "4a89d3ac-f58a-4a5d-8d67-f275c9137c0e");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP art.235 supervision 500.000 (" + exp1.length + " chars)");
})();
