require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.125 Jurado penales vs civiles
  const exp1 = `**Articulo 125 de la Constitucion Espanola** (Participacion ciudadana en la Justicia):

> "Los ciudadanos podran ejercer la **accion popular** y participar en la Administracion de Justicia mediante la institucion del **Jurado**, en la forma y con respecto a aquellos **procesos penales** que la ley determine, asi como en los **Tribunales consuetudinarios y tradicionales**."

**Por que D es la INCORRECTA:**
La opcion D dice "procesos **civiles**", pero el art. 125 CE dice expresamente "procesos **penales**". El Jurado solo interviene en el ambito penal, no en el civil. Es el cambio clasico de una sola palabra que invalida toda la afirmacion.

**Por que las demas son correctas:**

- **A)** "Ejercer la accion popular". Correcto: el art. 125 CE reconoce expresamente la accion popular, que permite a cualquier ciudadano ejercitar la accion penal aunque no sea perjudicado directo.

- **B)** "Participar en los Tribunales consuetudinarios". Correcto: el art. 125 CE menciona expresamente los Tribunales consuetudinarios (ej: Tribunal de las Aguas de Valencia).

- **C)** "Participar en los Tribunales tradicionales". Correcto: el art. 125 CE menciona tambien los Tribunales tradicionales junto a los consuetudinarios.

**Formas de participacion ciudadana en la Justicia (art. 125 CE):**
| Forma | Ambito |
|-------|--------|
| Accion popular | Proceso penal |
| Jurado | Procesos **penales** |
| Tribunales consuetudinarios | Jurisdiccion especial |
| Tribunales tradicionales | Jurisdiccion especial |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "16e5891c-9103-42e9-a350-65f2ba194fc9");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.125 Jurado (" + exp1.length + " chars)");

  // #2 - RDL 5/2015 art.89.4 excedencia cuidado hijo
  const exp2 = `**Articulo 89.4 del RDL 5/2015 (TREBEP)** - Excedencia por cuidado de hijos:

> "El tiempo de permanencia en esta situacion **sera computable a efectos de trienios, carrera y derechos** en el regimen de Seguridad Social [...] El puesto de trabajo desempenado **se reservara, al menos, durante dos anios**. [...] Los funcionarios en esta situacion **podran participar en los cursos de formacion** que convoque la Administracion."

**Por que D es correcta (ninguna de las anteriores):**
Las tres opciones A, B y C contienen modificaciones sutiles del texto legal que las hacen falsas:

**Por que las demas son incorrectas:**

- **A)** "Derecho a cursos de formacion en el **primer anio** exclusivamente". Falso: el art. 89.4 dice que podran participar en cursos de formacion **sin limitacion temporal**. No restringe este derecho al primer anio ni a ningun periodo concreto. La palabra "exclusivamente" es inventada.

- **B)** "Reserva del puesto **durante tres anios**". Falso: la reserva del puesto es de **al menos dos anios** (art. 89.4), no tres. El periodo maximo de excedencia es de tres anios, pero la reserva del mismo puesto es de dos. Despues de los dos anios, la reserva es a un puesto en la misma localidad y de igual retribucion.

- **C)** "El tiempo **no sera computable** a efectos de promocion ni de trienios". Falso: es exactamente al reves. El art. 89.4 dice que SI sera computable a efectos de trienios, carrera y derechos de Seguridad Social. Esta opcion niega lo que el articulo afirma.

**Derechos durante excedencia por cuidado de hijos (art. 89.4 TREBEP):**
| Aspecto | Regulacion |
|---------|------------|
| Duracion maxima | Hasta 3 anios por hijo |
| Reserva del puesto | Minimo **2 anios** (mismo puesto) |
| Computo trienios | SI computa |
| Computo carrera | SI computa |
| Cursos formacion | SI puede participar (sin limite temporal) |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ef6ec44f-7b6b-4767-8d47-c3317e52163f");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RDL 5/2015 art.89 excedencia (" + exp2.length + " chars)");

  // #3 - CE art.35 derecho al trabajo no es fundamental
  const exp3 = `**Estructura del Titulo I de la Constitucion Espanola** (Derechos y deberes fundamentales):

El Capitulo II del Titulo I se divide en **dos Secciones**:
- **Seccion 1a** (arts. 15-29): **Derechos fundamentales y libertades publicas** (maxima proteccion: recurso de amparo ante el TC)
- **Seccion 2a** (arts. 30-38): **Derechos y deberes de los ciudadanos** (proteccion ordinaria, sin amparo)

**Por que B es correcta:**
El **derecho al trabajo** esta en el **art. 35 CE**, que pertenece a la **Seccion 2a** del Capitulo II. Por tanto, NO es un derecho fundamental en sentido estricto. Es un derecho constitucional, pero no goza de la proteccion reforzada de los derechos fundamentales (no cabe recurso de amparo).

**Por que las demas son incorrectas (SI son derechos fundamentales):**

- **A)** "Derecho a la **educacion**" (art. 27 CE). SI es fundamental: esta en la Seccion 1a (arts. 15-29). Protegido por recurso de amparo.

- **C)** "Derecho de **reunion**" (art. 21 CE). SI es fundamental: esta en la Seccion 1a. Protegido por recurso de amparo y procedimiento preferente y sumario.

- **D)** "Derecho a la **libre sindicacion**" (art. 28.1 CE). SI es fundamental: esta en la Seccion 1a. Protegido por recurso de amparo.

**Ubicacion de cada derecho:**
| Derecho | Articulo | Seccion | Fundamental |
|---------|----------|---------|-------------|
| Educacion | 27 | 1a (15-29) | **SI** |
| Reunion | 21 | 1a (15-29) | **SI** |
| Libre sindicacion | 28.1 | 1a (15-29) | **SI** |
| Trabajo | 35 | 2a (30-38) | **NO** |`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "ec9c8b45-6d7c-4905-843c-862c03ec4b89");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.35 trabajo no fundamental (" + exp3.length + " chars)");
})();
