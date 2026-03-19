require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RDL 1/2013 art.55 Consejo Nacional Discapacidad
  const exp1 = `**Articulo 55 del RDL 1/2013** (Consejo Nacional de la Discapacidad):

> "El **Consejo Nacional de la Discapacidad** es el organo colegiado interministerial, de caracter consultivo, en el que se institucionaliza la colaboracion del movimiento asociativo de las personas con discapacidad y sus familias y la AGE, para la definicion y coordinacion de las politicas publicas que garanticen los derechos de las personas con discapacidad."

**Por que D es correcta:**
La definicion de la pregunta coincide literalmente con el art. 55: organo colegiado, interministerial, consultivo, que institucionaliza la colaboracion entre el movimiento asociativo y la AGE. Ese organo es el Consejo Nacional de la Discapacidad.

**Por que las demas son incorrectas:**

- **A)** "Observatorio Estatal sobre la Discapacidad". Es un organo diferente. El Observatorio (art. 56 RDL 1/2013) se encarga de la **recopilacion, sistematizacion y analisis de informacion** sobre discapacidad. No es el organo de colaboracion AGE-movimiento asociativo.

- **B)** "Sistema para la Autonomia y la Atencion a la Dependencia (SAAD)". Este es el sistema creado por la **Ley 39/2006 de Dependencia**, no por el RDL 1/2013. Se centra en personas en situacion de dependencia, no en la colaboracion institucional con el movimiento asociativo de discapacidad.

- **C)** "Comision para la atencion de la Dependencia y la Discapacidad". Este organo no existe con ese nombre en el RDL 1/2013. Es un distractor inventado que mezcla los ambitos de dependencia y discapacidad.

**Clave:** Consejo Nacional de la Discapacidad = organo consultivo de colaboracion AGE + movimiento asociativo (art. 55 RDL 1/2013).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0ec24e1e-0ccf-4207-aa6a-12bb90462ead");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RDL 1/2013 art.55 Consejo Discapacidad (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.53 derechos interesados
  const exp2 = `**Articulo 53.1.a) de la Ley 39/2015** (Derechos del interesado):

> "A conocer, en cualquier momento, el estado de la tramitacion de los procedimientos **en los que tengan la condicion de interesados**; el sentido del silencio administrativo que corresponda, **en caso de que la Administracion no dicte ni notifique** resolucion expresa en plazo; el organo competente para su instruccion, en su caso, y resolucion; y **los actos de tramite dictados**."

**Por que B es correcta:**
La opcion B ("conocer los actos de tramite dictados en los procedimientos en los que tengan la condicion de interesados") reproduce fielmente el final del art. 53.1.a).

**Por que las demas son incorrectas (cada una altera sutilmente el texto):**

- **A)** "Procedimientos **similares** a aquellos en los que tengan la condicion de interesados". Falso: el art. 53.1.a) habla de los procedimientos en los que **sean** interesados, no de procedimientos "similares". Solo se tiene derecho a conocer el estado de **tus propios** procedimientos.

- **C)** "Cuando la Administracion **dicte o notifique** su resolucion". Falso: el art. 53.1.a) dice exactamente lo contrario: el silencio administrativo opera cuando la Administracion **NO dicte NI notifique** resolucion. La opcion invierte la condicion: pasa de "no dicte ni notifique" a "dicte o notifique".

- **D)** "El organo competente para la resolucion de **cualquier procedimiento** administrativo". Falso: el derecho es a conocer el organo competente de **los procedimientos en los que se es interesado**, no de "cualquier" procedimiento. Se amplia indebidamente el ambito.

**Truco de examen:** Las 4 opciones parecen extractos del mismo articulo, pero A, C y D alteran una palabra clave (similares, dicte, cualquier).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "2315005c-2066-4154-a4bb-c5d134ec7b63");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.53 derechos (" + exp2.length + " chars)");
})();
