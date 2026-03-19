require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 4/2001 art.9 inadmisibilidad petición 45 días hábiles
  const exp1 = `**Articulo 9.1 de la LO 4/2001 reguladora del Derecho de Peticion:**

> "La declaracion de inadmisibilidad sera siempre **motivada** y debera acordarse y notificarse al peticionario en los **cuarenta y cinco dias habiles** siguientes al de presentacion del escrito de peticion."

**Por que A es correcta (45 dias habiles):**
El art. 9.1 de la LO 4/2001 establece tres requisitos para la declaracion de inadmisibilidad de una peticion: (1) sera **siempre motivada**, (2) debera acordarse y notificarse en **45 dias habiles** desde la presentacion. La opcion A reproduce fielmente estos datos: "cuarenta y cinco dias habiles".

**Por que las demas son incorrectas (cambian el numero de dias o el tipo):**

- **B)** "Cuarenta dias **naturales**." Falso por dos motivos: (1) son **45** dias, no 40; (2) son dias **habiles**, no naturales. Cambia tanto el numero como el tipo de dias.

- **C)** "Cuarenta dias **habiles**." Falso: acierta en que son dias habiles, pero el numero es **45**, no 40. La diferencia de 5 dias es la trampa mas habitual de esta pregunta.

- **D)** "Cuarenta y cinco dias **naturales**." Falso: acierta en el numero (45), pero el tipo de dias es incorrecto. Son dias **habiles**, no naturales. La diferencia es significativa: 45 dias habiles equivalen aproximadamente a 2 meses, mientras que 45 dias naturales son solo 1 mes y medio.

**Plazos de la LO 4/2001 (Derecho de Peticion):**

| Tramite | Plazo | Tipo |
|---------|-------|------|
| **Inadmisibilidad (art. 9.1)** | **45 dias** | **Habiles** |
| Admision a tramite (art. 9.2) | 45 dias | Habiles |
| Contestacion sustantiva (art. 11.1) | 3 meses | Desde presentacion |

**Clave:** Inadmisibilidad = siempre motivada + 45 dias habiles. Las trampas juegan con cambiar el numero (40 vs 45) o el tipo de dias (habiles vs naturales).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "504ed5cc-72a0-47f0-b573-fb33d35a6464");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 4/2001 art.9 inadmisibilidad 45 dias (" + exp1.length + " chars)");

  // #2 - LECrim art.989 responsabilidad civil ejecución provisional LEC
  const exp2 = `**Articulo 989.1 de la Ley de Enjuiciamiento Criminal:**

> "Los pronunciamientos sobre **responsabilidad civil** seran susceptibles de **ejecucion provisional** con arreglo a lo dispuesto en la **Ley 1/2000, de 7 de enero, de Enjuiciamiento Civil**."

**Por que C es correcta (ejecucion provisional conforme a la LEC):**
El art. 989.1 LECrim establece que los pronunciamientos sobre responsabilidad civil contenidos en sentencias penales si son susceptibles de ejecucion provisional, pero la norma aplicable es la **LEC** (Ley de Enjuiciamiento Civil), no la LECrim. Esto se debe a que la responsabilidad civil, aunque se declare en un proceso penal, tiene naturaleza civil, y su ejecucion provisional sigue las reglas civiles (arts. 524-537 LEC).

**Por que las demas son incorrectas:**

- **A)** "**Nunca** seran susceptibles de ejecucion provisional." Falso: el art. 989.1 dice expresamente que **si** son susceptibles de ejecucion provisional. La palabra "nunca" hace la opcion claramente incorrecta.

- **B)** "Se ejecutaran **exclusivamente** conforme a las disposiciones de la **LECrim**." Falso: el art. 989.1 remite expresamente a la **LEC**, no a la LECrim. Ademas, el art. 989.2 confirma: "En todo lo que no estuviera regulado en el Codigo Penal [...] se aplicaran las disposiciones sobre ejecucion de la Ley 1/2000" (LEC).

- **D)** "Las tercerias de dominio se sustanciaran conforme a la Ley de **Jurisdiccion Voluntaria**." Falso: las tercerias de dominio en ejecucion penal se rigen tambien por la **LEC** (art. 989.2 LECrim), no por la Ley de Jurisdiccion Voluntaria. Las tercerias son procedimientos contenciosos, no de jurisdiccion voluntaria.

**Ejecucion de responsabilidad civil en proceso penal (art. 989 LECrim):**

| Aspecto | Norma aplicable |
|---------|----------------|
| **Ejecucion provisional** | **LEC** (art. 989.1) |
| Ejecucion definitiva (supletoria) | LEC (art. 989.2) |
| Tercerias de dominio | LEC (art. 989.2) |
| Aspectos penales sustantivos | Codigo Penal |

**Clave:** La responsabilidad civil del proceso penal se ejecuta conforme a la LEC, no conforme a la LECrim. Siempre que haya un aspecto civil en el proceso penal, la LEC actua como norma supletoria.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "a7299d4a-5d0d-4c51-971b-d0520f5d20e4");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LECrim art.989 responsabilidad civil LEC (" + exp2.length + " chars)");

  // #3 - Ley 7/1985 art.33 Pleno Diputación NO planes autonómicos
  const exp3 = `**Articulo 33.2 de la Ley 7/1985 (LBRL) - Competencias del Pleno de la Diputacion:**

> "Corresponde en todo caso al Pleno: [...] d) La aprobacion de los planes de caracter **provincial**."

**Por que B es la funcion que NO corresponde al Pleno (planes autonomicos):**
La opcion B dice "planes de caracter **autonomico**". Falso: el art. 33.2.d) LBRL atribuye al Pleno de la Diputacion la aprobacion de planes de caracter **provincial**, no autonomico. Los planes autonomicos corresponden a los organos de la Comunidad Autonoma, no a la Diputacion Provincial. La Diputacion es una entidad local de ambito provincial, por lo que sus competencias se limitan a ese ambito territorial.

**Por que las demas SI corresponden al Pleno:**

- **A)** "El planteamiento de **conflictos de competencia** a otras Entidades Locales y demas Administraciones Publicas." **Correcto**: el art. 33.2.f) LBRL atribuye al Pleno "el planteamiento de conflictos de competencias a otras Entidades locales y demas Administraciones publicas".

- **C)** "La alteracion de la **calificacion juridica** de los bienes de dominio publico." **Correcto**: el art. 33.2.k) LBRL atribuye al Pleno "la alteracion de la calificacion juridica de los bienes de dominio publico".

- **D)** "La aprobacion de las **Ordenanzas**." **Correcto**: el art. 33.2.b) LBRL atribuye al Pleno "la aprobacion de las ordenanzas".

**Competencias del Pleno de la Diputacion (art. 33.2 LBRL):**

| Letra | Competencia |
|-------|-------------|
| a) | Organizacion de la Diputacion |
| b) | **Aprobacion de ordenanzas** |
| c) | Presupuestos, gastos y cuentas |
| d) | Planes de caracter **provincial** (NO autonomico) |
| f) | **Conflictos de competencia** |
| k) | **Alteracion calificacion juridica** bienes dominio publico |

**Clave:** El Pleno aprueba planes de caracter "provincial" (art. 33.2.d). La trampa sustituye "provincial" por "autonomico". La Diputacion es un ente local provincial, no autonomico.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "4729bd87-760b-4a4d-a1f9-43bfd28dcdbe");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LBRL art.33 Pleno Diputacion planes (" + exp3.length + " chars)");
})();
