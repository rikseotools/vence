require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.23.2 acceso cargos publicos
  const exp1 = `**Articulo 23.2 de la Constitucion Espanola:**

> "Asimismo, [los **ciudadanos**] tienen derecho a acceder en condiciones de igualdad a las funciones y cargos publicos, con los requisitos que senalen las leyes."

**Por que C es correcta:**
El art. 23 CE utiliza el termino "ciudadanos" como titulares del derecho de acceso a funciones y cargos publicos. No dice "espanoles", ni "residentes", ni "funcionarios".

**Por que las demas son incorrectas:**

- **A)** "Los residentes en Espana". Falso: el art. 23 no habla de "residentes". La residencia es un criterio distinto de la ciudadania. Un residente extranjero no tiene automaticamente derecho de acceso a cargos publicos por el mero hecho de residir en Espana.

- **B)** "Los funcionarios". Falso: los funcionarios ya son empleados publicos. El art. 23.2 reconoce el derecho de **acceso** a funciones publicas, no un derecho exclusivo de quienes ya son funcionarios.

- **D)** "Los espanoles". Falso: aunque en la practica muchos cargos publicos estan reservados a espanoles, el art. 23 CE usa deliberadamente "ciudadanos", no "espanoles". Esto permite que la legislacion pueda extender ciertos derechos a ciudadanos de la UE (como el voto municipal y el acceso a determinados puestos publicos).

**Distincion clave:** La CE usa "ciudadanos" (art. 23) como concepto mas amplio que "espanoles". En otros articulos si usa "espanoles" (ej: art. 13.2 para derechos politicos).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ab1119d0-0154-4719-8342-e67e02478e8c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.23.2 acceso cargos (" + exp1.length + " chars)");

  // #2 - CE art.53 recurso de amparo
  const exp2 = `**Articulo 53.2 de la Constitucion Espanola:**

> "Cualquier ciudadano podra recabar la tutela de las libertades y derechos reconocidos en el **articulo 14** y la **Seccion primera del Capitulo segundo** ante los Tribunales ordinarios [...] y, en su caso, a traves del **recurso de amparo** ante el Tribunal Constitucional."

**Por que C es correcta:**
La libertad de catedra esta en el **art. 20.1.c)** CE, que pertenece a la **Seccion 1a del Capitulo II del Titulo I** (arts. 15-29). Por tanto, esta protegida por recurso de amparo.

**Por que las demas son incorrectas (estan en la Seccion 2a, sin amparo):**

- **A)** "Conflicto colectivo (art. 37.2)". Esta en la **Seccion 2a** (arts. 30-38: "De los derechos y deberes de los ciudadanos"). No es susceptible de recurso de amparo. Solo tiene la proteccion generica del art. 53.1.

- **B)** "Derecho de fundacion (art. 34)". Esta en la **Seccion 2a** (arts. 30-38). No tiene recurso de amparo.

- **D)** "Libertad de empresa (art. 38)". Esta en la **Seccion 2a** (arts. 30-38). No tiene recurso de amparo.

**Derechos con recurso de amparo (art. 53.2):**
| Ambito | Articulos |
|--------|-----------|
| Art. 14 | Igualdad ante la ley |
| Seccion 1a Cap. II | Arts. 15-29 (derechos fundamentales) |
| Art. 30.2 | Objecion de conciencia (por remision expresa) |

**Truco:** Solo Seccion 1a (arts. 15-29) + art. 14 + objecion de conciencia (art. 30). La Seccion 2a (arts. 30-38) NO tiene amparo.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "4282885e-5878-43f9-8cf5-9ee16a2b5d77");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.53 recurso amparo (" + exp2.length + " chars)");

  // #3 - LOPJ art.499 recusacion funcionarios (sexto vs quinto dia)
  const exp3 = `**Articulo 499.2.d) de la LOPJ** (Recusacion de funcionarios):

> "Si el recusado niega la certeza de la causa alegada [...] el letrado de la Administracion de Justicia, oido lo que el recusado alegue, dentro del **quinto dia** y practicadas las comprobaciones [...] remitira lo actuado a quien haya de resolver."

**Por que A es la INCORRECTA:**
La opcion A dice "dentro del **sexto** dia", pero el art. 499.2.d) dice "dentro del **quinto** dia". Es un cambio numerico sutil (5 por 6) que altera el plazo procesal. El plazo correcto es de 5 dias, no 6.

**Por que las demas son correctas:**

- **B)** "En el dia siguiente a su recepcion, el recusado manifestara si se da o no la causa". Verdadero: reproduce el art. 499.2.c) - tras admitir a tramite, al dia siguiente el recusado debe pronunciarse.

- **C)** "Si la causa no es de las tipificadas, inadmitira en el acto". Verdadero: reproduce el art. 499.2.b) - el LAJ puede inadmitir directamente si la causa alegada no esta tipificada en la ley.

- **D)** "Lo decidira quien sea competente para dictar la resolucion que ponga termino al pleito o causa". Verdadero: reproduce el art. 499.2.a) - la decision corresponde al competente para resolver el pleito en esa instancia.

**Truco de examen:** Cambio numerico de un solo digito (quinto por sexto). En plazos procesales, estos cambios son muy frecuentes en oposiciones.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "299ccf0d-a300-4799-a39d-36bf6281d8b1");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LOPJ art.499 recusacion (" + exp3.length + " chars)");
})();
