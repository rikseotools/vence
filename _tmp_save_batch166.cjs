require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.2.2 sector público institucional
  const exp1 = `**Articulo 2.2 de la Ley 39/2015 (LPAC) - Sector publico institucional:**

> Art. 2.2: "El sector publico institucional se integra por:
> a) Cualesquiera **organismos publicos y entidades de derecho publico** vinculados o dependientes de las Administraciones Publicas.
> b) Las **entidades de derecho privado** vinculadas o dependientes de las Administraciones Publicas.
> c) Las **Universidades publicas**."

**Por que B es la respuesta INCORRECTA (no forma parte del sector publico institucional):**
"Los organos colegiados de asistencia" **no** aparecen en el listado del art. 2.2. Los organos colegiados de asistencia son organos internos de las Administraciones Publicas que asesoran o deliberan, pero no constituyen entidades separadas con personalidad juridica propia. No forman parte del sector publico institucional.

**Por que las demas SI forman parte del sector publico institucional:**

- **A)** "Las entidades de derecho **privado** vinculadas o dependientes de las AAPP." **SI**: expresamente incluidas en el art. 2.2.**b**. Ejemplo: sociedades mercantiles publicas, fundaciones del sector publico.

- **C)** "Cualesquiera organismos publicos y entidades de derecho **publico** vinculados o dependientes." **SI**: incluidos en el art. 2.2.**a**. Ejemplo: organismos autonomos, entidades publicas empresariales.

- **D)** "Las **Universidades publicas**." **SI**: incluidas en el art. 2.2.**c**. Las universidades publicas tienen personalidad juridica propia y forman parte del sector publico institucional.

**Sector publico institucional (art. 2.2):**
1. Organismos publicos y entidades de derecho publico
2. Entidades de derecho privado vinculadas a las AAPP
3. Universidades publicas

**Clave:** Los organos colegiados de asistencia NO son parte del sector publico institucional. Son organos internos, no entidades separadas.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e2848cfb-9ace-4682-83d4-5828da98f4cf");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.2 sector publico (" + exp1.length + " chars)");

  // #2 - CE art.53 objeción de conciencia no tutela preferente y sumaria
  const exp2 = `**Articulo 53.2 de la Constitucion Espanola - Proteccion de derechos fundamentales:**

> "Cualquier ciudadano podra recabar la tutela de las libertades y derechos reconocidos en el **articulo 14 y la Seccion primera del Capitulo segundo** ante los Tribunales ordinarios por un procedimiento basado en los principios de **preferencia y sumariedad** y, en su caso, a traves del **recurso de amparo** ante el Tribunal Constitucional. Este ultimo recurso sera aplicable a la **objecion de conciencia** reconocida en el articulo 30."

**Por que D es la afirmacion INCORRECTA (y por tanto la respuesta):**
La objecion de conciencia (art. 30.2 CE) esta en la **Seccion 2.a** del Capitulo II, no en la Seccion 1.a. El art. 53.2 solo otorga el procedimiento de **preferencia y sumariedad** a los derechos del art. 14 y la Seccion 1.a (arts. 15-29). La objecion de conciencia NO goza de este procedimiento preferente ante tribunales ordinarios.

**Por que las demas SI son correctas:**

- **A)** "Vincula a todos los poderes publicos." **Correcto**: el art. 53.1 dice que "los derechos y libertades reconocidos en el **Capitulo segundo** vinculan a todos los poderes publicos". La objecion de conciencia (art. 30.2) esta en el Capitulo II, asi que si vincula a todos los poderes publicos.

- **B)** "Solo por ley podra regularse, respetando su contenido esencial." **Correcto**: tambien del art. 53.1, aplicable a todos los derechos del Capitulo II, incluida la objecion de conciencia.

- **C)** "Es susceptible de recurso de amparo." **Correcto**: el art. 53.2 dice expresamente que el recurso de amparo "sera aplicable a la objecion de conciencia reconocida en el articulo 30". Es una extension especial del amparo mas alla de la Seccion 1.a.

**Proteccion de la objecion de conciencia (art. 30.2):**

| Garantia | Aplicable |
|----------|-----------|
| Vinculacion a poderes publicos (art. 53.1) | SI |
| Reserva de ley + contenido esencial (art. 53.1) | SI |
| **Procedimiento preferente y sumario** (art. 53.2) | **NO** |
| Recurso de amparo ante TC (art. 53.2) | SI (mencion expresa) |

**Clave:** La objecion de conciencia tiene amparo ante el TC pero NO tutela preferente y sumaria ante tribunales ordinarios. Esa tutela reforzada es solo para arts. 14-29.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "b0fad5e7-0f77-4733-82eb-54d744910a3a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.53 objecion conciencia (" + exp2.length + " chars)");
})();
