require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LGP art.79 pagos a justificar calendario obligatorio
  const exp1 = `**Articulo 79 de la Ley 47/2003 (LGP) - Pagos a justificar en localidades sin dependencia:**

> Art. 79.3: "En **todas** las propuestas de pagos a justificar debera incluirse un **calendario** de las actuaciones que se pretenda financiar con el correspondiente libramiento."

**Por que A es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion A dice que "no sera obligatorio incluir un calendario". Falso: el art. 79.3 dice que **si** es obligatorio incluir un calendario en **todas** las propuestas de pagos a justificar. La trampa anade un "no" que invierte el sentido de la obligacion.

**Por que las demas SI son correctas:**

- **B)** "Los ministros, presidentes o directores [...] que autoricen la expedicion designaran el organo competente para gestionarlos." **Correcto**: recoge lo previsto en el art. 79 sobre la designacion del organo gestor.

- **C)** "La expedicion de pagos a justificar sera autorizada por los ministros, presidentes o directores de los organismos autonomos o de las entidades gestoras." **Correcto**: reproduce la regla de autorizacion del art. 79.

- **D)** "La designacion del organo competente implicara la atribucion de competencias para la realizacion de gastos y pagos y la formacion, rendicion y justificacion de las cuentas." **Correcto**: el art. 79 establece que la designacion lleva aparejada estas competencias.

**Clave:** El calendario de actuaciones **SI** es obligatorio en todas las propuestas de pagos a justificar (art. 79.3). La trampa es anadir un "no" que invierte la obligatoriedad.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "56c3e8cf-17df-4c10-8f3b-2849b665044a");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LGP art.79 pagos justificar (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.47 nulidad incompetencia materia no convalidable
  const exp2 = `**Articulo 47.1.b de la Ley 39/2015 (LPAC) - Nulidad de pleno derecho:**

> "Son nulos de pleno derecho [...] b) Los dictados por organo **manifiestamente incompetente** por razon de la **materia** o del **territorio**."

**Por que A es correcta (nula de pleno derecho y no convalidable):**
El caso del enunciado es claro: el Ministro para la Transformacion Digital aprueba un pliego sobre mantenimiento de autopistas, que es competencia del Ministro de **Transportes**. Es una incompetencia **manifiesta por razon de la materia** (art. 47.1.b), lo que produce **nulidad de pleno derecho**. Los actos nulos no son convalidables (art. 52 solo permite convalidar actos **anulables**).

**Por que las demas son incorrectas:**

- **B)** "Anulabilidad convalidable". Falso: la incompetencia **manifiesta** por materia produce nulidad de pleno derecho (art. 47.1.b), no anulabilidad. Solo la incompetencia **no determinante de nulidad** (por ejemplo, jerarquica) produce anulabilidad convalidable (art. 52.3). Aqui la incompetencia es por materia, que es un supuesto de nulidad.

- **C)** "Irregularidad no invalidante". Falso: la incompetencia manifiesta por materia es uno de los vicios mas graves del ordenamiento. No es una mera irregularidad formal, sino un vicio que afecta a la esencia del acto.

- **D)** "Nula pero convalidable". Falso: la nulidad de pleno derecho es **insubsanable** e **inconvalidable**. Solo los actos **anulables** son convalidables (art. 52.1). La nulidad es imprescriptible y no admite convalidacion.

**Nulidad vs anulabilidad:**

| Vicio | Consecuencia | Convalidable |
|-------|-------------|-------------|
| Incompetencia **manifiesta** (materia/territorio) | **Nulidad** (art. 47) | **NO** |
| Incompetencia **no manifiesta** (jerarquica) | Anulabilidad (art. 48) | SI (art. 52.3) |

**Clave:** Incompetencia por materia = nulidad de pleno derecho = no convalidable. Solo la incompetencia jerarquica (no manifiesta) es convalidable.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "eaa159db-0cf2-49cf-b7a7-17f47dd81a83");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.47 nulidad incompetencia (" + exp2.length + " chars)");

  // #3 - Ley 39/2015 art.47.1.c nulidad contenido imposible
  const exp3 = `**Articulo 47.1 de la Ley 39/2015 (LPAC) - Causas de nulidad de pleno derecho:**

> Art. 47.1: "Los actos de las AAPP son nulos de pleno derecho:
> a) Lesion de derechos susceptibles de amparo constitucional
> b) Organo manifiestamente incompetente por materia o territorio
> **c) Contenido imposible**
> d) Constitutivos de infraccion **penal**
> e) Prescindencia total del procedimiento
> f) Actos por los que se adquieren derechos sin requisitos esenciales
> g) Cualquier otro establecido por ley"

**Por que C es correcta (contenido imposible):**
El art. 47.1.c establece como causa de nulidad los actos que tengan un **contenido imposible**, ya sea imposibilidad fisica (ordenar algo materialmente irrealizable), juridica (exigir algo contrario al ordenamiento) o logica (mandato contradictorio).

**Por que las demas son incorrectas (alteran los terminos del articulo):**

- **A)** "Organo que carezca de competencia **jerarquica**". Falso: el art. 47.1.b dice incompetencia por razon de la **materia** o del **territorio**, no de la jerarquia. La incompetencia jerarquica produce **anulabilidad** (art. 48), no nulidad de pleno derecho.

- **B)** "Consecuencia de una infraccion **administrativa**". Falso: el art. 47.1.d dice infraccion **penal**, no administrativa. La trampa sustituye "penal" por "administrativa". Una infraccion administrativa no produce nulidad del acto; un delito penal si.

- **D)** "Ejecutados por **desviacion de poder**". Falso: la desviacion de poder (uso de potestades para fines distintos de los previstos) produce **anulabilidad** (art. 48: "cualquier infraccion del ordenamiento juridico, **incluso la desviacion de poder**"), no nulidad de pleno derecho. El art. 48 menciona expresamente la desviacion de poder como causa de anulabilidad.

**Clave:** Contenido imposible = nulidad (art. 47). Incompetencia jerarquica y desviacion de poder = anulabilidad (art. 48). Infraccion penal (no administrativa) = nulidad.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "20405e58-57ed-4919-855d-4e6f3622fbd9");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 39/2015 art.47 contenido imposible (" + exp3.length + " chars)");
})();
