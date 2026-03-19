require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 20 del TREBEP (RDL 5/2015)** - Evaluacion del desempeno:

> **20.3:** Las Administraciones determinaran los efectos de la evaluacion en la **carrera profesional horizontal**, la **formacion**, la **provision de puestos** y en la percepcion de las **retribuciones complementarias** del art. 24.
>
> **20.4:** "La continuidad en un puesto de trabajo obtenido por concurso quedara vinculada a la evaluacion del desempeno."

**Por que C es correcta:**
El art. 20.4 establece expresamente que la continuidad en un puesto obtenido por concurso depende de la evaluacion del desempeno. Es un efecto directo y especifico.

**Por que las demas son incorrectas:**

- **A)** Dice "retribuciones complementarias derivadas de la carrera **administrativa**". Falso: el art. 20.3 se refiere a la carrera profesional **horizontal**, que es un sistema distinto de la carrera administrativa tradicional (vertical/por grados).

- **B)** Dice "retribuciones **basicas**". Falso: el art. 20.3 habla de retribuciones **complementarias** (art. 24). Las retribuciones basicas dependen del grupo/subgrupo de clasificacion, no de la evaluacion.

- **D)** "Promocion interna" - No aparece en la lista de efectos del art. 20.3. La evaluacion afecta a carrera horizontal, formacion, provision de puestos y retribuciones complementarias. La promocion interna se regula en el art. 18 con sus propios requisitos.

**Clave:** No confundir carrera profesional horizontal (art. 16.3, afectada por evaluacion) con carrera administrativa vertical ni con promocion interna.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "748a7f71-f684-490c-9232-efd1d11d6c77");

  if (error) console.error("Error:", error);
  else console.log("OK - TREBEP art.20 guardada (" + explanation.length + " chars)");
})();
