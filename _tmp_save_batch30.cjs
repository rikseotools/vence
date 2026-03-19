require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Ley 40/2015 art.32.5 responsabilidad norma contraria UE
  const exp1 = `**Articulo 32.5 de la Ley 40/2015** (Responsabilidad por norma contraria al Derecho UE):

Para que proceda indemnizacion por aplicacion de una norma declarada contraria al Derecho de la UE, se requiere:

> "El particular haya obtenido, en cualquier instancia, sentencia firme **desestimatoria** de un recurso contra la actuacion administrativa que ocasiono el dano, siempre que se hubiera alegado la infraccion del Derecho de la UE."

Ademas, deben cumplirse estos tres requisitos:
- a) La norma ha de tener por objeto **conferir derechos** a los particulares
- b) El incumplimiento ha de estar **suficientemente caracterizado**
- c) Ha de existir **relacion de causalidad directa** entre el incumplimiento y el dano

**Por que B es la INCORRECTA:**
La opcion B dice "sentencia firme **estimatoria**", pero el art. 32.5 dice "sentencia firme **desestimatoria**". Es un cambio de una sola palabra que invierte el significado:
- **Estimatoria**: el tribunal le dio la razon al particular (le estimo el recurso)
- **Desestimatoria**: el tribunal le quito la razon al particular (le desestimo el recurso)

La logica es: si el particular ya perdio en los tribunales (sentencia desestimatoria), y luego la norma se declara contraria al Derecho UE, entonces tiene derecho a indemnizacion. Si la sentencia fue estimatoria, ya obtuvo tutela judicial y no necesita esta via.

**Por que las demas son correctas (SI son requisitos):**

- **A)** Relacion de causalidad directa. SI: art. 32.5.c) lo exige expresamente.
- **C)** Incumplimiento suficientemente caracterizado. SI: art. 32.5.b) lo exige.
- **D)** Norma que confiera derechos a particulares. SI: art. 32.5.a) lo exige.

**Truco:** Estimatoria vs desestimatoria. La via del art. 32.5 es para quienes **perdieron** en los tribunales y luego la norma se declara contraria al Derecho UE.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "789503d0-f073-4ac0-b8fe-a9e565897bdf");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 art.32.5 UE (" + exp1.length + " chars)");
})();
