require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LOPJ art.568 renovación CGPJ plazo 4 meses
  const exp1 = `**Articulo 568.2 de la Ley Organica del Poder Judicial:**

> "A tal efecto, y a fin de que las Camaras puedan dar comienzo al proceso de renovacion del Consejo, **cuatro meses** antes de la expiracion del mencionado plazo, el Presidente del Tribunal Supremo y del Consejo General del Poder Judicial dispondra: a) la remision a los Presidentes del Congreso de los Diputados y del Senado de los datos del escalafon [...] b) la apertura del **plazo de presentacion de candidaturas** para la designacion de los Vocales correspondientes al turno judicial."

**Por que A es correcta (cuatro meses):**
El art. 568.2 LOPJ establece un plazo concreto: **4 meses** antes de que expire el mandato del CGPJ, el Presidente del Tribunal Supremo debe abrir el proceso de candidaturas. Este plazo permite a las Camaras (Congreso y Senado) tener tiempo suficiente para evaluar candidatos y votar la renovacion antes de que expire el mandato de 5 anos (art. 568.1).

**Por que las demas son incorrectas (inventan plazos falsos):**

- **B)** "Siete meses". Falso: el art. 568.2 dice expresamente "cuatro meses", no siete. Es un plazo inventado.

- **C)** "Seis meses". Falso: tampoco aparece en el articulo. Es otro plazo inventado que suena plausible pero no es el correcto.

- **D)** "Nueve meses". Falso: este plazo es excesivamente largo y no aparece en la LOPJ. Ningun plazo de la LOPJ para renovacion del CGPJ es de nueve meses.

**Renovacion del CGPJ (art. 568 LOPJ):**
- Mandato: **5 anos** desde la constitucion
- Plazo para abrir candidaturas: **4 meses** antes de expirar
- Quien lo inicia: **Presidente del TS y del CGPJ**
- Destinatarios: Presidentes del Congreso y del Senado

**Clave:** El plazo es **4 meses**. Las trampas usan plazos inventados (6, 7 o 9 meses) que no aparecen en el art. 568.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "33d7ac82-76eb-45a2-b727-b37f9a4a6a01");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LOPJ art.568 renovacion CGPJ (" + exp1.length + " chars)");

  // #2 - LOPJ art.567 presencia equilibrada mujeres/hombres CGPJ
  const exp2 = `**Articulo 567.2 de la Ley Organica del Poder Judicial:**

> "Cada una de las Camaras elegira, por mayoria de tres quintos de sus miembros, a diez Vocales [...] En dicha eleccion, **cada una de las Camaras** garantizara el principio de presencia equilibrada de mujeres y hombres de forma que entre las **diez personas vocales** se incluya como minimo un **cuarenta por ciento** de cada uno de los sexos."

**Por que C es correcta (minimo 40% por cada camara):**
El art. 567.2 establece dos claves:
1. El porcentaje minimo es el **40%** de cada sexo (no el 50%)
2. Se aplica a **cada camara por separado** (en los 10 vocales que elige cada una), no al conjunto de los 20

Es decir, tanto el Congreso como el Senado deben garantizar individualmente que al menos 4 de sus 10 vocales sean de cada sexo.

**Por que las demas son incorrectas (cada una cambia un elemento):**

- **A)** "Proporcion del **50%** en los 10 vocales elegidos por cada camara". Falso: el porcentaje minimo es el **40%**, no el 50%. El 50% seria paridad exacta; la ley establece una proporcion minima inferior.

- **B)** "Minimo 40% en el **conjunto de los 20 vocales**, pudiendo ser objeto de compensacion". Doble error: el 40% se aplica a **cada camara** individualmente (10 vocales), no al conjunto de 20. Ademas, la compensacion entre camaras no existe: cada una debe cumplir por separado.

- **D)** "**50%** en el conjunto de los 20 vocales, pudiendo ser objeto de compensacion". Triple error: usa 50% en vez de 40%, habla del conjunto de 20 en vez de por camara, y anade la compensacion que no existe.

**Presencia equilibrada en el CGPJ (art. 567.2):**
- **Minimo 40%** de cada sexo
- Se aplica a **cada camara** por separado (10 vocales)
- **NO** hay compensacion entre Congreso y Senado
- Mayoria requerida: **3/5** de cada camara

**Clave:** 40% por cada camara (no 50%, no en conjunto, no con compensacion).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "05473cb8-36ee-4b90-85d6-43e4f163fade");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOPJ art.567 presencia equilibrada (" + exp2.length + " chars)");

  // #3 - RGPD art.7.4 consentimiento libre datos no necesarios
  const exp3 = `**Articulo 7.4 del Reglamento (UE) 2016/679 (RGPD):**

> "Al evaluar si el consentimiento se ha dado libremente, se tendra en cuenta en la mayor medida posible el hecho de si, entre otras cosas, la ejecucion de un contrato, **incluida la prestacion de un servicio**, se supedita al consentimiento al tratamiento de datos personales que **no son necesarios** para la ejecucion de dicho contrato."

**Por que D es correcta:**
El art. 7.4 RGPD establece una regla clave para evaluar si el consentimiento fue **libre**: hay que verificar si la empresa condiciona un contrato (o servicio) a que el usuario acepte el tratamiento de datos que **no son necesarios** para ese contrato. Si es asi, el consentimiento no se considera libre.

Ejemplo: si para comprar un producto online te obligan a aceptar que usen tus datos para publicidad, ese consentimiento no es libre (los datos publicitarios no son necesarios para la compra).

**Por que las demas son incorrectas (cada una invierte uno o dos elementos):**

- **A)** "**Sin incluir** la prestacion de un servicio" + "datos que **son necesarios**". Doble error: el art. 7.4 dice "**incluida** la prestacion de un servicio" y se refiere a datos "**no** necesarios". Invierte ambos elementos.

- **B)** "**Incluida** la prestacion de un servicio" + "datos que **son necesarios**". Un error: la primera parte es correcta, pero dice "necesarios" cuando el articulo dice "**no** necesarios". Si los datos fueran necesarios para el contrato, pedirlos seria legitimo y no habria problema de libertad.

- **C)** "**Sin incluir** la prestacion de un servicio" + "datos que **no son necesarios**". Un error: la segunda parte es correcta, pero dice "sin incluir" cuando el articulo dice "**incluida**". La prestacion de servicios SI esta comprendida en el ambito del articulo.

**Las dos claves del art. 7.4 RGPD:**
1. El ambito incluye contratos **Y** prestacion de servicios ("**incluida**")
2. Se refiere a datos **NO necesarios** para el contrato

**Clave:** "Incluida" + "no son necesarios". Las trampas invierten uno o ambos elementos.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "9af519ab-5d6a-4e99-9d9f-7187b6f69dfa");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RGPD art.7.4 consentimiento (" + exp3.length + " chars)");
})();
