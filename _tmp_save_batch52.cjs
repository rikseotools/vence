require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.1.1 pluralismo politico (variante con D correcta)
  const exp1 = `**Articulo 1.1 de la Constitucion Espanola:**

> "Espana se constituye en un Estado social y democratico de Derecho, que propugna como **valores superiores** de su ordenamiento juridico la **libertad**, la **justicia**, la **igualdad** y el **pluralismo politico**."

**Por que D es correcta:**
El pluralismo politico es uno de los **4 valores superiores** del ordenamiento juridico, recogidos en el **Titulo Preliminar** (art. 1.1 CE).

**Por que las demas son incorrectas:**

- **A)** "Derecho protegido por el art. 53.2". Falso: el pluralismo politico es un **valor**, no un derecho subjetivo protegido por recurso de amparo (art. 53.2). Los derechos del 53.2 son los de los arts. 14-29.

- **B)** "Titulo Primero, fundamento del orden politico". Falso: (1) esta en el **Titulo Preliminar**, no en el Primero; (2) la expresion "fundamento del orden politico y de la paz social" es del **art. 10.1** (dignidad y derechos inherentes), no del art. 1.1.

- **C)** "Preambulo, sociedad democratica avanzada". Falso: el pluralismo politico se recoge en el **art. 1.1** (con fuerza normativa), no en el Preambulo (sin fuerza normativa directa).

**Los 4 valores superiores (art. 1.1 CE):** libertad, justicia, igualdad, pluralismo politico.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "9a148731-0899-4b84-922c-5b7fcc0fc484");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.1.1 pluralismo v2 (" + exp1.length + " chars)");

  // #2 - CE art.103.3 acceso funcion publica merito y capacidad
  const exp2 = `**Articulo 103.3 de la Constitucion Espanola:**

> "La ley regulara [...] el acceso a la funcion publica de acuerdo con los principios de **merito y capacidad** [...]."

**Por que B es correcta:**
El art. 103.3 CE establece expresamente dos principios de acceso a la funcion publica: **merito** y **capacidad**. La opcion B (capacidad) es uno de ellos.

**Por que las demas son incorrectas:**

- **A)** "Igualdad". Aunque la igualdad en el acceso a la funcion publica existe como derecho constitucional, se recoge en el **art. 23.2 CE** ("Los ciudadanos tienen derecho a acceder en condiciones de **igualdad** a las funciones y cargos publicos"), **no** en el art. 103.3. La pregunta pide expresamente los principios "segun el articulo 103.3".

- **C)** "Idoneidad". Falso: la palabra "idoneidad" **no aparece** en el art. 103.3 CE. No es un principio constitucional de acceso a la funcion publica. Es un concepto que puede usarse coloquialmente pero no tiene base en este articulo.

- **D)** "Todas son correctas". Falso: ni la igualdad (art. 23.2, no 103.3) ni la idoneidad (no aparece en la CE) estan en el art. 103.3.

**Principios de acceso a la funcion publica:**
| Principio | Base constitucional |
|-----------|-------------------|
| Merito | Art. 103.3 CE |
| **Capacidad** | **Art. 103.3 CE** |
| Igualdad | Art. 23.2 CE (no 103.3) |
| Idoneidad | No aparece en la CE |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "66371cbd-4311-49f0-9e09-fa1b67306cc1");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.103.3 merito capacidad (" + exp2.length + " chars)");

  // #3 - Ley 9/2017 art.194 penalidades demora
  const exp3 = `**Articulo 194 de la Ley 9/2017 (LCSP)** - Penalidades por demora:

> Las penalidades se haran efectivas mediante **deduccion** de las cantidades que deban abonarse al contratista, o sobre la **garantia** que se hubiese constituido, cuando no puedan deducirse de los pagos.

**Por que A es correcta:**
El art. 194 LCSP establece un sistema de dos pasos para hacer efectivas las penalidades:
1. **Primero**: se deducen de los pagos pendientes al contratista (pago total o parcial)
2. **Si no es posible**: se ejecuta la **garantia** constituida

**Por que las demas son incorrectas:**

- **B)** "Deduccion... o mediante la **resolucion del contrato**". Falso: la alternativa a la deduccion no es la resolucion del contrato, sino la ejecucion de la **garantia**. La resolucion del contrato es una consecuencia distinta, regulada en otros articulos, y mucho mas grave que la simple penalidad.

- **C)** "Ejecucion de la **garantia provisional**, incrementada en un **5%**". Falso en dos aspectos: (1) se refiere a la garantia **definitiva**, no a la provisional (la garantia provisional ya no existe como obligatoria en la LCSP); (2) no se incrementa en un 5%. El 5% es el porcentaje habitual de la garantia definitiva, no un incremento sobre las penalidades.

- **D)** "Ninguna de las anteriores es correcta". Falso: la opcion A reproduce correctamente el contenido del art. 194 LCSP.

**Orden de ejecucion de penalidades:** 1o Deduccion de pagos -> 2o Ejecucion de garantia (si no cabe deduccion).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "8e270dcb-b06b-464e-84f7-9243cda25822");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LCSP art.194 penalidades (" + exp3.length + " chars)");
})();
