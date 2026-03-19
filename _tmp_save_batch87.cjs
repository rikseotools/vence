require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.53.2 recurso de amparo derecho de reunion
  const exp1 = `**Articulo 53.2 de la Constitucion Espanola:**

> "Cualquier ciudadano podra recabar la tutela de las libertades y derechos reconocidos en el **articulo 14** y la **Seccion primera del Capitulo segundo** ante los Tribunales ordinarios [...] y, en su caso, a traves del **recurso de amparo** ante el Tribunal Constitucional."

**Por que D es correcta (derecho de reunion):**
El recurso de amparo ante el TC protege solo los derechos del **art. 14** y la **Seccion 1a del Capitulo II del Titulo I** (arts. 15 a 29). El derecho de **reunion** esta en el **art. 21 CE**, que pertenece a esa Seccion 1a. Por tanto, SI puede ser objeto de recurso de amparo.

**Por que las demas son incorrectas (estan fuera de la Seccion 1a):**

- **A)** "Proteccion de la **familia**" (art. 39 CE). Falso: esta en el **Capitulo III** ("Principios rectores de la politica social y economica", arts. 39-52). Los principios rectores NO tienen recurso de amparo; solo se pueden alegar ante la jurisdiccion ordinaria segun las leyes que los desarrollen (art. 53.3 CE).

- **B)** "Proteccion de la **salud**" (art. 43 CE). Falso: tambien esta en el **Capitulo III** (principios rectores). No tiene recurso de amparo.

- **C)** "Derecho al **trabajo**" (art. 35 CE). Falso: esta en la **Seccion 2a del Capitulo II** (arts. 30-38). Los derechos de la Seccion 2a tienen reserva de ley y vinculan a los poderes publicos, pero NO tienen recurso de amparo.

**Niveles de proteccion de derechos en la CE:**

| Derechos | Ubicacion | Recurso de amparo |
|----------|-----------|-------------------|
| Art. 14 + Seccion 1a (arts. 15-29) | Cap. II | **SI** |
| Seccion 2a (arts. 30-38) | Cap. II | **NO** |
| Principios rectores (arts. 39-52) | Cap. III | **NO** |

**Clave:** Amparo = art. 14 + arts. 15-29. Reunion (art. 21) esta dentro. Familia (39), salud (43) y trabajo (35) estan fuera.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e342f110-cdb4-41a2-abea-7b0fc2d9234c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.53.2 amparo (" + exp1.length + " chars)");

  // #2 - CE art.20.5 secuestro publicaciones solo resolucion judicial
  const exp2 = `**Articulo 20.5 de la Constitucion Espanola:**

> "Solo podra acordarse el secuestro de publicaciones, grabaciones y otros medios de informacion en virtud de **resolucion judicial**."

**Por que D es correcta (solo resolucion judicial):**
El art. 20.5 CE establece una garantia absoluta: el secuestro de publicaciones **solo** puede acordarse por **resolucion judicial**. Ningun otro poder del Estado (ni el Gobierno, ni las Cortes, ni la Administracion) puede ordenar el secuestro de medios de informacion. Es una proteccion directa de la libertad de prensa y expresion.

**Por que las demas son incorrectas:**

- **A)** "En ningun caso". Falso: el secuestro SI es posible, pero solo por via judicial. La libertad de expresion del art. 20 no es absoluta; tiene limites (art. 20.4: honor, intimidad, proteccion de la juventud). Lo que se protege es que solo un **juez** pueda ordenar el secuestro.

- **B)** "Unicamente cuando se vulnere el derecho a la proteccion de la juventud y la infancia". Falso: aunque la proteccion de la juventud es uno de los limites del art. 20.4 CE, el secuestro no se limita solo a ese supuesto. Puede ordenarse judicialmente por cualquier causa legal (ej: proteccion del honor, de la intimidad, etc.). Ademas, lo determinante no es el motivo sino el **medio**: siempre resolucion judicial.

- **C)** "En virtud de resolucion del **Ministerio de la Presidencia**". Falso: un ministerio es un organo del **poder ejecutivo**. El art. 20.5 CE reserva el secuestro exclusivamente al **poder judicial**. Que un ministerio pudiera secuestrar publicaciones seria una forma de censura gubernamental, incompatible con la libertad de expresion.

**Secuestro de publicaciones (art. 20.5 CE):**
- **Unico medio:** resolucion judicial (ni Gobierno, ni Ministerio, ni Administracion)
- Garantia de la libertad de expresion e informacion
- Relacionado con los limites del art. 20.4 (honor, intimidad, juventud)

**Clave:** Solo un **juez** puede ordenar el secuestro de publicaciones. Ni "nunca" (A) ni el Gobierno (C).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "339aee01-e4f5-4f16-b66e-bc14726fe6d8");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.20.5 secuestro publicaciones (" + exp2.length + " chars)");

  // #3 - CE art.56 Rey comunidad historica
  const exp3 = `**Articulo 56.1 de la Constitucion Espanola:**

> "El Rey es el Jefe del Estado, simbolo de su unidad y permanencia, arbitra y modera el funcionamiento regular de las instituciones, asume la mas alta representacion del Estado espanol en las relaciones internacionales, especialmente con las naciones de su **comunidad historica**, y ejerce las funciones que le atribuyen expresamente la Constitucion y las leyes."

**Por que D es correcta (comunidad historica):**
El art. 56.1 CE dice literalmente "comunidad **historica**". Se refiere a los paises con los que Espana comparte una vinculacion historica derivada de siglos de relacion (principalmente los paises hispanoamericanos, pero tambien otros como Filipinas, Guinea Ecuatorial, etc.). El Rey tiene un papel de representacion especialmente relevante con estos paises.

**Por que las demas son incorrectas (cambian "historica" por otra palabra):**

- **A)** "Naciones **iberoamericanas**". Falso: aunque las naciones iberoamericanas estan incluidas dentro de la "comunidad historica", el art. 56.1 usa la expresion mas amplia "comunidad historica", no "iberoamericanas". Ademas, "iberoamericanas" es un termino del art. 11.3 CE (sobre doble nacionalidad), no del art. 56.

- **B)** "Naciones de la **Union Europea**". Falso: la relacion con la UE no es la que destaca el art. 56.1. La UE es una organizacion supranacional a la que Espana pertenece, pero no es la "comunidad historica" del Rey. Ademas, la CE de 1978 es anterior a la entrada de Espana en la CEE (1986).

- **C)** "Naciones de su **comunidad cultural**". Falso: cambia "historica" por "cultural". Aunque suena parecido, la CE dice expresamente "comunidad **historica**". La trampa es que suena plausible, ya que la relacion historica incluye vinculos culturales, pero la palabra exacta es "historica".

**Art. 56.1 CE - Funciones del Rey:**
- Jefe del Estado
- Simbolo de unidad y permanencia
- Arbitra y modera las instituciones
- Mas alta representacion internacional, especialmente con la **comunidad historica**

**Clave:** "Comunidad **historica**" (no cultural, no iberoamericana, no UE).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "abe7fc65-3257-4fb8-afac-bcaf873045f5");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.56 comunidad historica (" + exp3.length + " chars)");
})();
