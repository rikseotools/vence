require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LCSP art.232 tipos de obras rehabilitación vs restauración
  const exp1 = `**Articulo 232 de la Ley 9/2017 (LCSP) - Clasificacion de las obras:**

> Art. 232.6: "Son obras de **rehabilitacion** aquellas que tienen por objeto reparar una construccion conservando su estetica, respetando su valor historico y **dotandola de una nueva funcionalidad** que sea compatible con los elementos y valores originales del inmueble."

**Por que A es correcta (obras de rehabilitacion):**
La definicion del enunciado coincide exactamente con el art. 232.6: reparar + conservar estetica + respetar valor historico + **nueva funcionalidad** compatible con los valores originales. La clave esta en ese ultimo elemento: dotar de nueva funcionalidad.

**Por que las demas son incorrectas:**

- **B)** "Obras de **mantenimiento**". Falso: las obras de conservacion y mantenimiento (art. 232.1.c) se limitan a mantener el bien en condiciones de funcionamiento y no implican reparacion integral ni respeto al valor historico. Son trabajos rutinarios de conservacion.

- **C)** "Obras de **restauracion**". Esta es la trampa principal. Las obras de restauracion (art. 232.5) tambien reparan conservando la estetica y respetando el valor historico, pero con una diferencia fundamental: **mantienen la funcionalidad original** en vez de dotar de una **nueva** funcionalidad. Restauracion = mantener lo que habia. Rehabilitacion = dar una funcion nueva compatible.

- **D)** "Obras de **conservacion**". Falso: como las de mantenimiento, las obras de conservacion (art. 232.1.c) son trabajos para preservar el bien, no para transformar su funcionalidad ni necesariamente respetar un valor historico.

**Diferencia clave restauracion vs rehabilitacion:**

| Tipo | Estetica | Valor historico | Funcionalidad |
|------|----------|----------------|---------------|
| **Restauracion** | Conserva | Respeta | **Mantiene** la original |
| **Rehabilitacion** | Conserva | Respeta | **Nueva** funcionalidad compatible |

**Clave:** La palabra "nueva funcionalidad" distingue la rehabilitacion de la restauracion. Si se mantiene la funcion original = restauracion. Si se da una funcion nueva = rehabilitacion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "9b0d6bce-a56d-410d-8c7d-4393cf478021");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP art.232 rehabilitacion vs restauracion (" + exp1.length + " chars)");
})();
