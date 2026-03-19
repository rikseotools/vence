require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.14 igualdad
  const exp1 = `**Articulo 14 de la Constitucion Espanola:**

> "Los espanoles son iguales ante la ley, sin que pueda prevalecer discriminacion alguna por razon de nacimiento, raza, sexo, religion, opinion o cualquier otra condicion o circunstancia personal o social."

**Por que A es correcta:**
El Tribunal Constitucional ha definido el principio de igualdad del art. 14 CE como la **prohibicion de toda diferencia de trato que carezca de justificacion objetiva y razonable**. Es decir, no se prohibe todo trato desigual, sino solo el que sea **injustificado** o **irrazonable**. Se pueden establecer diferencias si hay una razon objetiva que las justifique.

**Por que las demas son incorrectas:**

- **B)** "Vincula a la Administracion a **no exigir** lenguas oficiales de CCAA para acceso a funcion publica". Falso: la Administracion SI puede exigir el conocimiento de lenguas cooficiales cuando este justificado por el puesto. La exigencia de lenguas oficiales de CCAA no vulnera el art. 14 si es proporcional y justificada por la naturaleza del puesto.

- **C)** "Trato igual a todos, **con independencia** de las situaciones que pueden ser objeto de amparo". Falso: el art. 14 no asegura un trato igual absoluto e incondicional. Permite tratar de forma diferente situaciones que son objetivamente diferentes. La igualdad es "tratar igual lo igual y desigual lo desigual".

- **D)** "Vincula a los Tribunales a fundamentar sus sentencias **atendiendo a precedentes** siempre que...". Falso: el art. 14 no obliga a los Tribunales a seguir precedentes jurisprudenciales. Lo que exige es que si un Tribunal cambia de criterio, lo haga de forma **motivada y general**, no de forma arbitraria para un caso concreto (igualdad en la aplicacion de la ley).

**Clave:** El art. 14 no prohibe TODA diferencia de trato, solo la que carece de justificacion objetiva y razonable.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "fbd18155-f6ad-4441-8020-4190d29e8b9e");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.14 igualdad (" + exp1.length + " chars)");

  // #2 - Ley 1/2000 art.813/815 monitorio domicilio infructuoso
  const exp2 = `**Articulo 815 de la Ley 1/2000 de Enjuiciamiento Civil** (Procedimiento monitorio - admision y requerimiento):

> Si tras las averiguaciones sobre el domicilio o residencia del deudor, estas resultan **infructuosas**, "el Juez dictara **auto** dando por **terminado** el proceso."

**Por que C es correcta:**
En el proceso monitorio, si no se puede localizar al deudor, el **Juez** dicta **auto** finalizando el proceso. Esto es una particularidad del monitorio: a diferencia de otros procesos, en el monitorio **NO cabe** el requerimiento por edictos. Si el deudor no puede ser hallado, el proceso simplemente termina.

**Por que las demas son incorrectas:**

- **A)** "El **Letrado de la Administracion de Justicia** dictara **decreto**". Falso en dos aspectos: (1) no es el LAJ quien lo dicta, sino el **Juez**; (2) no es un decreto, sino un **auto**. La terminacion del monitorio por imposibilidad de localizar al deudor requiere una resolucion judicial (auto del Juez), no una resolucion procesal del LAJ.

- **B)** "Se practicara el requerimiento por **edictos**". Falso: esta es la trampa principal. En el proceso monitorio esta **prohibida** la comunicacion por edictos para el requerimiento de pago. Si el deudor no puede ser hallado personalmente, el proceso termina. Esta prohibicion es una garantia del derecho de defensa.

- **D)** "Se intentara nuevamente en el ultimo domicilio conocido". Falso: una vez realizadas las averiguaciones y siendo estas infructuosas, no se reintenta. Se da por terminado el proceso directamente.

**Regla clave del monitorio:** No cabe requerimiento por edictos. Deudor no localizado = auto del Juez terminando el proceso.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "746fdd7f-ec3d-4266-87c9-cef99a4816a4");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LEC monitorio domicilio (" + exp2.length + " chars)");

  // #3 - RDL 5/2015 art.14 inamovilidad condicion vs puesto
  const exp3 = `**Articulo 14 del RDL 5/2015 (TREBEP)** - Derechos individuales de los empleados publicos:

> "a) A la inamovilidad en la **condicion** de funcionario de carrera."

**Por que D es la respuesta correcta (NO es un derecho del art. 14):**
La opcion D dice "inamovilidad en el **puesto de trabajo**", pero el art. 14.a) TREBEP dice "inamovilidad en la **condicion** de funcionario de carrera". Son conceptos muy diferentes:

| Concepto | Significado | En el art. 14 |
|----------|-------------|---------------|
| Inamovilidad en la **condicion** | No puedes perder tu **estatus** de funcionario de carrera (salvo sancion) | **SI** esta |
| Inamovilidad en el **puesto** | No pueden cambiarte de **puesto de trabajo** | **NO** esta |

Un funcionario de carrera no puede ser despedido libremente (inamovilidad de condicion), pero SI puede ser trasladado de puesto por necesidades del servicio.

**Por que las demas son correctas (SI estan en el art. 14 TREBEP):**

- **A)** "Libre asociacion profesional". SI: art. 14.p) TREBEP reconoce expresamente este derecho.

- **B)** "Participar en la consecucion de los objetivos de su unidad y ser informado de las tareas a desarrollar". SI: art. 14.e) TREBEP lo recoge literalmente.

- **C)** "Libertad de expresion dentro de los limites del ordenamiento juridico". SI: art. 14.k) TREBEP. Tiene limites especificos derivados del deber de sigilo profesional.

**Clave:** La trampa esta en **condicion** vs **puesto**. El TREBEP garantiza que no pierdas tu condicion de funcionario, no que te mantengan en el mismo puesto.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "45df798d-09cc-43ac-8ebb-e0853436f9a6");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - TREBEP art.14 inamovilidad (" + exp3.length + " chars)");
})();
