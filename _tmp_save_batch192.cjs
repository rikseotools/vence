require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Apache no es sistema operativo (es servidor web)
  const exp1 = `**Software: sistemas operativos vs aplicaciones/servicios:**

**Por que C es correcta (Apache NO es un sistema operativo):**
**Apache** (Apache HTTP Server) es un **servidor web**, no un sistema operativo. Es un software que recibe peticiones HTTP y sirve paginas web. Es de codigo abierto (licencia Apache 2.0) y multiplataforma, pero no gestiona hardware ni recursos del ordenador como lo hace un sistema operativo.

**Por que las demas SI son sistemas operativos:**

- **A)** "**Linux**." **Correcto**: Linux es un sistema operativo (o mas precisamente, un nucleo/kernel) de codigo abierto creado por Linus Torvalds en 1991. Sus distribuciones (Ubuntu, Fedora, Debian, etc.) son sistemas operativos completos muy usados en servidores y escritorios.

- **B)** "**UNIX**." **Correcto**: UNIX es un sistema operativo creado en los anos 70 en los laboratorios Bell de AT&T. Es el precursor de muchos sistemas modernos. Variantes de UNIX incluyen macOS, Solaris, AIX y los sistemas BSD.

- **D)** "**Windows**." **Correcto**: Windows es el sistema operativo de Microsoft, el mas utilizado en ordenadores personales. Gestiona el hardware, los procesos, la memoria y proporciona la interfaz grafica al usuario.

**Sistema operativo vs servidor web:**

| Software | Tipo | Funcion |
|----------|------|---------|
| Linux | **Sistema operativo** | Gestiona hardware y recursos |
| UNIX | **Sistema operativo** | Gestiona hardware y recursos |
| Windows | **Sistema operativo** | Gestiona hardware y recursos |
| **Apache** | **Servidor web** | Sirve paginas web (HTTP) |

**Clave:** Apache = servidor web. Linux, UNIX y Windows = sistemas operativos. No confundir: Apache **funciona sobre** un sistema operativo, pero no lo es.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d9ddb546-6984-4eea-8f33-8d03f4aad3b3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Apache no es SO (" + exp1.length + " chars)");

  // #2 - Reglamento Congreso art.146 proposiciones reforma 2 GP o 1/5 diputados
  const exp2 = `**Articulo 146.1 del Reglamento del Congreso - Proposiciones de reforma constitucional:**

> "Los proyectos y proposiciones de reforma constitucional [...] se tramitaran conforme a las normas establecidas en este Reglamento [...], si bien estas deberan ir suscritas por **dos Grupos Parlamentarios** o por **una quinta parte** de los miembros de la Camara."

**Por que D es correcta (2 Grupos Parlamentarios o 1/5 de los Diputados):**
El art. 146.1 exige que las proposiciones de reforma constitucional vayan firmadas por al menos **2 Grupos Parlamentarios** o por **1/5 de los Diputados** (70 de 350). Es un umbral mas exigente que para las proposiciones de ley ordinarias, dado el caracter excepcional de la reforma constitucional.

**Por que las demas son incorrectas:**

- **A)** "**Tres** Grupos Parlamentarios o una **tercera parte** de los Diputados." Falso: el art. 146.1 dice **dos** GP (no tres) y **una quinta parte** (1/5, no 1/3). Ambos datos estan inflados respecto al requisito real.

- **B)** "**Tres** GP o menos si representan la mayoria absoluta." Falso: el art. 146.1 dice dos GP (no tres) y no menciona el criterio de "mayoria absoluta" para reducir el numero de grupos. El requisito es alternativo (2 GP **o** 1/5 diputados), no condicionado a mayorias.

- **C)** "Un GP si ostenta la mayoria simple o los necesarios para alcanzar la mayoria absoluta." Falso: el art. 146.1 no permite que un solo GP presente la proposicion de reforma, independientemente de su tamano. Se exigen **dos** GP como minimo, o alternativamente 1/5 de los diputados.

**Requisitos para proposiciones en el Congreso:**

| Tipo de proposicion | Firmantes necesarios |
|---------------------|---------------------|
| **Reforma constitucional** (art. 146) | **2 GP o 1/5 diputados** |
| Proposicion de ley ordinaria (art. 126) | 1 GP o 15 diputados |

**Clave:** Reforma constitucional = 2 GP o 1/5 diputados. Es mas exigente que la proposicion de ley ordinaria.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "d53e3e47-0356-419a-bc69-4ff49015650e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Reglamento Congreso art.146 (" + exp2.length + " chars)");

  // #3 - CE art.103.3 INCORRECTA "asociación" cuando dice "sindicación"
  const exp3 = `**Articulo 103.3 de la Constitucion Espanola - Estatuto de los funcionarios:**

> "La ley regulara el estatuto de los funcionarios publicos, el acceso a la funcion publica de acuerdo con los principios de **merito y capacidad**, las peculiaridades del ejercicio de su derecho a **sindicacion**, el sistema de **incompatibilidades** y las garantias para la **imparcialidad** en el ejercicio de sus funciones."

**Por que B es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion B dice "derecho de **asociacion**", pero el art. 103.3 CE dice "derecho a **sindicacion**". La trampa sustituye "sindicacion" por "asociacion". Son derechos diferentes: la sindicacion es el derecho a fundar y afiliarse a sindicatos (art. 28 CE), mientras que la asociacion es un derecho mas amplio (art. 22 CE). El art. 103.3 se refiere especificamente a la sindicacion de los funcionarios.

**Por que las demas SI son correctas (reproducen el art. 103.3):**

- **A)** "Se regulara por ley el acceso a la funcion publica de acuerdo con los principios de **merito y capacidad**." **Correcto**: reproduce literalmente el contenido del art. 103.3 CE.

- **C)** "La ley regulara el sistema de **incompatibilidades** de los funcionarios publicos." **Correcto**: el art. 103.3 incluye expresamente las incompatibilidades entre las materias de reserva de ley.

- **D)** "Se regularan por ley las garantias para la **imparcialidad** en el ejercicio de las funciones." **Correcto**: el art. 103.3 menciona las garantias para la imparcialidad como ultima materia de la reserva de ley.

**Contenido del art. 103.3 CE (reserva de ley):**
1. Estatuto de los funcionarios publicos
2. Acceso: **merito y capacidad**
3. Derecho a **sindicacion** (no "asociacion")
4. Sistema de **incompatibilidades**
5. Garantias de **imparcialidad**

**Clave:** El art. 103.3 dice "sindicacion", no "asociacion". Son derechos distintos: sindicacion = sindicatos (art. 28 CE), asociacion = asociaciones en general (art. 22 CE).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "41f8dbce-589b-48b9-ab0a-364a828249af");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.103.3 sindicacion (" + exp3.length + " chars)");
})();
