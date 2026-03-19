require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.149.3 supletoriedad derecho estatal "en todo caso"
  const exp1 = `**Articulo 149.3 de la Constitucion Espanola - Clausula de supletoriedad:**

> "El derecho estatal sera, **en todo caso**, supletorio del derecho de las Comunidades Autonomas."

**Por que D es correcta (en todo caso, supletorio):**
El art. 149.3 CE establece la supletoriedad del derecho estatal de forma **incondicional** ("en todo caso"). Esto significa que cuando una materia este regulada por la CA, se aplica su normativa; pero si hay lagunas o la CA no ha legislado, se aplica supletoriamente el derecho del Estado. No hay excepciones ni condiciones.

**Por que las demas son incorrectas:**

- **A)** "Unicamente en lo que este atribuido a la **exclusiva competencia del Estado**". Falso: la supletoriedad opera "en todo caso", no solo en materias exclusivas del Estado. De hecho, la supletoriedad tiene sentido precisamente en las materias que no son exclusivas del Estado, donde la CA puede tener su propia regulacion.

- **B)** "Unicamente en lo que **no** este atribuido a la exclusiva competencia de estas [CCAA]". Falso: anade una restriccion ("unicamente") que el art. 149.3 no contiene. La clausula es "en todo caso", sin limitaciones. La supletoriedad opera incluso en materias de competencia exclusiva de las CCAA si estas no han legislado.

- **C)** "**Nunca** supletorio". Falso: es exactamente lo contrario de lo que dice el art. 149.3. La supletoriedad es un principio constitucional expreso.

**Las tres clausulas del art. 149.3 CE:**
1. **Prevalencia**: en caso de conflicto, prevalecen las normas del Estado (salvo competencias exclusivas de las CCAA)
2. **Supletoriedad**: el derecho estatal es **en todo caso** supletorio del autonomico
3. **Residual**: las competencias no asumidas por los Estatutos de Autonomia corresponden al Estado

**Clave:** "En todo caso" = sin condiciones ni excepciones. El derecho estatal siempre es supletorio del autonomico.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f15a5d90-9a37-477a-9858-26d63cc6f911");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.149.3 supletoriedad (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.3 capacidad de obrar normas civiles
  const exp2 = `**Articulo 3 de la Ley 39/2015 (LPAC) - Capacidad de obrar ante las AAPP:**

> Art. 3: "Tendran capacidad de obrar ante las Administraciones Publicas:
> a) Las personas fisicas o juridicas que ostenten capacidad de obrar con arreglo a las **normas civiles**.
> b) Los **menores de edad** para el ejercicio y defensa de aquellos de sus derechos e intereses cuya actuacion este permitida por el ordenamiento juridico sin la asistencia de la persona que ejerza la patria potestad, tutela o curatela."

**Por que B es correcta (con arreglo a las normas civiles):**
El art. 3.a LPAC remite a las **normas civiles** para determinar la capacidad de obrar administrativa. Esto significa que la capacidad administrativa se rige por el Codigo Civil y la normativa civil general (mayoria de edad, emancipacion, etc.), no por criterios propios del derecho administrativo.

**Por que las demas son incorrectas:**

- **A)** "**Solo** cuando sea mayor de edad". Falso: el art. 3.b permite expresamente que los **menores de edad** actuen ante la Administracion en ciertos supuestos (derechos que el ordenamiento les permite ejercer sin asistencia). La palabra "solo" la hace incorrecta.

- **C)** "**Unicamente** cuando tenga nacionalidad espanola". Falso: la capacidad de obrar no depende de la nacionalidad. Las personas extranjeras tambien tienen capacidad de obrar ante las AAPP si la tienen segun las normas civiles. El art. 3 no menciona la nacionalidad como requisito.

- **D)** "**Solo** cuando este emancipada". Falso: la emancipacion es una de las formas de adquirir capacidad de obrar segun el derecho civil, pero no la unica. Los mayores de edad tienen capacidad plena sin necesidad de emancipacion. Ademas, los menores tambien pueden actuar en ciertos casos (art. 3.b).

**Clave:** Capacidad de obrar administrativa = la que se tenga segun las **normas civiles**. No depende de la edad (los menores pueden actuar en ciertos casos), ni de la nacionalidad, ni requiere emancipacion exclusivamente.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "f35bc505-3148-44f7-8e93-68a57c4c4c81");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.3 capacidad obrar (" + exp2.length + " chars)");

  // #3 - Ley 40/2015 entrada en vigor 2 de octubre de 2016
  const exp3 = `**Disposicion final decimoctava de la Ley 40/2015 (LRJSP) - Entrada en vigor:**

> "La presente Ley entrara en vigor al ano de su publicacion en el BOE."

La Ley 40/2015 se publico en el BOE el **2 de octubre de 2015**. Al ano de su publicacion = **2 de octubre de 2016**.

**Por que B es correcta (2 de octubre de 2016):**
La vacatio legis (periodo entre publicacion y entrada en vigor) fue de **un ano exacto**: del 2 de octubre de 2015 al 2 de octubre de 2016. Se establecio un plazo largo para permitir a las Administraciones adaptarse a la nueva normativa.

**Por que las demas son incorrectas:**

- **A)** "2 de **septiembre** de **2015**". Falso: contiene dos errores: (1) el mes es **octubre**, no septiembre; (2) el ano 2015 es la fecha de **publicacion**, no de entrada en vigor. La ley entro en vigor un ano despues, en 2016.

- **C)** "2 de **septiembre** de 2016". Falso: el mes es **octubre**, no septiembre. La ley se publico el 2 de **octubre** de 2015, por lo que un ano despues es el 2 de **octubre** de 2016.

- **D)** "2 de octubre de **2015**". Falso: esa es la fecha de **publicacion** en el BOE, no de entrada en vigor. La vacatio legis de un ano aplaza la entrada en vigor a 2016. Es la trampa mas comun: confundir la fecha de publicacion con la de entrada en vigor.

**Fechas clave de las leyes 39 y 40/2015:**

| Ley | Publicacion | Entrada en vigor |
|-----|-----------|-----------------|
| Ley 39/2015 (LPAC) | 2 octubre 2015 | **2 octubre 2016** |
| **Ley 40/2015** (LRJSP) | 2 octubre 2015 | **2 octubre 2016** |

Ambas leyes se publicaron y entraron en vigor en las mismas fechas.

**Clave:** Publicacion: 2 octubre **2015**. Entrada en vigor: 2 octubre **2016** (un ano de vacatio legis). Octubre, no septiembre.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "5c2347ef-06a9-4aa6-87ba-c798cca66587");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 40/2015 entrada vigor 2016 (" + exp3.length + " chars)");
})();
