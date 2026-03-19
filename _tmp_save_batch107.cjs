require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - TREBEP art.10 funcionarios interinos circunstancias (FALSA = obras)
  const exp1 = `**Articulo 10.1 del TREBEP (RDL 5/2015):**

> "Son funcionarios interinos los que [...] son nombrados como tales con caracter temporal [...] cuando se de alguna de las siguientes circunstancias:
> a) La existencia de **plazas vacantes** [...] por un maximo de tres anos.
> b) La **sustitucion transitoria** de los titulares.
> c) La ejecucion de **programas** de caracter temporal [...] no superior a tres anos.
> d) El **exceso o acumulacion de tareas** por plazo maximo de nueve meses, dentro de un periodo de dieciocho meses."

**Por que C es la FALSA (y por tanto la respuesta):**
La opcion C dice "ejecucion de **obras o servicios** temporales". Pero el art. 10.1.c) dice "ejecucion de **programas** de caracter temporal". La trampa es sustituir "programas" por "obras o servicios", que es terminologia propia del **contrato temporal del Derecho laboral** (art. 15 ET antiguo), no de la funcion publica.

**Por que las demas SI son correctas (circunstancias del art. 10.1):**

- **A)** "Cobertura de plazas vacantes que no sea posible cubrir con funcionarios de carrera". **SI**: letra a) del art. 10.1 (maximo 3 anos).

- **B)** "Sustitucion transitoria de los titulares". **SI**: letra b) del art. 10.1 (durante el tiempo estrictamente necesario).

- **D)** "Exceso o acumulacion de tareas por plazo maximo de 9 meses, dentro de 18 meses". **SI**: letra d) del art. 10.1.

**Las 4 circunstancias de interinidad (art. 10.1 TREBEP):**

| Letra | Circunstancia | Plazo maximo |
|-------|---------------|-------------|
| a) | Plazas **vacantes** | 3 anos |
| b) | **Sustitucion** transitoria | Tiempo necesario |
| c) | **Programas** temporales | 3 anos (+12 meses) |
| d) | **Exceso** de tareas | 9 meses en 18 |

**Clave:** "Programas" (no "obras o servicios"). La trampa mezcla terminologia laboral con la de funcion publica.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "23355bc5-51f7-4753-92ee-23dbaedd6c3c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - TREBEP art.10 interinos (" + exp1.length + " chars)");

  // #2 - TUE art.15.4 Consejo Europeo consenso
  const exp2 = `**Articulo 15.4 del Tratado de la Union Europea:**

> "El Consejo Europeo se pronunciara por **consenso**, excepto cuando los Tratados dispongan otra cosa."

**Por que D es correcta (consenso):**
La regla general de votacion del Consejo Europeo es el **consenso**. El consenso significa que no hay oposicion formal de ningun Estado miembro, aunque no requiere una votacion expresa de todos. Es un mecanismo flexible que permite avanzar sin que ningun Estado se oponga activamente.

**Por que las demas son incorrectas:**

- **A)** "Mayoria simple". Falso: la mayoria simple no es la regla general del Consejo Europeo. Este organismo reune a Jefes de Estado o de Gobierno; sus decisiones politicas fundamentales se toman por consenso, no por mayoria simple.

- **B)** "Mayoria cualificada". Falso: la mayoria cualificada es la regla general del **Consejo** (de Ministros), no del **Consejo Europeo**. No confundir ambos organos: el Consejo (art. 16 TUE) y el Consejo Europeo (art. 15 TUE) son instituciones diferentes.

- **C)** "Unanimidad". Falso y trampa importante: el consenso y la unanimidad son conceptos parecidos pero distintos. La **unanimidad** requiere voto favorable expreso de todos; el **consenso** solo requiere ausencia de oposicion (se puede guardar silencio sin bloquear). El art. 15.4 dice "consenso", no "unanimidad".

**Reglas de votacion en la UE:**

| Organo | Regla general |
|--------|---------------|
| **Consejo Europeo** | **Consenso** (art. 15.4 TUE) |
| **Consejo** (Ministros) | Mayoria cualificada (art. 16.3 TUE) |
| Parlamento Europeo | Mayoria de votos emitidos |

**Clave:** Consejo Europeo = consenso. Consejo (Ministros) = mayoria cualificada. No confundir consenso con unanimidad.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "c99c6a1b-232b-4224-9e42-7550d836f436");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - TUE art.15.4 consenso (" + exp2.length + " chars)");

  // #3 - LOTC art.7 dos Salas seis Magistrados
  const exp3 = `**Articulo 7.1 de la LOTC:**

> "El Tribunal Constitucional consta de **dos Salas**. Cada Sala esta compuesta por **seis Magistrados** nombrados por el Tribunal en Pleno."

**Por que C es correcta (2 Salas, 6 Magistrados cada una):**
El TC tiene 12 Magistrados en total (art. 159.1 CE), divididos en 2 Salas de 6 Magistrados cada una:
- **Sala Primera**: presidida por el Presidente del TC
- **Sala Segunda**: presidida por el Vicepresidente del TC

**Por que las demas son incorrectas (cambian el numero de Salas o Magistrados):**

- **A)** "**Tres** Salas, con **tres** Magistrados cada una". Doble error: 3 x 3 = 9, pero el TC tiene 12 Magistrados. Ni el numero de Salas ni el de Magistrados por Sala es correcto.

- **B)** "**Cuatro** Salas, con **tres** Magistrados cada una". Doble error: 4 x 3 = 12, que cuadra con el total, pero la estructura es incorrecta. El TC tiene 2 Salas, no 4. Ademas, confunde las **Secciones** (que SI son 4, con 3 Magistrados cada una) con las **Salas**.

- **D)** "**Tres** Salas, con **cuatro** Magistrados cada una". Doble error: 3 x 4 = 12, que cuadra con el total, pero la estructura es incorrecta. Solo hay 2 Salas, no 3.

**Estructura del TC:**

| Organo | Composicion |
|--------|-------------|
| **Pleno** | 12 Magistrados |
| **Salas** (2) | 6 Magistrados cada una |
| **Secciones** (4) | 3 Magistrados cada una |

**Clave:** 2 Salas x 6 = 12. No confundir Salas (2 x 6) con Secciones (4 x 3). La trampa B invierte ambas.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "5d5b33bd-6b8b-4107-a7b1-42664d47c9bf");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LOTC art.7 Salas TC (" + exp3.length + " chars)");
})();
