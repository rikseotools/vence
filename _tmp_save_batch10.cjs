require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.1.1 valores superiores (variante con distractores distintos)
  const exp1 = `**Articulo 1.1 de la Constitucion Espanola:**

> "Espana se constituye en un Estado social y democratico de Derecho, que propugna como valores superiores de su ordenamiento juridico la **libertad**, la **justicia**, la **igualdad** y el **pluralismo politico**."

**Por que A es correcta:**
Reproduce literalmente los cuatro valores superiores del art. 1.1 CE: libertad, justicia, igualdad y pluralismo politico. Son exactamente cuatro, ni mas ni menos.

**Por que las demas son incorrectas:**

- **B)** "Libertad de expresion, libertad de catedra y libertad sindical". Estos son **derechos fundamentales** concretos (arts. 20, 20.1.c y 28.1 CE), no valores superiores del ordenamiento. Los valores del art. 1.1 son conceptos generales, no derechos especificos.

- **C)** "Dignidad humana, libertad, democracia, igualdad, Estado de Derecho y respeto a los derechos humanos". Estos son los **valores de la Union Europea** recogidos en el art. 2 del Tratado de la UE (TUE), no los de la Constitucion Espanola. Es una trampa para confundir los valores de la UE con los de la CE.

- **D)** "Libertad, igualdad y fraternidad". Es el lema de la **Revolucion Francesa**, no los valores del art. 1.1 CE. La CE incluye libertad e igualdad, pero no "fraternidad" (la sustituye por "justicia" y "pluralismo politico").

**Valores superiores art. 1.1 CE:** Libertad, Justicia, Igualdad, Pluralismo politico.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "8d3975df-ac9b-46a0-975a-0a1d65f06d10");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.1.1 valores v2 (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.30 dias inhabiles
  const exp2 = `**Articulo 30.7 de la Ley 39/2015** (Calendario de dias inhabiles):

> **30.7:** "La **Administracion General del Estado** y las **Administraciones de las Comunidades Autonomas**, con sujecion al calendario laboral oficial, fijaran, en su respectivo ambito, el calendario de dias inhabiles a efectos de computos de plazos."

**Por que D es correcta:**
El art. 30.7 atribuye la competencia de fijar el calendario de dias inhabiles a solo dos niveles: la AGE y las Administraciones de las CCAA. Las Entidades Locales y las Diputaciones quedan fuera.

**Por que las demas son incorrectas:**

- **A)** "Administraciones de las CCAA y las Entidades Locales". Falso: falta la AGE y sobran las Entidades Locales. El art. 30.7 no incluye a las EELL en la fijacion del calendario de dias inhabiles.

- **B)** "AGE, Administraciones de las CCAA y las Entidades Locales". Falso: sobran las Entidades Locales. El art. 30.7 solo menciona AGE y CCAA.

- **C)** "AGE, Administraciones de las CCAA y las Diputaciones Provinciales". Falso: sobran las Diputaciones Provinciales. Estas son entidades locales y no tienen esta competencia segun el art. 30.7.

**Clave:** Solo **dos niveles** fijan el calendario de dias inhabiles: AGE y CCAA. Las Entidades Locales (incluyendo Diputaciones) no.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "77be3a4c-6e9f-4ffd-842e-4ef3af68ca4e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.30 inhabiles (" + exp2.length + " chars)");
})();
