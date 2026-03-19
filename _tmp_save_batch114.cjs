require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LOPJ art.82 Audiencias Provinciales civil y penal
  const exp1 = `**Articulo 82 de la LOPJ (LO 6/1985):**

> "Las Audiencias Provinciales conoceran en el **orden penal**: [...] de las causas por delito [...]"
> "Las Audiencias Provinciales conoceran en el **orden civil**: [...] de los recursos contra resoluciones dictadas en primera instancia [...]"

**Por que A es correcta (Civil y Penal):**
El art. 82 LOPJ atribuye a las Audiencias Provinciales competencias en exactamente dos ordenes jurisdiccionales: **penal** (art. 82.1 - causas por delito, recursos contra resoluciones penales) y **civil** (art. 82.2 - recursos contra resoluciones civiles en primera instancia). Son los tribunales colegiados de ambito provincial.

**Por que las demas son incorrectas (incluyen ordenes que NO corresponden a las AP):**

- **B)** "Administrativo y Social". Falso: las Audiencias Provinciales no conocen de lo contencioso-administrativo ni de lo social. El orden **contencioso-administrativo** corresponde a los Juzgados de lo Contencioso y a las Salas de lo Contencioso de los TSJ y AN. El orden **social** corresponde a los Juzgados de lo Social y a las Salas de lo Social de los TSJ.

- **C)** "Penal y Administrativo". Falso: penal SI, pero administrativo NO. Las AP no tienen Sala de lo Contencioso-Administrativo.

- **D)** "Civil y Social". Falso: civil SI, pero social NO. Las AP no tienen competencias en materia laboral ni de seguridad social.

**Ordenes jurisdiccionales por tribunal:**

| Tribunal | Ordenes |
|----------|---------|
| **Audiencias Provinciales** | **Civil + Penal** |
| Juzgados de lo Contencioso | Contencioso-administrativo |
| Juzgados de lo Social | Social |
| TSJ | Civil, Penal, Contencioso, Social |

**Clave:** Audiencias Provinciales = Civil + Penal (solo dos). No tienen competencia contencioso-administrativa ni social.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "62b98cae-16a2-470b-825d-8dd49f16bdd0");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LOPJ art.82 AP civil penal (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.24 silencio desestimatorio solo permite recurrir
  const exp2 = `**Articulo 24.2 de la Ley 39/2015:**

> "La estimacion por silencio administrativo tiene a todos los efectos la consideracion de **acto administrativo finalizador** del procedimiento. La desestimacion por silencio administrativo tiene los **solos efectos** de permitir a los interesados la **interposicion del recurso administrativo o contencioso-administrativo** que resulte procedente."

**Por que D es correcta:**
El art. 24.2 distingue dos efectos segun el sentido del silencio:
- **Silencio estimatorio** = acto administrativo en toda regla (produce efectos como si hubiera resolucion expresa)
- **Silencio desestimatorio** = solo abre la via de recurso (no produce un "acto" propiamente dicho)

La opcion D reproduce exactamente la regla del silencio desestimatorio: sus unicos efectos son permitir recurrir.

**Por que las demas son incorrectas:**

- **A)** "El silencio tendra caracter desestimatorio poniendo fin al procedimiento". Falso: la regla general del silencio en procedimientos a solicitud del interesado es **estimatoria** (art. 24.1), no desestimatoria. Solo es desestimatorio en supuestos concretos (derecho de peticion, dominio publico, medio ambiente, etc.). Ademas, el silencio desestimatorio **no pone fin al procedimiento**: la Administracion sigue obligada a resolver expresamente (art. 24.3).

- **B)** "Se entenderan desestimadas las solicitudes **unicamente** en el caso de procedimientos de ejercicio del derecho de peticion del art. 29 CE". Falso: el derecho de peticion es solo uno de varios supuestos de silencio desestimatorio. Tambien son desestimatorios: transferencias de dominio publico, actividades daninas para el medio ambiente, procedimientos de responsabilidad patrimonial, y recursos administrativos (art. 24.1 parrafos 2 y 3).

- **C)** "El silencio tendra caracter estimatorio **en todo caso**". Falso: aunque la regla general es estimatoria, hay numerosas excepciones legales. "En todo caso" es demasiado absoluto y no refleja las excepciones del art. 24.1.

**Regla del silencio administrativo (art. 24):**
- Regla general: **estimatorio** (a solicitud del interesado)
- Excepciones desestimatorias: derecho de peticion, dominio publico, medio ambiente, responsabilidad patrimonial, recursos
- Silencio estimatorio = acto administrativo completo
- Silencio desestimatorio = solo permite recurrir

**Clave:** Desestimacion por silencio = solos efectos de recurrir. No es un acto administrativo pleno.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ac134526-e97c-4190-964b-adba392a28ad");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.24 silencio (" + exp2.length + " chars)");

  // #3 - LO 3/1980 art.4 Consejo de Estado Pleno Defensor del Pueblo no
  const exp3 = `**Articulo 4.1 de la LO 3/1980 del Consejo de Estado:**

> "Integran el Consejo de Estado en Pleno:
> a) El **Presidente**.
> b) Los **Consejeros permanentes**.
> c) Los **Consejeros natos**.
> d) Los **Consejeros electivos**.
> e) El **Secretario general**."

**Por que B es la respuesta (el Defensor del Pueblo NO forma parte del Pleno):**
El art. 4.1 enumera taxativamente los cinco tipos de miembros del Pleno. El Defensor del Pueblo **no aparece** en esta lista. Aunque es una institucion constitucional importante (art. 54 CE), su funcion es defender los derechos fundamentales ante la Administracion, no asesorar juridicamente al Gobierno (que es la funcion del Consejo de Estado).

**Por que las demas SI forman parte del Pleno:**

- **A)** "El Secretario General". **SI**: art. 4.1.e). El Secretario General asiste a las sesiones del Pleno con voz pero sin voto, y es responsable del funcionamiento administrativo del Consejo.

- **C)** "Los Consejeros permanentes". **SI**: art. 4.1.b). Son los miembros de dedicacion exclusiva que presiden las Secciones del Consejo. Su numero es igual al de Secciones.

- **D)** "Los Consejeros natos". **SI**: art. 4.1.c). Son miembros que lo son en razon de su cargo: Director de la RAE, Presidente del Consejo General de la Abogacia, Fiscal General del Estado, Jefe del Estado Mayor de la Defensa, entre otros (art. 8).

**Composicion del Consejo de Estado en Pleno:**
1. Presidente
2. Consejeros **permanentes** (dedicacion exclusiva, presiden Secciones)
3. Consejeros **natos** (por razon de cargo)
4. Consejeros **electivos** (nombrados por RD por 4 anos)
5. Secretario General

**Clave:** El Defensor del Pueblo no forma parte del Consejo de Estado. Son instituciones constitucionales distintas con funciones diferentes (defensa de derechos vs asesoramiento juridico).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "71a6b8b9-1121-4f1a-a3df-a61c841f4d40");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LO 3/1980 art.4 Consejo Estado Pleno (" + exp3.length + " chars)");
})();
