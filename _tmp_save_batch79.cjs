require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LGP art.20 fuentes obligaciones HP
  const exp1 = `**Articulo 20 de la Ley 47/2003 (LGP):**

> "Las obligaciones de la Hacienda Publica estatal nacen de la **ley**, de los **negocios juridicos** y de los **actos o hechos** que, segun derecho, las generen."

**Por que B es la respuesta (NO es fuente):**
Los "Principios Generales Tributarios" **no** aparecen en el art. 20 LGP como fuente de obligaciones de la Hacienda Publica. El articulo enumera exactamente **tres fuentes**, y los principios tributarios no estan entre ellas. Los principios son criterios interpretativos del ordenamiento, no fuentes generadoras de obligaciones.

**Por que las demas SI son fuentes (y por tanto no son la respuesta):**

- **A)** "La Ley". **SI es fuente**: primera fuente del art. 20. Las obligaciones creadas directamente por norma legal (ej: una ley que establece una subvencion).

- **C)** "Los negocios juridicos". **SI es fuente**: segunda fuente del art. 20. Obligaciones nacidas de contratos, convenios y demas acuerdos de voluntad (ej: un contrato publico).

- **D)** "Los actos o hechos que generen las obligaciones". **SI es fuente**: tercera fuente del art. 20. Obligaciones nacidas de situaciones de hecho o actos administrativos (ej: un dano causado por la Administracion que genera responsabilidad patrimonial).

**Las 3 fuentes de obligaciones de la HP (art. 20 LGP):**
1. La **ley**
2. Los **negocios juridicos**
3. Los **actos o hechos** que las generen

**Clave:** Son solo 3 fuentes. Los "Principios Generales Tributarios" no son una de ellas.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "cf7b7df8-2ec0-45e8-ae59-cdf71bd534cb");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LGP fuentes obligaciones (" + exp1.length + " chars)");

  // #2 - LGP art.60 anticipos Tesoreria limite 1%
  const exp2 = `**Articulo 60.1 de la Ley 47/2003 (LGP):**

> "Con caracter excepcional, el Gobierno [...] podra conceder anticipos de Tesoreria para atender gastos inaplazables, con el limite maximo en cada ejercicio del **uno por ciento** de los creditos autorizados al Estado por la Ley de Presupuestos Generales del Estado."

**Por que B es correcta (1%):**
El limite de los anticipos de Tesoreria es del **1%** de los creditos autorizados. Es un porcentaje bajo porque los anticipos son una medida **excepcional**: permiten gastar antes de que las Cortes aprueben los creditos extraordinarios o suplementos de credito correspondientes.

**Por que las demas son incorrectas (todas cambian el porcentaje):**

| Opcion | Porcentaje | Correcto? |
|--------|-----------|-----------|
| A | **2%** | Falso |
| **B** | **1%** | **Correcto** |
| C | **5%** | Falso |
| D | **3%** | Falso |

Las opciones A, C y D simplemente alteran el porcentaje para confundir. Solo el 1% es el limite legal.

**Datos clave de los anticipos de Tesoreria (art. 60 LGP):**
- Caracter: **excepcional**
- Quien concede: el **Gobierno**
- A propuesta de: el **Ministro de Economia**
- Limite: **1%** de los creditos autorizados
- Requisito: dictamen favorable del **Consejo de Estado**
- Para: gastos **inaplazables**

**Clave:** Anticipos de Tesoreria = limite del **1%**. No confundir con el 2%, 3% o 5%.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "80180137-b15e-4060-85fa-eb2239399046");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LGP anticipos 1% (" + exp2.length + " chars)");

  // #3 - LGP art.78 anticipos de caja fija
  const exp3 = `**Articulo 78 de la Ley 47/2003 (LGP)** - Anticipos de caja fija:

> "Las **provisiones de fondos** de caracter **extrapresupuestario** y **permanente** que se realicen a pagadurias, cajas y habilitaciones para la atencion inmediata y posterior aplicacion al capitulo de gastos corrientes en bienes y servicios del presupuesto del ano en que se realicen, de gastos **periodicos o repetitivos**."

**Por que B es correcta:**
La opcion B reproduce fielmente la definicion legal: **provisiones de fondos**, de caracter **extrapresupuestario** y **permanente**, para gastos **periodicos o repetitivos** del capitulo de gastos corrientes.

**Por que las demas son incorrectas (cada una cambia un termino clave):**

- **A)** "Los **fondos**..." Falso: dice "los fondos" cuando el articulo dice "las **provisiones** de fondos". La palabra "provisiones" es clave: indica que se trata de entregas anticipadas de dinero, no de fondos a secas.

- **C)** "Fondos de caracter **presupuestario**...". Falso: cambia "**extrapresupuestario**" por "presupuestario". Los anticipos de caja fija son extrapresupuestarios porque se entregan como adelantos fuera del procedimiento presupuestario normal, aunque luego se aplican al presupuesto.

- **D)** "Gastos corrientes de caracter **extraordinario**, aplicables en el ejercicio de dotacion y en el **siguiente**". Doble error:
  1. Dice "extraordinario" cuando son para gastos "**periodicos o repetitivos**" (lo contrario).
  2. Dice "ejercicio de dotacion y en el siguiente" cuando solo se aplican al "presupuesto del **ano en que se realicen**".

**Clave:** Anticipos de caja fija = **provisiones** de fondos + **extrapresupuestario** + **permanente** + gastos **periodicos/repetitivos** + aplicacion al **ano en curso**.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "2b471904-27c4-4ed0-a35f-d8b79de59d0f");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LGP anticipos caja fija (" + exp3.length + " chars)");
})();
