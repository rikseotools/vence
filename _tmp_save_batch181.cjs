require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.48.3 actuaciones fuera de tiempo solo anulabilidad condicionada
  const exp1 = `**Articulo 48.3 de la Ley 39/2015 (LPAC) - Actuaciones fuera de plazo:**

> "La realizacion de actuaciones administrativas fuera del tiempo establecido para ellas **solo** implicara la anulabilidad del acto cuando asi lo imponga la **naturaleza del termino o plazo**."

**Por que D es correcta (ninguna de las anteriores):**
Las opciones A, B y C son todas incorrectas porque el art. 48.3 establece una regla muy concreta: actuar fuera de plazo **no** implica automaticamente nulidad ni anulabilidad. Solo produce anulabilidad cuando la naturaleza del plazo lo exija (por ejemplo, plazos esenciales cuyo incumplimiento prive de sentido al acto). Ninguna opcion recoge correctamente esta regla.

**Por que las demas son incorrectas:**

- **A)** "Implicara la **nulidad de pleno derecho**." Falso: actuar fuera de plazo **nunca** produce nulidad de pleno derecho. Las causas de nulidad estan tasadas en el art. 47.1, y el incumplimiento de plazos no figura entre ellas. Ademas, la regla general es que actuar fuera de plazo ni siquiera invalida el acto.

- **B)** "Puede implicar la nulidad de pleno derecho, **a criterio del organo tramitador**." Falso por dos motivos: (1) actuar fuera de plazo no produce nulidad en ningun caso; (2) la consecuencia juridica no depende del "criterio" discrecional del organo, sino de la naturaleza objetiva del plazo. La ley no deja esta cuestion a criterio del tramitador.

- **C)** "Implicara **en todo caso** la anulabilidad." Falso: el art. 48.3 dice "**solo**... cuando asi lo imponga la naturaleza del termino o plazo". No es "en todo caso", sino solo cuando la naturaleza del plazo lo exija. La regla general es que actuar fuera de plazo **no** invalida el acto (es una mera irregularidad no invalidante).

**Regla del art. 48.3:**
- Regla general: actuar fuera de plazo = **irregularidad no invalidante**
- Excepcion: anulabilidad **solo** cuando la naturaleza del plazo lo exija
- **Nunca** produce nulidad de pleno derecho

**Clave:** El incumplimiento de plazos es, por regla general, una irregularidad no invalidante. Solo excepcionalmente causa anulabilidad (nunca nulidad).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "efcd2dce-8d34-487f-b558-5cb22b55fa73");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.48.3 fuera plazo (" + exp1.length + " chars)");

  // #2 - Windows F2 renombrar archivo o carpeta
  const exp2 = `**Teclas de funcion en el Explorador de archivos de Windows:**

**Por que C es correcta (F2):**
La tecla **F2** es el atajo de teclado universal en Windows para **renombrar** el elemento seleccionado (archivo o carpeta). Al pulsar F2, el nombre del archivo se vuelve editable, se escribe el nuevo nombre y se confirma con Enter.

**Por que las demas son incorrectas (asignan funciones erroneas a cada tecla):**

- **A)** "Pulsar **F3**". Falso: la tecla F3 abre la **barra de busqueda** en el Explorador de archivos. No activa el modo de renombrado. F3 sirve para buscar archivos, no para renombrarlos.

- **B)** "Pulsar **F1**". Falso: la tecla F1 abre la **ayuda** de Windows (ventana de soporte y asistencia). Es el atajo universal de ayuda en casi todas las aplicaciones, no tiene relacion con renombrar.

- **D)** "Pulsar **F4**". Falso: la tecla F4 activa la **barra de direcciones** del Explorador (permite escribir una ruta directamente). No inicia el renombrado de archivos.

**Teclas de funcion en el Explorador de Windows:**

| Tecla | Funcion |
|-------|---------|
| **F1** | Abrir **ayuda** |
| **F2** | **Renombrar** elemento seleccionado |
| **F3** | Abrir **busqueda** |
| **F4** | Activar **barra de direcciones** |
| **F5** | **Actualizar** la ventana |
| **F11** | Pantalla **completa** |

**Clave:** F2 = Renombrar. Mnemotecnia: F2 es la segunda tecla de funcion, como "segunda oportunidad" para darle un nuevo nombre al archivo.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "31683d18-b1bd-4ddf-a539-1a0cfa87dd15");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Windows F2 renombrar (" + exp2.length + " chars)");
})();
