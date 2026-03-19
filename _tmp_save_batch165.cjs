require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.47 nulidad pleno derecho vs anulabilidad
  const exp1 = `**Articulo 47 de la Ley 39/2015 (LPAC) - Nulidad de pleno derecho:**

> Art. 47.1: "Los actos de las Administraciones Publicas son nulos de pleno derecho en los casos siguientes:
> a) Los que **lesionen derechos y libertades susceptibles de amparo constitucional**.
> b) Los dictados por **organo manifiestamente incompetente** por razon de la materia o del territorio.
> c) Los que tengan un **contenido imposible**.
> d) Los que sean constitutivos de **infraccion penal** [...]
> e) Los dictados **prescindiendo total y absolutamente del procedimiento** [...]"

**Por que C es la opcion que NO es nulidad de pleno derecho:**
"Los actos que incurran en **cualquier** infraccion del ordenamiento juridico" NO son nulos de pleno derecho. Estos son actos **anulables** (art. 48 LPAC): "Son anulables los actos de la Administracion que incurran en cualquier infraccion del ordenamiento juridico, incluso la desviacion de poder." La anulabilidad es el vicio general; la nulidad de pleno derecho es excepcional y solo para los supuestos tasados del art. 47.

**Por que las demas SI son nulidad de pleno derecho:**

- **A)** "Contenido imposible". **SI**: nulidad de pleno derecho segun art. 47.1.**c**. Un acto cuyo contenido es material o juridicamente imposible es nulo.

- **B)** "Organo manifiestamente incompetente por razon de la materia o del territorio". **SI**: nulidad segun art. 47.1.**b**. La incompetencia manifiesta por materia o territorio es un vicio grave insubsanable.

- **D)** "Lesionen derechos susceptibles de amparo constitucional". **SI**: nulidad segun art. 47.1.**a**. La vulneracion de derechos fundamentales (arts. 14-29 y 30.2 CE) produce la nulidad mas grave.

**Nulidad (art. 47) vs Anulabilidad (art. 48):**

| Vicio | Consecuencia |
|-------|-------------|
| Contenido imposible, incompetencia manifiesta, lesion de derechos fundamentales, infraccion penal, prescindencia total de procedimiento | **Nulidad de pleno derecho** (art. 47) |
| **Cualquier otra** infraccion del ordenamiento | **Anulabilidad** (art. 48) |

**Clave:** "Cualquier infraccion del ordenamiento" = anulabilidad (art. 48), no nulidad. La nulidad se reserva para los supuestos tasados y graves del art. 47.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "081206d1-eaaa-43ba-a9f9-4ebc9d649f50");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.47 nulidad (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.52.4 convalidación falta autorización órgano competente
  const exp2 = `**Articulo 52 de la Ley 39/2015 (LPAC) - Convalidacion de actos anulables:**

> Art. 52.3: "Si el vicio consistiera en **incompetencia** no determinante de nulidad, la convalidacion podra realizarse por el organo competente cuando sea **superior jerarquico** del que dicto el acto viciado."
>
> Art. 52.4: "Si el vicio consistiese en la **falta de alguna autorizacion**, podra ser convalidado el acto mediante el otorgamiento de la misma por el **organo competente**."

**Por que A es correcta:**
Cuando el vicio es la **falta de autorizacion** (art. 52.4), la convalidacion se realiza mediante el otorgamiento de esa autorizacion por el **organo competente** para darla. No se requiere que sea superior jerarquico: basta con que sea el organo que tiene la competencia para autorizar.

**Por que las demas son incorrectas:**

- **B)** Dice que la convalidacion se realiza "por el organo competente cuando sea **superior jerarquico**". Falso para falta de autorizacion: esta regla del **superior jerarquico** corresponde al vicio de **incompetencia** (art. 52.3), no al de falta de autorizacion (art. 52.4). La trampa mezcla los apartados 3 y 4 del articulo.

- **C)** Dice "mediante el otorgamiento de la autorizacion por el **superior jerarquico** del que dicto el acto". Falso: combina elementos de los dos apartados. Para la falta de autorizacion, el art. 52.4 dice "organo competente" (el que tiene la competencia para autorizar), no "superior jerarquico".

- **D)** "Ninguna es correcta". Falso: la opcion A reproduce fielmente el art. 52.4.

**Reglas de convalidacion (art. 52):**

| Vicio | Quien convalida | Apartado |
|-------|----------------|----------|
| **Incompetencia** (no de nulidad) | **Superior jerarquico** competente | Art. 52.**3** |
| **Falta de autorizacion** | **Organo competente** para autorizar | Art. 52.**4** |

**Clave:** Incompetencia = superior jerarquico (art. 52.3). Falta de autorizacion = organo competente (art. 52.4). No mezclar las dos reglas.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "70f2fa56-89b6-46e8-966d-6a3c7dc8783e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.52 convalidacion (" + exp2.length + " chars)");

  // #3 - CE art.92 referéndum consultivo Presidente Gobierno + Congreso
  const exp3 = `**Articulo 92.2 de la Constitucion Espanola - Referendum consultivo:**

> "El referendum sera convocado por el **Rey**, mediante propuesta del **Presidente del Gobierno**, previamente autorizada por el **Congreso de los Diputados**."

**Por que B es correcta:**
El art. 92.2 CE establece una cadena de tres actores para el referendum consultivo:
1. **Propone**: el Presidente del **Gobierno** (no del Congreso)
2. **Autoriza**: el **Congreso** de los Diputados (no las Cortes Generales)
3. **Convoca**: el **Rey**

La opcion B recoge correctamente los dos primeros elementos.

**Por que las demas son incorrectas:**

- **A)** Dice "propuesta del Presidente del **Congreso**". Falso: quien propone es el Presidente del **Gobierno**, no el del Congreso. El Presidente del Congreso tiene otras funciones (refrendar la disolucion de Camaras, proponer candidato a Presidente del Gobierno), pero no proponer referendums.

- **C)** Contiene **dos errores**: (1) dice "Presidente del **Congreso**" en vez de Presidente del Gobierno; (2) dice "autorizada por las **Cortes Generales**" en vez de solo el Congreso de los Diputados. Solo el Congreso autoriza, no el Senado.

- **D)** Dice "autorizada por las **Cortes Generales**". Falso: el art. 92.2 dice **Congreso de los Diputados**, no Cortes Generales (que incluyen Congreso + Senado). La autorizacion es competencia exclusiva del Congreso; el Senado no interviene en este tramite.

**Clave:** Referendum consultivo: **Gobierno** propone + **Congreso** autoriza + **Rey** convoca. No confundir Presidente del Gobierno con Presidente del Congreso, ni Congreso con Cortes Generales.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "10d568c4-6aaa-4809-9da0-f6efec0df402");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.92 referendum consultivo (" + exp3.length + " chars)");
})();
