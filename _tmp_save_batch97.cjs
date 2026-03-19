require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.164 sentencias TC publicacion votos particulares
  const exp1 = `**Articulo 164.1 de la Constitucion Espanola:**

> "Las sentencias del Tribunal Constitucional se publicaran en el **boletin oficial del Estado** con los **votos particulares**, si los hubiere. Tienen el valor de cosa juzgada a partir del **dia siguiente** de su publicacion y no cabe recurso alguno contra ellas. Las que declaren la inconstitucionalidad de una ley [...] y todas las que **no se limiten** a la estimacion subjetiva de un derecho, tienen plenos efectos frente a todos."

**Por que D es correcta:**
La opcion D reproduce fielmente el primer inciso del art. 164.1: las sentencias del TC se publican en el **BOE** con los **votos particulares** (opiniones discrepantes de los magistrados que no estan de acuerdo con la mayoria).

**Por que las demas son incorrectas (cada una altera un elemento del articulo):**

- **A)** "Las que estimen **subjetivamente** un derecho tienen plenos efectos frente a todos". Falso: invierte la regla. El art. 164.1 dice que tienen plenos efectos frente a todos las que "**no se limiten** a la estimacion subjetiva de un derecho". Las estimaciones puramente subjetivas (ej: un amparo que solo afecta al recurrente) NO tienen efectos erga omnes.

- **B)** "Pueden ser objeto de **recurso de casacion** para la unificacion de la doctrina". Falso: el art. 164.1 dice expresamente que "**no cabe recurso alguno** contra ellas". Las sentencias del TC son irrecurribles. No existe casacion contra sentencias del TC.

- **C)** "Tienen valor de cosa juzgada desde el **dia de su publicacion**". Falso: el art. 164.1 dice "a partir del **dia siguiente** de su publicacion", no desde el dia de su publicacion. La diferencia es de un dia, pero es la trampa clave.

**Sentencias del TC (art. 164.1 CE):**
- Se publican en el **BOE** con votos particulares
- Cosa juzgada: desde el **dia siguiente** a la publicacion (no el mismo dia)
- **Irrecurribles** (no cabe recurso alguno)
- Efectos erga omnes: solo las que NO se limitan a estimacion subjetiva

**Clave:** Tres trampas principales: "dia de" vs "dia siguiente" (C), "estimen subjetivamente" vs "no se limiten a" (A), y recurso inexistente (B).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "3ddf691c-73f5-48d2-9e2f-b92a36e18a2a");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.164 sentencias TC (" + exp1.length + " chars)");

  // #2 - LOPJ art.63 Presidente AN consideracion Presidente Sala TS
  const exp2 = `**Articulo 63.2 de la Ley Organica del Poder Judicial:**

> "El Presidente de la Audiencia Nacional, que tendra la consideracion de **Presidente de Sala del Tribunal Supremo**, es el Presidente nato de todas sus Salas."

**Por que A es correcta (Presidente de Sala del TS):**
El art. 63.2 LOPJ otorga al Presidente de la Audiencia Nacional una **equiparacion honorifica y funcional** con un Presidente de Sala del Tribunal Supremo. Esto refleja la importancia de la Audiencia Nacional en el organigrama judicial espanol, situandola un escalon por debajo del TS pero por encima de las Audiencias Provinciales.

**Por que las demas son incorrectas:**

- **B)** "Presidente del Tribunal Central de Instancia". Falso: no existe tal figura. Los Tribunales de Instancia son organos de los partidos judiciales (art. 84 LOPJ), no de la Audiencia Nacional. No hay un "Tribunal Central de Instancia".

- **C)** "Presidente del Tribunal Constitucional". Falso: el Presidente del TC es elegido por los propios Magistrados del TC (art. 160 CE). No tiene nada que ver con la Audiencia Nacional. Son organos completamente distintos (el TC no forma parte del Poder Judicial).

- **D)** "Fiscal General del Estado". Falso: el Fiscal General del Estado es nombrado por el Rey a propuesta del Gobierno (art. 124.4 CE). Es el jefe del Ministerio Fiscal, no del Poder Judicial. No tiene relacion con la Presidencia de la Audiencia Nacional.

**Jerarquia judicial (equiparaciones):**

| Presidente de... | Consideracion de... |
|-------------------|---------------------|
| **Audiencia Nacional** | **Presidente de Sala del TS** |
| TSJ de CCAA | Magistrado del TS (art. 72 LOPJ) |

**Clave:** El Presidente de la AN tiene consideracion de Presidente de Sala del **Tribunal Supremo** (no de otro organo).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "3cd19656-413e-4690-ad5e-6c31bf3e0431");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOPJ art.63 Presidente AN (" + exp2.length + " chars)");
})();
