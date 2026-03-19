require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.39.3 eficacia retroactiva actos administrativos
  const exp1 = `**Articulo 39.3 de la Ley 39/2015 (LPAC) - Eficacia retroactiva:**

> "**Excepcionalmente**, podra otorgarse eficacia retroactiva a los actos cuando se dicten en **sustitucion de actos anulados**, asi como cuando produzcan **efectos favorables** al interesado, siempre que los supuestos de hecho necesarios **existieran ya** en la fecha a que se retrotraiga la eficacia del acto y esta **no lesione derechos o intereses legitimos** de otras personas."

**Por que D es correcta:**
La opcion D reproduce fielmente el art. 39.3, que establece la retroactividad como **excepcion** con tres requisitos acumulativos: (1) actos en sustitucion de anulados o que produzcan efectos favorables, (2) que los supuestos de hecho ya existieran en la fecha de retroaccion, y (3) que no lesione derechos de terceros.

**Por que las demas son incorrectas:**

- **A)** "Aunque los supuestos de hecho necesarios **no existieran**". Falso: el art. 39.3 exige exactamente lo contrario. Los supuestos de hecho **deben existir ya** en la fecha a que se retrotraiga la eficacia. Ademas, anade "en todo caso" cuando la ley dice "excepcionalmente".

- **B)** "Siempre, cuando produzcan efectos **desfavorables**". Falso por dos razones: (1) la retroactividad no se aplica "siempre", sino **excepcionalmente**; (2) se permite para efectos **favorables**, no desfavorables. Ademas, el principio de irretroactividad de disposiciones sancionadoras (art. 9.3 CE) prohibe la retroactividad desfavorable.

- **C)** "En **ningun caso**". Falso: el art. 39.3 si permite la eficacia retroactiva, aunque de forma excepcional. No existe una prohibicion absoluta.

**Requisitos para la eficacia retroactiva (art. 39.3):**
1. Caracter **excepcional** (no es la regla general)
2. Solo en sustitucion de actos anulados o con efectos **favorables**
3. Los supuestos de hecho deben **preexistir**
4. No puede **lesionar** derechos de terceros

**Clave:** La retroactividad es excepcional, solo favorable, exige que los hechos preexistan y que no lesione derechos de terceros. No es "siempre", ni "nunca", ni sin requisitos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "6551c1a3-a9aa-4d8c-96d5-f7b130328fca");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.39 retroactividad (" + exp1.length + " chars)");

  // #2 - CE art.117.1 justicia emana del pueblo no del Rey
  const exp2 = `**Articulo 117.1 de la Constitucion Espanola - Poder Judicial:**

> "La justicia **emana del pueblo** y se administra **en nombre del Rey** por Jueces y Magistrados integrantes del poder judicial, **independientes**, **inamovibles**, responsables y sometidos unicamente al **imperio de la ley**."

**Por que B es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion B dice "La justicia emana del **Rey**". Falso: el art. 117.1 CE dice que la justicia emana del **pueblo**, no del Rey. El Rey es en cuyo **nombre** se administra la justicia, pero la fuente (emanacion) es el pueblo. La trampa confunde "emanar" con "administrar en nombre de".

**Por que las demas SI son correctas:**

- **A)** "La justicia se administra por Jueces y Magistrados integrantes del Poder Judicial." **Correcto**: reproduce literalmente el art. 117.1 CE. Son los Jueces y Magistrados del poder judicial quienes administran justicia.

- **C)** "Los Jueces y Magistrados estan sometidos unicamente al imperio de la ley." **Correcto**: el art. 117.1 establece el principio de sometimiento exclusivo a la ley, garantia de independencia judicial. No estan sometidos a instrucciones del Gobierno ni de otros poderes.

- **D)** "Los Jueces y Magistrados no son movibles." **Correcto**: el art. 117.1 los califica de "inamovibles", que significa que no pueden ser separados, suspendidos, trasladados ni jubilados sino por las causas legales (art. 117.2). "No son movibles" equivale a "inamovibles".

**Caracteristicas de Jueces y Magistrados (art. 117.1 CE):**
- **Independientes** (no reciben instrucciones)
- **Inamovibles** (no pueden ser trasladados arbitrariamente)
- **Responsables** (responden de sus actos)
- **Sometidos al imperio de la ley** (solo a la ley)

**Clave:** La justicia **emana del pueblo** (soberania popular) y se **administra en nombre del Rey** (funcion simbolica). No confundir la fuente (pueblo) con el nombre en que se ejerce (Rey).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ac6b4253-1f92-4e50-b677-023468119d30");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.117 justicia pueblo (" + exp2.length + " chars)");

  // #3 - CE art.149.1.18ª bases régimen jurídico AAPP tratamiento común
  const exp3 = `**Articulo 149.1.18.a de la Constitucion Espanola - Competencia exclusiva del Estado:**

> "El Estado tiene competencia exclusiva sobre: [...] 18.a Las **bases del regimen juridico de las Administraciones publicas** y del regimen estatutario de sus funcionarios que, **en todo caso, garantizaran a los administrados un tratamiento comun** ante ellas; el procedimiento administrativo comun [...]"

**Por que C es correcta (tratamiento comun):**
El art. 149.1.18.a CE atribuye al Estado la competencia exclusiva sobre las bases del regimen juridico de las AAPP y del regimen estatutario de los funcionarios, con una finalidad expresa: **garantizar a los administrados un tratamiento comun** ante todas las Administraciones. La opcion C reproduce literalmente esta garantia.

**Por que las demas son incorrectas:**

- **A)** "Pueden regular su propio estatuto de los funcionarios." Falso como afirmacion sobre el 149.1.18.a: este articulo dice que las **bases** del regimen estatutario son competencia **exclusiva del Estado**. Las CCAA pueden desarrollar esas bases, pero no "regular su propio estatuto" de forma autonoma. El art. 149.1.18.a no dice esto.

- **B)** "No pueden tener especialidades, en base al principio de competencia exclusiva." Falso: el propio art. 149.1.18.a admite "especialidades derivadas de la organizacion propia de las Comunidades Autonomas" en materia de procedimiento administrativo. La competencia exclusiva del Estado es sobre las **bases**, pero caben especialidades autonomicas.

- **D)** "Desarrollaran reglamentariamente el alcance de los principios de merito y capacidad." Falso: el art. 149.1.18.a no menciona el desarrollo reglamentario de merito y capacidad. Los principios de merito y capacidad se regulan en el art. 103.3 CE, pero el 149.1.18.a trata de las bases del regimen juridico y el tratamiento comun, no del desarrollo reglamentario de esos principios.

**Contenido del art. 149.1.18.a CE (competencia exclusiva del Estado):**
1. **Bases** del regimen juridico de las AAPP
2. **Bases** del regimen estatutario de funcionarios
3. Garantia de **tratamiento comun** a los administrados
4. **Procedimiento administrativo comun** (con especialidades autonomicas)
5. Legislacion sobre expropiacion forzosa
6. Legislacion basica sobre contratos y concesiones
7. Sistema de responsabilidad de todas las AAPP

**Clave:** El art. 149.1.18.a garantiza un "tratamiento comun" ante todas las AAPP. No impide especialidades autonomicas ni regula el desarrollo de merito y capacidad.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "d6b1d427-3e88-4a55-b356-93e00da70358");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.149.1.18 tratamiento comun (" + exp3.length + " chars)");
})();
