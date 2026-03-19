require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // === PREGUNTA 2: CE Art. 2 (la mas insuficiente) ===
  const explanation2 = `**Artículo 2 de la Constitución Española:**

> "La Constitución se fundamenta en la indisoluble unidad de la Nación española, patria común e indivisible de todos los españoles, y reconoce y garantiza el derecho a la autonomía de las nacionalidades y regiones que la integran y la solidaridad entre todas ellas."

**¿Por qué D es correcta?**
La opción D recoge directamente el contenido del artículo 2: la Constitución "reconoce y garantiza la solidaridad entre todas las nacionalidades y regiones".

**¿Por qué las demás son incorrectas?**

- **A)** "La forma política del Estado español es la Monarquía parlamentaria" → Esto está en el **artículo 1.3**, no en el 2.

- **B)** "La riqueza de las distintas modalidades lingüísticas..." → Esto corresponde al **artículo 3.3** de la CE.

- **C)** "La soberanía nacional reside en el pueblo español..." → Esto está en el **artículo 1.2**, no en el 2.

**Truco para recordar:** El artículo 2 habla de tres ideas clave: **unidad** de la Nación, **autonomía** de nacionalidades y regiones, y **solidaridad** entre ellas.`;

  const { error: err2 } = await supabase
    .from("questions")
    .update({ explanation: explanation2 })
    .eq("id", "541822d6-d3c1-4fe2-b0af-822fef4208c0");

  if (err2) console.error("Error pregunta CE:", err2);
  else console.log("OK - Pregunta CE art.2 actualizada (" + explanation2.length + " chars)");

  // === PREGUNTA 1: Ley 15/2022 Art. 2 (mejorable) ===
  const explanation1 = `**Artículo 2.4 de la Ley 15/2022** (Igualdad de trato y no discriminación):

> "Las obligaciones establecidas en la presente ley serán de aplicación al **sector público**. También lo serán a las personas físicas o jurídicas de carácter privado que residan, se encuentren o actúen en territorio español."

**¿Por qué D es correcta?**
La pregunta pide identificar un destinatario específico mencionado en la ley. El artículo 2.4.c) incluye expresamente a "las entidades que integran la **Administración Local**" dentro del sector público al que se aplican las obligaciones.

**¿Por qué las demás no son la mejor respuesta?**

- **A)** "A las personas jurídicas" → Parcialmente cierto (art. 2.4 las menciona), pero es incompleto: la ley también se aplica al sector público y a personas físicas.

- **B)** "A todas las personas" → Demasiado genérico. Aunque la ley tiene un ámbito amplio, esta opción no refleja la distinción que hace el artículo entre sector público y sector privado.

- **C)** "A las personas físicas" → Parcialmente cierto, pero igualmente incompleto: omite al sector público y a las personas jurídicas.

**Clave:** El artículo 2.4 distingue entre sector público (donde están las entidades locales) y sector privado (personas físicas y jurídicas). La opción D es la única que nombra un destinatario expresamente citado en la ley.`;

  const { error: err1 } = await supabase
    .from("questions")
    .update({ explanation: explanation1 })
    .eq("id", "da400714-a21e-4250-b3b6-b483fb39e95a");

  if (err1) console.error("Error pregunta Ley 15/2022:", err1);
  else console.log("OK - Pregunta Ley 15/2022 art.2 actualizada (" + explanation1.length + " chars)");
})();
